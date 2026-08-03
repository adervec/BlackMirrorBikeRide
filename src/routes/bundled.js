// Bundled routes: enriched route JSON files shipped in public/routes/ (authored
// by the `gpx-route` Claude skill, deployed with the app). Fetched at startup
// and merged into state; every failure degrades to "no bundled routes".

export async function loadBundledRoutes() {
  try {
    const base = import.meta.env.BASE_URL; // '/' in dev, '/BlackMirrorBikeRide/' on Pages
    const idx = await (await fetch(`${base}routes/index.json`, { cache: 'no-cache' })).json();
    const out = [];
    for (const f of idx.routes || []) {
      try { out.push(await (await fetch(`${base}routes/${f}`)).json()); } catch {}
    }
    return out;
  } catch { return []; }
}
