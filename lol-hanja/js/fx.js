/* 한자 특강(롤 속 한자어) — 이펙트 엔진
 * 푸티지 위에 겹치는 캔버스 파티클(불씨·안개·스파크·빗방울·회오리·베기)과
 * WebAudio로 즉석 합성하는 효과음. 외부 라이브러리 없이 file:// 에서 동작한다.
 */
(function () {
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const PAL = {
    fire: [[255, 196, 92], [255, 140, 40], [255, 98, 24], [255, 226, 150]],
    hex: [[10, 200, 185], [205, 250, 250], [3, 151, 171]],
    gold: [[240, 230, 210], [200, 170, 110], [200, 155, 60]],
    ghost: [[127, 214, 255], [190, 236, 255], [90, 170, 255]],
    mist: [[24, 180, 160], [10, 120, 110], [60, 210, 190]],
    blood: [[232, 64, 87], [255, 90, 90], [180, 20, 40], [255, 170, 150]],
    white: [[255, 255, 255], [255, 244, 214]],
    water: [[170, 214, 255], [220, 240, 255]],
    steam: [[210, 220, 230], [170, 180, 190]],
  };

  let under, top, cu, ct, shaker, flashEl;
  let parts = [], emitters = [], rings = [], slashes = [];
  const sprites = new Map();

  function sprite(c) {
    const key = c.join(',');
    let s = sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${key},1)`);
    gr.addColorStop(0.25, `rgba(${key},.55)`);
    gr.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, s);
    return s;
  }

  /* ---------- 상시(ambient) 이미터 프리셋 ---------- */
  const PRESETS = {
    embers: (o) => ({
      rate: o.rate ?? 36,
      spawn: () => ({
        kind: 'glow', blend: 'lighter',
        x: o.x != null ? o.x + rand(-o.w / 2, o.w / 2) : rand(-40, W + 40),
        y: o.y != null ? o.y + rand(-20, 20) : H + 20,
        vx: rand(-25, 25), vy: rand(-70, -190) * (o.speed ?? 1), ay: -8,
        life: rand(2.5, 6), size: rand(3, 10) * (o.scale ?? 1),
        col: pick(o.colors || PAL.fire), flick: true, sway: rand(10, 50), ph: rand(0, TAU),
        top: o.top,
      }),
    }),
    motes: (o) => ({
      rate: o.rate ?? 14,
      spawn: () => ({
        kind: 'glow', blend: 'lighter',
        x: rand(0, W), y: rand(0, H), vx: rand(-12, 12), vy: rand(-28, -4),
        life: rand(4, 9), size: rand(2, 7), col: pick(o.colors || PAL.hex), twinkle: rand(2, 6), ph: rand(0, TAU),
        alpha: o.alpha ?? 0.9,
      }),
    }),
    mist: (o) => ({
      rate: o.rate ?? 2.6,
      spawn: () => ({
        kind: 'mist', blend: o.blend || 'screen',
        x: rand(-200, W + 200), y: o.y != null ? o.y + rand(-160, 160) : rand(H * 0.25, H + 120),
        vx: rand(-18, 18) + (o.drift ?? 0), vy: rand(-14, -2),
        life: rand(8, 15), size: rand(280, 560), col: pick(o.colors || PAL.ghost), alpha: o.alpha ?? 0.1,
      }),
      prewarm: 6,
    }),
    rain: (o) => ({
      rate: o.rate ?? 170,
      spawn: () => ({
        kind: 'drop', blend: 'lighter',
        x: rand(-120, W), y: rand(-80, -20), vx: 140, vy: rand(1500, 2000),
        life: 1.4, len: rand(18, 38), col: pick(PAL.water), alpha: 0.55, floor: rand(H * 0.45, H), top: o.top,
      }),
    }),
    steam: (o) => ({
      rate: o.rate ?? 10,
      spawn: () => ({
        kind: 'mist', blend: 'screen',
        x: o.x + rand(-o.w / 2, o.w / 2), y: o.y + rand(-30, 30), vx: rand(-30, 30), vy: rand(-90, -40),
        grow: 90, life: rand(2, 4), size: rand(80, 180), col: pick(PAL.steam), alpha: o.alpha ?? 0.16, top: o.top,
      }),
    }),
    vortex: (o) => ({
      rate: o.rate ?? 34,
      spawn: () => ({
        kind: 'orbit', blend: 'lighter',
        cx: o.x, cy: o.y, r: rand(o.r0 ?? 90, o.r1 ?? 460), a: rand(0, TAU), w: rand(2.2, 4.4) * (o.dir ?? 1),
        dr: rand(-20, 30), life: rand(0.9, 2.2), col: pick(o.colors || PAL.blood), width: rand(1.5, 4), arc: rand(0.25, 0.7),
      }),
    }),
    ash: (o) => ({
      rate: o.rate ?? 18,
      spawn: () => ({
        kind: 'glow', blend: 'source-over',
        x: rand(0, W), y: rand(-40, H * 0.6), vx: rand(10, 40), vy: rand(15, 50),
        life: rand(5, 9), size: rand(2, 5), col: pick(o.colors || [[30, 40, 45], [60, 70, 70]]), alpha: o.alpha ?? 0.6,
      }),
    }),
  };

  function setAmbient(list) {
    emitters = [];
    (list || []).forEach(([name, opts]) => addAmbient(name, opts));
  }
  function addAmbient(name, opts = {}) {
    const e = PRESETS[name](opts);
    e.name = name;
    e.acc = 0;
    emitters.push(e);
    // 장면에 들어서자마자 텅 빈 화면이 되지 않도록 미리 채워 둔다
    const warm = e.prewarm ?? opts.prewarm ?? 0;
    for (let t = 0; t < warm; t += 0.25) {
      for (let k = 0; k < e.rate * 0.25; k++) {
        const p = e.spawn();
        init(p);
        const age = rand(0, Math.min(t, p.life * 0.8));
        p.x += p.vx * age; p.y += p.vy * age; p.age = age;
        parts.push(p);
      }
    }
    return e;
  }
  function stopAmbient(name) { emitters = emitters.filter((e) => e.name !== name); }

  function init(p) {
    p.age = p.age || 0;
    p.ax = p.ax || 0; p.ay = p.ay || 0;
    p.drag = p.drag ?? 1;
    p.alpha = p.alpha ?? 1;
    return p;
  }

  /* ---------- 일회성 효과 ---------- */
  function sparks(x, y, o = {}) {
    const n = o.n ?? 60;
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rand(-(o.spread ?? 0.6), o.spread ?? 0.6) : rand(0, TAU);
      const sp = rand(...(o.speed || [250, 950]));
      parts.push(init({
        kind: 'streak', blend: 'lighter', top: o.top ?? true,
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: o.gravity ?? 700, drag: o.drag ?? 0.9,
        life: rand(...(o.life || [0.35, 0.9])), width: rand(1.5, 3.5), col: pick(o.colors || PAL.fire),
      }));
    }
    if (o.glow !== false) {
      for (let i = 0; i < (o.glowN ?? 14); i++) {
        const a = rand(0, TAU), sp = rand(30, 220);
        parts.push(init({
          kind: 'glow', blend: 'lighter', top: o.top ?? true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.92,
          life: rand(0.4, 1.1), size: rand(20, 70), col: pick(o.colors || PAL.fire), alpha: 0.7,
        }));
      }
    }
  }

  function ring(x, y, o = {}) {
    rings.push({ x, y, r0: o.r0 ?? 10, r1: o.r1 ?? 320, dur: o.dur ?? 0.7, t: 0, width: o.width ?? 8, col: o.col || [255, 255, 255], top: o.top ?? true, delay: o.delay ?? 0 });
  }

  // 화면 전체 섬광 (DOM 오버레이)
  function flash(color = '#fff', ms = 320, alpha = 0.9) {
    if (!flashEl) return;
    flashEl.style.transition = 'none';
    flashEl.style.background = color;
    flashEl.style.opacity = alpha;
    void flashEl.offsetWidth;
    flashEl.style.transition = `opacity ${ms}ms cubic-bezier(.2,.6,.3,1)`;
    flashEl.style.opacity = 0;
  }

  let shakeT = 0, shakeDur = 0, shakeAmp = 0;
  function shake(amp = 14, dur = 0.45) { shakeAmp = amp; shakeDur = dur; shakeT = dur; }

  // 베기 궤적: pts = [[x0,y0],[cx,cy],[x1,y1]] 이차 베지어
  function slash(o) {
    slashes.push({ pts: o.pts, col: o.col || [255, 244, 214], glow: o.glow || [255, 196, 92], width: o.width ?? 22, dur: o.dur ?? 0.28, hold: o.hold ?? 0.45, t: 0, delay: o.delay ?? 0 });
  }

  function clear(all) {
    emitters = [];
    if (all) { parts = []; rings = []; slashes = []; }
  }

  /* ---------- 루프 ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    for (const e of emitters) {
      e.acc += e.rate * dt;
      while (e.acc >= 1) { e.acc -= 1; parts.push(init(e.spawn())); }
    }

    cu.clearRect(0, 0, W, H);
    ct.clearRect(0, 0, W, H);

    // 파티클
    const alive = [];
    for (const p of parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      alive.push(p);
      p.vx = (p.vx + p.ax * dt) * Math.pow(p.drag, dt * 60);
      p.vy = (p.vy + p.ay * dt) * Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const ctx = p.top ? ct : cu;
      const k = p.age / p.life;
      let a = p.alpha * Math.min(1, p.age / 0.25) * (1 - k);
      if (p.flick) a *= 0.65 + 0.35 * Math.sin(p.age * 18 + p.ph);
      if (p.twinkle) a *= 0.5 + 0.5 * Math.sin(p.age * p.twinkle + p.ph);
      if (a <= 0.003) continue;
      ctx.globalCompositeOperation = p.blend || 'lighter';
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.kind === 'glow') {
        const sx = p.sway ? Math.sin(p.age * 2 + p.ph) * p.sway * dt * 10 : 0;
        p.x += sx;
        const s = p.size * (p.flick ? 1 - k * 0.5 : 1);
        ctx.drawImage(sprite(p.col), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.kind === 'mist') {
        const s = p.size + (p.grow || 0) * p.age;
        ctx.globalAlpha = clamp(p.alpha * Math.sin(Math.PI * k), 0, 1);
        ctx.drawImage(sprite(p.col), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.kind === 'streak') {
        ctx.strokeStyle = `rgb(${p.col.join(',')})`;
        ctx.lineWidth = p.width * (1 - k * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.kind === 'drop') {
        if (p.y > p.floor) {
          p.age = p.life;
          if (Math.random() < 0.35) parts.push(init({ kind: 'glow', blend: 'lighter', x: p.x, y: p.floor, vx: rand(-60, 60), vy: rand(-120, -40), ay: 500, life: 0.3, size: rand(3, 6), col: PAL.water[1], alpha: 0.6, top: p.top }));
          continue;
        }
        ctx.strokeStyle = `rgb(${p.col.join(',')})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const n = Math.hypot(p.vx, p.vy);
        ctx.moveTo(p.x - (p.vx / n) * p.len, p.y - (p.vy / n) * p.len);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.kind === 'orbit') {
        p.a += p.w * dt;
        p.r += p.dr * dt;
        ctx.strokeStyle = `rgb(${p.col.join(',')})`;
        ctx.lineWidth = p.width * Math.sin(Math.PI * k);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const dir = Math.sign(p.w);
        ctx.ellipse(p.cx, p.cy, p.r, p.r * 0.42, 0, p.a - p.arc * dir, p.a, dir < 0);
        ctx.stroke();
      }
    }
    parts = alive;
    cu.globalAlpha = ct.globalAlpha = 1;

    // 충격파 고리
    rings = rings.filter((r) => {
      if (r.delay > 0) { r.delay -= dt; return true; }
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) return false;
      const e = 1 - Math.pow(1 - k, 3);
      const ctx = r.top ? ct : cu;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${r.col.join(',')},${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, (r.r0 + (r.r1 - r.r0) * e) * 0.55, 0, 0, TAU);
      ctx.stroke();
      return true;
    });

    // 베기 궤적
    slashes = slashes.filter((s) => {
      if (s.delay > 0) { s.delay -= dt; return true; }
      s.t += dt;
      if (s.t > s.dur + s.hold) return false;
      const head = clamp(s.t / s.dur, 0, 1);
      const fade = clamp((s.t - s.dur) / s.hold, 0, 1);
      const [p0, p1, p2] = s.pts;
      const N = 40;
      const tail = Math.max(0, head - 0.75 - fade * 0.25);
      const ctx = ct;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) {
          const u0 = tail + ((head - tail) * i) / N, u1 = tail + ((head - tail) * (i + 1)) / N;
          const q = (u) => [
            (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
            (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1],
          ];
          const [ax, ay] = q(u0), [bx, by] = q(u1);
          const taper = Math.sin(Math.PI * (i / N));
          const w = s.width * taper * (1 - fade);
          if (w < 0.3) continue;
          ctx.strokeStyle = pass === 0 ? `rgba(${s.glow.join(',')},${0.35 * (1 - fade)})` : `rgba(${s.col.join(',')},${1 - fade})`;
          ctx.lineWidth = pass === 0 ? w * 3 : w * 0.45;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
      return true;
    });
    cu.globalCompositeOperation = ct.globalCompositeOperation = 'source-over';

    // 화면 흔들림
    if (shakeT > 0) {
      shakeT -= dt;
      const k = Math.max(0, shakeT / shakeDur);
      shaker.style.transform = `translate(${rand(-1, 1) * shakeAmp * k}px,${rand(-1, 1) * shakeAmp * k}px)`;
      if (shakeT <= 0) shaker.style.transform = '';
    }

    requestAnimationFrame(frame);
  }

  /* ---------- 효과음 (WebAudio 즉석 합성) ---------- */
  const SFX = (() => {
    let ac, master, enabled = true, noiseBuf;
    function ensure() {
      if (ac) return ac;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.32;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ac;
    }
    const env = (g, t, a, peak, d) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    function noise(t, dur, type, f0, f1, peak, q = 1) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, 0.01, peak, dur);
      s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
    }
    function tone(t, dur, type, f0, f1, peak, a = 0.005) {
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, a, peak, dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    const SOUNDS = {
      flash: (t) => { tone(t, 0.18, 'sine', 700, 2600, 0.5); noise(t, 0.25, 'highpass', 3000, 8000, 0.35); tone(t + 0.02, 0.4, 'triangle', 1800, 900, 0.12); },
      boom: (t) => { tone(t, 0.6, 'sine', 140, 38, 0.9); noise(t, 0.35, 'lowpass', 900, 120, 0.4); },
      crack: (t) => { for (let i = 0; i < 4; i++) noise(t + i * 0.035 + Math.random() * 0.02, 0.06, 'bandpass', 2600 - i * 300, 1200, 0.5, 3); tone(t, 0.25, 'sine', 220, 60, 0.3); },
      whoosh: (t) => noise(t, 0.7, 'bandpass', 300, 2400, 0.4, 1.4),
      fire: (t) => { noise(t, 1.2, 'lowpass', 1600, 300, 0.45); noise(t, 0.3, 'bandpass', 900, 3000, 0.25, 2); tone(t, 0.5, 'sine', 90, 50, 0.4); },
      ghost: (t) => { tone(t, 1.4, 'sine', 520, 380, 0.12, 0.2); tone(t + 0.03, 1.4, 'sine', 528, 392, 0.1, 0.2); noise(t, 1.0, 'bandpass', 600, 2400, 0.12, 4); },
      slash: (t) => { noise(t, 0.22, 'highpass', 1500, 7000, 0.55); tone(t + 0.05, 0.5, 'triangle', 2400, 1700, 0.08); },
      ding: (t) => { tone(t, 0.9, 'sine', 1320, 1318, 0.18); tone(t, 0.7, 'sine', 1980, 1975, 0.08); },
      chord: (t) => { [660, 830, 990, 1320].forEach((f, i) => tone(t + i * 0.07, 1.4, 'sine', f, f, 0.1)); },
      glitch: (t) => { for (let i = 0; i < 7; i++) tone(t + i * 0.04, 0.035, 'square', rand(120, 1600), rand(120, 1600), 0.12); },
      heart: (t) => { tone(t, 0.18, 'sine', 70, 40, 0.9); tone(t + 0.24, 0.16, 'sine', 64, 38, 0.6); },
      ping: (t) => { tone(t, 0.12, 'square', 880, 880, 0.08); tone(t + 0.13, 0.22, 'square', 660, 660, 0.08); },
      hiss: (t) => noise(t, 1.6, 'highpass', 2500, 5000, 0.25),
    };
    return {
      unlock() { ensure() && ac.state === 'suspended' && ac.resume(); },
      set enabled(v) { enabled = v; },
      get enabled() { return enabled; },
      play(name, delay = 0) {
        if (!enabled || !ensure() || ac.state !== 'running' || !SOUNDS[name]) return;
        SOUNDS[name](ac.currentTime + delay);
      },
    };
  })();

  window.FX = {
    PAL, W, H,
    init(stageEl) {
      under = stageEl.querySelector('#fx');
      top = stageEl.querySelector('#fxTop');
      shaker = stageEl.querySelector('#shaker');
      flashEl = stageEl.querySelector('#flash');
      for (const c of [under, top]) { c.width = W; c.height = H; }
      cu = under.getContext('2d');
      ct = top.getContext('2d');
      requestAnimationFrame(frame);
    },
    setAmbient, addAmbient, stopAmbient, sparks, ring, flash, shake, slash, clear,
    SFX,
  };
})();
