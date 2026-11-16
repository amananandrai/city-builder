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

const pickOf = arr => arr[Math.floor(Math.random() * arr.length)];

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

/** One window: frame, glazing, glazing bars, sill and a soft reveal shadow. */
function windowPane(ctx, x, y, w, h, { frame = '#f4f1ea', cols = 2, rows = 2, lit = false, t = 5, sill = true, curtain = 0 } = {}) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - t + 2, y - t + 3, w + t * 2, h + t * 2 + 2);          // drop shadow
  ctx.fillStyle = frame;
  ctx.fillRect(x - t, y - t, w + t * 2, h + t * 2);
  glass(ctx, x, y, w, h, lit);
  if (curtain) {
    ctx.fillStyle = curtain;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.34, y); ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.6, x, y + h * 0.85); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w * 0.66, y); ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.6, x + w, y + h * 0.85); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y, w, 5);               // reveal shadow
  ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = frame;
  for (let i = 1; i < cols; i++) ctx.fillRect(x + (w * i) / cols - 1.5, y, 3, h);
  for (let i = 1; i < rows; i++) ctx.fillRect(x, y + (h * i) / rows - 1.5, w, 3);
  if (sill) {
    ctx.fillStyle = frame; ctx.fillRect(x - t - 4, y + h + t - 1, w + t * 2 + 8, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x - t - 4, y + h + t + 5, w + t * 2 + 8, 4);
  }
}

const CURTAINS = ['rgba(245,240,225,0.8)', 'rgba(214,116,104,0.75)', 'rgba(120,150,190,0.75)', 'rgba(236,208,140,0.8)'];
const SHUTTERS = ['#3f6f95', '#5b7f5a', '#8a4b3c', '#3e4a5a'];

/**
 * Facade texture: 512×512 canvas, 4 bays × 4 floors of 128px cells.
 * style: 'house' | 'apartment' | 'brick' | 'stone' | 'plain' | 'office'
 *        | 'glass' | 'tower' | 'concrete' (ribbed industrial cladding)
 */
export function facadeTexture(style, wallHex) {
  return cached(`facade_${style}_${wallHex}`, () => {
    const S = 512, C = 128, R = Math.random;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = css(wallHex);
    ctx.fillRect(0, 0, S, S);
    // Companion emissive map: black except windows that light up at night
    const [gc, gctx] = makeCanvas(S, S);
    gctx.fillStyle = '#000'; gctx.fillRect(0, 0, S, S);
    const glow = (x, y, w, h) => {
      gctx.fillStyle = R() < 0.3 ? '#bfd4e6' : '#ffd98a';
      gctx.fillRect(x, y, w, h);
    };

    // ── Wall surface ──
    if (style === 'brick') {
      ctx.fillStyle = shade(wallHex, 1.3); ctx.fillRect(0, 0, S, S);       // mortar
      for (let y = 0, row = 0; y < S; y += 16, row++) {
        for (let x = row % 2 ? -16 : 0; x < S; x += 32) {
          ctx.fillStyle = shade(wallHex, 0.86 + R() * 0.26);
          ctx.fillRect(x + 1, y + 1, 30, 14);
        }
      }
      speckle(ctx, S, S, 1500, 0.07, 3);
    } else if (style === 'stone') {
      for (let y = 0, row = 0; y < S; y += 32, row++) {
        for (let x = row % 2 ? -32 : 0; x < S; x += 64) {
          ctx.fillStyle = shade(wallHex, 0.94 + R() * 0.1);
          ctx.fillRect(x, y, 64, 32);
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y + 30, 64, 2); ctx.fillRect(x + 62, y, 2, 32);
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, 64, 2);
        }
      }
      speckle(ctx, S, S, 900, 0.04, 3);
    } else if (style === 'concrete') {
      // Ribbed metal cladding with panel seams
      for (let x = 0; x < S; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0, shade(wallHex, 0.8)); g.addColorStop(0.3, shade(wallHex, 1.08)); g.addColorStop(1, shade(wallHex, 0.92));
        ctx.fillStyle = g; ctx.fillRect(x, 0, 16, S);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < S; y += C) ctx.fillRect(0, y + C - 3, S, 3);
      speckle(ctx, S, S, 900, 0.05, 3);
      // Rust and grime streaks running down from the seams
      for (let i = 0; i < 26; i++) {
        const x = R() * S, y = Math.floor(R() * 4) * C, h = 20 + R() * 60;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(90,60,40,0.22)'); g.addColorStop(1, 'rgba(90,60,40,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, 3 + R() * 5, h);
      }
    } else if (style === 'house') {
      // Clapboard siding
      for (let y = 0; y < S; y += 16) {
        ctx.fillStyle = 'rgba(0,0,0,0.11)'; ctx.fillRect(0, y + 14, S, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, y, S, 2);
      }
      speckle(ctx, S, S, 800, 0.035, 3);
    } else if (style !== 'glass' && style !== 'tower') {
      speckle(ctx, S, S, 1600, 0.04, 3);
      if (style === 'apartment' || style === 'plain') {
        // Floor slab line with a soft shadow beneath
        for (let y = 0; y < S; y += C) {
          ctx.fillStyle = shade(wallHex, 0.86); ctx.fillRect(0, y + C - 7, S, 7);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, y + C - 7, S, 2);
          const g = ctx.createLinearGradient(0, y, 0, y + 16);
          g.addColorStop(0, 'rgba(0,0,0,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(0, y, S, 16);
        }
      }
    }

    const shutter = pickOf(SHUTTERS);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x0 = col * C, y0 = row * C;
        const lit = R() < 0.2;
        const nightLit = lit || R() < 0.4;
        const curtain = R() < 0.45 ? pickOf(CURTAINS) : 0;
        if (style === 'house') {
          const wx = x0 + 38, wy = y0 + 30, ww = 52, wh = 62;
          ctx.fillStyle = shutter;
          ctx.fillRect(wx - 20, wy - 4, 14, wh + 8); ctx.fillRect(wx + ww + 6, wy - 4, 14, wh + 8);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          for (let i = 0; i < 6; i++) { ctx.fillRect(wx - 18, wy + i * 11, 10, 2); ctx.fillRect(wx + ww + 8, wy + i * 11, 10, 2); }
          windowPane(ctx, wx, wy, ww, wh, { lit, curtain });
          if (nightLit) glow(wx, wy, ww, wh);
          if (R() < 0.5) {
            // Window box with flowers
            ctx.fillStyle = '#7a5134'; ctx.fillRect(wx - 6, wy + wh + 8, ww + 12, 9);
            for (let i = 0; i < 9; i++) {
              ctx.fillStyle = i % 3 ? pickOf(['#e84393', '#fdcb6e', '#ffffff', '#e74c3c']) : '#4f8f3a';
              ctx.beginPath(); ctx.arc(wx - 2 + i * 7.5, wy + wh + 6 - (i % 2) * 3, 4, 0, 7); ctx.fill();
            }
          }
        } else if (style === 'apartment') {
          const wx = x0 + 34, wy = y0 + 22, ww = 60, wh = 76;
          windowPane(ctx, wx, wy, ww, wh, { lit, cols: 2, rows: 3, curtain });
          if (nightLit) glow(wx, wy, ww, wh);
        } else if (style === 'plain') {
          const wx = x0 + 36, wy = y0 + 30, ww = 56, wh = 54;
          windowPane(ctx, wx, wy, ww, wh, { lit, frame: '#3d4046', cols: 2, rows: 1, t: 4, curtain });
          if (nightLit) glow(wx, wy, ww, wh);
        } else if (style === 'brick') {
          const wx = x0 + 38, wy = y0 + 30, ww = 52, wh = 66;
          ctx.fillStyle = '#e6dfd0'; ctx.fillRect(wx - 12, wy - 18, ww + 24, 13);   // stone lintel
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(wx - 12, wy - 5, ww + 24, 2);
          windowPane(ctx, wx, wy, ww, wh, { lit, frame: '#e6dfd0', cols: 2, rows: 3, curtain });
          if (nightLit) glow(wx, wy, ww, wh);
        } else if (style === 'stone') {
          const wx = x0 + 42, wy = y0 + 26, ww = 44, wh = 78;
          ctx.fillStyle = shade(wallHex, 1.08); ctx.fillRect(wx - 12, wy - 16, ww + 24, 8);   // cornice over the window
          ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(wx - 12, wy - 8, ww + 24, 3);
          windowPane(ctx, wx, wy, ww, wh, { lit, frame: shade(wallHex, 1.06), cols: 2, rows: 3, t: 6 });
          if (nightLit) glow(wx, wy, ww, wh);
          // Pilaster shading between bays
          const g = ctx.createLinearGradient(x0, 0, x0 + 14, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(x0, y0, 14, C);
        } else if (style === 'office') {
          const wy = y0 + 10, wh = 72;
          glass(ctx, x0, wy, C, wh, lit);
          if (nightLit) glow(x0 + 4, wy, C - 8, wh);
          if (R() < 0.4) {       // blinds drawn part-way
            const bh = wh * (0.25 + R() * 0.5);
            ctx.fillStyle = 'rgba(236,232,220,0.6)'; ctx.fillRect(x0 + 4, wy, C - 8, bh);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            for (let y = wy; y < wy + bh; y += 6) ctx.fillRect(x0 + 4, y, C - 8, 1.5);
          }
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0, wy, C, 5);
          ctx.fillStyle = shade(wallHex, 0.7);
          ctx.fillRect(x0 - 3, wy, 6, wh); ctx.fillRect(x0 + C - 3, wy, 6, wh); ctx.fillRect(x0 + C / 2 - 1.5, wy, 3, wh);
          // Spandrel panel
          ctx.fillStyle = shade(wallHex, 0.88); ctx.fillRect(x0, wy + wh, C, C - wh - 10);
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0, wy + wh, C, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x0, y0 + C - 4, C, 4); ctx.fillRect(x0 + C / 2 - 1, wy + wh, 2, C - wh - 10);
        } else if (style === 'glass') {
          for (let i = 0; i < 2; i++) {
            const px = x0 + i * 64, isLit = lit && R() < 0.5;
            glass(ctx, px, y0, 64, C, isLit);
            // Sky / cloud reflections differ pane to pane
            ctx.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '20,40,80'},${(0.03 + R() * 0.12).toFixed(2)})`;
            ctx.fillRect(px, y0, 64, C);
            if (nightLit && R() < 0.6) glow(px + 4, y0 + 6, 56, C - 28);
          }
          ctx.fillStyle = shade(wallHex, 0.55); ctx.fillRect(x0, y0 + C - 20, C, 20);        // spandrel band
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x0, y0 + C - 20, C, 2);
          ctx.fillStyle = shade(wallHex, 1.1);
          ctx.fillRect(x0, y0, 4, C); ctx.fillRect(x0 + 62, y0, 3, C); ctx.fillRect(x0, y0, C, 3);
        } else if (style === 'tower') {
          // Stone piers with recessed vertical window strips
          const g = ctx.createLinearGradient(x0, 0, x0 + 36, 0);
          g.addColorStop(0, shade(wallHex, 0.85)); g.addColorStop(0.35, shade(wallHex, 1.1)); g.addColorStop(1, shade(wallHex, 0.92));
          ctx.fillStyle = g; ctx.fillRect(x0, y0, 36, C);
          glass(ctx, x0 + 36, y0, C - 36, C - 26, lit);
          if (nightLit) glow(x0 + 40, y0 + 4, C - 44, C - 34);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + 36, y0, 5, C - 26); ctx.fillRect(x0 + 36, y0, C - 36, 4);
          ctx.fillStyle = shade(wallHex, 0.72); ctx.fillRect(x0 + 36, y0 + C - 26, C - 36, 26);
          ctx.fillStyle = shade(wallHex, 0.95); ctx.fillRect(x0 + 36, y0 + C - 26, C - 36, 4);
          ctx.fillStyle = shade(wallHex, 0.8); ctx.fillRect(x0 + 36 + (C - 36) / 2 - 2, y0, 4, C - 26);
        } else if (style === 'concrete') {
          const wx = x0 + 14, wy = y0 + 18, ww = C - 28, wh = 26;
          ctx.fillStyle = '#4a5058'; ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          glass(ctx, wx, wy, ww, wh, false);
          if (nightLit) glow(wx, wy, ww, wh);
          ctx.fillStyle = '#4a5058';
          for (let i = 1; i < 4; i++) ctx.fillRect(wx + (ww * i) / 4 - 1.5, wy, 3, wh);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx - 3, wy + wh + 3, ww + 6, 4);
        }
      }
    }
    const tex = finish(c);
    tex.userData.glow = finish(gc);
    return tex;
  });
}

const SHOP_GOODS = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#e67e22', '#ecf0f1', '#9b59b6'];
/** Storefront: 512×128, four glazed shop bays with a door in bay 2. */
export function shopfrontTexture(wallHex) {
  return cached(`shop_${wallHex}`, () => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = css(wallHex); ctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x + 8, 20, 112, 108);
      if (i === 1) {
        glass(ctx, x + 36, 28, 56, 100, true);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x + 62, 28, 4, 100);
        ctx.fillStyle = '#d9c27a'; ctx.fillRect(x + 54, 78, 5, 16); ctx.fillRect(x + 69, 78, 5, 16);   // handles
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 36, 28, 56, 6);
      } else {
        glass(ctx, x + 14, 26, 100, 84, true);
        // Window display: shelves of goods
        for (let s = 0; s < 2; s++) {
          const sy = 66 + s * 26;
          ctx.fillStyle = 'rgba(70,50,35,0.75)'; ctx.fillRect(x + 18, sy + 14, 92, 3);
          for (let k = 0; k < 6; k++) {
            ctx.fillStyle = pickOf(SHOP_GOODS);
            const h = 8 + Math.random() * 8;
            ctx.fillRect(x + 22 + k * 15, sy + 14 - h, 10, h);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 14, 26, 100, 7);
        ctx.fillStyle = '#4c4c4c'; ctx.fillRect(x + 14, 110, 100, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 14, 110, 100, 2);
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
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 13, 64, 3);
    return finish(c);
  });
}

/** Text sign (not repeating). */
export function signTexture(text, bgHex, fgHex = 0xffffff) {
  return cached(`sign_${text}_${bgHex}_${fgHex}`, () => {
    const [c, ctx] = makeCanvas(256, 64);
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, shade(bgHex, 1.15)); g.addColorStop(1, shade(bgHex, 0.85));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 130, 36, 236);
    ctx.fillStyle = css(fgHex);
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
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, 64, 4); ctx.fillRect(0, 0, 2, 64); ctx.fillRect(62, 0, 2, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(26, 54, 12, 3);
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
      // Draw each patch wrapped so the texture tiles without seams
      const px = Math.random() * S, py = Math.random() * S;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        ctx.save(); ctx.translate(px + ox, py + oy);
        ctx.fillStyle = g; ctx.fillRect(-70, -70, 140, 140);
        ctx.restore();
      }
    }
    for (let i = 0; i < 4500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(150,200,100,0.35)' : 'rgba(40,85,35,0.35)';
      ctx.fillRect(Math.random() * S, Math.random() * S, 1, 2 + Math.random() * 3);
    }
    // Clover and wildflowers
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = pickOf(['rgba(255,255,255,0.75)', 'rgba(250,220,90,0.75)', 'rgba(240,160,190,0.7)']);
      ctx.fillRect(4 + Math.random() * (S - 8), 4 + Math.random() * (S - 8), 2, 2);
    }
    return finish(c);
  });
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const S = 256;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#3e4146'; ctx.fillRect(0, 0, S, S);
    // Worn lighter wheel tracks and darker patches
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 + Math.random() * 34);
      g.addColorStop(0, Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(30 + Math.random() * (S - 60), 30 + Math.random() * (S - 60));
      ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120); ctx.restore();
    }
    speckle(ctx, S, S, 7000, 0.11, 1);
    speckle(ctx, S, S, 500, 0.08, 2);
    // Hairline cracks
    ctx.strokeStyle = 'rgba(15,16,18,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = 30 + Math.random() * (S - 60), y = 30 + Math.random() * (S - 60);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 22; y += (Math.random() - 0.5) * 22; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return finish(c);
  });
}

/** Paving slabs in a running bond, 4 × 4 per repeat, each a slightly different tone. */
export function paverTexture() {
  return cached('pavers', () => {
    const S = 128, P = 32;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#a29f97'; ctx.fillRect(0, 0, S, S);
    for (let row = 0; row < 4; row++) {
      for (let col = -1; col < 4; col++) {
        const x = col * P + (row % 2 ? P / 2 : 0), y = row * P;
        const v = 196 + Math.floor(Math.random() * 16);
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 11})`;
        ctx.fillRect(x + 1, y + 1, P - 2, P - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1, y + 1, P - 2, 2);
      }
    }
    speckle(ctx, S, S, 700, 0.05, 1);
    return finish(c);
  });
}

export function gravelRoofTexture() {
  return cached('roof', () => {
    const S = 128;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#8a8d90'; ctx.fillRect(0, 0, S, S);
    speckle(ctx, S, S, 3600, 0.15, 1);
    // Roofing-felt seams
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < S; x += 32) ctx.fillRect(x, 0, 1.5, S);
    return finish(c);
  });
}

/** Near-white standing-seam panel, tinted by the material colour (themed roofs). */
export function roofPanelTexture() {
  return cached('roofpanel', () => {
    const S = 128;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x, 0, 2, S);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x + 2, 0, 2, S);
    }
    speckle(ctx, S, S, 500, 0.03, 2);
    return finish(c);
  });
}

/** Clay / shingle roof tiles for pitched roofs. */
export function shingleTexture(hex) {
  return cached(`shingle_${hex}`, () => {
    const S = 128;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = css(hex); ctx.fillRect(0, 0, S, S);
    for (let y = 0, row = 0; y < S; y += 16, row++) {
      for (let x = row % 2 ? -8 : 0; x < S; x += 16) {
        ctx.fillStyle = shade(hex, 0.88 + Math.random() * 0.22);
        ctx.fillRect(x + 0.5, y, 15, 16);
      }
      const g = ctx.createLinearGradient(0, y, 0, y + 16);
      g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g; ctx.fillRect(0, y, S, 16);
    }
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

/** Clock face for towers. */
export function clockTexture() {
  return cached('clock', () => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, 0, 128, 128);
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fillStyle = '#fbf8ee'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#c9a646'; ctx.stroke();
    ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42); ctx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(84, 48); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64, 22); ctx.stroke();
    return finish(c, { repeat: false });
  });
}

/** Rooftop helipad: ringed disc with an H. */
export function helipadTexture() {
  return cached('helipad', () => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(0, 0, 128, 128);
    ctx.lineWidth = 8; ctx.strokeStyle = '#f4d03f';
    ctx.beginPath(); ctx.arc(64, 64, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(40, 34, 12, 60); ctx.fillRect(76, 34, 12, 60); ctx.fillRect(40, 58, 48, 12);
    return finish(c, { repeat: false });
  });
}

/** Ploughed field rows (tinted by the material colour). */
export function furrowTexture() {
  return cached('furrow', () => {
    const [c, ctx] = makeCanvas(64, 64);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 8) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 0, 3, 64); }
    speckle(ctx, 64, 64, 200, 0.06, 2);
    return finish(c);
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

/** Floating "no road access" badge: a road with a dashed centre line. */
export function noRoadTexture() {
  return cached('noroad', () => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(64, 64, 50, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#3a3d42';
    ctx.beginPath(); ctx.moveTo(50, 14); ctx.lineTo(78, 14); ctx.lineTo(96, 114); ctx.lineTo(32, 114); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [y, h, w] of [[24, 14, 4], [48, 18, 5], [78, 24, 7]]) ctx.fillRect(64 - w / 2, y, w, h);
    ctx.restore();
    return finish(c, { repeat: false });
  });
}

/** Round sign with an emoji, ringed in the building type's colour. */
export function badgeTexture(icon, ringHex) {
  return cached(`badge_${icon}_${ringHex}`, () => {
    const S = 128;
    const [c, ctx] = makeCanvas(S, S);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#fbfaf6'; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = css(ringHex); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 63, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2b2f36'; // for platforms that draw this glyph as plain text
    ctx.fillText(icon, S / 2, S / 2 + 4);
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
