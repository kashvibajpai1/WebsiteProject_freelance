/* ============================================================
   FINGER NINJA — the game loop
   Camera → fingertip → blade → sliced fruit.

   Latency notes (why it feels immediate):
     • the webcam feed is a plain <video> behind the canvas, so
       the GPU composites it; we never copy pixels per frame
     • hand detection runs on the camera's own frame callback
     • the render loop samples a *predicted* fingertip position
       every rAF, so the blade moves at display rate even though
       detection is slower
     • collisions use the swept segment between two blade
       samples, in the fruit's frame, so nothing tunnels through
   ============================================================ */

import { HandTracker, SKELETON } from './hand-tracker.js';
import { Sfx } from './audio.js';
import { pickFruit, getSprite, blit, drawBombGlow, clearSprites } from './fruits.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);

/* how far a small hand movement reaches on screen — >1 means
   you can cover the corners without stretching your arm */
const REACH_GAIN = 1.3;
const AIM_OFFSET_Y = -0.03;

const COMBO_WINDOW = 340;      // ms to chain slices into one combo
const TRAIL_LIFE = 150;        // ms of visible blade trail

/* ---------- blade ------------------------------------------ */
class Blade {
  constructor(id, isHand) {
    this.id = id;
    this.isHand = isHand;
    this.points = [];
    this.x = 0; this.y = 0;
    this.px = 0; this.py = 0;
    this.speed = 0;
    this.active = false;
    this.lastSeen = 0;
    this.warm = false;
  }

  move(x, y, now) {
    if (!this.warm) { this.px = x; this.py = y; this.warm = true; }
    else { this.px = this.x; this.py = this.y; }
    this.x = x; this.y = y;
    this.lastSeen = now;

    const dx = this.x - this.px, dy = this.y - this.py;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(1, now - (this.points.at(-1)?.t ?? now - 16));
    this.speed = this.speed * 0.45 + (dist / dt) * 1000 * 0.55;

    this.points.push({ x, y, t: now });
    if (this.points.length > 48) this.points.shift();
  }

  prune(now) {
    while (this.points.length && now - this.points[0].t > TRAIL_LIFE) this.points.shift();
  }

  /* tapered, glowing ribbon */
  draw(ctx, now, tint) {
    this.prune(now);
    const pts = this.points;
    if (pts.length < 2) return;

    const maxW = this.isHand ? 17 : 14;
    const passes = [
      { w: 2.4, a: 0.22, c: tint },
      { w: 1.35, a: 0.4, c: tint },
      { w: 0.62, a: 0.95, c: '#FFFFFF' },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const pass of passes) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const age = (now - b.t) / TRAIL_LIFE;
        if (age > 1) continue;
        const taper = (i / pts.length);                // thin at the tail
        const fade = (1 - age) * (1 - age);
        ctx.strokeStyle = pass.c;
        ctx.globalAlpha = pass.a * fade;
        ctx.lineWidth = Math.max(0.4, maxW * pass.w * taper * fade);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // hot tip
    const tip = pts.at(-1);
    const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, maxW * 1.9);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.35, tint);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, maxW * 1.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- entities --------------------------------------- */
let SEED = 1;
const nextSeed = () => (SEED = (SEED * 1103515245 + 12345) & 0x7fffffff);

class Fruit {
  constructor(def, x, y, vx, vy, r) {
    this.def = def;               // null ⇒ bomb
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.vx = vx; this.vy = vy;
    this.r = r;
    this.rot = rand(0, TAU);
    this.spin = rand(-2.2, 2.2);
    this.seed = nextSeed();
    this.dead = false;
    this.born = performance.now();
    this.wobble = rand(0, TAU);
  }
  get isBomb() { return this.def === null; }
}

class Half {
  constructor(fruit, side, cutLocal, vx, vy, spin) {
    this.def = fruit.def;
    this.r = fruit.r;
    this.seed = fruit.seed;
    this.x = fruit.x; this.y = fruit.y;
    this.vx = vx; this.vy = vy;
    this.rot = fruit.rot;
    this.spin = spin;
    this.cutLocal = cutLocal;     // cut angle in the fruit's own frame
    this.side = side;
    this.open = 0.06;
    this.alpha = 1;
  }
}

class Particle {
  constructor(x, y, vx, vy, r, color, life) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = r; this.color = color;
    this.life = life; this.max = life;
  }
}

/* A juice mark left hanging in the air where a fruit burst.
   The blob layout is computed once — per-frame we only fade
   and grow it, so a screenful of splats costs almost nothing. */
class Splat {
  constructor(x, y, r, color) {
    this.x = x; this.y = y; this.r = r; this.color = color;
    this.life = 2.6;
    this.max = 2.6;
    this.grow = 0;

    this.blobs = [];
    // one ragged core...
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU), d = rand(0, 0.28) * r;
      this.blobs.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        rx: rand(0.34, 0.58) * r, ry: rand(0.26, 0.46) * r,
        rot: rand(0, TAU), a: rand(0.5, 0.8),
      });
    }
    // ...and droplets thrown clear of it
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU), d = rand(0.5, 1.35) * r;
      const s = rand(0.05, 0.15) * r;
      this.blobs.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        rx: s * rand(1, 2.1), ry: s,
        rot: a, a: rand(0.3, 0.65),
      });
    }
  }
}

class Popup {
  constructor(x, y, text, color, size = 30) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size; this.life = 1.05; this.vy = -46;
  }
}

class Flash {
  constructor(x, y, angle, len, color) {
    this.x = x; this.y = y; this.angle = angle; this.len = len;
    this.color = color; this.life = 0.16;
  }
}

/* ---------- geometry ---------------------------------------
   Shortest distance from the origin to segment p0→p1.        */
function segDistToOrigin(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(x0, y0);
  let t = -(x0 * dx + y0 * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(x0 + dx * t, y0 + dy * t);
}

/* ============================================================ */
export class Game {
  constructor(dom) {
    this.dom = dom;
    this.canvas = dom.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.video = dom.video;

    this.sfx = new Sfx();
    this.tracker = new HandTracker(this.video, { maxHands: 2 });

    this.blades = new Map();
    this.fruits = [];
    this.halves = [];
    this.particles = [];
    this.splats = [];
    this.popups = [];
    this.flashes = [];

    this.state = 'menu';          // menu | playing | over
    this.mode = 'classic';
    this.score = 0;
    this.lives = 3;
    this.timeLeft = 0;
    this.streak = 0;
    this.best = { classic: 0, zen: 0 };

    this.shake = 0;
    this.timeScale = 1;
    this.showSkeleton = true;
    this.trackingOn = false;

    this.comboCount = 0;
    this.comboScore = 0;
    this.comboUntil = 0;
    this.comboX = 0; this.comboY = 0;

    this.spawnTimer = 0;
    this.elapsed = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.pointerDown = false;

    this.loadBest();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ---- persistence -------------------------------------- */
  loadBest() {
    try {
      const raw = localStorage.getItem('fingerNinja.best');
      if (raw) this.best = { ...this.best, ...JSON.parse(raw) };
    } catch { /* private mode */ }
  }
  saveBest() {
    try { localStorage.setItem('fingerNinja.best', JSON.stringify(this.best)); } catch { /* ignore */ }
  }

  /* ---- sizing -------------------------------------------- */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (dpr !== this.dpr) clearSprites();          // sprites are baked per-DPR
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(w, h) / 720;
    this.G = 1.45 * h;
  }

  /* normalised (already mirrored) camera coords → canvas px,
     matching the video's object-fit: cover crop */
  mapNorm(nx, ny) {
    const vw = this.video.videoWidth || 16;
    const vh = this.video.videoHeight || 9;
    const s = Math.max(this.w / vw, this.h / vh);
    const dw = vw * s, dh = vh * s;
    const ox = (this.w - dw) / 2, oy = (this.h - dh) / 2;
    const gx = 0.5 + (nx - 0.5) * REACH_GAIN;
    const gy = 0.5 + (ny - 0.5 - AIM_OFFSET_Y) * REACH_GAIN;
    return { x: ox + gx * dw, y: oy + gy * dh };
  }

  /* ---- input --------------------------------------------- */
  bindPointer() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const blade = () => {
      let b = this.blades.get('pointer');
      if (!b) { b = new Blade('pointer', false); this.blades.set('pointer', b); }
      return b;
    };
    c.addEventListener('pointerdown', (e) => {
      this.sfx.resume();
      this.pointerDown = true;
      const b = blade(); b.warm = false;
      const p = pos(e); b.move(p.x, p.y, performance.now());
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointerDown) return;
      const p = pos(e);
      blade().move(p.x, p.y, performance.now());
    });
    const up = () => { this.pointerDown = false; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', up);
  }

  /* ---- camera -------------------------------------------- */
  async enableTracking(onStatus) {
    onStatus?.('Waking the camera…');
    try {
      await this.tracker.start();
      this.trackingOn = true;
      onStatus?.('ready');
      return true;
    } catch (err) {
      this.trackingOn = false;
      onStatus?.(err?.message || 'Camera unavailable.');
      return false;
    }
  }

  /* ---- lifecycle ----------------------------------------- */
  startGame(mode = 'classic') {
    this.mode = mode;
    this.state = 'playing';
    this.score = 0;
    this.lives = mode === 'zen' ? Infinity : 3;
    this.timeLeft = mode === 'zen' ? 90 : Infinity;
    this.streak = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.4;
    this.fruits.length = 0;
    this.halves.length = 0;
    this.particles.length = 0;
    this.popups.length = 0;
    this.flashes.length = 0;
    this.splats.length = 0;
    this.comboCount = 0;
    this.shake = 0;
    this.sfx.resume();
    this.sfx.start();
    this.dom.onStateChange?.('playing');
  }

  endGame() {
    this.state = 'over';
    const key = this.mode;
    const isBest = this.score > (this.best[key] || 0);
    if (isBest) { this.best[key] = this.score; this.saveBest(); }
    this.sfx.gameOver();
    this.dom.onStateChange?.('over', { score: this.score, best: this.best[key], isBest });
  }

  toMenu() {
    this.state = 'menu';
    this.fruits.length = 0;
    this.halves.length = 0;
    this.dom.onStateChange?.('menu');
  }

  /* ---- spawning ------------------------------------------ */
  difficulty() {
    if (this.mode === 'zen') return 0.55;
    return clamp(this.elapsed / 95, 0, 1);
  }

  launch(isBomb) {
    const s = this.scale;
    const def = isBomb ? null : pickFruit();
    const r = isBomb ? 34 * s : rand(def.radius[0], def.radius[1]) * s;

    const x = rand(this.w * 0.1, this.w * 0.9);
    const apex = rand(this.h * 0.1, this.h * 0.36);
    const rise = this.h + r - apex;
    const vy = -Math.sqrt(2 * this.G * rise);
    const T = (2 * Math.abs(vy)) / this.G;                 // time back to the floor
    const landing = rand(this.w * 0.08, this.w * 0.92);
    const vx = clamp((landing - x) / T, -this.w * 0.42, this.w * 0.42);

    this.fruits.push(new Fruit(def, x, this.h + r, vx, vy, r));
  }

  spawnWave() {
    const d = this.difficulty();
    const count = Math.round(rand(1, 2 + d * 3.4));
    const bombChance = this.mode === 'zen' ? 0 : 0.1 + d * 0.28;
    for (let i = 0; i < count; i++) {
      const bomb = Math.random() < bombChance && i > 0;
      setTimeout(() => {
        if (this.state === 'playing') this.launch(bomb);
      }, i * rand(70, 190));
    }
    this.spawnTimer = rand(1.5, 2.5) - d * 0.85;
  }

  /* ---- slicing ------------------------------------------- */
  sliceFruit(fruit, angle, bladeSpeed, now) {
    fruit.dead = true;

    if (fruit.isBomb) {
      this.explode(fruit);
      return;
    }

    const def = fruit.def;
    const s = this.scale;
    const kick = clamp(bladeSpeed * 0.09, 90, 340) * s;
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const cutLocal = angle - fruit.rot;

    for (const side of [1, -1]) {
      const h = new Half(
        fruit, side, cutLocal,
        fruit.vx + nx * kick * side + rand(-25, 25),
        fruit.vy + ny * kick * side - rand(20, 90),
        fruit.spin + side * rand(1.6, 4.2),
      );
      this.halves.push(h);
    }

    // juice
    const n = Math.round(16 + fruit.r * 0.32);
    for (let i = 0; i < n; i++) {
      const a = angle + rand(-0.9, 0.9) + (Math.random() < 0.5 ? Math.PI : 0);
      const sp = rand(80, 620) * s;
      this.particles.push(new Particle(
        fruit.x + rand(-fruit.r * 0.4, fruit.r * 0.4),
        fruit.y + rand(-fruit.r * 0.4, fruit.r * 0.4),
        Math.cos(a) * sp + fruit.vx * 0.35,
        Math.sin(a) * sp + fruit.vy * 0.35,
        rand(2.5, 8) * s, def.juice, rand(0.4, 0.95),
      ));
    }

    this.splats.push(new Splat(fruit.x, fruit.y, fruit.r * rand(1.1, 1.6), def.juice));
    if (this.splats.length > 22) this.splats.shift();
    this.flashes.push(new Flash(fruit.x, fruit.y, angle, fruit.r * 2.6, '#FFFFFF'));

    // score
    const base = def.score;
    this.score += base;
    this.streak++;
    this.popups.push(new Popup(fruit.x, fruit.y - fruit.r * 0.5, `+${base}`, '#FFE9A8', 26 * s + 12));
    this.sfx.slice(def.pitch);

    // combo bookkeeping
    if (now > this.comboUntil) { this.comboCount = 0; this.comboScore = 0; }
    this.comboCount++;
    this.comboScore += base;
    this.comboUntil = now + COMBO_WINDOW;
    this.comboX = fruit.x; this.comboY = fruit.y;
  }

  resolveCombo() {
    if (this.comboCount >= 3) {
      const bonus = this.comboCount * 10;
      this.score += bonus;
      this.popups.push(new Popup(
        clamp(this.comboX, 120, this.w - 120),
        clamp(this.comboY - 60, 90, this.h - 90),
        `${this.comboCount} COMBO  +${bonus}`, '#FFD36B', 40 * this.scale + 16,
      ));
      this.sfx.combo(this.comboCount);
      this.shake = Math.min(this.shake + 7, 16);
    }
    this.comboCount = 0;
    this.comboScore = 0;
  }

  explode(bomb) {
    const s = this.scale;
    this.sfx.bomb();
    this.shake = 34;
    this.timeScale = 0.25;
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU);
      const sp = rand(120, 1150) * s;
      const warm = ['#FFF3C4', '#FFB13B', '#FF5A1F', '#8A2B0B'][i % 4];
      this.particles.push(new Particle(
        bomb.x, bomb.y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        rand(3, 13) * s, warm, rand(0.35, 1.0),
      ));
    }
    this.flashes.push(new Flash(bomb.x, bomb.y, 0, bomb.r * 9, '#FFB347'));

    if (this.mode !== 'zen') {
      this.lives--;
      this.streak = 0;
      this.popups.push(new Popup(bomb.x, bomb.y, 'BOMB!', '#FF6B5A', 46 * s + 14));
      if (this.lives <= 0) this.endGame();
    }
  }

  missFruit(fruit) {
    if (this.mode === 'zen' || fruit.isBomb) return;
    this.lives--;
    this.streak = 0;
    this.sfx.miss();
    this.dom.pulseMiss?.();
    if (this.lives <= 0) this.endGame();
  }

  /* ---- collision ----------------------------------------- */
  checkBlades(now) {
    const minSpeed = 260 * this.scale;
    for (const blade of this.blades.values()) {
      if (!blade.warm || !blade.active) continue;
      if (blade.speed < minSpeed) continue;

      const angle = Math.atan2(blade.y - blade.py, blade.x - blade.px);

      for (const fruit of this.fruits) {
        if (fruit.dead) continue;
        // swept test in the fruit's own frame: both blade and
        // fruit moved this frame, so we compare relative motion
        const x0 = blade.px - fruit.px, y0 = blade.py - fruit.py;
        const x1 = blade.x - fruit.x, y1 = blade.y - fruit.y;
        if (segDistToOrigin(x0, y0, x1, y1) <= fruit.r) {
          this.sliceFruit(fruit, angle, blade.speed, now);
        }
      }
    }
  }

  /* ---- update -------------------------------------------- */
  update(dt, now) {
    // hit-stop after a bomb, then ease back to normal speed
    this.timeScale = Math.min(1, this.timeScale + dt * 2.4);
    const t = dt * this.timeScale;

    /* blades from tracked hands */
    const seen = new Set();
    if (this.trackingOn) {
      const hands = this.tracker.sample(now, (nx, ny) => this.mapNorm(nx, ny));
      for (const h of hands) {
        seen.add(h.id);
        let b = this.blades.get(h.id);
        if (!b) { b = new Blade(h.id, true); this.blades.set(h.id, b); }
        b.move(h.x, h.y, now);
        b.active = h.fresh;
        b.landmarks = h.landmarks;
      }
    }
    if (this.pointerDown) seen.add('pointer');
    for (const [id, b] of this.blades) {
      if (!seen.has(id)) {
        b.active = false;
        b.warm = false;
        b.speed = 0;
        b.landmarks = null;
        b.prune(now);
        if (!b.points.length && now - b.lastSeen > 400) this.blades.delete(id);
      } else if (id === 'pointer') {
        b.active = true;
      }
    }

    // whoosh, but never more than a few times a second
    if (this.state === 'playing') {
      let fastest = 0;
      for (const b of this.blades.values()) if (b.active) fastest = Math.max(fastest, b.speed);
      const norm = fastest / (1400 * this.scale);
      if (norm > 0.55 && now - (this._lastWhoosh || 0) > 220) {
        this._lastWhoosh = now;
        this.sfx.whoosh(clamp(norm, 0, 1.6));
      }
    }

    if (this.state === 'playing') {
      this.elapsed += t;
      if (this.mode === 'zen') {
        this.timeLeft -= t;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.endGame(); }
      }
      this.spawnTimer -= t;
      if (this.spawnTimer <= 0) this.spawnWave();
    }

    /* fruit */
    for (const f of this.fruits) {
      f.px = f.x; f.py = f.y;
      f.vy += this.G * t;
      f.x += f.vx * t;
      f.y += f.vy * t;
      f.rot += f.spin * t;
      if (f.y - f.r > this.h + 40 && !f.dead) {
        f.dead = true;
        if (this.state === 'playing' && f.vy > 0) this.missFruit(f);
      }
    }

    if (this.state === 'playing') this.checkBlades(now);
    if (this.comboCount && now > this.comboUntil) this.resolveCombo();

    this.fruits = this.fruits.filter((f) => !f.dead);

    /* halves */
    for (const h of this.halves) {
      h.vy += this.G * t;
      h.x += h.vx * t;
      h.y += h.vy * t;
      h.rot += h.spin * t;
      h.open = Math.min(0.62, h.open + t * 4.4);
      if (h.y - h.r > this.h + 120) h.alpha = 0;
    }
    this.halves = this.halves.filter((h) => h.alpha > 0);
    if (this.halves.length > 40) this.halves.splice(0, this.halves.length - 40);

    /* particles */
    for (const p of this.particles) {
      p.vy += this.G * 0.62 * t;
      p.vx *= 1 - 1.1 * t;
      p.x += p.vx * t;
      p.y += p.vy * t;
      p.life -= t;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < this.h + 60);

    for (const s of this.splats) { s.life -= t; s.grow = Math.min(1, s.grow + t * 6); }
    this.splats = this.splats.filter((s) => s.life > 0);

    for (const p of this.popups) { p.y += p.vy * t; p.vy *= 1 - 1.6 * t; p.life -= t; }
    this.popups = this.popups.filter((p) => p.life > 0);

    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);

    this.shake *= 1 - Math.min(1, 7 * dt);
    if (this.shake < 0.3) this.shake = 0;
  }

  /* ---- render -------------------------------------------- */
  render(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    this.drawSplats(ctx);

    for (const h of this.halves) this.drawHalf(ctx, h);

    for (const f of this.fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      if (f.isBomb) {
        drawBombGlow(ctx, f.r, now / 1000, f.seed);
        blit(ctx, getSprite('bomb', null, f.r, f.seed, this.dpr), f.r);
      } else {
        const wob = Math.sin(now / 1000 * 5.5 + f.wobble) * 0.028;
        ctx.scale(1 + wob, 1 - wob);
        blit(ctx, getSprite('skin', f.def, f.r, f.seed, this.dpr), f.r);
      }
      ctx.restore();
    }

    this.drawParticles(ctx);
    this.drawFlashes(ctx);

    const tint = this.state === 'playing' ? 'rgba(255,226,150,.85)' : 'rgba(190,225,255,.85)';
    for (const b of this.blades.values()) b.draw(ctx, now, tint);

    if (this.showSkeleton && this.trackingOn) this.drawHands(ctx);

    this.drawPopups(ctx);
    ctx.restore();
  }

  drawSplats(ctx) {
    ctx.save();
    // 'screen' keeps the juice reading as bright wet colour over
    // the dark camera feed instead of a muddy translucent disc
    ctx.globalCompositeOperation = 'screen';
    for (const s of this.splats) {
      const fade = clamp(s.life / s.max, 0, 1);
      const k = 0.45 + s.grow * 0.55;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(k, k);
      ctx.fillStyle = s.color;
      for (const b of s.blobs) {
        ctx.globalAlpha = b.a * fade * 0.72;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawHalf(ctx, h) {
    const r = h.r;
    ctx.save();
    ctx.globalAlpha = h.alpha;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);

    // clip to the kept side of the cut, then draw the whole skin
    const big = r * 3;
    const ca = Math.cos(h.cutLocal), sa = Math.sin(h.cutLocal);
    const nx = -sa * h.side, ny = ca * h.side;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-ca * big, -sa * big);
    ctx.lineTo(ca * big, sa * big);
    ctx.lineTo(ca * big + nx * big, sa * big + ny * big);
    ctx.lineTo(-ca * big + nx * big, -sa * big + ny * big);
    ctx.closePath();
    ctx.clip();
    blit(ctx, getSprite('skin', h.def, r, h.seed, this.dpr), r);
    ctx.restore();

    // the wet face: with the cut line along local +x, the kept
    // side is simply y·side > 0. Squashing the cached circle
    // vertically fakes the piece turning away from the blade.
    ctx.save();
    ctx.rotate(h.cutLocal);
    ctx.beginPath();
    ctx.rect(-big, h.side > 0 ? 0 : -big, big * 2, big);
    ctx.clip();

    ctx.save();
    ctx.scale(1, Math.max(0.02, h.open));
    blit(ctx, getSprite('face', h.def, r, h.seed, this.dpr), r);
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, Math.max(0.5, r * h.open), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const k = p.life / p.max;
      // stretch along travel so fast droplets read as streaks
      const sp = Math.hypot(p.vx, p.vy);
      const stretch = clamp(sp / 900, 0, 1.6);
      ctx.save();
      ctx.globalAlpha = clamp(k * 1.25, 0, 1);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * k * (1 + stretch), p.r * k, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawFlashes(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      const k = f.life / 0.16;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.globalAlpha = k * 0.85;
      const g = ctx.createLinearGradient(-f.len / 2, 0, f.len / 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, f.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      const hgt = Math.max(2, f.len * 0.06 * k);
      ctx.beginPath();
      ctx.ellipse(0, 0, f.len / 2, hgt, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawPopups(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = clamp(p.life / 1.05, 0, 1);
      const pop = 1 + (1 - k) * 0.12;
      ctx.globalAlpha = k;
      ctx.font = `700 ${p.size * pop}px "Karla", system-ui, sans-serif`;
      // keep the text on screen — combo banners are wide
      const halfW = ctx.measureText(p.text).width / 2;
      const x = clamp(p.x, halfW + 14, Math.max(halfW + 14, this.w - halfW - 14));
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.text, x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, p.y);
    }
    ctx.restore();
  }

  drawHands(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.blades.values()) {
      if (!b.isHand || !b.landmarks) continue;
      const pts = b.landmarks.map((lm) => this.mapNorm(1 - lm.x, lm.y));
      ctx.strokeStyle = 'rgba(255,214,120,.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, c] of SKELETON) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[c].x, pts[c].y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,236,180,.32)';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---- main loop ----------------------------------------- */
  loop(ts) {
    requestAnimationFrame(this.loop);
    const now = ts || performance.now();
    const real = (now - (this.lastFrame || now)) / 1000;
    this.lastFrame = now;
    // measure on the true delta, simulate on a clamped one: a
    // stalled tab must not teleport every fruit off screen
    if (real > 0.0005) this.fps = this.fps * 0.92 + (1 / real) * 0.08;
    const dt = clamp(real, 0, 0.05);

    this.update(dt, now);
    this.render(now);
    this.dom.onFrame?.(this);
  }
}
