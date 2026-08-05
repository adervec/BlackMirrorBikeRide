// Cloud-sync configuration (Google Drive appData — opt-in, no backend).
//
// Mirrors the arrangement used by the sibling apps (Tachyread, GuitarPicker,
// GymTracker, ChessRetabled…): nothing here causes a network request. Google's
// script is fetched, and a token requested, only when someone clicks
// "Connect Google Drive" in Settings.
//
// The client ID below is a PUBLIC identifier, not a secret — safe to commit, and
// deliberately shared with the author's other local-first apps so they all work
// on adervec.github.io with zero per-user setup. Security is twofold: Google
// enforces the "Authorized JavaScript origins" registered for the project, AND
// the OAUTH_ORIGINS gate below refuses it app-side on any origin we don't expect,
// so a fork redeployed elsewhere must supply its own ID.
//
// Sync uses the user's OWN Drive "appDataFolder" — a hidden, app-private space.
// We request only the minimal `drive.appdata` scope (which never sees the rest of
// the user's Drive), plus the identity scopes so Settings can show which account
// is connected. Because that folder is per-Google-project, the sibling apps share
// it — the distinct SYNC_FILENAME below is what keeps them apart.
export const BUILTIN_CLIENT_ID = '547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com';

export const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
export const SYNC_FILENAME = 'bmbr-sync.json';

// Origins permitted to use the built-in client ID. localhost / 127.0.0.1 (any
// port) are always allowed for local dev. GitHub Pages serves this app from
// https://adervec.github.io/BlackMirrorBikeRide/ — same ORIGIN as the siblings,
// so the existing registration already covers it.
export const OAUTH_ORIGINS = ['https://adervec.github.io'];

export function originAllowed() {
  if (typeof location === 'undefined') return true; // non-browser (tests): nothing to police
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
    return OAUTH_ORIGINS.includes(location.origin);
  } catch { return false; }
}

// The client ID to actually use. A user-supplied one (fork / self-host, set in
// Settings) always wins; otherwise the built-in ID, but only on an allowed
// origin. Empty string means sync is unavailable here — fail closed on forks.
export function driveClientId(override = '') {
  return String(override || '').trim() || (originAllowed() ? BUILTIN_CLIENT_ID : '');
}

export function syncConfigured(override) { return !!driveClientId(override); }
