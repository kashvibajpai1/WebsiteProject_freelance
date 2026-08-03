/* ============================================================
   FRUIT ART — everything is drawn with canvas paths, so there
   are no image assets to load and it stays crisp at any DPI.

   Each fruit knows how to draw two things:
     drawSkin()  the outside, used for the whole fruit and for
                 the two halves (clipped to a half-plane)
     drawFace()  the wet cut surface revealed by the blade
   ============================================================ */

const TAU = Math.PI * 2;

/* deterministic pseudo-random so a given fruit's seeds/speckles
   sit in the same place every frame it is drawn */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const FRUITS = [
  {
    id: 'watermelon', label: 'Watermelon', weight: 1.0, score: 12, radius: [58, 70],
    skin: ['#3E9A4A', '#12471F'], stripe: '#0C3417',
    rind: ['#EAF6D8', '#B8DC96'], flesh: ['#FF6B7E', '#C71230'],
    juice: '#FF3355', face: 'scatter', seed: '#25121A', pitch: 0.72,
  },
  {
    id: 'orange', label: 'Orange', weight: 1.0, score: 10, radius: [44, 52],
    skin: ['#FFB03A', '#D96A05'], dimple: true,
    rind: ['#FFE2B0', '#F3B168'], flesh: ['#FFC24A', '#F07A12'],
    juice: '#FF9E1B', face: 'segments', segments: 9, pitch: 1.0,
  },
  {
    id: 'lime', label: 'Lime', weight: 0.85, score: 14, radius: [36, 43],
    skin: ['#9FD84A', '#3E7A16'], dimple: true,
    rind: ['#EAF7C8', '#B6DE7C'], flesh: ['#DCF07A', '#8CC42A'],
    juice: '#C8EE55', face: 'segments', segments: 8, pitch: 1.25,
  },
  {
    id: 'apple', label: 'Apple', weight: 1.0, score: 10, radius: [42, 50],
    skin: ['#F0475B', '#96101F'], stem: true,
    rind: ['#FFF6DC', '#F2E2B4'], flesh: ['#FFF8E2', '#EBD9A8'],
    juice: '#FFE9B8', face: 'core', seed: '#4A2B14', pitch: 1.05,
  },
  {
    id: 'kiwi', label: 'Kiwi', weight: 0.8, score: 16, radius: [38, 45],
    skin: ['#A87A46', '#402813'], fuzz: true, mottle: true,
    rind: ['#D8C79A', '#9C8A55'], flesh: ['#D6EF87', '#5D9A1E'],
    juice: '#B9E45E', face: 'kiwi', seed: '#1E1509', pitch: 1.2,
  },
  {
    id: 'dragon', label: 'Dragonfruit', weight: 0.55, score: 24, radius: [48, 56],
    skin: ['#FF5FA2', '#A80E56'], fins: true,
    rind: ['#FFD7E8', '#FF8FC0'], flesh: ['#FFFFFF', '#E9DCE6'],
    juice: '#FF7FBA', face: 'speckle', seed: '#191119', pitch: 0.9,
  },
  {
    id: 'pomegranate', label: 'Pomegranate', weight: 0.6, score: 20, radius: [46, 54],
    skin: ['#C9303E', '#4E0710'], crown: true, mottle: true,
    rind: ['#F7DCC9', '#D9A88C'], flesh: ['#FF4258', '#8E0B22'],
    juice: '#E01F3D', face: 'arils', pitch: 0.85,
  },
  {
    id: 'plum', label: 'Plum', weight: 0.8, score: 15, radius: [38, 45],
    skin: ['#A65BC4', '#3E1352'], bloom: true,
    rind: ['#FFD9A8', '#E0A45E'], flesh: ['#FFC978', '#D9702C'],
    juice: '#E2872F', face: 'pit', seed: '#6B4118', pitch: 1.15,
  },
];

export const FRUIT_BY_ID = Object.fromEntries(FRUITS.map((f) => [f.id, f]));

const TOTAL_WEIGHT = FRUITS.reduce((a, f) => a + f.weight, 0);

export function pickFruit(rand = Math.random) {
  let r = rand() * TOTAL_WEIGHT;
  for (const f of FRUITS) { r -= f.weight; if (r <= 0) return f; }
  return FRUITS[0];
}

/* ---------- outside of the fruit --------------------------- */
export function drawSkin(ctx, def, r, seed) {
  const rnd = rng(seed);

  // contact shadow gives the ball some weight against the video
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.16, r * 0.99, r * 0.96, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // body: light from upper-left
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r * 1.06);
  g.addColorStop(0, def.skin[0]);
  g.addColorStop(0.62, def.skin[0]);
  g.addColorStop(1, def.skin[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  if (def.stripe) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = def.stripe;
    ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      const off = (i / 3.4) * r;
      ctx.globalAlpha = 0.75 - Math.abs(i) * 0.07;
      ctx.lineWidth = r * (0.16 - Math.abs(i) * 0.014);
      ctx.beginPath();
      for (let t = -1; t <= 1.001; t += 0.1) {
        const y = t * r;
        const bulge = Math.sqrt(Math.max(0, 1 - t * t));
        const x = off * bulge + Math.sin(t * 3 + i) * r * 0.045;
        if (t === -1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (def.dimple) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.99, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 90; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.94;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      ctx.fillStyle = i % 2 ? '#000' : '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r * (0.015 + rnd() * 0.02), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  if (def.mottle) {
    // fine leathery grain — keeps big single-colour fruit from
    // reading as a flat plastic ball
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.99, 0, TAU); ctx.clip();
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.96;
      ctx.globalAlpha = 0.05 + rnd() * 0.09;
      ctx.fillStyle = i % 3 ? '#000' : '#FFF';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d,
        r * (0.06 + rnd() * 0.13), r * (0.04 + rnd() * 0.09), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  if (def.fuzz) {
    // surface fuzz first, then the hairs breaking the silhouette
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 90; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.97;
      ctx.strokeStyle = i % 2 ? 'rgba(255,238,205,.55)' : 'rgba(60,38,16,.5)';
      ctx.lineWidth = Math.max(0.5, r * 0.014);
      const len = r * (0.05 + rnd() * 0.07);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const ha = rnd() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ha) * len, y + Math.sin(ha) * len);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,235,200,.5)';
    ctx.lineWidth = Math.max(0.6, r * 0.018);
    for (let i = 0; i < 34; i++) {
      const a = rnd() * TAU;
      const d = r * (0.9 + rnd() * 0.06);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * d * 0.93, Math.sin(a) * d * 0.93);
      ctx.lineTo(Math.cos(a) * (d + r * 0.09), Math.sin(a) * (d + r * 0.09));
      ctx.stroke();
    }
    ctx.restore();
  }

  if (def.bloom) {   // the dusty grey sheen on a fresh plum
    ctx.save();
    const b = ctx.createRadialGradient(-r * 0.3, -r * 0.45, 0, -r * 0.3, -r * 0.45, r * 1.1);
    b.addColorStop(0, 'rgba(226,214,235,.42)');
    b.addColorStop(1, 'rgba(226,214,235,0)');
    ctx.fillStyle = b;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  if (def.fins) {
    // soft green bracts laid along the skin, not spikes
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.5;
      ctx.save();
      ctx.rotate(a);
      const fg = ctx.createLinearGradient(0, -r * 0.55, 0, -r * 1.14);
      fg.addColorStop(0, 'rgba(126,217,87,.55)');
      fg.addColorStop(0.45, '#69C24A');
      fg.addColorStop(1, '#2F7D2A');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.6);
      ctx.quadraticCurveTo(-r * 0.16, -r * 1.05, r * 0.1, -r * 1.1);
      ctx.quadraticCurveTo(r * 0.19, -r * 0.85, r * 0.2, -r * 0.58);
      ctx.quadraticCurveTo(0, -r * 0.5, -r * 0.2, -r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (def.crown) {
    // the little calyx a pomegranate wears on top
    ctx.save();
    ctx.translate(0, -r * 0.92);
    ctx.fillStyle = '#66101A';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.06, r * 0.19, r * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A0B12';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-r * 0.07, 0);
      ctx.quadraticCurveTo(0, -r * 0.34, r * 0.07, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (def.stem) {
    ctx.save();
    ctx.strokeStyle = '#5A3A1C';
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.quadraticCurveTo(r * 0.06, -r * 1.2, r * 0.16, -r * 1.28);
    ctx.stroke();
    const lg = ctx.createLinearGradient(r * 0.1, -r * 1.3, r * 0.8, -r * 0.95);
    lg.addColorStop(0, '#7BC24A'); lg.addColorStop(1, '#2F6B21');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(r * 0.14, -r * 1.22);
    ctx.quadraticCurveTo(r * 0.62, -r * 1.34, r * 0.7, -r * 0.98);
    ctx.quadraticCurveTo(r * 0.36, -r * 1.0, r * 0.14, -r * 1.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // rim light on the shaded side, then the specular highlight
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(r * 0.42, r * 0.5, r * 0.5, r * 0.3, r * 0.36, r * 1.16);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(1, 'rgba(255,255,255,.26)');
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();

  // small, tight specular — a big soft one just reads as fog
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.globalAlpha = 0.5;
  const hl = ctx.createRadialGradient(-r * 0.42, -r * 0.48, 0, -r * 0.42, -r * 0.48, r * 0.3);
  hl.addColorStop(0, 'rgba(255,255,255,.9)');
  hl.addColorStop(0.45, 'rgba(255,255,255,.28)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.26, r * 0.17, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------- the cut surface --------------------------------
   Painted as a full circle. The caller squashes it vertically
   (scale(1, open)) to fake the half turning away from the
   blade, and strokes the rim itself so the line stays crisp.  */
export function drawFace(ctx, def, r, seed) {
  const rnd = rng(seed ^ 0x9e3779b9);

  ctx.save();

  // rind ring
  const rg = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
  rg.addColorStop(0, def.rind[1]);
  rg.addColorStop(0.55, def.rind[0]);
  rg.addColorStop(1, def.rind[1]);
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  const inner = r * (def.face === 'scatter' ? 0.86 : 0.88);
  const fg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, inner);
  fg.addColorStop(0, def.flesh[0]);
  fg.addColorStop(1, def.flesh[1]);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(0, 0, inner, 0, TAU); ctx.fill();

  switch (def.face) {
    case 'segments': {
      const n = def.segments || 9;
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, inner, 0, TAU); ctx.clip();
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 0.94) / n) * TAU;
        const sg = ctx.createRadialGradient(0, 0, inner * 0.1, 0, 0, inner);
        sg.addColorStop(0, def.flesh[1]);
        sg.addColorStop(0.35, def.flesh[0]);
        sg.addColorStop(1, def.flesh[0]);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, inner * 0.93, a0, a1);
        ctx.closePath();
        ctx.fill();
        // juice vesicles catching the light
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = r * 0.012;
        for (let k = 0; k < 5; k++) {
          const a = a0 + (a1 - a0) * (0.15 + k * 0.18);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner * 0.2, Math.sin(a) * inner * 0.2);
          ctx.lineTo(Math.cos(a) * inner * 0.88, Math.sin(a) * inner * 0.88);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(0, 0, inner * 0.1, 0, TAU); ctx.fill();
      break;
    }
    case 'scatter': {
      ctx.fillStyle = def.seed;
      for (let i = 0; i < 11; i++) {
        const a = rnd() * TAU, d = (0.28 + rnd() * 0.5) * inner;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(rnd() * TAU);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.05, r * 0.075, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'kiwi': {
      ctx.fillStyle = 'rgba(255,255,240,.92)';
      ctx.beginPath(); ctx.arc(0, 0, inner * 0.24, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,235,.55)';
      ctx.lineWidth = r * 0.02;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner * 0.24, Math.sin(a) * inner * 0.24);
        ctx.lineTo(Math.cos(a) * inner * 0.92, Math.sin(a) * inner * 0.92);
        ctx.stroke();
      }
      ctx.fillStyle = def.seed;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU + 0.14;
        const d = inner * (0.4 + (i % 2) * 0.1);
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.045, r * 0.028, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'core': {
      ctx.fillStyle = 'rgba(210,185,130,.55)';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        const x = Math.cos(a) * inner * 0.3, y = Math.sin(a) * inner * 0.3;
        const a2 = ((i + 0.5) / 5) * TAU - Math.PI / 2;
        const x2 = Math.cos(a2) * inner * 0.1, y2 = Math.sin(a2) * inner * 0.1;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.seed;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.6;
        ctx.save();
        ctx.translate(Math.cos(a) * inner * 0.2, Math.sin(a) * inner * 0.2);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.05, r * 0.08, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'speckle': {
      ctx.fillStyle = def.seed;
      for (let i = 0; i < 60; i++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * inner * 0.92;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.014 + rnd() * 0.012), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'arils': {
      for (let i = 0; i < 46; i++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * inner * 0.9;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        const rr = r * (0.07 + rnd() * 0.045);
        const ag = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr);
        ag.addColorStop(0, '#FF8A9C');
        ag.addColorStop(1, def.flesh[1]);
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'pit': {
      const pg = ctx.createRadialGradient(-r * 0.06, -r * 0.06, 0, 0, 0, inner * 0.3);
      pg.addColorStop(0, '#A9762F'); pg.addColorStop(1, def.seed);
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.ellipse(0, 0, inner * 0.3, inner * 0.24, 0, 0, TAU); ctx.fill();
      break;
    }
    default: break;
  }

  // wet sheen — kept light, the flesh colour has to survive it
  const sh = ctx.createLinearGradient(-r, -r, r * 0.4, r);
  sh.addColorStop(0, 'rgba(255,255,255,.18)');
  sh.addColorStop(0.4, 'rgba(255,255,255,.02)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------- bomb -------------------------------------------
   Split in two: the body never changes so it can be cached,
   while the halo and fuse sparks animate every frame.        */
export function drawBombBody(ctx, r) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.16, r, r * 0.97, 0, 0, TAU); ctx.fill();
  ctx.restore();

  const g = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.05, 0, 0, r * 1.05);
  g.addColorStop(0, '#5B6270');
  g.addColorStop(0.45, '#22262E');
  g.addColorStop(1, '#07090C');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.24, r * 0.15, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();

  // cap + fuse
  ctx.save();
  ctx.rotate(-0.35);
  ctx.fillStyle = '#3A3F49';
  ctx.fillRect(-r * 0.2, -r * 1.2, r * 0.4, r * 0.34);
  ctx.strokeStyle = '#8A6A3C';
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.16);
  ctx.quadraticCurveTo(r * 0.42, -r * 1.5, r * 0.24, -r * 1.78);
  ctx.stroke();
  ctx.restore();
}

/* the parts that have to move: warning halo + burning fuse */
export function drawBombGlow(ctx, r, t, seed = 1) {
  const rnd = rng(seed);
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * (1.5 + pulse * 0.25));
  halo.addColorStop(0, `rgba(255,60,40,${0.3 + pulse * 0.28})`);
  halo.addColorStop(1, 'rgba(255,60,40,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();

  ctx.rotate(-0.35);
  const sx = r * 0.24, sy = -r * 1.78;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * (0.4 + pulse * 0.2));
  sg.addColorStop(0, 'rgba(255,255,220,1)');
  sg.addColorStop(0.4, 'rgba(255,170,40,.8)');
  sg.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, r * 0.55, 0, TAU); ctx.fill();

  ctx.fillStyle = 'rgba(255,220,120,.9)';
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU + t * 6;
    const d = r * (0.1 + rnd() * 0.3);
    ctx.beginPath();
    ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, r * 0.03, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
   SPRITE CACHE
   Every fruit is a few dozen gradients and paths. Painting that
   per fruit per frame is what would actually cost us latency,
   so each (kind, fruit, radius, variant) is baked once into an
   offscreen canvas and then just blitted + rotated.
   ============================================================ */
const SPRITES = new Map();
const MAX_SPRITES = 200;

/**
 * @param {'skin'|'face'|'bomb'} kind
 * @returns {{canvas: HTMLCanvasElement, half: number, r: number}}
 */
export function getSprite(kind, def, radius, seed, dpr = 1) {
  const r = Math.max(6, Math.round(radius / 2) * 2);       // 2px radius buckets
  const variant = (seed & 3) + 1;                           // 4 looks per fruit
  const key = `${kind}|${def ? def.id : 'bomb'}|${r}|${variant}|${dpr}`;

  const hit = SPRITES.get(key);
  if (hit) { SPRITES.delete(key); SPRITES.set(key, hit); return hit; }

  const pad = Math.ceil(r * (kind === 'face' ? 0.12 : 0.55));
  const half = r + pad;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(half * 2 * dpr);
  const cx = canvas.getContext('2d');
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.translate(half, half);

  if (kind === 'skin') drawSkin(cx, def, r, variant);
  else if (kind === 'face') drawFace(cx, def, r, variant);
  else drawBombBody(cx, r);

  const sprite = { canvas, half, r };
  SPRITES.set(key, sprite);
  if (SPRITES.size > MAX_SPRITES) SPRITES.delete(SPRITES.keys().next().value);
  return sprite;
}

/* blit a cached sprite centred on the current origin, rescaled
   to the entity's exact radius */
export function blit(ctx, sprite, radius) {
  const k = (radius / sprite.r) * sprite.half;
  ctx.drawImage(sprite.canvas, -k, -k, k * 2, k * 2);
}

export function clearSprites() { SPRITES.clear(); }
