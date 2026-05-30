// Simplified top-down map drawn on a 2D canvas — the overhead view that matches
// the ground-level world. Plots the route polyline (coloured by surface), start/
// finish flags, and a player icon oriented to heading.

import { profileAt } from '../routes/virtualRoute.js';
import { SURFACES, DEFAULT_SURFACE } from '../physics/surfaces.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.iconColor = '#ffcc00';
  }

  setProfile(profile, iconColor = '#ffcc00', endMode = 'complete') {
    this.profile = profile;
    this.iconColor = iconColor;
    this.endMode = endMode;
    this._fit();
  }

  _fit() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 200, h = c.clientHeight || 200;
    c.width = w * dpr; c.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;
    const b = this.profile.bounds;
    const pad = 16;
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxZ - b.minZ);
    this.scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    this.ox = (w - bw * this.scale) / 2 - b.minX * this.scale;
    this.oy = (h - bh * this.scale) / 2 - b.minZ * this.scale;
  }

  _px(x, z) { return [x * this.scale + this.ox, z * this.scale + this.oy]; }

  render(distance, ghostDistance = null) {
    if (!this.profile) return;
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.fillRect(0, 0, W, H);

    // route polyline coloured by surface
    const pts = this.profile.points;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const s = SURFACES[pts[i].surfaceId] || SURFACES[DEFAULT_SURFACE];
      ctx.strokeStyle = '#' + s.color.toString(16).padStart(6, '0');
      const [x0, y0] = this._px(pts[i - 1].x, pts[i - 1].z);
      const [x1, y1] = this._px(pts[i].x, pts[i].z);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }

    // start / finish + what happens at the terminus (complete/teleport/U-turn)
    const start = this._px(pts[0].x, pts[0].z);
    const end = this._px(pts[pts.length - 1].x, pts[pts.length - 1].z);
    this._flag(start[0], start[1], '#2ecc71');
    this._flag(end[0], end[1], '#e74c3c');
    const glyph = this.endMode === 'teleport' ? '⊚' : this.endMode === 'turnaround' ? '⟲' : '🏁';
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(glyph, end[0], end[1] - 8);

    // ghost (overhead map ONLY, per spec) — drawn under the player marker
    if (ghostDistance != null) {
      const g = profileAt(this.profile, ghostDistance);
      const [gx, gy] = this._px(g.x, g.z);
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '9px sans-serif'; ctx.fillText('👻', gx - 6, gy - 7);
    }

    // player
    const st = profileAt(this.profile, distance);
    const [px, py] = this._px(st.x, st.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(st.heading); // screen +y is world +z; heading measured x->z
    ctx.fillStyle = this.iconColor;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _flag(x, y, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
}
