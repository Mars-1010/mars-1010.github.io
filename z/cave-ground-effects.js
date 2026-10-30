/** Ground-plane responses for the actual Damo installation photographs. */
const TAU = Math.PI * 2;
const bounded = (n, fallback = .5) => Number.isFinite(Number(n)) ? Math.max(0, Math.min(1, Number(n))) : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, n) => { const t = bounded((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const angular = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class GroundEffects {
  constructor() {
    this.style = 'lotus';
    this.state = { x: .5, y: .5, bodyX: null, bodyY: null, source: 'pointer', isActive: false, isTracking: false, energy: .6, calm: .45, original: false, mode: 'memory', photo: 'projection', paused: false };
    this.clock = 0;
    this.events = [];
    this.pending = [];
    this.lastInput = null;
    this.lastSample = null;
    this.lastStamp = null;
    this.distance = 0;
    this.sequence = 0;
    this.motion = 0;
    this.repelUntil = 0;
    this.fish = [];
    this.resetFish();
  }

  setStyle(style) {
    if (!['lotus', 'water', 'fish', 'trace'].includes(style) || style === this.style) return;
    this.style = style;
    this.clear();
  }

  setState(partial = {}) {
    const old = this.state;
    const discontinuity = ['mode', 'photo', 'source'].some(key => key in partial && partial[key] !== old[key]);
    if (partial.memoryStyle) this.setStyle(partial.memoryStyle);
    this.state = { ...old, ...partial };
    for (const key of ['x', 'y', 'energy', 'calm']) this.state[key] = bounded(this.state[key], old[key]);
    for (const key of ['bodyX', 'bodyY']) this.state[key] = this.state[key] == null ? null : bounded(this.state[key]);
    if (discontinuity) this.breakPath();
    if (!this.active() || this.state.original || this.state.paused || this.state.mode !== 'memory') { this.breakPath(); return; }
    const body = this.state.source === 'body' && this.state.bodyX != null && this.state.bodyY != null;
    const point = { u: body ? this.state.bodyX : this.state.x, v: 1 - (body ? this.state.bodyY : this.state.y) };
    if (!this.lastInput || Math.hypot(point.u - this.lastInput.u, point.v - this.lastInput.v) > .005) {
      this.pending.push(point);
      if (this.pending.length > 32) this.pending.shift();
      this.lastInput = point;
    }
  }

  active() { return !!this.state.isActive && (this.state.source === 'pointer' || !!this.state.isTracking); }

  breakPath() { this.pending.length = 0; this.lastInput = null; this.lastSample = null; this.lastStamp = null; this.distance = 0; }

  clear() {
    this.events.length = 0;
    this.breakPath();
    this.sequence = 0;
    this.motion = 0;
    this.repelUntil = 0;
    this.clock = 0;
    this.resetFish();
  }

  resetFish() {
    this.fish = Array.from({ length: 5 }, (_, i) => ({
      u: [.27, .43, .64, .75, .53][i], v: [.43, .72, .5, .82, .27][i],
      angle: [.2, 2.7, 3.4, 4.5, 1.2][i], seed: i * 1.79, size: [.94, 1.14, .83, .96, .79][i],
      history: [], trailAt: -1, turn: 0,
    }));
  }

  ground(photo, w, h) {
    const narrow = photo === 'floor';
    return { w, h, top: h * (narrow ? .89 : .73), bottom: h * .98, narrow };
  }

  map(u, v, ground) {
    const depth = bounded(v);
    const spread = mix(.65, .9, depth);
    return { x: ground.w * (.5 + (bounded(u) - .5) * spread), y: mix(ground.top, ground.bottom, Math.pow(depth, .88)), depth };
  }

  consume() {
    let moved = 0;
    const spacing = this.style === 'water' ? .09 : this.style === 'trace' ? .025 : .1;
    for (const point of this.pending) {
      if (!this.lastSample) {
        this.addEvent(point);
        this.lastSample = point;
        this.lastStamp = point;
        this.distance = 0;
        continue;
      }
      const previous = this.lastSample;
      const du = point.u - previous.u, dv = point.v - previous.v;
      const length = Math.hypot(du, dv);
      moved += length;
      if (length > .32) { this.lastSample = point; this.lastStamp = point; this.distance = 0; this.addEvent(point); continue; }
      if (length < .00001) continue;
      // Distance from the last actual step rejects stationary camera jitter.
      // Small alternating landmark noise cannot accumulate into endless blooms.
      let emitted = 0;
      while (this.lastStamp && emitted < 7) {
        const su = point.u - this.lastStamp.u, sv = point.v - this.lastStamp.v;
        const stride = Math.hypot(su, sv);
        if (stride < spacing) break;
        const step = { u: this.lastStamp.u + su / stride * spacing, v: this.lastStamp.v + sv / stride * spacing, angle: Math.atan2(dv, du) };
        this.addEvent(step);
        this.lastStamp = step;
        emitted++;
      }
      this.lastSample = point;
    }
    this.pending.length = 0;
    return moved;
  }

  addEvent(point) {
    if (this.style === 'fish') return;
    const side = this.sequence % 2 ? 1 : -1;
    const offset = this.style === 'lotus' ? .012 * side : 0;
    this.events.push({ ...point, u: bounded(point.u + offset), born: this.clock, seed: this.sequence++ * 2.39996, style: this.style });
    const limit = this.style === 'water' ? 16 : this.style === 'lotus' ? 28 : 64;
    if (this.events.length > limit) this.events.splice(0, this.events.length - limit);
  }

  draw(ctx, { width, height, dt = 1 / 30, photo = this.state.photo, paused = false } = {}) {
    if (!ctx || !width || !height || this.state.original) { this.breakPath(); return; }
    const freeze = paused || this.state.paused;
    const elapsed = freeze ? 0 : Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 1 / 30));
    this.clock += elapsed;
    let moved = 0;
    if (freeze) this.breakPath();
    else if (this.active()) moved = this.consume();
    else this.breakPath();
    if (elapsed) {
      this.motion = mix(this.motion, moved / elapsed, 1 - Math.exp(-elapsed * 10));
      if (this.motion > .95) this.repelUntil = this.clock + .9;
    }
    const ground = this.ground(photo, width, height);
    const lifetime = this.style === 'water' ? 6 : this.style === 'trace' ? 20 : 28;
    this.events = this.events.filter(event => this.clock - event.born < lifetime);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(width * .13, ground.top - 2);
    ctx.lineTo(width * .87, ground.top - 2);
    ctx.lineTo(width * .99, ground.bottom + 2);
    ctx.lineTo(width * .01, ground.bottom + 2);
    ctx.closePath();
    ctx.clip();
    if (this.style === 'fish') { this.updateFish(elapsed); this.drawPond(ctx, ground); this.drawFishSchool(ctx, ground); }
    else for (const event of this.events) {
      const age = this.clock - event.born;
      if (this.style === 'lotus') this.drawLotus(ctx, ground, event, age);
      else if (this.style === 'water') this.drawWater(ctx, ground, event, age);
      else this.drawTrace(ctx, ground, event, age);
    }
    ctx.restore();
  }

  drawLotus(ctx, ground, event, age) {
    const p = this.map(event.u, event.v, ground);
    const fade = (1 - smooth(19, 28, age)) * smooth(0, .2, age);
    const bloom = smooth(0, 1.8, age);
    const radius = Math.min(ground.w * .046, ground.h * .097) * mix(.68, 1.1, p.depth);
    const flat = ground.narrow ? .26 : .43;
    const turn = event.seed * .29;
    ctx.save(); ctx.translate(p.x, p.y);
    // A translucent pool of reflected pearl-light anchors the raised flower.
    ctx.save(); ctx.scale(1, flat);
    const reflection = ctx.createRadialGradient(0, radius * .12, 1, 0, radius * .12, radius * 1.42);
    reflection.addColorStop(0, 'rgba(190,220,234,.15)');
    reflection.addColorStop(.48, 'rgba(185,176,214,.07)');
    reflection.addColorStop(1, 'rgba(171,221,227,0)');
    ctx.globalAlpha = fade * bloom; ctx.fillStyle = reflection;
    ctx.beginPath(); ctx.ellipse(0, radius * .12, radius * 1.42, radius * 1.42, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = fade * bloom * .2; ctx.lineWidth = .65 / flat;
    ctx.strokeStyle = '#d4eff1';
    ctx.beginPath(); ctx.ellipse(0, radius * .15, radius * (1.2 + Math.sin(age * .4) * .025), radius * .86, -.09, .12, Math.PI * .83); ctx.stroke();
    ctx.restore();

    // Each petal has its own curved lip, translucency and unfolding phase.
    // The staggered, uneven crowns read as a flower rather than a radial icon.
    const rings = [
      { count: 7, reach: 1, width: .4, delay: 0, opacity: .54 },
      { count: 6, reach: .77, width: .35, delay: .24, opacity: .72 },
      { count: 5, reach: .58, width: .26, delay: .48, opacity: .78 },
    ];
    for (let layer = 0; layer < rings.length; layer++) {
      const ring = rings[layer];
      const petals = Array.from({ length: ring.count }, (_, i) => {
        const noise = Math.sin(event.seed * 1.9 + i * 3.61 + layer * 8.7);
        const angle = i / ring.count * TAU + turn + layer * .49 + noise * .07;
        return { i, noise, angle, depth: -Math.cos(angle) };
      }).sort((a, b) => a.depth - b.depth);
      for (const petal of petals) {
        const grow = smooth(ring.delay + petal.i * .038, ring.delay + 1.45 + petal.i * .038, age);
        if (grow <= 0) continue;
        const reach = radius * ring.reach * mix(.24, 1, grow) * (1 + petal.noise * .075);
        const broad = radius * ring.width * mix(.28, 1, grow) * (1 - petal.noise * .055);
        const curve = broad * (.16 + petal.noise * .13);
        ctx.save(); ctx.translate(0, -radius * layer * .075 * grow);
        ctx.scale(1, flat + layer * .12); ctx.rotate(petal.angle);
        const silk = ctx.createLinearGradient(-broad * .5, radius * .08, broad * .25, -reach);
        silk.addColorStop(0, 'rgba(117,133,173,.18)');
        silk.addColorStop(.23, 'rgba(190,179,214,.58)');
        silk.addColorStop(.62, layer === 2 ? 'rgba(245,229,234,.86)' : 'rgba(236,210,229,.76)');
        silk.addColorStop(.88, 'rgba(255,244,248,.83)');
        silk.addColorStop(1, 'rgba(228,241,253,.52)');
        ctx.globalAlpha = fade * ring.opacity * grow;
        ctx.fillStyle = silk;
        ctx.beginPath(); ctx.moveTo(0, radius * .08);
        ctx.bezierCurveTo(-broad * .86, -reach * .03, -broad * 1.08, -reach * .55, curve, -reach);
        ctx.bezierCurveTo(broad * .62, -reach * 1.015, broad * 1.05, -reach * .26, 0, radius * .08);
        ctx.fill();
        // The lit lip occupies only one edge; there is no enclosing outline.
        ctx.globalAlpha = fade * grow * (.3 + layer * .045);
        const lip = ctx.createLinearGradient(-broad, 0, curve, -reach);
        lip.addColorStop(0, 'rgba(221,225,252,0)'); lip.addColorStop(.68, 'rgba(255,251,255,.65)'); lip.addColorStop(1, 'rgba(238,250,255,.95)');
        ctx.strokeStyle = lip; ctx.lineWidth = Math.max(.6, radius * .014);
        ctx.beginPath(); ctx.moveTo(-broad * .56, -reach * .35);
        ctx.bezierCurveTo(-broad * .72, -reach * .66, -broad * .32, -reach * .86, curve, -reach); ctx.stroke();
        ctx.globalAlpha = fade * grow * .13;
        ctx.strokeStyle = '#fff7fb'; ctx.lineWidth = .5;
        for (const vein of [-.24, .12]) {
          ctx.beginPath(); ctx.moveTo(0, radius * .025);
          ctx.bezierCurveTo(broad * vein, -reach * .2, broad * vein + curve * .6, -reach * .58, curve, -reach * .92); ctx.stroke();
        }
        // One tiny lenticular dew reflection, only on a few exposed petals.
        if ((petal.i + layer) % 4 === 0) {
          ctx.globalAlpha = fade * grow * .68;
          const dx = curve * .3 - broad * .11, dy = -reach * .62;
          const dew = ctx.createRadialGradient(dx - .6, dy - .8, 0, dx, dy, radius * .039);
          dew.addColorStop(0, 'rgba(255,255,255,.98)'); dew.addColorStop(.28, 'rgba(219,250,255,.6)'); dew.addColorStop(1, 'rgba(207,225,250,0)');
          ctx.fillStyle = dew; ctx.beginPath(); ctx.ellipse(dx, dy, radius * .041, radius * .052, -.3, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    // Fine ivory stamens emerge from a pearl centre without a solid gold disc.
    const centre = fade * smooth(.8, 1.9, age);
    ctx.save(); ctx.translate(0, -radius * .13 * bloom); ctx.scale(1, flat + .15);
    ctx.globalAlpha = centre * .75;
    const heart = ctx.createRadialGradient(0, -radius * .03, 0, 0, 0, radius * .24);
    heart.addColorStop(0, 'rgba(255,247,222,.75)'); heart.addColorStop(.45, 'rgba(245,227,219,.32)'); heart.addColorStop(1, 'rgba(235,217,238,0)');
    ctx.fillStyle = heart; ctx.beginPath(); ctx.arc(0, 0, radius * .24, 0, TAU); ctx.fill();
    for (let i = 0; i < 11; i++) {
      const a = i * 2.39996 + event.seed, reach = radius * (.095 + (i % 3) * .027);
      const x = Math.cos(a) * reach, y = Math.sin(a) * reach - radius * .018;
      ctx.globalAlpha = centre * .57; ctx.strokeStyle = '#f6e6cc'; ctx.lineWidth = .55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(x * .7, y - radius * .035, x, y); ctx.stroke();
      ctx.globalAlpha = centre * .84; ctx.fillStyle = '#fff6dc';
      ctx.beginPath(); ctx.ellipse(x, y, radius * .016, radius * .023, a, 0, TAU); ctx.fill();
    }
    ctx.restore(); ctx.restore();
  }

  drawWater(ctx, ground, event, age) {
    const p = this.map(event.u, event.v, ground);
    const scale = mix(.68, 1.13, p.depth);
    const flat = ground.narrow ? .25 : .4;
    const maxRadius = Math.min(ground.w * .13, ground.h * .26) * scale;
    ctx.save(); ctx.translate(p.x, p.y);
    // Refraction appears in a few uneven glancing highlights, never wire rings.
    for (let wave = 0; wave < 2; wave++) {
      const t = age - wave * .47;
      if (t <= 0 || t > 4.8) continue;
      const radius = 2 + maxRadius * (1 - Math.exp(-t * .51));
      const alpha = 1.1 * Math.pow(1 - t / 4.8, 1.35) * smooth(0, .16, t) * (wave ? .2 : 1);
      const start = event.seed * .37 + wave * 1.31;
      const arcPath = (from, length, offset = 0) => {
        ctx.beginPath();
        const pieces = 26;
        for (let i = 0; i <= pieces; i++) {
          const a = from + i / pieces * length;
          const r = radius * (1 + Math.sin(a * 3 + event.seed) * .016 + Math.sin(a * 5 - t * .7) * .006) + offset;
          const x = Math.cos(a) * r, y = Math.sin(a) * r * flat;
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      };
      // A very narrow refractive band displaces the photograph itself. Copying
      // the current canvas is deliberate: only this clipped water lip is shifted.
      if (wave === 0 && ctx.canvas && radius > 6) {
        ctx.save(); ctx.beginPath();
        ctx.ellipse(0, 0, radius + 2.6, (radius + 2.6) * flat, 0, 0, TAU);
        ctx.ellipse(0, 0, radius - 2.6, (radius - 2.6) * flat, 0, 0, TAU, true);
        ctx.clip('evenodd'); ctx.globalAlpha = alpha * .3;
        ctx.drawImage(ctx.canvas, -p.x + 2.4, -p.y - .7, ground.w, ground.h);
        ctx.restore();
      }
      ctx.save(); ctx.scale(1, flat);
      const lens = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.025);
      lens.addColorStop(0, 'rgba(155,211,232,0)');
      lens.addColorStop(.86, 'rgba(155,211,232,0)');
      lens.addColorStop(.935, 'rgba(12,39,54,.22)');
      lens.addColorStop(.963, 'rgba(170,220,237,.22)');
      lens.addColorStop(.982, 'rgba(237,253,255,.4)');
      lens.addColorStop(1, 'rgba(196,230,245,0)');
      ctx.globalAlpha = alpha * .48; ctx.fillStyle = lens;
      ctx.beginPath(); ctx.arc(0, 0, radius * 1.025, 0, TAU); ctx.fill(); ctx.restore();
      ctx.globalAlpha = alpha * .25; ctx.strokeStyle = '#102b3b'; ctx.lineWidth = 2.1;
      arcPath(0, TAU, 1.4); ctx.stroke();
      ctx.globalAlpha = alpha * .13; ctx.strokeStyle = '#c6ecf4'; ctx.lineWidth = .68;
      arcPath(0, TAU); ctx.stroke();
      for (let glint = 0; glint < 3; glint++) {
        const angle = start + glint * 2.17;
        ctx.globalAlpha = alpha * (.98 - glint * .17);
        const sheen = ctx.createLinearGradient(Math.cos(angle) * radius, Math.sin(angle) * radius * flat, Math.cos(angle + 1.1) * radius, Math.sin(angle + 1.1) * radius * flat);
        sheen.addColorStop(0, 'rgba(223,251,255,0)'); sheen.addColorStop(.45, 'rgba(235,254,255,.95)'); sheen.addColorStop(1, 'rgba(195,237,250,0)');
        ctx.strokeStyle = sheen; ctx.lineWidth = glint === 0 ? 1.35 : .88;
        arcPath(angle, 1.1 + glint * .17, glint === 1 ? -1.2 : .1); ctx.stroke();
      }
      // A faint, offset shimmer lets the stone remain visible through the water.
      ctx.globalAlpha = alpha * .08;
      const refraction = ctx.createRadialGradient(radius * -.12, 0, 0, 0, 0, radius);
      refraction.addColorStop(0, 'rgba(175,231,238,0)'); refraction.addColorStop(.76, 'rgba(209,244,248,.6)'); refraction.addColorStop(1, 'rgba(191,226,244,0)');
      ctx.save(); ctx.scale(1, flat); ctx.fillStyle = refraction; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (age < .72) {
      const t = age / .72;
      const dropHeight = Math.sin(t * Math.PI) * maxRadius * .13;
      for (let i = 0; i < 5; i++) {
        const a = event.seed + i * 2.39996;
        const reach = Math.sin(t * Math.PI * .6) * maxRadius * (.028 + i * .009);
        const x = Math.cos(a) * reach, y = Math.sin(a) * reach * flat - dropHeight * (1 - i * .13);
        const r = Math.max(.6, (1.5 - i * .14) * scale);
        ctx.globalAlpha = Math.pow(1 - t, .65) * .73;
        const droplet = ctx.createRadialGradient(x - r * .25, y - r * .4, 0, x, y, r * 1.6);
        droplet.addColorStop(0, '#f5fdff'); droplet.addColorStop(.3, 'rgba(208,245,255,.58)'); droplet.addColorStop(1, 'rgba(160,217,241,0)');
        ctx.fillStyle = droplet; ctx.beginPath(); ctx.ellipse(x, y, r, r * (1.2 + .6 * (1 - t)), a * .08, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  updateFish(dt) {
    if (!dt) return;
    const body = this.state.source === 'body' && this.state.bodyX != null && this.state.bodyY != null;
    const active = this.active();
    const target = { u: body ? this.state.bodyX : this.state.x, v: 1 - (body ? this.state.bodyY : this.state.y) };
    for (const fish of this.fish) {
      const orbit = this.clock * (.19 + fish.size * .025) + fish.seed;
      let tx = .5 + Math.cos(orbit) * (.18 + .08 * Math.sin(fish.seed));
      let ty = .56 + Math.sin(orbit * .83) * .27;
      if (active) {
        if (this.clock < this.repelUntil) {
          const du = fish.u - target.u, dv = fish.v - target.v;
          const distance = Math.max(.025, Math.hypot(du, dv));
          tx = fish.u + du / distance * .4;
          ty = fish.v + dv / distance * .5;
        } else {
          tx = mix(tx, bounded(target.u, .5) + Math.cos(orbit * 1.8) * .115, .76);
          ty = mix(ty, bounded(target.v, .5) + Math.sin(orbit * 1.8) * .16, .76);
        }
      }
      for (const other of this.fish) {
        if (other === fish) continue;
        const du = fish.u - other.u, dv = fish.v - other.v;
        const d2 = du * du + dv * dv;
        if (d2 < .025 && d2 > .0001) { tx += du * .007 / d2; ty += dv * .007 / d2; }
      }
      tx = Math.max(.08, Math.min(.92, tx)); ty = Math.max(.14, Math.min(.88, ty));
      const desired = Math.atan2(ty - fish.v, tx - fish.u);
      fish.turn = angular(fish.angle, desired);
      fish.angle += fish.turn * Math.min(1, dt * 1.45);
      const scattering = active && this.clock < this.repelUntil;
      const speed = (.035 + .011 * fish.size) * (scattering ? 2.8 : active ? 1.18 : 1);
      fish.u = Math.max(.055, Math.min(.945, fish.u + Math.cos(fish.angle) * speed * dt));
      fish.v = Math.max(.08, Math.min(.94, fish.v + Math.sin(fish.angle) * speed * dt * 1.3));
      if (this.clock - fish.trailAt > .12) {
        fish.history.push({ u: fish.u, v: fish.v, time: this.clock });
        fish.trailAt = this.clock;
      }
      fish.history = fish.history.filter(point => this.clock - point.time < 2.8);
    }
  }

  drawPond(ctx, ground) {
    const band = ground.bottom - ground.top;
    // Clear water is mostly absence: only sparse caustic slivers cross the floor.
    ctx.save(); ctx.lineWidth = Math.max(.55, ground.w * .00055);
    for (let j = 0; j < 5; j++) {
      ctx.globalAlpha = .035 + (j % 2) * .015;
      ctx.strokeStyle = j % 2 ? '#eff2ff' : '#c4eff2';
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const u = .05 + i / 30 * .9;
        const v = .17 + j * .16 + Math.sin(u * 15 + this.clock * .23 + j * 1.8) * .022;
        const p = this.map(u, v, ground);
        if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    const wash = ctx.createLinearGradient(0, ground.top, 0, ground.bottom);
    wash.addColorStop(0, 'rgba(179,224,235,0)'); wash.addColorStop(.68, 'rgba(188,227,232,.018)'); wash.addColorStop(1, 'rgba(196,221,243,.035)');
    ctx.fillStyle = wash; ctx.fillRect(0, ground.top, ground.w, band); ctx.restore();
  }

  drawFishSchool(ctx, ground) {
    const sorted = [...this.fish].sort((a, b) => a.v - b.v);
    for (const fish of sorted) {
      const p = this.map(fish.u, fish.v, ground);
      const flat = ground.narrow ? .3 : .52;
      const size = Math.min(ground.w / 1050, ground.h / 475) * fish.size * mix(.78, 1.14, p.depth);
      const phase = this.clock * (3.8 + fish.size) + fish.seed;
      const tail = Math.sin(phase) * .45;
      const flex = Math.sin(phase - .5) * 1.65 + fish.turn * 1.9;
      if (fish.history.length > 2) {
        ctx.save(); ctx.strokeStyle = '#d6eff3'; ctx.lineWidth = Math.max(.55, size * .65);
        // Wake dissolves towards its oldest point instead of a continuous neon trail.
        for (let i = 1; i < fish.history.length; i++) {
          const a = fish.history[i - 1], b = fish.history[i];
          const q = this.map(a.u, a.v, ground), r = this.map(b.u, b.v, ground);
          const age = this.clock - b.time;
          ctx.globalAlpha = .11 * Math.pow(Math.max(0, 1 - age / 2.8), 2);
          for (const side of [-1, 1]) {
            const spread = (1.8 + age * 4) * size * side;
            ctx.beginPath(); ctx.moveTo(q.x, q.y + spread); ctx.lineTo(r.x, r.y + spread * .97); ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(size, size * flat); ctx.rotate(fish.angle);
      // The fins are layers of near-transparent silk with softly lit folds.
      const fin = ctx.createLinearGradient(-20, 0, -72, tail * 23);
      fin.addColorStop(0, 'rgba(212,237,245,.48)');
      fin.addColorStop(.35, 'rgba(226,215,241,.26)');
      fin.addColorStop(.74, 'rgba(188,231,243,.17)');
      fin.addColorStop(1, 'rgba(226,246,255,0)');
      for (const side of [-1, 1]) {
        const swing = tail * 24 + flex;
        ctx.fillStyle = fin; ctx.globalAlpha = .86;
        ctx.beginPath(); ctx.moveTo(-21, side * 1.5);
        ctx.bezierCurveTo(-33, side * 8 + swing * .2, -51, side * 26 + swing, -72, side * 18 + swing * 1.25);
        ctx.bezierCurveTo(-62, side * 10 + swing * 1.15, -44, side * 2 + swing * .65, -28, side * .8 + flex); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = .25; ctx.strokeStyle = '#e5faff'; ctx.lineWidth = .65;
        for (let ray = 0; ray < 3; ray++) {
          ctx.beginPath(); ctx.moveTo(-23, side * 1);
          ctx.bezierCurveTo(-40, side * (3 + ray * 2) + swing * .4, -51, side * (8 + ray * 4) + swing * .9, -67 + ray * 6, side * (15 + ray * 1.5) + swing * 1.1); ctx.stroke();
        }
      }
      const finBeat = Math.sin(phase * .7) * 4;
      for (const side of [-1, 1]) {
        const wing = ctx.createLinearGradient(6, side * 5, -17, side * 26);
        wing.addColorStop(0, 'rgba(235,247,252,.44)'); wing.addColorStop(.55, 'rgba(189,229,241,.24)'); wing.addColorStop(1, 'rgba(228,221,248,0)');
        ctx.globalAlpha = .84; ctx.fillStyle = wing;
        ctx.beginPath(); ctx.moveTo(6, side * 6);
        ctx.bezierCurveTo(-1, side * (15 + finBeat), -10, side * (26 + finBeat), -25, side * 21);
        ctx.quadraticCurveTo(-11, side * 12, -5, side * 6); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = .21; ctx.strokeStyle = '#ecfcff'; ctx.lineWidth = .55;
        ctx.beginPath(); ctx.moveTo(4, side * 7); ctx.quadraticCurveTo(-6, side * (15 + finBeat), -22, side * 21); ctx.stroke();
      }
      const body = ctx.createLinearGradient(0, -11, 0, 11);
      body.addColorStop(0, 'rgba(225,249,255,.64)');
      body.addColorStop(.23, 'rgba(222,238,250,.48)');
      body.addColorStop(.48, 'rgba(246,240,250,.22)');
      body.addColorStop(.7, 'rgba(174,223,239,.15)');
      body.addColorStop(1, 'rgba(206,239,246,.38)');
      ctx.globalAlpha = .89; ctx.fillStyle = body; this.fishBody(ctx, flex); ctx.fill();
      ctx.save(); this.fishBody(ctx, flex); ctx.clip();
      // Inner pearl is small enough that the underlying photograph stays visible.
      const pearl = ctx.createRadialGradient(7, -3, 0, 3, 0, 20);
      pearl.addColorStop(0, 'rgba(255,253,255,.33)'); pearl.addColorStop(.38, 'rgba(219,225,245,.13)'); pearl.addColorStop(1, 'rgba(194,225,243,0)');
      ctx.fillStyle = pearl; ctx.fillRect(-27, -13, 55, 26);
      ctx.globalAlpha = .23; ctx.strokeStyle = '#d3f5ff'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(-23, flex * .4); ctx.bezierCurveTo(-11, flex - 1, 2, -1.5, 17, 0); ctx.stroke();
      // Brief iridescence shifts between pale cyan and lavender with each turn.
      ctx.globalAlpha = .18 + (Math.sin(phase * .23) + 1) * .045;
      ctx.strokeStyle = fish.seed > 3 ? '#e6d8ff' : '#bdf5f4'; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(-17, -4 + flex * .4); ctx.quadraticCurveTo(2, -8, 19, -3); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = .63; ctx.strokeStyle = '#effcff'; ctx.lineWidth = .75;
      ctx.beginPath(); ctx.moveTo(-24, -2 + flex * .3); ctx.bezierCurveTo(-12, -7 + flex, 11, -11, 23, -3); ctx.stroke();
      ctx.globalAlpha = .21; ctx.strokeStyle = '#b7d8e7'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(-22, 2 + flex * .3); ctx.bezierCurveTo(-8, 8, 15, 9, 25, 1); ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.globalAlpha = .58; ctx.fillStyle = '#5b8196'; ctx.beginPath(); ctx.ellipse(19, side * 3.3, 1.05, .82, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = .92; ctx.fillStyle = '#f5ffff'; ctx.beginPath(); ctx.arc(19.25, side * 3.3 - .25, .38, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = .21; ctx.strokeStyle = '#d9f4ff'; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.arc(13, 0, 5.6, -.82, .82); ctx.stroke();
      ctx.restore();
    }
  }

  fishBody(ctx, flex = 0) {
    ctx.beginPath(); ctx.moveTo(26, 0);
    ctx.bezierCurveTo(25, -6, 13, -9.2, -1, -8.2);
    ctx.bezierCurveTo(-14, -7 + flex, -19, -3 + flex * .7, -25, -1.6 + flex * .3);
    ctx.quadraticCurveTo(-28, flex * .4, -25, 1.6 + flex * .3);
    ctx.bezierCurveTo(-19, 3 + flex * .7, -14, 7 + flex, -1, 8.2);
    ctx.bezierCurveTo(13, 9.2, 25, 6, 26, 0); ctx.closePath();
  }

  drawTrace(ctx, ground, event, age) {
    const p = this.map(event.u, event.v, ground);
    const size = Math.min(ground.w * .017, ground.h * .035) * mix(.6, 1.1, p.depth);
    ctx.save(); ctx.globalAlpha = (1 - smooth(10, 20, age)) * smooth(0, .2, age);
    ctx.strokeStyle = '#bdf9e9'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, size, size * (ground.narrow ? .2 : .35), 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  dispose() { this.events.length = 0; this.pending.length = 0; this.fish.length = 0; }
}
