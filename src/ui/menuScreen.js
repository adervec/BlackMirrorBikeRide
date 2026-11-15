import { div, h, el } from './dom.js';
import { getState, activePlayer } from '../state.js';
import { ftpWkg } from '../profile/player.js';
import { t, num } from '../i18n.js';

export function renderMenu(ctx) {
  const s = getState();
  const player = activePlayer();
  const tiles = [
    { id: 'routes',   title: t('Ride'),            sub: t('Pick a route and roll'),             go: 'routes' },
    { id: 'workouts', title: t('Workouts'),        sub: t('ERG intervals, .zwo files & FTP tests'), go: 'workouts' },
    { id: 'builder',  title: t('Virtual Routes'),  sub: t('Build segment-based worlds'),        go: 'builder' },
    { id: 'real',     title: t('Real Routes'),     sub: t('Ride a GPX file in 3D'),             go: 'real' },
    { id: 'garage',   title: t('Garage & Rider'),  sub: t('Bike build, body & avatar'),         go: 'garage' },
    { id: 'history',  title: t('History & PBs'),   sub: t('Past rides, bests, replays & TCX'),  go: 'history' },
    { id: 'settings', title: t('Settings'),        sub: t('Units, HUD, trainer, sound, ghost'), go: 'settings' }
  ];

  const grid = div({ class: 'menu-grid' }, tiles.map((tile) =>
    el('button', { class: 'menu-tile', onclick: () => ctx.router.go(tile.go) }, [
      h(2, tile.title), div({ class: 'menu-sub' }, tile.sub)
    ])
  ));

  const root = div({ class: 'screen menu-screen' }, [
    div({ class: 'hero' }, [
      h(1, 'BLACK MIRROR BIKE RIDE', { class: 'hero-title' }),
      div({ class: 'hero-sub' }, t('A homebrew indoor cycling sim — bring your own watts.'))
    ]),
    grid,
    div({ class: 'menu-footer' }, [
      div({}, t('Player: {name} · {kg} kg · FTP {ftp} W ({wkg} W/kg)', { name: player.name, kg: player.weightKg, ftp: player.ftpW, wkg: num(ftpWkg(player), 2) })),
      div({ class: 'dim' }, [t.n('{n} route', '{n} routes', s.routes.length), t.n('{n} rider', '{n} riders', s.riders.length), t.n('{n} bike', '{n} bikes', s.garage.bikes.length)].join(' · ')),
      div({}, el('a', { href: 'https://adervec.github.io', target: '_blank', rel: 'noopener noreferrer' }, t('More apps by this maker — adervec.github.io')))
    ])
  ]);
  return root;
}
