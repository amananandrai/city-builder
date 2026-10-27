/**
 * textures.js — procedural canvas textures (facades, ground, signage).
 *
 * Everything is generated once at runtime and cached, so the game ships no
 * extra image files. Facade textures cover a 4-bay × 4-floor block so that
 * lit/unlit windows vary across a wall instead of repeating every bay.
 */
import * as THREE from 'three';

const cache = {};
const cached = (key, fn) => cache[key] ??= fn();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export const css = hex => '#' + hex.toString(16).padStart(6, '0');

/** Scale a hex colour's brightness by f and return a CSS string. */
export function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function speckle(ctx, w, h, count, alpha = 0.08, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

function glass(ctx, x, y, w, h, lit) {
  if (lit) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#f5b95a');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#a9cde6'); g.addColorStop(0.45, '#5b88ad'); g.addColorStop(1, '#2f4f6e');
    ctx.fillStyle = g;
  }
  ctx.fillRect(x, y, w, h);
  // Diagonal reflection streak
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.1, y + h); ctx.lineTo(x - w * 0.2, y + h);
  ctx.fill();
  ctx.restore();
}

/**
 * Facade texture: 256×256 canvas, 4 bays × 4 floors of 64px cells.
 * style: 'house' | 'brick' | 'office' | 'glass' | 'concrete' | 'apartment'
 */
export function facadeTexture(style, wallHex) {
  return cached(`facade_${style}_${wallHex}`, () => {
    const S = 256, C = 64;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = css(wallHex);
    ctx.fillRect(0, 0, S, S);

    if (style === 'brick') {
      ctx.fillStyle = shade(wallHex, 1.25);
      for (let y = 0; y < S; y += 8) {
        ctx.fillRect(0, y, S, 1);
        const off = (y / 8) % 2 ? 8 : 0;
        for (let x = off; x < S; x += 16) ctx.fillRect(x, y, 1, 8);
      }
      speckle(ctx, S, S, 900, 0.1, 3);
    } else if (style === 'concrete') {
      ctx.fillStyle = shade(wallHex, 0.85);
      for (let x = 0; x < S; x += 8) ctx.fillRect(x, 0, 2, S);
      speckle(ctx, S, S, 600, 0.06, 2);
    } else {
      speckle(ctx, S, S, 700, 0.05, 2);
    }

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x0 = col * C, y0 = row * C;
        const lit = Math.random() < 0.22;
        if (style === 'house' || style === 'brick' || style === 'apartment') {
          const wx = x0 + 18, wy = y0 + 14, ww = 28, wh = 34;
          ctx.fillStyle = style === 'brick' ? '#d9d2c3' : '#f4f1ea';
          ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
          glass(ctx, wx, wy, ww, wh, lit);
          ctx.fillStyle = style === 'brick' ? '#d9d2c3' : '#f4f1ea';
          ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
          ctx.fillRect(wx, wy + wh / 2 - 1.5, ww, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(wx - 6, wy + wh + 4, ww + 12, 3);
          if (style === 'apartment') {
            // Balcony rail
            ctx.fillStyle = 'rgba(40,40,40,0.65)';
            ctx.fillRect(x0 + 8, y0 + 50, 48, 3);
            for (let i = 0; i < 7; i++) ctx.fillRect(x0 + 9 + i * 7, y0 + 50, 1.5, 12);
          }
        } else if (style === 'office') {
          glass(ctx, x0 + 3, y0 + 4, C - 6, C - 18, lit);
          ctx.fillStyle = shade(wallHex, 0.8);
          ctx.fillRect(x0, y0 + C - 14, C, 14);
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(x0, y0 + C - 14, C, 2);
        } else if (style === 'glass') {
          glass(ctx, x0, y0, C, C, lit && Math.random() < 0.6);
          ctx.fillStyle = shade(wallHex, 1);
          ctx.fillRect(x0, y0, 3, C);
          ctx.fillRect(x0, y0, C, 3);
          ctx.fillRect(x0 + C / 2 - 1, y0, 2, C);
        } else if (style === 'concrete') {
          glass(ctx, x0 + 6, y0 + 8, C - 12, 12, false);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x0 + 6, y0 + 20, C - 12, 2);
        }
      }
    }
    return finish(c);
  });
}

/** Storefront: 256×64, four glazed shop bays with a door in bay 2. */
export function shopfrontTexture(wallHex) {
  return cached(`shop_${wallHex}`, () => {
    const [c, ctx] = makeCanvas(256, 64);
    ctx.fillStyle = css(wallHex); ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 4; i++) {
      const x = i * 64;
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x + 4, 10, 56, 54);
      if (i === 1) {
        glass(ctx, x + 18, 14, 28, 50, true);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x + 31, 14, 2, 50);
      } else {
        glass(ctx, x + 7, 13, 50, 42, true);
        ctx.fillStyle = '#555'; ctx.fillRect(x + 7, 55, 50, 9);
      }
    }
    return finish(c);
  });
}

/** Striped awning fabric. */
export function awningTexture(aHex, bHex) {
  return cached(`awning_${aHex}_${bHex}`, () => {
    const [c, ctx] = makeCanvas(64, 16);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = css(i % 2 ? bHex : aHex);
      ctx.fillRect(i * 8, 0, 8, 16);
    }
    return finish(c);
  });
}

/** Text sign (not repeating). */
export function signTexture(text, bgHex, fgHex = 0xffffff) {
  return cached(`sign_${text}_${bgHex}_${fgHex}`, () => {
    const [c, ctx] = makeCanvas(256, 64);
    ctx.fillStyle = css(bgHex); ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = css(fgHex);
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34, 236);
    return finish(c, { repeat: false });
  });
}

/** Roller shutter / garage door. */
export function shutterTexture(hex = 0xc9ccd1) {
  return cached(`shutter_${hex}`, () => {
    const [c, ctx] = makeCanvas(64, 64);
    ctx.fillStyle = css(hex); ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, y, 64, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, y + 1.5, 64, 1);
    }
    return finish(c, { repeat: false });
  });
}

export function grassTexture() {
  return cached('grass', () => {
    const S = 256;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#5d9a46'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 + Math.random() * 40);
      const tone = Math.random() > 0.5 ? 'rgba(120,170,80,0.12)' : 'rgba(60,110,45,0.12)';
      g.addColorStop(0, tone); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(Math.random() * S, Math.random() * S);
      ctx.fillStyle = g; ctx.fillRect(-70, -70, 140, 140);
      ctx.restore();
    }
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(150,200,100,0.35)' : 'rgba(40,85,35,0.35)';
      ctx.fillRect(Math.random() * S, Math.random() * S, 1, 2 + Math.random() * 2);
    }
    return finish(c);
  });
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const S = 128;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#3e4146'; ctx.fillRect(0, 0, S, S);
    speckle(ctx, S, S, 2500, 0.12, 1);
    return finish(c);
  });
}

export function paverTexture() {
  return cached('pavers', () => {
    const S = 64;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#c9c6bd'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#a9a69e';
    for (let i = 0; i < S; i += 16) { ctx.fillRect(i, 0, 1, S); ctx.fillRect(0, i, S, 1); }
    speckle(ctx, S, S, 300, 0.06, 1);
    return finish(c);
  });
}

export function gravelRoofTexture() {
  return cached('roof', () => {
    const S = 64;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#8a8d90'; ctx.fillRect(0, 0, S, S);
    speckle(ctx, S, S, 900, 0.15, 1);
    return finish(c);
  });
}

/** Clay / shingle roof tiles for pitched roofs. */
export function shingleTexture(hex) {
  return cached(`shingle_${hex}`, () => {
    const S = 64;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = css(hex); ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, S, 1.5);
      const off = (y / 8) % 2 ? 6 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = off; x < S; x += 12) ctx.fillRect(x, y, 1, 8);
    }
    speckle(ctx, S, S, 200, 0.06, 2);
    return finish(c);
  });
}

/** Sports field with white markings (single image). */
export function fieldTexture() {
  return cached('field', () => {
    const [c, ctx] = makeCanvas(128, 128);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#5aa543' : '#4f9a3b';
      ctx.fillRect(0, i * 16, 128, 16);
    }
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 116, 116);
    ctx.beginPath(); ctx.moveTo(6, 64); ctx.lineTo(122, 64); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 64, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(40, 6, 48, 18); ctx.strokeRect(40, 104, 48, 18);
    return finish(c, { repeat: false });
  });
}

/** Floating "no power" badge used above unpowered buildings. */
export function noPowerTexture() {
  return cached('nopower', () => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.moveTo(72, 18); ctx.lineTo(38, 72); ctx.lineTo(60, 72);
    ctx.lineTo(52, 110); ctx.lineTo(90, 52); ctx.lineTo(67, 52); ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#7a1d12'; ctx.stroke();
    return finish(c, { repeat: false });
  });
}

/** Vertical sky gradient for the scene background. */
export function skyTexture() {
  return cached('sky', () => {
    const [c, ctx] = makeCanvas(2, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#3f87d6');
    g.addColorStop(0.55, '#8cc4ef');
    g.addColorStop(1, '#dcebf5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
    return finish(c, { repeat: false });
  });
}
