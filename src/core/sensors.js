// Accelerometer (R1 creationSensors or DeviceMotion), pedometer, compass heading, battery.
import { state, save, emit, today } from './store.js';
import { addXp, completeQuest } from './xp.js';

const accelSubs = new Set();
let accelRunning = false;
let motionHandler = null;

function dispatch(d) {
  accelSubs.forEach((fn) => fn(d));
}

// The R1 sends { rawX/Y/Z (m/s²), tiltX/Y/Z (-1..1) }; older docs show { x, y, z }. Normalize to g.
function fromR1(d) {
  if (!d) return;
  if (d.rawX !== undefined) dispatch({ x: d.rawX / 9.81, y: d.rawY / 9.81, z: d.rawZ / 9.81 });
  else if (d.tiltX !== undefined) dispatch({ x: d.tiltX, y: d.tiltY, z: d.tiltZ });
  else if (d.x !== undefined) dispatch({ x: d.x, y: d.y, z: d.z });
}

function startAccel() {
  if (accelRunning) return;
  accelRunning = true;
  const s = window.creationSensors?.accelerometer;
  if (s?.start) {
    try { s.start(fromR1, { frequency: 30 }); return; } catch {}
  }
  motionHandler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    dispatch({ x: a.x / 9.81, y: a.y / 9.81, z: a.z / 9.81 });
  };
  window.addEventListener('devicemotion', motionHandler);
}

function stopAccel() {
  if (!accelRunning) return;
  accelRunning = false;
  try { window.creationSensors?.accelerometer?.stop?.(); } catch {}
  if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
  motionHandler = null;
}

// Subscribe to {x,y,z} readings in g. Returns an unsubscribe function.
export function onAccel(fn) {
  accelSubs.add(fn);
  startAccel();
  return () => {
    accelSubs.delete(fn);
    if (!accelSubs.size) stopAccel();
  };
}

// ---- Pedometer ----
let stopPedo = null;
let slow = 1;
let above = false;
let lastStep = 0;

export function rollDay() {
  const d = today();
  if (state.stats.day === d) return;
  state.stats.day = d;
  state.stats.stepsToday = 0;
  for (const q of state.quests) if (q.type === 'daily') q.done = false;
  save();
  emit('quests');
}

function step() {
  rollDay();
  const st = state.stats;
  st.stepsToday++;
  st.stepsTotal++;
  st.stepsXpBank++;
  if (st.stepsXpBank >= 500) {
    st.stepsXpBank -= 500;
    addXp(5);
  }
  if (st.stepsToday === 10000) {
    const q = state.quests.find((q) => q.auto === 'steps' && !q.done);
    if (q) completeQuest(q);
  }
  save();
  emit('steps');
}

function onPedoReading({ x, y, z }) {
  const m = Math.hypot(x, y, z);
  slow = slow * 0.97 + m * 0.03;
  const d = m - slow;
  const now = performance.now();
  if (!above && d > 0.16 && now - lastStep > 280) {
    above = true;
    lastStep = now;
    step();
  } else if (above && d < 0.04) {
    above = false;
  }
}

export function setPedometer(enabled) {
  if (enabled && !stopPedo) stopPedo = onAccel(onPedoReading);
  if (!enabled && stopPedo) { stopPedo(); stopPedo = null; }
}

// ---- Compass heading (degrees, 0 = north) ----
// Diagnostic counters shown by the compass: which orientation events actually arrive.
export const headingStats = { abs: 0, rel: 0, empty: 0 };

// Heading of the device top edge. Flat: 360 - alpha. Held upright: tilt-compensated (W3C formula).
function headingFrom(alpha, beta, gamma) {
  if (Math.abs(beta ?? 0) < 45) return (360 - alpha + 360) % 360;
  const d = Math.PI / 180;
  const cX = Math.cos(beta * d), cY = Math.cos(gamma * d), cZ = Math.cos(alpha * d);
  const sX = Math.sin(beta * d), sY = Math.sin(gamma * d), sZ = Math.sin(alpha * d);
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI;
  else if (vx < 0) h += 2 * Math.PI;
  return (h * 180) / Math.PI;
}

/**
 * fn(heading, source): source is 'mag' (absolute, magnetometer) or 'gyro'
 * (relative alpha only; corrected by the north calibration offset).
 * Absolute events win: once one arrives, relative ones are ignored.
 */
export function onHeading(fn) {
  let gotAbs = false;
  const handler = (e) => {
    if (e.alpha == null && typeof e.webkitCompassHeading !== 'number') {
      headingStats.empty++;
      return;
    }
    if (typeof e.webkitCompassHeading === 'number') {
      headingStats.abs++;
      gotAbs = true;
      return fn(e.webkitCompassHeading, 'mag');
    }
    const h = headingFrom(e.alpha, e.beta, e.gamma);
    if (e.absolute || e.type === 'deviceorientationabsolute') {
      headingStats.abs++;
      gotAbs = true;
      return fn(h, 'mag');
    }
    headingStats.rel++;
    if (!gotAbs) fn((h - (state.settings.compassOffset || 0) + 360) % 360, 'gyro', h);
  };
  window.addEventListener('deviceorientationabsolute', handler);
  window.addEventListener('deviceorientation', handler);
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
  };
}

// Bearing in degrees from a to b ({lat, lon}).
export function bearing(a, b) {
  const d = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * d) * Math.cos(b.lat * d);
  const x = Math.cos(a.lat * d) * Math.sin(b.lat * d) - Math.sin(a.lat * d) * Math.cos(b.lat * d) * Math.cos((b.lon - a.lon) * d);
  return ((Math.atan2(y, x) / d) + 360) % 360;
}

// ---- Battery ----
export const battery = { level: null, charging: false };
export function initBattery() {
  navigator.getBattery?.().then((b) => {
    const upd = () => {
      battery.level = Math.round(b.level * 100);
      battery.charging = b.charging;
      emit('battery');
    };
    b.addEventListener('levelchange', upd);
    b.addEventListener('chargingchange', upd);
    upd();
  }).catch(() => {});
}
