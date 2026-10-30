// A visible mirror of the control input. This module never requests a camera.
const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
const confidence = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  ? Math.min(p.visibility ?? 1, p.presence ?? 1) : 0;
const visible = (p, threshold = .45) => confidence(p) >= threshold &&
  p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Normalized image coordinates; y is top-to-bottom, x is optionally mirrored.
 * This reports landmark geometry, not real-world distance or emotion.
 */
export function poseSignals(points, { mirrored = true } = {}) {
  const p = Array.isArray(points) ? points : [];
  const shouldersVisible = visible(p[11]) && visible(p[12]);
  const leftWristVisible = visible(p[15]);
  const rightWristVisible = visible(p[16]);
  const wristsVisible = leftWristVisible && rightWristVisible;
  const shoulders = shouldersVisible ? midpoint(p[11], p[12]) : { x: .5, y: .5 };
  const wrist = rightWristVisible ? p[16] : leftWristVisible ? p[15] : shoulders;
  const mirror = x => clamp(mirrored ? 1 - x : x);
  const width = shouldersVisible ? Math.max(.04, distance(p[11], p[12])) : .2;
  return {
    torsoX: mirror(shoulders.x), torsoY: clamp(shoulders.y),
    wristX: mirror(wrist.x), wristY: clamp(wrist.y),
    armSpread: shouldersVisible && wristsVisible
      ? clamp((distance(p[15], p[16]) / width - .55) / 2.5) : 0,
    shouldersVisible, wristsVisible, leftWristVisible, rightWristVisible,
    confidence: shouldersVisible ? (confidence(p[11]) + confidence(p[12])) / 2 : 0,
    leftWristX: leftWristVisible ? mirror(p[15].x) : null,
    leftWristY: leftWristVisible ? clamp(p[15].y) : null,
    rightWristX: rightWristVisible ? mirror(p[16].x) : null,
    rightWristY: rightWristVisible ? clamp(p[16].y) : null
  };
}

const SEGMENTS = [[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
const JOINTS = [11,12,13,14,15,16,23,24,25,26,27,28];

export class BodyAvatar {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas?.getContext('2d') ?? null;
    this.source = 'idle';
    this.points = null;
    this.mirrored = true;
    this.state = { demo: false, x: .5, y: .45, lean: 0 };
    this.smoothed = null;
    this.disposed = false;
    this.lastFrame = 0;
    this.width = 240;
    this.height = 230;
    this.tick = this.tick.bind(this);
    if (this.context) {
      this.resize();
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
      }
      this.animation = requestAnimationFrame(this.tick);
    }
  }

  setPose(points, { source = 'camera', mirrored = true } = {}) {
    if (!Array.isArray(points) || !poseSignals(points, { mirrored }).shouldersVisible) {
      this.clear();
      return;
    }
    this.points = points.map(p => p ? { ...p } : null);
    this.mirrored = mirrored;
    this.source = source === 'demo' ? 'demo' : 'camera';
    this.state.demo = this.source === 'demo';
  }

  /** Pointer puppet: x moves/leans the torso; x/y move the gold right wrist.
   * Optional leftArm/rightArm: 0 = lowered, 1 = raised; lean: -1..1.
   */
  setState(partial = {}) {
    Object.assign(this.state, partial);
    if (partial.demo === true) { this.source = 'demo'; this.points = null; }
    if (partial.demo === false && this.source === 'demo') this.source = 'idle';
  }

  clear() {
    this.source = 'idle';
    this.points = null;
    this.state.demo = false;
  }

  resize() {
    if (!this.canvas || !this.context) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 240;
    this.height = rect.height || 230;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.smoothed = null;
  }

  demoPose() {
    const w = this.width, h = this.height;
    const active = this.source === 'demo';
    const x = active ? clamp(this.state.x) : .5;
    const y = active ? clamp(this.state.y) : .6;
    const lean = active ? clamp(this.state.lean || (x - .5) * 1.3, -1, 1) : 0;
    const sw = Math.min(w * .21, h * .21);
    const cx = w * .5 + (x - .5) * w * .22;
    const sy = h * .32;
    const hipX = cx - lean * sw * .45, hipY = h * .575;
    const p = [];
    const joint = (px, py, tracked = active) => ({ x: px, y: py, tracked });
    p[11] = joint(cx + sw / 2, sy + lean * sw * .1);
    p[12] = joint(cx - sw / 2, sy - lean * sw * .1);
    p[23] = joint(hipX + sw * .31, hipY);
    p[24] = joint(hipX - sw * .31, hipY);
    p[25] = joint(hipX + sw * .34, h * .73);
    p[26] = joint(hipX - sw * .34, h * .73);
    p[27] = joint(hipX + sw * .39, h * .875);
    p[28] = joint(hipX - sw * .39, h * .875);
    const leftRaise = clamp(this.state.leftArm ?? .12);
    const leftAngle = .25 + leftRaise * 2.4;
    p[15] = joint(p[11].x + Math.sin(leftAngle) * sw * 1.17,
      p[11].y + Math.cos(leftAngle) * sw * 1.5);
    p[13] = joint(p[11].x + (p[15].x - p[11].x) * .65 + sw * .1,
      p[11].y + (p[15].y - p[11].y) * .47);
    if (typeof this.state.rightArm === 'number') {
      const a = .25 + clamp(this.state.rightArm) * 2.4;
      p[16] = joint(p[12].x - Math.sin(a) * sw * 1.17,
        p[12].y + Math.cos(a) * sw * 1.5);
    } else {
      p[16] = joint(w * (.16 + x * .68), h * (.17 + y * .50));
    }
    p[14] = joint(p[12].x + (p[16].x - p[12].x) * .52 - sw * .22,
      p[12].y + (p[16].y - p[12].y) * .58 + sw * .17);
    p[0] = joint(cx + lean * sw * .18, sy - sw * .68);
    return { joints: p, headRadius: sw * .32, centerX: hipX, activeWrist: active ? 16 : null };
  }

  cameraPose() {
    const raw = this.points;
    if (!raw) return this.demoPose();
    const signals = poseSignals(raw, { mirrored: this.mirrored });
    if (!signals.shouldersVisible) return this.demoPose();
    const w = this.width, h = this.height;
    const source = raw.map(p => p ? { x: this.mirrored ? 1 - p.x : p.x, y: p.y, tracked: visible(p) } : null);
    const sc = midpoint(source[11], source[12]);
    const sw = Math.max(.04, distance(source[11], source[12]));
    const fallback = (index, x, y) => {
      if (!source[index]?.tracked) source[index] = { x, y, tracked: false };
    };
    // Missing landmarks are displayed as dashed reference anatomy, never as tracking.
    const leftSign = source[11].x >= source[12].x ? 1 : -1;
    fallback(0, sc.x, sc.y - sw * .66);
    fallback(23, sc.x + leftSign * sw * .31, sc.y + sw * 1.3);
    fallback(24, sc.x - leftSign * sw * .31, sc.y + sw * 1.3);
    for (const [shoulder, elbow, wrist, sign] of [[11,13,15,leftSign],[12,14,16,-leftSign]]) {
      fallback(elbow, source[shoulder].x + sign * sw * .26, sc.y + sw * .7);
      fallback(wrist, source[shoulder].x + sign * sw * .36, sc.y + sw * 1.4);
    }
    for (const [hip, knee, ankle, sign] of [[23,25,27,leftSign],[24,26,28,-leftSign]]) {
      fallback(knee, source[hip].x + sign * sw * .03, source[hip].y + sw * .86);
      fallback(ankle, source[knee].x + sign * sw * .05, source[knee].y + sw * .84);
    }
    const used = [0, ...JOINTS].map(i => source[i]);
    const minX = Math.min(...used.map(p => p.x)), maxX = Math.max(...used.map(p => p.x));
    const minY = Math.min(...used.map(p => p.y)) - sw * .35;
    const maxY = Math.max(...used.map(p => p.y)) + sw * .08;
    const scale = Math.min(h * .72 / Math.max(sw * 3.6, maxY - minY), w * .70 / Math.max(sw * 1.3, maxX - minX));
    const centerX = w * .5 + (signals.torsoX - .5) * w * .23;
    const topY = h * .16;
    const joints = source.map(p => p ? {
      x: clamp(centerX + (p.x - sc.x) * scale, w * .09, w * .91),
      y: topY + (p.y - minY) * scale, tracked: p.tracked
    } : null);
    return { joints, headRadius: Math.max(7, sw * scale * .32), centerX,
      activeWrist: signals.rightWristVisible ? 16 : signals.leftWristVisible ? 15 : null };
  }

  tick(now) {
    if (this.disposed) return;
    this.animation = requestAnimationFrame(this.tick);
    if (now - this.lastFrame < 30 || document.hidden || !this.canvas?.isConnected) return;
    this.lastFrame = now;
    this.draw();
  }

  draw() {
    const c = this.context;
    if (!c) return;
    const w = this.width, h = this.height;
    c.clearRect(0, 0, w, h);
    const target = this.source === 'camera' ? this.cameraPose() : this.demoPose();
    if (!this.smoothed) this.smoothed = target.joints.map(p => p ? { ...p } : null);
    const joints = target.joints.map((p, i) => {
      if (!p) return null;
      const last = this.smoothed[i] || p;
      return this.smoothed[i] = { x: last.x + (p.x - last.x) * .24,
        y: last.y + (p.y - last.y) * .24, tracked: p.tracked };
    });
    const active = this.source !== 'idle';
    c.save();
    // Quiet spatial reference makes leaning and wrist position easy to read.
    c.strokeStyle = 'rgba(141,211,225,.075)'; c.lineWidth = 1;
    c.setLineDash([2, 5]);
    c.beginPath(); c.moveTo(w / 2, h * .14); c.lineTo(w / 2, h * .9); c.stroke();
    c.setLineDash([]);
    const floorY = Math.min(h * .91, Math.max(joints[27].y, joints[28].y) + 7);
    const floor = c.createRadialGradient(target.centerX, floorY, 0, target.centerX, floorY, w * .34);
    floor.addColorStop(0, active ? 'rgba(105,223,238,.16)' : 'rgba(105,223,238,.07)');
    floor.addColorStop(1, 'rgba(105,223,238,0)');
    c.fillStyle = floor; c.beginPath(); c.ellipse(target.centerX, floorY, w * .34, h * .045, 0, 0, TAU); c.fill();
    const shoulders = midpoint(joints[11], joints[12]);
    const hips = midpoint(joints[23], joints[24]);
    const radius = target.headRadius;
    const neck = { x: shoulders.x, y: shoulders.y - radius * .28, tracked: active };
    const head = joints[0];
    c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = (a, b, thickness = 7) => {
      const tracked = active && a.tracked && b.tracked;
      c.save();
      c.strokeStyle = tracked ? '#a0e8ef' : 'rgba(133,180,195,.26)';
      c.lineWidth = tracked ? thickness : 2;
      c.setLineDash(tracked ? [] : [3, 4]);
      if (tracked) { c.shadowColor = 'rgba(88,218,238,.33)'; c.shadowBlur = 9; }
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
    };
    // Legs first, then the filled torso, then arms and head.
    for (const [a, b] of SEGMENTS.slice(4)) limb(joints[a], joints[b], Math.max(5, radius * .60));
    const torsoTracked = active && joints[11].tracked && joints[12].tracked;
    const torso = c.createLinearGradient(shoulders.x, shoulders.y, hips.x, hips.y);
    torso.addColorStop(0, torsoTracked ? 'rgba(128,226,239,.86)' : 'rgba(128,180,197,.12)');
    torso.addColorStop(1, torsoTracked ? 'rgba(71,140,163,.40)' : 'rgba(71,140,163,.05)');
    c.fillStyle = torso; c.strokeStyle = torsoTracked ? 'rgba(187,245,249,.80)' : 'rgba(133,180,195,.28)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(joints[11].x, joints[11].y);
    c.quadraticCurveTo(shoulders.x, shoulders.y + radius * .52, joints[12].x, joints[12].y);
    c.lineTo(joints[24].x, joints[24].y); c.quadraticCurveTo(hips.x, hips.y + radius * .3, joints[23].x, joints[23].y); c.closePath();
    c.fill(); c.stroke();
    limb(neck, { x: head.x, y: head.y + radius * .65, tracked: head.tracked }, radius * .6);
    for (const [a, b] of SEGMENTS.slice(0, 4)) limb(joints[a], joints[b], Math.max(5, radius * .54));
    // A face and solid head distinguish the avatar from an abstract skeleton.
    c.fillStyle = active && head.tracked ? '#d9f6f4' : '#54717e';
    c.shadowColor = active ? 'rgba(142,230,239,.5)' : 'transparent'; c.shadowBlur = active ? 13 : 0;
    c.beginPath(); c.ellipse(head.x, head.y, radius * .87, radius, -.07, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#214555';
    for (const sign of [-1, 1]) { c.beginPath(); c.arc(head.x + sign * radius * .27, head.y - radius * .06, Math.max(1, radius * .08), 0, TAU); c.fill(); }
    c.strokeStyle = '#3e6d7a'; c.lineWidth = 1; c.beginPath(); c.arc(head.x, head.y + radius * .17, radius * .24, .2, Math.PI - .2); c.stroke();
    for (const index of JOINTS) {
      const p = joints[index];
      if (!active || !p.tracked) continue;
      c.fillStyle = index === target.activeWrist ? '#ffda9c' : '#def9f7';
      c.beginPath(); c.arc(p.x, p.y, index === target.activeWrist ? 4.2 : 2.0, 0, TAU); c.fill();
    }
    if (target.activeWrist !== null) {
      const hand = joints[target.activeWrist];
      c.strokeStyle = 'rgba(255,211,143,.8)'; c.lineWidth = 1;
      c.beginPath(); c.arc(hand.x, hand.y, 9, 0, TAU); c.stroke();
      c.fillStyle = '#ffdcaa'; c.font = '8px ui-monospace, monospace';
      const labelX = hand.x > w * .57 ? hand.x - 48 : hand.x + 13;
      c.fillText('LIGHT', labelX, hand.y - 6);
    }
    c.font = '8px ui-monospace, monospace'; c.textBaseline = 'middle';
    c.fillStyle = this.source === 'camera' ? '#a6ecdb' : '#b2bfcb';
    c.fillText(this.source === 'camera' ? 'LIVE POSE · MIRRORED' : this.source === 'demo' ? 'POINTER PUPPET · DEMO' : 'WAITING FOR BODY', 12, 16);
    c.fillStyle = '#8ba8b8'; c.font = '7px ui-monospace, monospace';
    c.fillText(this.source === 'camera' ? 'DASHED = OUT OF VIEW' : this.source === 'demo' ? 'MOVE POINTER → BODY + HAND' : 'CAMERA OFF · NO TRACKING', 12, h - 9);
    c.restore();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.observer?.disconnect();
    this.context?.clearRect(0, 0, this.width, this.height);
    this.points = null;
  }
}
