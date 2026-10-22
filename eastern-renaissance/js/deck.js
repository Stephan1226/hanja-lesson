/* 한자 특강(동양의 르네상스) — 덱 컨트롤러
 * 장면 전환 · 단계(빌드) 공개 · 장면별 이펙트 · 발표자 노트/목차.
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

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function clearTimers() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; }

  /* ---------- 장면별 훅 ---------- */
  const at = (sel, sc) => centerOf($(sel, sc));
  const motes = (rate = 12, colors = P.gold) => ['motes', { rate, colors }];
  const paperMist = (alpha = 0.06, rate = 2) => ['mist', { colors: P.paper, alpha, rate }];
  const clouds = (o = {}) => ['mist', { colors: P.cloud, alpha: o.alpha ?? 0.08, rate: o.rate ?? 2.4, drift: o.drift ?? 40, y: o.y }];
  const dingOnStep = (sc, n, dir) => { if (dir > 0 && n) sfx('ding'); };

  const HOOKS = {
    title: {
      enter() { FX.setAmbient([paperMist(0.07, 2.4), motes(16), ['embers', { rate: 6, colors: P.gold, scale: 0.7 }]]); later(() => sfx('bell'), 300); later(() => sfx('wood'), 2400); },
    },
    hook: {
      enter() { FX.setAmbient([motes(10)]); },
    },
    renaissance: {
      enter() { FX.setAmbient([motes(12, [...P.gold, ...P.white])]); later(() => sfx('boom'), 450); },
      step: dingOnStep,
    },
    fuxing: {
      enter() { FX.setAmbient([motes(10)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('brush');
        if (n === 2) {
          const [x, y] = at('.lifter .gbox', sc);
          FX.sparks(x, y + 80, { n: 40, colors: P.gold, angle: -Math.PI / 2, spread: 0.8, gravity: 300, speed: [150, 600] });
          sfx('whoosh');
        }
        if (n === 3) sfx('chord');
        if (n === 4) sfx('ding');
      },
    },
    east: {
      enter() { FX.setAmbient([motes(10), paperMist(0.05, 1.6)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 3) {
          const [x, y] = at('.stamp-seal', sc);
          FX.ring(x, y, { col: [214, 72, 48], r1: 160, width: 8 });
          FX.sparks(x, y, { n: 30, colors: P.seal, speed: [100, 420] });
          sfx('wood');
        } else if (n) sfx('ding');
      },
    },
    ch1: {
      enter() { FX.setAmbient([['embers', { rate: 22, x: 960, w: 1700, y: 1080, speed: 1.1 }], ['ash', { rate: 10 }]]); sfx('fire'); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          FX.flash('#ff8a2a', 700, 0.45);
          FX.sparks(960, 900, { n: 120, colors: P.fire, angle: -Math.PI / 2, spread: 1.2, speed: [300, 1100], gravity: 400 });
          FX.shake(8, 0.35);
          sfx('fire');
        }
        if (n === 2) sfx('brush');
      },
    },
    jing: {
      enter() { FX.setAmbient([motes(8)]); },
      step(sc, n, dir) { if (dir > 0 && n) sfx(n === 1 ? 'brush' : 'ding'); },
    },
    dian: {
      enter() { FX.setAmbient([motes(8)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === 2) { const [x, y] = at('.gcard.hero .gbox', sc); FX.ring(x, y, { col: [240, 210, 140], r1: 180 }); }
        sfx(n === 5 ? 'chord' : 'brush');
      },
    },
    zhushu: {
      enter() { FX.setAmbient([motes(8)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          later(() => {
            const [x, y] = at('.pour .gbox', sc);
            FX.sparks(x, y - 130, { n: 70, colors: P.water, angle: Math.PI / 2, spread: 0.25, speed: [300, 700], gravity: 900, life: [0.4, 0.8] });
            sfx('hiss');
          }, 500);
        }
        if (n === 2) sfx('whoosh');
        if (n === 3) sfx('chord');
        if (n === 4) sfx('ding');
      },
    },
    stack: {
      enter() { FX.setAmbient([motes(8)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n <= 3) {
          const marks = $$(`.mark[data-step="${n}"]`, sc);
          const cols = [null, [201, 164, 92], [127, 209, 174], [214, 85, 58]];
          marks.forEach((m) => { const [x, y] = centerOf(m); FX.ring(x, y, { col: cols[n], r1: 90, width: 5 }); });
          sfx('ding');
        }
        if (n === 4) sfx('brush');
        if (n === 5) { FX.shake(5, 0.25); sfx('boom'); }
      },
    },
    ch2: {
      enter() { FX.setAmbient([motes(10), paperMist(0.06, 1.8)]); later(() => sfx('wood'), 900); later(() => sfx('wood'), 1300); },
      step: dingOnStep,
    },
    xiyouji: {
      enter() { FX.setAmbient([clouds({ alpha: 0.06, rate: 1.6, drift: 60, y: 900 }), motes(8)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) {
          const [x, y] = at('.all3', sc);
          FX.sparks(x, y, { n: 90, colors: [...P.seal, ...P.gold], speed: [250, 900] });
          FX.ring(x, y, { col: [255, 138, 106], r1: 300 });
          FX.shake(8, 0.3);
          sfx('boom');
        }
        if (n === 2) sfx('whoosh');
        if (n === 3) sfx('chord');
      },
    },
    wukong: {
      enter() { FX.setAmbient([clouds({ alpha: 0.07, rate: 2, drift: 90 }), motes(10)]); later(() => sfx('flash'), 450); },
      step(sc, n, dir) { if (dir > 0 && n) sfx(n === 2 ? 'chime' : 'ding'); },
    },
    kong: {
      enter() { FX.setAmbient([paperMist(0.05, 1.6), motes(8, P.cloud)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === 3) sfx('bell'); else sfx('ding');
      },
    },
    wuwo: {
      enter() { FX.setAmbient([paperMist(0.05, 1.4)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('wood');
        if (n === 2) {
          const [x, y] = at('.we .gbox', sc);
          FX.slash({ pts: [[x - 240, y + 200], [x - 30, y - 30], [x + 240, y - 200]], width: 22 });
          later(() => FX.sparks(x + 200, y - 170, { n: 30, colors: P.white }), 220);
          sfx('slash');
        }
        if (n === 3) sfx('ding');
        if (n === 4) sfx('bell');
        if (n === 5) sfx('ding');
      },
    },
    xin: {
      enter() { FX.setAmbient([motes(10), clouds({ alpha: 0.05, rate: 1.4, drift: 30 })]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('whoosh');
        if (n === 2) {
          sfx('chime');
          later(() => { const [x, y] = at('.hoop', sc); FX.ring(x, y, { col: [233, 196, 106], r0: 220, r1: 120, dur: 0.6 }); sfx('wood'); }, 1100);
        }
        if (n === 3 || n === 4) sfx('ding');
      },
    },
    xuwu: {
      enter() { FX.setAmbient([paperMist(0.05, 1.4)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1 || n === 2) sfx('brush');
        if (n === 3) {
          const [x, y] = at('.pair > div:last-child .hz', sc);
          FX.sparks(x, y, { n: 30, colors: P.fire, speed: [80, 300], gravity: -60 });
          sfx('hiss');
        }
        if (n === 4) { FX.shake(6, 0.3); sfx('boom'); }
      },
    },
    ch3: {
      enter() {
        FX.setAmbient([['ash', { rate: 16, colors: [[40, 30, 26], [70, 50, 40]] }], ['embers', { rate: 10, colors: P.seal, scale: 0.8 }]]);
        sfx('drum'); later(() => sfx('drum'), 420);
      },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === 3) { FX.flash('#d4553a', 600, 0.35); FX.shake(10, 0.4); sfx('drum'); later(() => sfx('drum'), 300); later(() => sfx('boom'), 600); }
        else sfx('ding');
      },
    },
    map: {
      enter(sc) { sc._fire = false; FX.setAmbient([['ash', { rate: 8, colors: [[40, 30, 26], [70, 50, 40]] }]]); },
      step(sc, n, dir) {
        const map = $('.map', sc);
        [2, 3, 4].forEach((k) => map.classList.toggle('s' + k, n >= k));
        if (n < 3 && sc._fire) { sc._fire = false; FX.setAmbient([['ash', { rate: 8, colors: [[40, 30, 26], [70, 50, 40]] }]]); }
        if (dir < 0) return;
        if (n === 1) sfx('ding');
        if (n === 2) { sfx('drum'); later(() => sfx('drum'), 380); later(() => sfx('drum'), 760); }
        if (n === 3) {
          const [x, y] = at('.city.cap circle', sc);
          FX.sparks(x, y, { n: 90, colors: P.fire, speed: [150, 700] });
          FX.ring(x, y, { col: [255, 106, 74], r1: 160 });
          FX.flash('#ff5a2a', 500, 0.25);
          FX.shake(10, 0.4);
          sfx('fire');
          if (!sc._fire) { sc._fire = true; FX.addAmbient('embers', { rate: 26, x, w: 60, y, speed: 0.5, scale: 0.8 }); }
        }
        if (n === 4) sfx('whoosh');
        if (n === 5) sfx('bell');
        if (n === 6) sfx('chime');
      },
    },
    ch4: {
      enter() { FX.setAmbient([motes(14), paperMist(0.05, 1.4)]); later(() => sfx('chord'), 500); },
      step: dingOnStep,
    },
    xing: {
      enter() { FX.setAmbient([motes(10, P.jade)]); },
      step(sc, n, dir) { if (dir > 0 && n) sfx(n === 3 ? 'chord' : 'ding'); },
    },
    li: {
      enter(sc) { $('.jade', sc).classList.remove('cut'); FX.setAmbient([motes(10, P.jade)]); },
      step(sc, n, dir) {
        $('.jade', sc).classList.toggle('cut', n >= 2);
        if (dir < 0) return;
        if (n === 1) sfx('ding');
        if (n === 2) {
          const [x, y] = at('.jade', sc);
          later(() => {
            FX.sparks(x, y, { n: 80, colors: [...P.jade, ...P.white], speed: [200, 800] });
            FX.ring(x, y, { col: [127, 209, 174], r1: 320 });
            FX.flash('#9ff0cc', 500, 0.25);
            sfx('crack'); sfx('chime', 0.15);
          }, 450);
        }
        if (n === 3 || n === 4) sfx('ding');
      },
    },
    vs: {
      enter() { FX.setAmbient([motes(8, [...P.ghost, ...P.jade])]); later(() => sfx('boom'), 300); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === 1) { const [x, y] = at('.vs2.l .hz', sc); FX.sparks(x, y, { n: 50, colors: P.ghost, gravity: -80, speed: [60, 300], life: [0.8, 1.6] }); sfx('bell'); }
        if (n === 2) { const [x, y] = at('.vs2.r .hz', sc); FX.sparks(x, y, { n: 70, colors: P.jade, speed: [150, 600] }); FX.ring(x, y, { col: [127, 209, 174], r1: 260 }); sfx('chime'); }
        if (n === 3) sfx('whoosh');
        if (n === 4) sfx('chord');
      },
    },
    qi: {
      enter() { FX.setAmbient([clouds({ alpha: 0.09, rate: 3, drift: 50 }), motes(8, P.cloud)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) { const [x, y] = at('.answer .gbox', sc); FX.ring(x, y, { col: [169, 205, 234], r1: 240 }); FX.sparks(x, y, { n: 50, colors: P.cloud, speed: [100, 500], gravity: -40 }); sfx('chime'); }
        if (n === 2) sfx('whoosh');
        if (n >= 3) sfx('ding');
      },
    },
    sishu: {
      enter() { FX.setAmbient([motes(10)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === 1) { $$('.book.pull', sc).forEach((b) => { const [x, y] = centerOf(b); FX.ring(x, y, { col: [214, 85, 58], r1: 120, width: 5 }); }); sfx('whoosh'); }
        else sfx('ding');
      },
    },
    qiong: {
      enter() { FX.setAmbient([motes(8)]); },
      step(sc, n, dir) {
        if (dir < 0) return;
        if (n === 1) sfx('ding');
        if (n === 2) { sfx('whoosh'); later(() => { const [x, y] = at('.cave .end', sc); FX.sparks(x, y, { n: 40, colors: P.gold, speed: [80, 400] }); sfx('chime'); }, 2700); }
        if (n === 3) sfx('chord');
        if (n === 4) sfx('ding');
      },
    },
    words: {
      enter() { FX.setAmbient([motes(12)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        const card = $(`[data-reveal="${n}"]`, sc);
        if (!card) return sfx('chord'); // 카드 다음 단계(20분판의 정리 한 줄)
        FX.sparks(...centerOf(card), { n: 34, colors: P.gold, speed: [100, 480], gravity: 200 });
        sfx('ding');
      },
    },
    compare: {
      enter() { FX.setAmbient([motes(10)]); },
      step(sc, n, dir) { if (dir > 0 && n) sfx(n === 7 ? 'chord' : 'brush'); },
    },
    korea: {
      enter() { FX.setAmbient([motes(10), ['ash', { rate: 6, colors: [[200, 120, 50], [220, 170, 80]], alpha: 0.7 }]]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        if (n === +$('.won', sc).dataset.step) { $$('.won .note', sc).forEach((el) => FX.sparks(...centerOf(el), { n: 30, colors: P.gold, speed: [100, 400] })); sfx('chord'); }
        else sfx('ding');
      },
    },
    quiz: {
      enter() { FX.setAmbient([motes(10)]); },
      step(sc, n, dir) {
        if (dir < 0 || !n) return;
        FX.sparks(...at(`.a[data-step="${n}"]`, sc), { n: 40, colors: P.gold, speed: [100, 500] });
        sfx('ding');
      },
    },
    finale: {
      enter() { FX.setAmbient([motes(18), ['embers', { rate: 10, colors: P.gold }], paperMist(0.05, 1.6)]); later(() => sfx('bell'), 600); later(() => sfx('chord'), 2600); },
      step(sc, n, dir) {
        if (dir < 0 || n !== 1) return;
        const [x, y] = at('.motto', sc);
        FX.flash('#fff3d0', 600, 0.5);
        FX.ring(x, y, { col: [240, 210, 140], r1: 520, width: 14 });
        FX.sparks(x, y, { n: 160, colors: P.gold, speed: [300, 1400] });
        FX.shake(8, 0.35);
        sfx('boom'); sfx('bell', 0.1);
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

  function transition(kind) {
    if (kind === 'flash') { FX.flash('#ffffff', 600, 0.8); sfx('whoosh'); }
    else if (kind === 'burn') { FX.flash('#ff8a2a', 700, 0.55); sfx('fire'); }
    else if (kind === 'bell') { FX.flash('#fff3d6', 700, 0.25); sfx('bell'); }
    else if (kind === 'drum') { FX.flash('#d4553a', 500, 0.3); FX.shake(8, 0.3); sfx('drum'); }
  }

  function go(i, s = 0, dir = 1) {
    i = Math.max(0, Math.min(scenes.length - 1, i));
    const sc = scenes[i];
    if (i !== cur) {
      const old = scenes[cur];
      if (old) { old.classList.remove('active'); hook(old, 'leave'); }
      clearTimers();
      FX.clear();
      cur = i;
      sc.classList.add('active');
      if (unlocked) transition(sc.dataset.trans);
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
      b.onclick = (e) => { e.stopPropagation(); b.blur(); toggleOverview(false); go(i, 0, 1); };
      grid.appendChild(b);
    });
  }
  function toggleOverview(force) {
    const ov = $('#overview');
    ov.hidden = force === undefined ? !ov.hidden : !force;
  }
  function toggleNotes() { const n = $('#notes'); n.hidden = !n.hidden; }
  function toggleSound() { soundOn = !soundOn; FX.SFX.enabled = soundOn; updateHud(); }
  function toggleFS() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function unlock() {
    if (unlocked) return false;
    unlocked = true;
    FX.SFX.unlock();
    $('#startgate')?.remove();
    replay(); // 효과음을 켠 상태로 현재 장면을 처음부터
    return true;
  }

  /* ---------- 입력 ---------- */
  // 한글 입력 상태에서도 단축키가 먹도록 글자(e.key)가 아니라 물리 키(e.code)로 판별한다
  const NEXT = ['ArrowRight', 'ArrowDown', 'Space', 'PageDown', 'Enter', 'NumpadEnter'];
  const PREV = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
  const COMMANDS = {
    Home: () => go(0),
    End: () => go(scenes.length - 1),
    KeyF: toggleFS,
    KeyM: toggleSound,
    KeyN: toggleNotes,
    KeyO: () => toggleOverview(),
    Escape: () => toggleOverview(false),
    KeyR: replay,
  };
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    const nav = NEXT.includes(c) || PREV.includes(c);
    if (nav || COMMANDS[c]) e.preventDefault();
    // 시작 화면에서 누른 이동 키는 '시작'으로만 쓴다. F·M 같은 명령은 시작과 함께 바로 실행.
    if (unlock() && nav) return;
    if (NEXT.includes(c)) next();
    else if (PREV.includes(c)) prev();
    else if (COMMANDS[c] && !e.repeat) COMMANDS[c]();
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
})();
