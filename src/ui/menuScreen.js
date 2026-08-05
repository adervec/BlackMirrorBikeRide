import { div, h, el } from './dom.js';
import { getState, activePlayer } from '../state.js';
import { ftpWkg } from '../profile/player.js';

export function renderMenu(ctx) {
  const s = getState();
  const player = activePlayer();
  const tiles = [
    { id: 'routes',   title: 'Ride',            sub: 'Pick a route and roll',         go: 'routes' },
    { id: 'builder',  title: 'Virtual Routes',  sub: 'Build segment-based worlds',    go: 'builder' },
    { id: 'real',     title: 'Real Routes',     sub: 'Ride a GPX file in 3D',         go: 'real' },
    { id: 'garage',   title: 'Garage & Rider',  sub: 'Bike build, body & avatar',     go: 'garage' },
    { id: 'history',  title: 'History & PBs',   sub: 'Past rides, bests & replays',   go: 'history' },
    { id: 'settings', title: 'Settings',        sub: 'Units, HUD, ghost, sensors',    go: 'settings' }
  ];

  const grid = div({ class: 'menu-grid' }, tiles.map((t) =>
    el('button', { class: 'menu-tile', onclick: () => ctx.router.go(t.go) }, [
      h(2, t.title), div({ class: 'menu-sub' }, t.sub)
    ])
  ));

  const root = div({ class: 'screen menu-screen' }, [
    div({ class: 'hero' }, [
      h(1, 'BLACK MIRROR BIKE RIDE', { class: 'hero-title' }),
      div({ class: 'hero-sub' }, 'A homebrew indoor cycling sim — bring your own watts.')
    ]),
    grid,
    div({ class: 'menu-footer' }, [
      div({}, `Player: ${player.name} · ${player.weightKg} kg · FTP ${player.ftpW} W (${ftpWkg(player).toFixed(2)} W/kg)`),
      div({ class: 'dim' }, `${s.routes.length} routes · ${s.riders.length} rider(s) · ${s.garage.bikes.length} bike(s)`)
    ])
  ]);
  return root;
}
