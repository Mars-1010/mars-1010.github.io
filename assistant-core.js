// Original, open-ended silk filaments suspended in a shallow 3D field.
// The homepage supplies the clock and the assistant's interaction state.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const palettes = {
  idle: [194, 216, 227],
  listening: [148, 228, 238],
  thinking: [185, 204, 239],
  responding: [220, 190, 244],
};
const states = Object.keys(palettes);
const rgba = (rgb, alpha) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;

export class AssistantCore {
  constructor(canvas, { compact = false } = {}) {
    this.canvas = canvas;
    this.compact = Boolean(compact);
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.w = this.h = this.dpr = 1;
    this.visible = true;
    this.disposed = false;
    this.state = 'idle';
    this.stateMix = [1, 0, 0, 0];
    this.color = [...palettes.idle];
    this.energy = this.currentEnergy = this.pulseEnergy = 0;
    this.pointer = { x: .5, y: .5, active: false };
    this.mouse = { x: 0, y: 0, active: 0 };
    this.previousTime = null;
    this.motionTime = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.resize();
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(canvas);
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? true;
      if (!this.visible) this.previousTime = null;
    }, { rootMargin: '100px' });
    this.observer.observe(canvas);
  }

  setState(state) {
    if (Object.hasOwn(palettes, state)) this.state = state;
  }

  setEnergy(value) {
    this.energy = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
  }

  setPointer(x, y, active = true) {
    this.pointer.x = Number.isFinite(x) ? clamp(x, 0, 1) : .5;
    this.pointer.y = Number.isFinite(y) ? clamp(y, 0, 1) : .5;
    this.pointer.active = Boolean(active);
  }

  pulse() {
    this.pulseEnergy = 1;
  }

  resize() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, bounds.width);
    this.h = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.w < 700 ? 1.7 : 1.6);
    this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.mobile = window.matchMedia('(max-width: 700px)').matches;
    this.tablet = !this.mobile && window.matchMedia('(max-width: 1100px)').matches;
    this.radius = this.compact ? Math.min(this.w, this.h) * .32
      : this.mobile ? Math.min(this.w * .385, this.h * .26)
      : this.tablet ? Math.min(this.w * .235, this.h * .30)
      : Math.min(this.w * .263, this.h * .338);
    this.cx = this.w * (this.compact ? .5 : this.mobile ? .5 : this.tablet ? .34 : .438);
    this.cy = this.h * (this.compact ? .5 : this.mobile ? .43 : .5);
  }

  draw(time = 0) {
    if (this.disposed || !this.ctx || !this.visible || this.w < 2 || this.h < 2) return;
    const stamp = Number.isFinite(time) ? time : 0;
    const dt = this.previousTime === null ? 1 / 30 : clamp(stamp - this.previousTime, 0, .07);
    this.previousTime = stamp;
    const moving = !this.reducedMotion.matches;
    // A held clock freezes ambient movement, while direct input still works.
    const staticInput = dt === 0 || !moving;
    const smooth = staticInput ? 1 : 1 - Math.exp(-dt * 4.5);
    this.currentEnergy += (this.energy - this.currentEnergy) * (staticInput ? 1 : 1 - Math.exp(-dt * 7));
    this.pulseEnergy *= Math.exp(-dt * 1.55);
    states.forEach((state, i) => {
      this.stateMix[i] += ((state === this.state ? 1 : 0) - this.stateMix[i]) * smooth;
    });
    for (let channel = 0; channel < 3; channel++) {
      this.color[channel] = states.reduce((sum, state, i) => sum + palettes[state][channel] * this.stateMix[i], 0);
    }
    this.mouse.x += (((this.pointer.x - .5) * 2) - this.mouse.x) * smooth;
    this.mouse.y += (((this.pointer.y - .5) * 2) - this.mouse.y) * smooth;
    this.mouse.active += ((this.pointer.active ? 1 : 0) - this.mouse.active) * smooth;
    const activity = this.stateMix[1] * .12 + this.stateMix[2] * .24 + this.stateMix[3] * .35;
    if (moving) this.motionTime += dt * (.72 + activity + this.currentEnergy * .36);
    this.paint(this.motionTime, this.currentEnergy * .7 + this.pulseEnergy * .3);
  }

  fieldPoint(lane, progress, t, energy) {
    const listen = this.stateMix[1];
    const think = this.stateMix[2];
    const respond = this.stateMix[3];
    const s = progress * 2 - 1;
    const envelope = Math.pow(Math.max(0, Math.sin(progress * Math.PI)), .72);
    const breathing = 1 + Math.sin(t * .43) * .035;
    const width = (.86 - listen * .28 + respond * .55 + energy * .1) * breathing;
    const alignment = 1 - think * .7;
    const drift = t * .145;
    const curl = Math.sin(s * 2.35 - drift + lane * .48);
    const fold = Math.sin(lane * 2.75 + s * 2.1 + drift * .74);
    const ripple = Math.sin(s * 8.5 - t * .47 + lane * 5.2) * .025 * (1 + energy * 2);
    let x = lane * width * envelope + curl * (.27 - think * .13) + ripple * alignment;
    let y = s * (1.18 - respond * .3) + lane * .11 + fold * envelope * .11 * alignment;
    let z = Math.cos(lane * 2.65 + s * 2.0 + drift * .61) * envelope * (.48 - think * .2);
    // During an answer, the upper and lower folds part into open wings.
    x += respond * Math.sin(s * 1.9 + lane * 2) * envelope * .14;
    y += respond * lane * Math.sin(progress * Math.PI) * .15;
    // Fine folds retain depth without forming a closed shell or a solid core.
    z += Math.sin(s * 4.4 + lane * 4.1 - drift) * .065 * alignment;
    const yaw = .35 + Math.sin(t * .11) * .17 + this.mouse.x * this.mouse.active * .2;
    const pitch = -.12 + this.mouse.y * this.mouse.active * .11;
    const roll = -.35 + Math.sin(t * .09) * .055 + respond * .21;
    const ax = x * Math.cos(yaw) + z * Math.sin(yaw);
    const az = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const ay = y * Math.cos(pitch) - az * Math.sin(pitch);
    z = y * Math.sin(pitch) + az * Math.cos(pitch);
    x = ax * Math.cos(roll) - ay * Math.sin(roll);
    y = ax * Math.sin(roll) + ay * Math.cos(roll);
    const perspective = 3.9 / (3.9 - z);
    return { x: x * perspective, y: y * perspective, z };
  }

  paint(t, energy) {
    const c = this.ctx;
    const r = this.radius;
    const color = this.color;
    const listen = this.stateMix[1];
    const respond = this.stateMix[3];
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = this.compact ? '#121619' : '#050809';
    c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.translate(this.cx, this.cy);

    // Broad, asymmetric light haze sits behind the threads, never a solid fill.
    c.save();
    c.rotate(-.4);
    c.scale(.75 + respond * .2, 1.22);
    const haze = c.createRadialGradient(-r * .13, -r * .1, 0, 0, 0, r * 1.42);
    haze.addColorStop(0, rgba(color, .038 + energy * .018));
    haze.addColorStop(.35, rgba(color, .018));
    haze.addColorStop(1, rgba(color, 0));
    c.fillStyle = haze;
    c.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    c.restore();

    const count = this.compact ? 38 : this.mobile ? 65 : 88;
    const segments = this.compact ? 42 : this.mobile ? 68 : 88;
    const filaments = [];
    for (let j = 0; j < count; j++) {
      const lane = j / (count - 1) * 2 - 1;
      const start = .015 + (.5 + .5 * Math.sin(j * 2.399)) * .045;
      const finish = .965 + Math.cos(j * 1.71) * .026;
      const points = [];
      let depth = 0;
      for (let i = 0; i <= segments; i++) {
        const u = start + i / segments * (finish - start);
        const point = this.fieldPoint(lane, u, t, energy);
        points.push(point);
        depth += point.z;
      }
      filaments.push({ points, depth: depth / points.length, index: j });
    }
    filaments.sort((a, b) => a.depth - b.depth);
    c.globalCompositeOperation = 'screen';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const filament of filaments) {
      const { points, depth, index } = filament;
      const front = clamp((depth + .5) / .9, 0, 1);
      const brightness = .55 + .45 * Math.pow(Math.sin(index * 2.399), 2);
      const alpha = ((this.compact ? .2 : .12) + front * .3) * brightness * (1 + listen * .14 + energy * .3);
      const first = points[0];
      const last = points[points.length - 1];
      const light = c.createLinearGradient(first.x * r, first.y * r, last.x * r, last.y * r);
      light.addColorStop(0, rgba(color, .02));
      light.addColorStop(.18, rgba(color, .42));
      light.addColorStop(.44, rgba([228, 242, 246], .95));
      light.addColorStop(.7, rgba(color, .72));
      light.addColorStop(1, rgba(color, .02));
      c.strokeStyle = light;
      this.trace(c, points, r);
      c.lineWidth = this.compact ? 2.2 : 3.4;
      c.globalAlpha = alpha * .075;
      c.stroke();
      c.lineWidth = this.compact ? .51 + front * .16 : .48 + front * .3;
      c.globalAlpha = alpha;
      c.stroke();

      // Light travels along the open filaments, like a thought taking shape.
      if (index % (this.compact ? 4 : 3) === 0) {
        const phase = (t * (.045 + listen * .018 + respond * .024) + index * .071) % 1;
        const n = Math.min(points.length - 2, Math.floor(phase * (points.length - 1)));
        const a = points[n];
        const b = points[n + 1];
        const mix = phase * (points.length - 1) - n;
        const x = (a.x + (b.x - a.x) * mix) * r;
        const y = (a.y + (b.y - a.y) * mix) * r;
        const visibility = Math.pow(Math.sin(phase * Math.PI), 2);
        c.globalAlpha = (.32 + front * .5) * visibility;
        c.fillStyle = rgba(color, .85);
        c.beginPath();
        c.arc(x, y, this.compact ? .65 : .8 + front * .35, 0, TAU);
        c.fill();
      }
    }

    // Sparse particles are drawn through the same space, rather than on a rim.
    const dustCount = this.compact ? 16 : 46;
    for (let k = 0; k < dustCount; k++) {
      const lane = Math.sin(k * 2.3999) * (1.05 + respond * .15);
      const u = (k * .618034 + t * .018 * (k % 2 ? 1 : -1) + 20) % 1;
      const point = this.fieldPoint(lane, u, t, energy);
      const outward = .07 + (.5 + .5 * Math.sin(k * 7.1)) * (.22 - listen * .11);
      const x = (point.x + Math.sin(k * 3.1 + t * .09) * outward) * r;
      const y = (point.y + Math.cos(k * 1.7 - t * .07) * outward) * r;
      const fade = Math.pow(Math.sin(u * Math.PI), .8);
      c.globalAlpha = fade * (.13 + .28 * (.5 + .5 * Math.sin(k * 1.91 + t * .11)));
      c.fillStyle = rgba(color, 1);
      c.beginPath();
      c.arc(x, y, this.compact ? .43 : .5 + (k % 3) * .18, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  trace(c, points, radius) {
    c.beginPath();
    c.moveTo(points[0].x * radius, points[0].y * radius);
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      const next = points[i + 1];
      c.quadraticCurveTo(point.x * radius, point.y * radius,
        (point.x + next.x) * radius * .5, (point.y + next.y) * radius * .5);
    }
    const last = points[points.length - 1];
    c.lineTo(last.x * radius, last.y * radius);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.resizer?.disconnect();
    this.observer?.disconnect();
  }
}
