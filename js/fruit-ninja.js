/* ============================================================
   FINGER NINJA — page wiring
   Connects the DOM (HUD, overlays, buttons) to the game loop
   in js/game/game.js.
   ============================================================ */

import { Game } from './game/game.js';

const $ = (id) => document.getElementById(id);

const el = {
  stage: $('stage'),
  canvas: $('canvas'),
  video: $('cam'),
  score: $('score'),
  bestLine: $('bestLine'),
  lives: $('lives'),
  timer: $('timer'),
  hint: $('hint'),
  stat: $('stat'),
  damage: $('damage'),
  menu: $('menu'),
  over: $('over'),
  status: $('status'),
  btnPlay: $('btnPlay'),
  btnMouse: $('btnMouse'),
  btnAgain: $('btnAgain'),
  btnMenu: $('btnMenu'),
  btnQuit: $('btnQuit'),
  btnSound: $('btnSound'),
  btnSkeleton: $('btnSkeleton'),
  overKicker: $('overKicker'),
  finalScore: $('finalScore'),
  finalBest: $('finalBest'),
  newBest: $('newBest'),
};

let mode = 'classic';
let shownScore = -1;
let shownLives = -1;
let statTick = 0;

/* ---------- overlay helpers -------------------------------- */
function showOverlay(node) {
  node.hidden = false;
  requestAnimationFrame(() => node.classList.remove('fade'));
}
function hideOverlay(node) {
  node.classList.add('fade');
  setTimeout(() => { node.hidden = true; }, 420);
}

function setStatus(text, isError = false, spinner = false) {
  el.status.classList.toggle('err', isError);
  el.status.innerHTML = spinner
    ? `<span class="fn-spin"></span>${text}`
    : (text || '');
}

/* ---------- the game --------------------------------------- */
const game = new Game({
  canvas: el.canvas,
  video: el.video,

  onStateChange(state, data) {
    if (state === 'playing') {
      el.stage.classList.add('is-playing');
      hideOverlay(el.menu);
      hideOverlay(el.over);
      el.timer.hidden = game.mode !== 'zen';
      el.lives.hidden = game.mode === 'zen';
      shownScore = -1;
      shownLives = -1;
    }
    if (state === 'over') {
      el.stage.classList.remove('is-playing');
      el.overKicker.textContent = game.mode === 'zen' ? "Time's up" : 'Out of lives';
      el.finalScore.textContent = data.score;
      el.finalBest.textContent = data.best;
      el.newBest.hidden = !data.isBest;
      setTimeout(() => showOverlay(el.over), 700);
    }
    if (state === 'menu') {
      el.stage.classList.remove('is-playing');
      hideOverlay(el.over);
      showOverlay(el.menu);
      refreshBestLine();
    }
  },

  pulseMiss() {
    el.damage.classList.remove('hit');
    void el.damage.offsetWidth;          // restart the animation
    el.damage.classList.add('hit');
  },

  /* called once per rendered frame — keep it cheap, only touch
     the DOM when a value actually changed */
  onFrame(g) {
    if (g.score !== shownScore) {
      shownScore = g.score;
      el.score.textContent = g.score;
      el.score.classList.remove('bump');
      void el.score.offsetWidth;
      el.score.classList.add('bump');
    }

    if (g.lives !== shownLives) {
      shownLives = g.lives;
      const dots = el.lives.children;
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('spent', i >= g.lives);
      }
    }

    if (g.mode === 'zen' && g.state === 'playing') {
      const s = Math.max(0, Math.ceil(g.timeLeft));
      const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (el.timer.textContent !== txt) el.timer.textContent = txt;
      el.timer.classList.toggle('low', s <= 10);
    }

    // "show me a hand" nudge
    const wantHint = g.state === 'playing' && g.trackingOn && !g.tracker.hasHands && !g.pointerDown;
    el.hint.classList.toggle('show', wantHint);

    // performance read-out, refreshed twice a second
    if (performance.now() - statTick > 500) {
      statTick = performance.now();
      const cam = g.trackingOn ? `${Math.round(g.tracker.fps)} track` : 'mouse';
      el.stat.textContent = `${Math.round(g.fps)} fps · ${cam}`;
    }
  },
});

function refreshBestLine() {
  el.bestLine.textContent = `Best ${game.best[mode] || 0}`;
}

/* ---------- mode picker ------------------------------------ */
document.querySelectorAll('.fn-mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fn-mode').forEach((b) => b.classList.toggle('on', b === btn));
    mode = btn.dataset.mode;
    refreshBestLine();
  });
});

/* ---------- start ------------------------------------------ */
async function startWithCamera() {
  el.btnPlay.disabled = true;
  el.btnMouse.disabled = true;
  setStatus('Asking for camera permission…', false, true);

  const ok = await game.enableTracking((msg) => {
    if (msg === 'ready') setStatus('');
    else setStatus(msg, false, true);
  });

  el.btnPlay.disabled = false;
  el.btnMouse.disabled = false;

  if (!ok) {
    setStatus(`${el.status.textContent.trim()} — you can still play with the mouse.`, true);
    return;
  }
  el.stage.classList.add('is-live');
  game.startGame(mode);
}

el.btnPlay.addEventListener('click', startWithCamera);
el.btnMouse.addEventListener('click', () => {
  setStatus('');
  game.startGame(mode);
});
el.btnAgain.addEventListener('click', () => game.startGame(mode));
el.btnMenu.addEventListener('click', () => game.toMenu());
el.btnQuit.addEventListener('click', () => game.toMenu());

/* ---------- tray toggles ----------------------------------- */
el.btnSkeleton.classList.add('on');
el.btnSkeleton.addEventListener('click', () => {
  game.showSkeleton = !game.showSkeleton;
  el.btnSkeleton.classList.toggle('on', game.showSkeleton);
});

let soundOn = true;
el.btnSound.classList.add('on');
el.btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  game.sfx.resume();
  game.sfx.setEnabled(soundOn);
  el.btnSound.classList.toggle('on', soundOn);
});

/* ---------- keyboard --------------------------------------- */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && game.state === 'playing') game.toMenu();
  if (e.key === ' ' && game.state !== 'playing') {
    e.preventDefault();
    game.startGame(mode);
  }
  if (e.key.toLowerCase() === 'h') el.btnSkeleton.click();
  if (e.key.toLowerCase() === 'm') el.btnSound.click();
});

/* don't keep spawning fruit into a tab nobody is looking at */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.toMenu();
});

window.addEventListener('pagehide', () => game.tracker.stop());

refreshBestLine();

/* handy from the devtools console: __fnGame.score, __fnGame.tracker.fps */
window.__fnGame = game;
