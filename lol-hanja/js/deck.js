/* 협곡의 한자 — 덱 컨트롤러
 * 장면 전환 · 단계(빌드) 공개 · 영상 큐에 맞춘 이펙트 · 발표자 노트/목차.
 * 주소 끝의 #장면.단계 (예: #9.2) 로 바로 이동할 수 있다.
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const P = FX.PAL;
  const sfx = (n, d) => FX.SFX.play(n, d);

  const stage = $('#stage');
  const scenes = $$('.scene');
  let cur = -1, step = 0, unlocked = false, soundOn = true;
  let timers = [];
  let cue = { t: -1, fired: new Set() };

  /* ---------- 준비 ---------- */
  function renderGlyphs() {
    $$('i.g[data-g]').forEach((el) => {
      const d = window.GLYPHS[el.dataset.g];
      if (!d) { console.warn('glyph missing:', el.dataset.g); return; }
      const extra = [...el.classList].filter((c) => c !== 'g').join(' ');
      el.outerHTML = `<svg class="glyph ${extra}" viewBox="${d.vb}" aria-hidden="true">${d.svg}</svg>`;
    });
    $$('svg.glyph path').forEach((p) => p.setAttribute('pathLength', '1'));
  }

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px,${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
  }

  // 화면 요소 → 스테이지(1920×1080) 좌표
  function toStage(x, y) {
    const r = stage.getBoundingClientRect();
    const s = r.width / 1920;
    return [(x - r.left) / s, (y - r.top) / s];
  }
  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return toStage(r.left + r.width / 2, r.top + r.height / 2);
  }
  // 영상 안의 정규화 좌표(0~1) → 스테이지 좌표 (object-fit: cover + 확대 반영)
  function vpt(v, nx, ny) {
    const r = v.getBoundingClientRect();
    const vw = v.videoWidth || 1056, vh = v.videoHeight || 720;
    const k = Math.max(r.width / vw, r.height / vh);
    const dw = vw * k, dh = vh * k;
    return toStage(r.left + (r.width - dw) / 2 + nx * dw, r.top + (r.height - dh) / 2 + ny * dh);
  }

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  function clearTimers() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; }

  // 같은 상시 효과를 단계마다 다시 깔지 않도록 이름으로 기억
  function ambient(sc, key, list) {
    if (sc._amb === key) return;
    sc._amb = key;
    FX.setAmbient(list);
  }

  /* ---------- 장면별 훅 ---------- */
  const HOOKS = {
    title: {
      enter() { FX.setAmbient([['motes', { rate: 22, colors: [...P.hex, ...P.gold] }], ['embers', { rate: 8, colors: P.gold, scale: 0.8 }]]); },
    },
    hook: {
      enter() { FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]); },
    },
    oracle: {
      enter() {
        FX.setAmbient([['motes', { rate: 8, colors: P.gold }]]);
        later(() => { FX.crack(1180, 720, { arms: 3, len: 320 }); FX.crack(1650, 820, { arms: 2, len: 260, delay: 0.4 }); sfx('crack'); }, 700);
        later(() => { FX.crack(1420, 160, { arms: 2, len: 220 }); sfx('crack'); }, 2200);
      },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          const [x, y] = centerOf($('[data-step="1"] .gbox', sc));
          FX.crack(x - 150, y + 260, { shape: 'bu', len: 200, top: false, width: 4 });
          FX.sparks(x, y, { n: 36, colors: P.gold, speed: [120, 520] });
          sfx('crack');
        }
        if (n === 2) { FX.sparks(...centerOf($('[data-step="2"] .gbox', sc)), { n: 30, colors: P.gold, speed: [100, 420] }); sfx('ding'); }
        if (n === 3) sfx('whoosh');
      },
    },
    ch1: {
      enter() { FX.setAmbient([['motes', { rate: 16, colors: [...P.hex, ...P.gold] }]]); sfx('whoosh'); },
      step(sc, n, dir) { if (dir > 0) sfx('ding'); },
    },
    flash: {
      enter(sc) { FX.setAmbient([['motes', { rate: 6, colors: P.gold }]]); later(() => sc.classList.add('hit'), 2800); },
      cues: [{ t: 2.05, fn(sc, v) {
        const a = vpt(v, 0.81, 0.32), b = vpt(v, 0.66, 0.68);
        FX.sparks(...a, { n: 40, colors: P.gold, speed: [120, 520] });
        FX.ring(...b, { col: [255, 240, 190], r1: 280 });
        FX.sparks(...b, { n: 80, colors: [...P.white, ...P.gold], speed: [200, 900] });
        FX.flash('#fff', 420, 0.8);
        FX.shake(10, 0.35);
        sfx('flash');
        sc.classList.add('hit');
      } }],
      step(sc, n, dir) { if (dir > 0) sfx(n === 1 ? 'ding' : 'whoosh'); },
    },
    dian: {
      enter() { FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1 || n === 2) sfx('ding');
        if (n === 3) {
          const ink = $('.ink', sc);
          ink.classList.remove('go'); void ink.offsetWidth; ink.classList.add('go');
          later(() => {
            const [x, y] = centerOf($('.gcol.hero .gbox', sc));
            FX.ring(x, y, { col: [255, 210, 122], r1: 210 });
            FX.sparks(x, y, { n: 40, colors: P.gold, speed: [120, 600] });
            FX.shake(6, 0.25);
            sfx('boom');
          }, 480);
        }
        if (n === 4) sfx('whoosh');
      },
    },
    mie: {
      enter(sc) { sc._amb = null; FX.setAmbient([]); },
      step(sc, n, dir) {
        if (n === 0) ambient(sc, 'none', []);
        else if (n < 3) ambient(sc, 'fire', [['embers', { rate: 70, x: 960, w: 1500, y: 1080, speed: 1.3, scale: 1.3 }]]);
        else ambient(sc, 'rain', [['rain', { rate: 220 }], ['steam', { x: 960, y: 980, w: 1600, rate: 16 }]]);
        if (dir < 0) return;
        if (n === 1) sfx('fire');
        if (n === 2) { FX.sparks(...centerOf($('.flow5 [data-step="2"] .gbox', sc)), { n: 50, colors: P.fire }); sfx('crack'); }
        if (n === 3) { FX.flash('#9fd0ff', 600, 0.25); sfx('hiss'); }
        if (n === 4) sfx('ding');
      },
    },
    blink: {
      enter() { FX.setAmbient([['motes', { rate: 8, colors: P.gold }]]); },
      cues: [{ t: 2.05, fn(sc, v) {
        const b = vpt(v, 0.66, 0.68);
        FX.ring(...b, { col: [255, 240, 190], r1: 240 });
        FX.flash('#fff', 380, 0.6);
        sfx('flash');
      } }],
      step(sc, n, dir) { if (dir > 0) sfx('ding'); },
    },
    ignite: {
      enter(sc) {
        sc._burning = false;
        FX.setAmbient([['embers', { rate: 12 }]]);
        later(() => sc.classList.add('hit'), 3200);
      },
      cues: [{ t: 2.6, fn(sc, v) {
        const p = vpt(v, 0.74, 0.64);
        FX.sparks(...p, { n: 100, colors: P.fire, speed: [200, 1100] });
        FX.ring(...p, { col: [255, 140, 40], r1: 320, width: 12 });
        FX.flash('#ff7a1a', 520, 0.35);
        FX.shake(8, 0.3);
        sfx('fire');
        sc.classList.add('hit', 'heating');
        later(() => sc.classList.remove('heating'), 2400);
        if (!sc._burning) { sc._burning = true; FX.addAmbient('embers', { rate: 34, x: p[0], w: 420, y: p[1] + 40, speed: 0.8 }); }
      } }],
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 2) { FX.sparks(...centerOf($('.stamp', sc)), { n: 60, colors: P.fire }); sfx('fire'); } else sfx('ding');
      },
    },
    huo: {
      enter() { FX.setAmbient([['embers', { rate: 26 }]]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          const [x, y] = centerOf($('.answer .gbox', sc));
          FX.sparks(x, y, { n: 90, colors: P.fire, speed: [200, 900] });
          FX.ring(x, y, { col: [255, 150, 50], r1: 220 });
          sfx('fire');
        }
        if (n === 2) sfx('ding');
        if (n === 3) sfx('whoosh');
      },
    },
    ghost: {
      enter(sc) { sc._mist = false; FX.setAmbient([['motes', { rate: 8, colors: P.ghost }]]); later(() => sc.classList.add('hit'), 4300); },
      cues: [{ t: 3.7, fn(sc, v) {
        const p = vpt(v, 0.59, 0.5);
        FX.ring(...p, { col: [127, 214, 255], r1: 360, width: 10 });
        FX.sparks(...p, { n: 50, colors: P.ghost, gravity: -60, speed: [60, 320], life: [0.8, 1.6] });
        FX.flash('#9fe8ff', 480, 0.3);
        sfx('ghost');
        sc.classList.add('hit');
        if (!sc._mist) { sc._mist = true; FX.addAmbient('mist', { colors: P.ghost, alpha: 0.09, rate: 3 }); }
      } }],
      step(sc, n, dir) { if (dir > 0) sfx(n === 1 ? 'ghost' : 'whoosh'); },
    },
    you: {
      enter() { FX.setAmbient([['mist', { colors: P.ghost, alpha: 0.08, rate: 2.4 }], ['motes', { rate: 10, colors: P.ghost }]]); },
      step(sc, n, dir) {
        sc.classList.toggle('morph', n >= 1);
        if (dir < 0) return;
        if (n === 1) { FX.sparks(...centerOf($('.recon .gbox', sc)), { n: 40, colors: [...P.fire, ...P.gold], speed: [100, 500] }); sfx('ghost'); }
        if (n === 2) sfx('ding');
      },
    },
    tihua: {
      enter() { FX.setAmbient([['mist', { colors: P.ghost, alpha: 0.07, rate: 2 }]]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('ding');
        if (n === 2) sfx('whoosh');
        if (n === 3) { sfx('ghost'); FX.flash('#9fe8ff', 500, 0.2); }
      },
    },
    quick: {
      enter() { FX.setAmbient([['motes', { rate: 12, colors: P.hex }]]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        FX.sparks(...centerOf($(`[data-reveal="${n}"]`, sc)), { n: 34, colors: P.hex, speed: [100, 480], gravity: 200 });
        sfx('ding');
      },
    },
    ch2: {
      enter() { FX.setAmbient([['mist', { colors: P.mist, alpha: 0.12, rate: 3 }], ['motes', { rate: 12, colors: P.hex }]]); sfx('whoosh'); },
    },
    botrk: {
      enter() { FX.setAmbient([['mist', { colors: P.mist, alpha: 0.1, rate: 2.6 }], ['motes', { rate: 10, colors: P.hex }]]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('ding');
        if (n === 2) { stage.classList.add('glitching'); setTimeout(() => stage.classList.remove('glitching'), 420); sfx('glitch'); }
      },
    },
    vs: {
      enter() { FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]); sfx('boom'); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          FX.slash({ pts: [[1060, 820], [1420, 120], [1880, 360]], width: 26 });
          later(() => FX.sparks(1880, 360, { n: 40, colors: P.gold }), 260);
          sfx('slash');
        }
        if (n === 2) sfx('ding');
        if (n === 3) {
          FX.slash({ pts: [[60, 560], [480, 520], [900, 480]], width: 18, dur: 0.18, col: [220, 250, 255], glow: [120, 200, 255] });
          later(() => { FX.ring(900, 480, { col: [200, 240, 255], r1: 160 }); FX.sparks(900, 480, { n: 40, colors: P.white, angle: 0, spread: 0.7 }); }, 180);
          FX.shake(8, 0.25);
          sfx('slash');
        }
        if (n === 4) sfx('ding');
        if (n === 5) sfx('chord');
      },
    },
    rift: {
      enter() { FX.setAmbient([['motes', { rate: 8, colors: P.gold }]]); },
      step(sc, n, dir) { if (dir > 0) sfx('ding'); },
    },
    dd: {
      enter(sc) {
        const v = $('video.main', sc);
        later(() => {
          const [x, y] = vpt(v, 0.71, 0.45);
          FX.setAmbient([['vortex', { x, y, rate: 30 }], ['embers', { rate: 14, colors: P.blood }]]);
        }, 60);
      },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 2) sfx('ding');
        if (n === 1) {
          const [x, y] = centerOf($('.shatter', sc));
          FX.sparks(x, y, { n: 120, colors: P.blood, speed: [300, 1300] });
          FX.ring(x, y, { col: [232, 64, 87], r1: 300, width: 12 });
          FX.flash('#e84057', 500, 0.35);
          FX.shake(14, 0.4);
          stage.classList.add('glitching'); setTimeout(() => stage.classList.remove('glitching'), 420);
          sfx('glitch'); sfx('boom', 0.05);
        }
      },
    },
    wudao: {
      enter() { FX.setAmbient([['vortex', { x: 1500, y: 760, r0: 120, r1: 360, rate: 12 }], ['embers', { rate: 8, colors: P.blood }]]); },
      step(sc, n, dir) { if (dir > 0) sfx(n === 3 ? 'chord' : 'ding'); },
    },
    three: {
      enter() { FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        const [x, y] = centerOf($(`.tcard[data-step="${n}"]`, sc));
        if (n === 1) { FX.slash({ pts: [[x - 240, y + 200], [x - 40, y - 60], [x + 240, y - 220]], width: 20 }); sfx('slash'); }
        if (n === 2) { FX.sparks(x, y, { n: 40, colors: P.gold, speed: [100, 500] }); sfx('ding'); }
        if (n === 3) { FX.ring(x, y + 120, { col: [232, 64, 87], r1: 260 }); FX.sparks(x, y + 120, { n: 50, colors: P.blood, speed: [100, 600] }); sfx('boom'); }
      },
    },
    bonus: {
      enter() { FX.setAmbient([['embers', { rate: 18, colors: P.blood }]]); sfx('heart'); later(() => sfx('heart'), 900); },
    },
    gank: {
      enter(sc) {
        FX.setAmbient([['embers', { rate: 8, colors: P.blood }]]);
        const box = $('.pings', sc);
        const ping = () => {
          const el = document.createElement('div');
          el.className = 'ping';
          el.style.left = 160 + Math.random() * 760 + 'px';
          el.style.top = 220 + Math.random() * 600 + 'px';
          el.innerHTML = '<b>!</b>';
          box.appendChild(el);
          setTimeout(() => el.remove(), 1800);
          sfx('ping');
        };
        later(ping, 500);
        every(ping, 1900);
        every(() => sfx('heart'), 1900);
      },
      step(sc, n, dir) { if (dir > 0) sfx(n === 1 ? 'whoosh' : 'ding'); },
    },
    roam: {
      enter(sc) {
        FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]);
        const run = () => {
          const m = $('animateMotion', sc);
          try { m.beginElement(); } catch (e) { /* SMIL 미지원 브라우저 */ }
          later(() => {
            const [x, y] = centerOf($('.mm-champ.foe', sc));
            FX.ring(x, y, { col: [255, 210, 120], r1: 90, width: 5 });
            FX.sparks(x, y, { n: 26, colors: P.gold, speed: [80, 360] });
          }, 2300);
        };
        later(run, 900);
        every(run, 4600);
      },
      step(sc, n, dir) { if (dir > 0) sfx(n === 4 ? 'chord' : 'whoosh'); },
    },
    quiz: {
      enter() { FX.setAmbient([['motes', { rate: 10, colors: P.gold }]]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        FX.sparks(...centerOf($(`.a[data-step="${n}"]`, sc)), { n: 40, colors: P.gold, speed: [100, 500] });
        sfx('ding');
      },
    },
    finale: {
      enter() {
        FX.setAmbient([['motes', { rate: 18, colors: P.gold }], ['embers', { rate: 10, colors: P.gold }]]);
        later(() => sfx('chord'), 900);
      },
      step(sc, n, dir) {
        if (dir < 0 || n !== 1) return;
        const [x, y] = centerOf($('.gg', sc));
        FX.flash('#fff3d0', 600, 0.6);
        FX.ring(x, y, { col: [240, 210, 140], r1: 520, width: 14 });
        FX.sparks(x, y, { n: 160, colors: P.gold, speed: [300, 1400] });
        FX.shake(10, 0.35);
        sfx('boom'); sfx('chord', 0.1);
      },
    },
    credits: { enter() { FX.setAmbient([]); } },
  };
  const hook = (sc, name, ...a) => { const h = HOOKS[sc.dataset.id]; h && h[name] && h[name](sc, ...a); };

  /* ---------- 진행 ---------- */
  function maxStep(sc) {
    let m = 0;
    $$('[data-step]', sc).forEach((e) => (m = Math.max(m, +e.dataset.step)));
    $$('[data-reveal]', sc).forEach((e) => (m = Math.max(m, +e.dataset.reveal)));
    return m;
  }
  function applyStep(sc, n) {
    $$('[data-step]', sc).forEach((e) => e.classList.toggle('on', n >= +e.dataset.step));
    $$('[data-reveal]', sc).forEach((e) => e.classList.toggle('on', n >= +e.dataset.reveal));
    $$('[data-until]', sc).forEach((e) => e.classList.toggle('gone', n >= +e.dataset.until));
  }

  function setAudio(sc) {
    $$('video', sc).forEach((v) => { v.muted = !(unlocked && soundOn && v.hasAttribute('data-audio')); });
  }
  function playScene(sc) {
    setAudio(sc);
    $$('video', sc).forEach((v) => {
      try { v.currentTime = 0; } catch (e) { /* 아직 메타데이터 없음 */ }
      const p = v.play();
      p && p.catch(() => {});
    });
  }

  function transition(kind) {
    if (kind === 'flash') { FX.flash('#ffffff', 600, 0.8); sfx('whoosh'); }
    else if (kind === 'burn') { FX.flash('#ff8a2a', 700, 0.55); sfx('fire'); }
    else if (kind === 'glitch') { stage.classList.add('glitching'); setTimeout(() => stage.classList.remove('glitching'), 450); sfx('glitch'); }
  }

  function go(i, s = 0, dir = 1) {
    i = Math.max(0, Math.min(scenes.length - 1, i));
    const sc = scenes[i];
    if (i !== cur) {
      const old = scenes[cur];
      if (old) { old.classList.remove('active', 'hit', 'heating', 'morph'); $$('video', old).forEach((v) => v.pause()); hook(old, 'leave'); }
      clearTimers();
      FX.clear();
      cur = i;
      sc._amb = null;
      sc.classList.remove('hit', 'heating', 'morph');
      sc.classList.add('active');
      playScene(sc);
      if (unlocked) transition(sc.dataset.trans);
      cue = { t: -1, fired: new Set() };
      hook(sc, 'enter');
    }
    step = Math.max(0, Math.min(maxStep(sc), s));
    applyStep(sc, step);
    hook(sc, 'step', step, dir);
    updateHud();
  }
  const next = () => (step < maxStep(scenes[cur]) ? go(cur, step + 1, 1) : cur < scenes.length - 1 && go(cur + 1, 0, 1));
  const prev = () => (step > 0 ? go(cur, step - 1, -1) : cur > 0 && go(cur - 1, maxStep(scenes[cur - 1]), -1));
  function replay() { const i = cur; cur = -1; scenes[i].classList.remove('active'); void scenes[i].offsetWidth; go(i, 0, 1); }

  // 영상 시간에 맞춘 큐
  function tick() {
    const sc = scenes[cur];
    const h = sc && HOOKS[sc.dataset.id];
    const v = sc && $('video.main', sc);
    if (h && h.cues && v && !v.paused) {
      const t = v.currentTime;
      if (t < cue.t) cue.fired.clear(); // 반복 재생으로 처음으로 돌아감
      h.cues.forEach((c, k) => {
        if (!cue.fired.has(k) && t >= c.t && t < c.t + 0.6) { cue.fired.add(k); c.fn(sc, v); }
      });
      cue.t = t;
    }
    requestAnimationFrame(tick);
  }

  /* ---------- HUD · 노트 · 목차 ---------- */
  function updateHud() {
    const sc = scenes[cur];
    $('.hud-chapter').textContent = sc.dataset.chapter || '';
    $('.hud-page').textContent = `${String(cur + 1).padStart(2, '0')} / ${scenes.length}`;
    $('.hud-bar i').style.width = `${(cur / (scenes.length - 1)) * 100}%`;
    $('.hud-sound').textContent = soundOn ? '♪ ON' : '♪ OFF';
    $('.hud-sound').classList.toggle('off', !soundOn);
    const notes = $('#notes');
    const n = $('.notes', sc);
    notes.innerHTML = `<b>${cur + 1}. ${sc.dataset.title || ''}</b>${n ? n.innerHTML : ''}`;
    $$('#overview button').forEach((b, k) => b.classList.toggle('cur', k === cur));
    history.replaceState(null, '', `#${cur + 1}${step ? '.' + step : ''}`);
  }

  function buildOverview() {
    const grid = $('#overview .ov-grid');
    let lastCh = '';
    scenes.forEach((sc, i) => {
      if (sc.dataset.chapter !== lastCh) {
        lastCh = sc.dataset.chapter;
        grid.insertAdjacentHTML('beforeend', `<h4>${lastCh}</h4>`);
      }
      const b = document.createElement('button');
      b.innerHTML = `<em>${String(i + 1).padStart(2, '0')}</em>${sc.dataset.title || sc.dataset.id}`;
      b.onclick = (e) => { e.stopPropagation(); toggleOverview(false); go(i, 0, 1); };
      grid.appendChild(b);
    });
  }
  function toggleOverview(force) {
    const ov = $('#overview');
    ov.hidden = force === undefined ? !ov.hidden : !force;
  }
  function toggleNotes() { const n = $('#notes'); n.hidden = !n.hidden; }
  function toggleSound() { soundOn = !soundOn; FX.SFX.enabled = soundOn; setAudio(scenes[cur]); updateHud(); }
  function toggleFS() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function unlock() {
    if (unlocked) return false;
    unlocked = true;
    FX.SFX.unlock();
    $('#startgate')?.remove();
    replay(); // 소리를 켠 상태로 현재 장면을 처음부터
    return true;
  }

  /* ---------- 입력 ---------- */
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (unlock()) { e.preventDefault(); return; }
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(scenes.length - 1);
    else if (k === 'f' || k === 'F') toggleFS();
    else if (k === 'm' || k === 'M') toggleSound();
    else if (k === 'n' || k === 'N') toggleNotes();
    else if (k === 'o' || k === 'O') toggleOverview();
    else if (k === 'Escape') toggleOverview(false);
    else if (k === 'r' || k === 'R') replay();
  });
  $('#viewport').addEventListener('click', (e) => {
    if (unlock()) return;
    if (e.clientX < innerWidth * 0.25) prev(); else next();
  });
  $('#startgate')?.addEventListener('click', (e) => { e.stopPropagation(); unlock(); });
  $('#overview').addEventListener('click', (e) => { if (e.target.id === 'overview') toggleOverview(false); });
  addEventListener('resize', fit);

  /* ---------- 시작 ---------- */
  if (/[?&]nogate\b/.test(location.search)) $('#startgate')?.remove();
  renderGlyphs();
  buildOverview();
  fit();
  FX.init(stage);
  const fromHash = () => {
    const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/);
    go(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] : 0, 1);
  };
  addEventListener('hashchange', fromHash);
  fromHash();
  requestAnimationFrame(tick);
})();
