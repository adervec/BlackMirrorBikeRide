// Garmin TCX export of a recorded activity. Plain XML, no positions — Strava,
// Intervals.icu and friends import it as a virtual/indoor ride with power, HR,
// cadence and speed. (FIT would be ~200 lines of binary encoding for no gain.)

import { profileAt } from '../routes/virtualRoute.js';

const iso = (ms) => new Date(ms).toISOString();

export function activityToTcx(activity, profile = null) {
  const endMs = Date.parse(activity.date) || Date.now();
  const startMs = endMs - (activity.durationS || 0) * 1000;
  const S = activity.samples || [];
  const kcal = Math.round((activity.energyJ || 0) / 4184);
  const maxSpeed = S.reduce((m, x) => Math.max(m, x.s || 0), 0);
  const hrs = S.map((x) => x.hr).filter((v) => v != null);
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;

  const tp = (x) => {
    const alt = profile ? profileAt(profile, x.d).y : null;
    return `      <Trackpoint>
        <Time>${iso(startMs + x.t * 1000)}</Time>${alt != null ? `
        <AltitudeMeters>${alt.toFixed(1)}</AltitudeMeters>` : ''}
        <DistanceMeters>${(x.d || 0).toFixed(1)}</DistanceMeters>${x.hr != null ? `
        <HeartRateBpm><Value>${Math.round(x.hr)}</Value></HeartRateBpm>` : ''}${x.c != null ? `
        <Cadence>${Math.round(x.c)}</Cadence>` : ''}
        <Extensions><ns3:TPX><ns3:Speed>${(x.s || 0).toFixed(2)}</ns3:Speed><ns3:Watts>${Math.round(x.p || 0)}</ns3:Watts></ns3:TPX></Extensions>
      </Trackpoint>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${iso(startMs)}</Id>
      <Lap StartTime="${iso(startMs)}">
        <TotalTimeSeconds>${(activity.durationS || 0).toFixed(1)}</TotalTimeSeconds>
        <DistanceMeters>${(activity.distanceM || 0).toFixed(1)}</DistanceMeters>
        <MaximumSpeed>${maxSpeed.toFixed(2)}</MaximumSpeed>
        <Calories>${kcal}</Calories>${avgHr != null ? `
        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>` : ''}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${S.map(tp).join('\n')}
        </Track>
        <Extensions><ns3:LX><ns3:AvgWatts>${Math.round(activity.avgPower || 0)}</ns3:AvgWatts></ns3:LX></Extensions>
      </Lap>
      <Notes>${escapeXml(activity.routeName || 'Ride')}${activity.reverse ? ' (reverse)' : ''} — Black Mirror Bike Ride</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function tcxFilename(activity) {
  const d = new Date(activity.date);
  const stamp = isNaN(d) ? 'ride' : d.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `${(activity.routeName || 'ride').replace(/\W+/g, '_')}_${stamp}.tcx`;
}
