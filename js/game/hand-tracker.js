/* ============================================================
   HAND TRACKER — webcam → fingertip blade points
   MediaPipe Tasks Vision (HandLandmarker), tuned for latency:
     • detection runs on requestVideoFrameCallback (camera rate,
       not render rate) so we never detect the same frame twice
     • One Euro filter kills jitter without adding lag
     • velocity extrapolation hides the detect→draw delay
   ============================================================ */

/* The tracking runtime is ~19 MB of wasm, so it is loaded from a
   CDN rather than committed to this repo. To run the game fully
   offline, `npm pack @mediapipe/tasks-vision`, drop the files on
   your own server and set before loading the page:

     window.FN_TRACKER_SOURCES = {
       esm:   '/vendor/tasks-vision/vision_bundle.mjs',
       wasm:  '/vendor/tasks-vision/wasm',
       model: '/vendor/hand_landmarker.task',
     };                                                        */
const OVERRIDE = (typeof window !== 'undefined' && window.FN_TRACKER_SOURCES) || {};

const ESM_SOURCES = OVERRIDE.esm ? [OVERRIDE.esm] : [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
];
const WASM_BASES = OVERRIDE.wasm ? [OVERRIDE.wasm] : [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/wasm',
];
const MODEL_URL = OVERRIDE.model ||
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/* index fingertip = the blade tip; these are MediaPipe landmark ids */
export const TIP = 8;
const SKELETON = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
export { SKELETON };

/* ---------- One Euro filter ----------------------------------
   Low speed → heavy smoothing (no jitter).
   High speed → light smoothing (no lag). Exactly what a blade
   needs: steady when you hold still, instant when you swipe.  */
class LowPass {
  constructor() { this.y = null; }
  filter(x, a) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
}

class OneEuro {
  constructor({ minCutoff = 1.2, beta = 0.05, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.prev = null;
  }
  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value, dt) {
    if (dt <= 0) dt = 1 / 60;
    const dv = this.prev === null ? 0 : (value - this.prev) / dt;
    this.prev = value;
    const edv = this.dx.filter(dv, OneEuro.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edv);
    return this.x.filter(value, OneEuro.alpha(cutoff, dt));
  }
}

class TrackedHand {
  constructor(id) {
    this.id = id;
    this.fx = new OneEuro({ minCutoff: 1.7, beta: 0.055 });
    this.fy = new OneEuro({ minCutoff: 1.7, beta: 0.055 });
    this.x = 0; this.y = 0;      // filtered, normalised, already mirrored
    this.vx = 0; this.vy = 0;    // units per second
    this.t = 0;                  // timestamp of last update
    this.landmarks = null;
    this.seen = 0;               // consecutive detections (warm-up guard)
    this.alive = false;
  }

  update(landmarks, now) {
    const dt = this.t ? (now - this.t) / 1000 : 1 / 60;
    const raw = landmarks[TIP];
    const nx = 1 - raw.x;        // video is mirrored on screen
    const ny = raw.y;
    const px = this.x, py = this.y;
    const x = this.fx.filter(nx, dt);
    const y = this.fy.filter(ny, dt);

    if (this.seen > 0 && dt > 0) {
      // blend velocity a little so a dropped frame doesn't spike it
      const ivx = (x - px) / dt;
      const ivy = (y - py) / dt;
      this.vx = this.vx * 0.35 + ivx * 0.65;
      this.vy = this.vy * 0.35 + ivy * 0.65;
    }
    this.x = x; this.y = y; this.t = now;
    this.landmarks = landmarks;
    this.seen = Math.min(this.seen + 1, 30);
    this.alive = true;
  }
}

export class HandTracker {
  /**
   * @param {HTMLVideoElement} video
   */
  constructor(video, { maxHands = 2, predictMs = 34, maxPredict = 0.055 } = {}) {
    this.video = video;
    this.maxHands = maxHands;
    this.predictMs = predictMs;      // how far ahead we extrapolate
    this.maxPredict = maxPredict;    // hard cap in seconds
    this.hands = new Map();
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this.ready = false;
    this.lastDetect = 0;
    this.fps = 0;
    this.cost = 0;          // ms per inference, smoothed
    this._skip = false;
    this._lastTs = -1;
    this._rvfc = null;
  }

  /* ---- camera -------------------------------------------- */
  async openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot reach a camera. Try Chrome, Edge or Safari.');
    }
    const attempts = [
      { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 60, min: 24 }, facingMode: 'user' },
      { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' },
      true,
    ];
    let lastErr;
    for (const video of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        break;
      } catch (err) { lastErr = err; }
    }
    if (!this.stream) throw lastErr || new Error('Could not open the camera.');

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    await new Promise((res) => {
      if (this.video.readyState >= 2 && this.video.videoWidth) return res();
      this.video.onloadeddata = () => res();
    });
    return this.stream;
  }

  /* ---- model --------------------------------------------- */
  async loadModel() {
    let vision = null, lastErr;
    for (const url of ESM_SOURCES) {
      try { vision = await import(/* @vite-ignore */ url); break; }
      catch (err) { lastErr = err; }
    }
    if (!vision) throw new Error('Could not download the hand-tracking library. Check your connection.');

    const { FilesetResolver, HandLandmarker } = vision;
    let fileset = null;
    for (const base of WASM_BASES) {
      try { fileset = await FilesetResolver.forVisionTasks(base); break; }
      catch (err) { lastErr = err; }
    }
    if (!fileset) throw lastErr || new Error('Could not load the tracking runtime.');

    const build = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: this.maxHands,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });

    try { this.landmarker = await build('GPU'); }
    catch { this.landmarker = await build('CPU'); }   // older GPUs / blocked WebGL
    return this.landmarker;
  }

  async start() {
    const [, ] = await Promise.all([this.openCamera(), this.loadModel()]);
    this.running = true;
    this.ready = true;
    this._pump();
  }

  /* ---- detection pump ------------------------------------
     One detect per *camera* frame. requestVideoFrameCallback
     fires exactly when a new frame lands, so there is no
     wasted work and no duplicated frames.                    */
  _pump() {
    const v = this.video;
    const step = () => {
      if (!this.running) return;
      this._detect();
      if (v.requestVideoFrameCallback) this._rvfc = v.requestVideoFrameCallback(step);
      else this._rvfc = requestAnimationFrame(step);
    };
    if (v.requestVideoFrameCallback) this._rvfc = v.requestVideoFrameCallback(step);
    else this._rvfc = requestAnimationFrame(step);
  }

  _detect() {
    const v = this.video;
    if (!this.landmarker || v.readyState < 2 || !v.videoWidth) return;
    if (v.currentTime === this._lastTs) return;      // rAF fallback: skip stale frames
    this._lastTs = v.currentTime;

    // Inference is synchronous on the main thread. On a machine
    // without a usable GPU delegate it can cost more than a frame,
    // which would starve rendering — so when it gets expensive we
    // detect on every other camera frame and let prediction cover
    // the gap. The blade stays smooth either way.
    if (this.cost > 20) {
      this._skip = !this._skip;
      if (this._skip) return;
    }

    const now = performance.now();
    let res;
    try { res = this.landmarker.detectForVideo(v, now); }
    catch { return; }
    const spent = performance.now() - now;
    this.cost = this.cost ? this.cost * 0.85 + spent * 0.15 : spent;

    if (this.lastDetect) {
      const dt = now - this.lastDetect;
      if (dt > 0) this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
    }
    this.lastDetect = now;

    const found = res?.landmarks || [];
    const labels = res?.handednesses || res?.handedness || [];
    const active = new Set();

    for (let i = 0; i < found.length; i++) {
      const label = labels[i]?.[0]?.categoryName || `hand${i}`;
      const id = `${label}`;
      active.add(id);
      let hand = this.hands.get(id);
      if (!hand) { hand = new TrackedHand(id); this.hands.set(id, hand); }
      hand.update(found[i], now);
    }
    for (const [id, hand] of this.hands) {
      if (!active.has(id)) {
        hand.alive = false;
        hand.seen = 0;
        if (now - hand.t > 900) this.hands.delete(id);
      }
    }
  }

  /* ---- sampling for the render loop -----------------------
     Returns predicted, screen-space blade points. `map` turns
     normalised coords into canvas pixels (handles object-fit
     cover + the comfort gain).                               */
  sample(now, map) {
    const out = [];
    for (const hand of this.hands.values()) {
      if (!hand.alive || hand.seen < 2) continue;
      const age = (now - hand.t) / 1000;
      if (age > 0.25) continue;                          // lost the hand
      const lead = Math.min(age + this.predictMs / 1000, this.maxPredict);
      const nx = hand.x + hand.vx * lead;
      const ny = hand.y + hand.vy * lead;
      const p = map(nx, ny);
      out.push({
        id: hand.id,
        x: p.x,
        y: p.y,
        landmarks: hand.landmarks,
        fresh: hand.seen > 4,
      });
    }
    return out;
  }

  get hasHands() {
    for (const h of this.hands.values()) if (h.alive) return true;
    return false;
  }

  stop() {
    this.running = false;
    if (this._rvfc != null) {
      if (this.video.cancelVideoFrameCallback) {
        try { this.video.cancelVideoFrameCallback(this._rvfc); } catch { /* rAF id */ }
      }
      cancelAnimationFrame(this._rvfc);
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.landmarker?.close(); } catch { /* already gone */ }
    this.landmarker = null;
    this.hands.clear();
    this.ready = false;
  }
}
