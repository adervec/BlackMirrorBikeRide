// Minimal screen router. Each screen is a function (ctx) => HTMLElement, where
// ctx = { router, params, onCleanup(fn) }. Cleanup fires when leaving a screen
// (used by the ride screen to tear down the 3D session).

export class Router {
  constructor(root) {
    this.root = root;
    this.routes = {};
    this._cleanup = null;
    this.current = null;
  }

  register(name, fn) { this.routes[name] = fn; return this; }

  go(name, params = {}) {
    if (!this.routes[name]) { console.error('Unknown screen', name); return; }
    if (this._cleanup) { try { this._cleanup(); } catch (e) { console.warn(e); } this._cleanup = null; }
    this.root.innerHTML = '';
    const ctx = { router: this, params, onCleanup: (fn) => { this._cleanup = fn; } };
    const elem = this.routes[name](ctx);
    if (elem) this.root.appendChild(elem);
    this.current = name;
  }
}
