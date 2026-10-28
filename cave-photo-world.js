/**
 * An interactive lighting study drawn over the actual supplied Damo photographs.
 * It is a photographic concept prototype, not a reconstructed installation.
 * All crop/warp operations happen in the browser. Source files remain intact.
 */
import { GroundEffects } from './cave-ground-effects.js';

const clamp = (n, fallback = .5) => Number.isFinite(Number(n)) ? Math.max(0, Math.min(1, Number(n))) : fallback;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const PHOTOS = {
  // Source pixel rectangles omit the captured webpage header and sidebar.
  blue: { url: './assets/cave/damo-blue.png', crop: [14, 392, 2362, 1034] },
  projection: { url: './assets/cave/damo-projection.png', crop: [46, 244, 2372, 1188] },
  floor: { url: './assets/cave/damo-film-floor.jpg', crop: [0, 0, 805, 453] },
  // 00:59 film frame from the same project's actual MANA documentation.
  redGold: { url: './assets/cave/damo-film-red-gold.jpg', crop: [0, 0, 805, 453] },
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Installation photograph could not load: ${url}`));
    image.src = new URL(url, import.meta.url).href;
  });
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d') };
}

export class PhotoCaveWorld {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('PhotoCaveWorld needs a canvas.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Canvas 2D is unavailable.');
    this.kind = 'photo-canvas';
    this.state = { x: .5, y: .5, bodyX: null, bodyY: null, source: 'pointer', isActive: true, energy: .55, calm: .45, opening: 0, held: false, isTracking: false, mode: 'ripple', memoryStyle: 'lotus', photo: 'blue', original: false, paused: false };
    this.photos = {};
    this.images = {};
    this.light = makeCanvas();
    this.mask = makeCanvas();
    this.exposure = null;
    this.exposures = {};
    this.groundEffects = new GroundEffects();
    this.lastFrame = 0;
    this.time = 0;
    this.opening = 0;
    this.focus = { x: .5, y: .5 };
    this.presence = { x: .5, y: .5 };
    this.disposed = false;
    this.frame = 0;
    this.dirty = true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.state.paused = this.reducedMotion.matches;
    this.boundResize = () => this.resize();
    this.boundVisibility = () => { this.lastFrame = 0; this.schedule(); };
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(this.boundResize) : null;
    this.resizeObserver?.observe(canvas);
    this.intersectionObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      this.inView = entries[0]?.isIntersecting !== false;
      if (this.inView) { this.lastFrame = 0; this.schedule(); }
    }, { rootMargin: '120px' }) : null;
    this.inView = true;
    this.intersectionObserver?.observe(canvas);
    window.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.resize();
    this.ready = Promise.all(Object.entries(PHOTOS).map(async ([key, spec]) => {
      this.images[key] = await loadImage(spec.url);
    })).then(() => {
      if (this.disposed) return;
      this.cachePhotos();
      this.dirty = true;
      this.schedule();
      return this;
    });
    // Avoid unhandled rejection while still allowing the caller to await ready.
    this.ready.catch(error => { this.loadError = error; this.dirty = true; this.schedule(); });
  }

  setState(partial = {}) {
    const previousPhoto = this.state.photo;
    for (const key of ['x', 'y', 'energy', 'calm', 'opening']) if (key in partial) this.state[key] = clamp(partial[key], this.state[key]);
    // pinch used by the earlier controller is accepted for compatibility.
    if ('pinch' in partial && !('opening' in partial)) this.state.opening = clamp(partial.pinch, this.state.opening);
    if (['ripple', 'portal', 'memory'].includes(partial.mode)) this.state.mode = partial.mode;
    if (['lotus', 'water', 'fish', 'trace'].includes(partial.memoryStyle)) this.state.memoryStyle = partial.memoryStyle;
    if (['blue', 'projection', 'floor'].includes(partial.photo)) this.state.photo = partial.photo;
    for (const key of ['held', 'isTracking', 'isActive', 'original', 'paused']) if (typeof partial[key] === 'boolean') this.state[key] = partial[key];
    for (const key of ['bodyX', 'bodyY']) if (key in partial) this.state[key] = partial[key] == null ? null : clamp(partial[key]);
    if (['pointer', 'hand', 'body'].includes(partial.source)) this.state.source = partial.source;
    if (previousPhoto !== this.state.photo) this.exposure = this.exposures[this.state.photo] || this.buildExposure();
    this.groundEffects.setStyle(this.state.memoryStyle);
    this.groundEffects.setState(this.state);
    this.dirty = true;
    this.schedule();
  }

  setPhoto(photo) { this.setState({ photo }); }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 700 ? 1.35 : 1.5, Math.sqrt(1300000 / (rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (width === this.canvas.width && height === this.canvas.height && this.photos.blue) return;
    this.canvas.width = width;
    this.canvas.height = height;
    for (const layer of [this.light, this.mask]) { layer.canvas.width = width; layer.canvas.height = height; }
    this.cachePhotos();
    this.dirty = true;
    this.schedule();
  }

  cachePhotos() {
    const w = this.canvas.width, h = this.canvas.height;
    for (const [key, image] of Object.entries(this.images)) {
      const { canvas, ctx } = this.photos[key] || makeCanvas();
      canvas.width = w; canvas.height = h;
      const crop = PHOTOS[key].crop;
      const scale = Math.max(w / crop[2], h / crop[3]);
      const sw = w / scale, sh = h / scale;
      // A centred cover fit keeps the actual columns, visitor and floor visible.
      const sx = crop[0] + (crop[2] - sw) * .5;
      const sy = crop[1] + (crop[3] - sh) * .5;
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
      this.photos[key] = { canvas, ctx };
    }
    this.exposures = {};
    for (const key of ['blue', 'projection', 'floor']) this.buildExposure(key);
    this.exposure = this.exposures[this.state.photo];
  }

  buildExposure(photoKey = this.state.photo) {
    const photo = this.photos[photoKey];
    if (!photo || !this.canvas.width) return;
    const w = this.canvas.width, h = this.canvas.height;
    const dark = makeCanvas(), bright = makeCanvas();
    for (const variant of [dark, bright]) {
      variant.canvas.width = w;
      variant.canvas.height = h;
    }
    // These are exposure variants of the photograph itself, built only when
    // its size or selection changes. Per-frame rendering never reads pixels.
    // Linear-light gain preserves hue, black stone voids and the real image's
    // fine projected lines, unlike painting an additive coloured glow on top.
    const linear = value => {
      const s = value / 255;
      return s <= .04045 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
    };
    const srgb = value => Math.round(255 * (value <= .0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - .055));
    const darkLut = new Uint8Array(256), brightLut = new Uint8Array(256);
    for (let value = 0; value < 256; value++) {
      const light = linear(value);
      darkLut[value] = srgb(light * .42);
      // A smooth highlight shoulder leaves white dress/stone highlights
      // intact instead of clipping them into a white patch.
      brightLut[value] = srgb((light * 1.9) / (1 + .9 * light));
    }
    try {
      const original = photo.ctx.getImageData(0, 0, w, h);
      const dimPixels = dark.ctx.createImageData(w, h);
      const litPixels = bright.ctx.createImageData(w, h);
      for (let i = 0; i < original.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          const value = original.data[i + channel];
          dimPixels.data[i + channel] = darkLut[value];
          litPixels.data[i + channel] = brightLut[value];
        }
        dimPixels.data[i + 3] = litPixels.data[i + 3] = original.data[i + 3];
      }
      dark.ctx.putImageData(dimPixels, 0, 0);
      bright.ctx.putImageData(litPixels, 0, 0);
    } catch {
      // Local images normally permit pixel reads. Keep the same photographic
      // rendering if a future remote source disallows them.
      dark.ctx.filter = 'brightness(.68)';
      dark.ctx.drawImage(photo.canvas, 0, 0);
      dark.ctx.filter = 'none';
      bright.ctx.filter = 'brightness(1.16)';
      bright.ctx.drawImage(photo.canvas, 0, 0);
      bright.ctx.filter = 'none';
    }
    const exposure = { photo: photoKey, dark: dark.canvas, bright: bright.canvas };
    this.exposures[photoKey] = exposure;
    if (photoKey === this.state.photo) this.exposure = exposure;
    return exposure;
  }

  clearMemory() {
    this.groundEffects.clear();
    this.dirty = true;
    this.schedule();
  }

  schedule() {
    if (this.disposed || this.frame || document.hidden || !this.inView) return;
    this.frame = requestAnimationFrame(now => this.tick(now));
  }

  tick(now) {
    this.frame = 0;
    if (this.disposed || document.hidden || !this.inView) return;
    if (!this.canvas.clientWidth || !this.canvas.getClientRects().length) { this.lastFrame = 0; return; }
    const elapsed = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 30;
    if (elapsed < 1 / 30) { this.schedule(); return; }
    const dt = Math.min(.1, elapsed);
    this.lastFrame = now;
    const still = this.state.paused;
    if (!still) this.time += dt;
    const response = still ? 0 : 1 - Math.exp(-dt * 14);
    this.focus.x = lerp(this.focus.x, this.state.x, response);
    this.focus.y = lerp(this.focus.y, this.state.y, response);
    const body = this.state.source === 'body' && Number.isFinite(this.state.bodyX) && Number.isFinite(this.state.bodyY);
    this.presence.x = lerp(this.presence.x, body ? this.state.bodyX : this.state.x, response);
    this.presence.y = lerp(this.presence.y, body ? this.state.bodyY : this.state.y, response);
    this.opening = lerp(this.opening, this.state.opening, response);
    this.draw(dt);
    this.dirty = false;
    const settling = !still && (Math.abs(this.opening - this.state.opening) + Math.abs(this.focus.x - this.state.x) + Math.abs(this.focus.y - this.state.y) + Math.abs(this.presence.x - (body ? this.state.bodyX : this.state.x)) + Math.abs(this.presence.y - (body ? this.state.bodyY : this.state.y))) > .001;
    if ((!still && !this.state.original && this.state.mode !== 'ripple') || settling) this.schedule();
  }

  draw(dt) {
    const { ctx } = this;
    const w = this.canvas.width, h = this.canvas.height;
    const base = this.photos[this.state.photo]?.canvas;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#03131d'; ctx.fillRect(0, 0, w, h);
    if (!base) {
      ctx.fillStyle = '#c3f7ff'; ctx.font = `${Math.max(14, w * .017)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(this.loadError ? 'Installation image unavailable. Please reload.' : 'Loading the actual installation…', w * .5, h * .5);
      return;
    }
    if (this.state.original) { ctx.drawImage(base, 0, 0); return; }
    if (this.state.mode === 'portal') this.drawPortal(base);
    else this.drawPhoto(base);
    if (this.state.mode === 'ripple') this.drawLight();
    else if (this.state.mode === 'memory') this.groundEffects.draw(ctx, { width: w, height: h, time: this.time, dt, photo: this.state.photo, paused: this.state.paused });
    if (this.state.mode === 'portal') this.drawAtmosphere();
  }

  drawPhoto(base) {
    // The photograph is spatially fixed. Lighting and floor marks share its
    // exact coordinate system, without moving the image as a flat card.
    this.ctx.drawImage(base, 0, 0);
  }

  drawLight() {
    const w = this.canvas.width, h = this.canvas.height;
    if (!this.exposure || this.exposure.photo !== this.state.photo) this.buildExposure();
    if (!this.exposure) return;
    const { dark, bright } = this.exposure;
    const body = this.state.source === 'body' && Number.isFinite(this.state.bodyX) && Number.isFinite(this.state.bodyY);
    // Pointer inactivity ends ground sampling, but its last light position
    // remains selected. Camera sources dim only when tracking is lost.
    const active = this.state.source === 'pointer' || this.state.isTracking;
    const strength = .40 + this.state.energy * .60;
    const mask = this.mask.ctx, light = this.light.ctx;
    mask.clearRect(0, 0, w, h);
    // The mask changes only the exposure of existing image pixels. It does
    // not contribute coloured light, rings, beams, particles or a new orb.
    const exposureRegion = (x, y, rx, ry, opacity) => {
      mask.save();
      mask.translate(x * w, (1 - y) * h);
      mask.scale(rx * w, ry * h);
      const fade = mask.createRadialGradient(0, 0, 0, 0, 0, 1);
      fade.addColorStop(0, `rgba(255,255,255,${opacity})`);
      fade.addColorStop(.28, `rgba(255,255,255,${opacity * .97})`);
      fade.addColorStop(.64, `rgba(255,255,255,${opacity * .40})`);
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      mask.fillStyle = fade;
      mask.fillRect(-1, -1, 2, 2);
      mask.restore();
    };
    this.ctx.drawImage(dark, 0, 0);
    if (active) {
      if (body) {
        exposureRegion(this.presence.x, this.presence.y, .32, .72, strength * .88);
        exposureRegion(this.focus.x, this.focus.y, .16, .37, strength);
      } else {
        exposureRegion(this.focus.x, this.focus.y, .30, .64, strength);
      }
    }
    light.clearRect(0, 0, w, h);
    light.globalCompositeOperation = 'source-over';
    light.drawImage(bright, 0, 0);
    light.globalCompositeOperation = 'destination-in';
    light.drawImage(this.mask.canvas, 0, 0);
    light.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.light.canvas, 0, 0);
  }

  seamAt(y, side, opening, w, h) {
    const n = y / h;
    const centre = w * (.5 + (this.focus.x - .5) * .23);
    const warp = (Math.sin(n * 21.4 + .8) * .009 + Math.sin(n * 54.2) * .004 + Math.sin(n * 113) * .0025) * w;
    const bulgeCentre = .5 + (.5 - this.focus.y) * .15;
    const bulge = Math.pow(Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, n - bulgeCentre + .5)))), .7);
    return centre + warp * Math.min(1, .2 + opening * 3) + side * w * opening * (.135 + .245 * bulge);
  }

  drawPortal(base) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    const o = this.opening < .0005 ? 0 : this.opening;
    const second = this.photos.redGold?.canvas || this.photos[this.state.photo === 'blue' ? 'projection' : 'blue']?.canvas || base;
    // There is always a real second photographic space behind the opening.
    const zoom = 1.035 + o * .035;
    ctx.save(); ctx.filter = 'brightness(1.28) saturate(1.1)';
    ctx.drawImage(second, -w * (zoom - 1) * .5 + (this.focus.x - .5) * w * .012, -h * (zoom - 1) * .5, w * zoom, h * zoom);
    ctx.restore();
    if (o > .01) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const behind = ctx.createRadialGradient(w * .5, h * .48, 0, w * .5, h * .48, w * .48);
      behind.addColorStop(0, `rgba(247,157,42,${o * .11})`); behind.addColorStop(.65, `rgba(230,155,49,${o * .07})`); behind.addColorStop(1, 'rgba(30,120,130,0)');
      ctx.fillStyle = behind; ctx.fillRect(0, 0, w, h); ctx.restore();
    }
    if (!o) { this.drawPhoto(base); }
    else {
      // Horizontal stone slices squeeze and peel towards both edges. Their
      // jagged seam opens into an image, not a dark disc or an empty tunnel.
      const rows = Math.min(132, Math.ceil(h / 5));
      const sourceCentre = w * (.5 + (this.focus.x - .5) * .23);
      for (let i = 0; i < rows; i++) {
        const y = i / rows * h, band = h / rows + 1;
        const left = this.seamAt(y + band * .5, -1, o, w, h);
        const right = this.seamAt(y + band * .5, 1, o, w, h);
        const sy = Math.max(0, Math.min(h - band, y + Math.sin(i * .15) * o * h * .006));
        if (left > 0) ctx.drawImage(base, 0, sy, sourceCentre, Math.min(band, h - sy), -o * w * .075, y, left + o * w * .075, band);
        if (right < w) ctx.drawImage(base, sourceCentre, sy, w - sourceCentre, Math.min(band, h - sy), right, y, w - right + o * w * .075, band);
      }
    }
    // Two unmistakable full-height tear edges are visible even before opening.
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const edge = new Path2D();
      for (let i = 0; i <= 110; i++) {
        const y = i / 110 * h;
        const x = this.seamAt(y, side, o, w, h);
        if (!i) edge.moveTo(x, y); else edge.lineTo(x, y);
      }
      const colour = side < 0 ? '#8cfff1' : '#ffcb77';
      ctx.shadowColor = colour; ctx.shadowBlur = h * .036;
      ctx.strokeStyle = side < 0 ? `rgba(35,230,246,${.45 + o * .4})` : `rgba(255,174,63,${.45 + o * .4})`;
      ctx.lineWidth = h * (.005 + o * .005); ctx.stroke(edge);
      ctx.shadowBlur = h * .008; ctx.strokeStyle = '#f0fff0'; ctx.lineWidth = Math.max(1, h * .002); ctx.stroke(edge);
      // Stone-light fragments drift away from the opening with increasing gap.
      if (o > .05) for (let j = 0; j < 35; j++) {
        const n = (j * .6180339 + this.time * .012) % 1;
        const y = n * h;
        const pulse = (j * .327 + this.time * .25) % 1;
        const x = this.seamAt(y, side, o, w, h) + side * pulse * w * .08 * o;
        ctx.globalAlpha = (1 - pulse) * o;
        ctx.fillStyle = colour;
        const size = Math.max(1, h * (.001 + (j % 4) * .00065));
        ctx.fillRect(x, y - pulse * h * .055, size * 1.2, size * 2.4);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // A tactile pair of luminous grip tabs tells the visitor what to pull.
    // Once opened, the tabs travel with the two torn edges.
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const gripY = h * .49;
    for (const side of [-1, 1]) {
      const gx = this.seamAt(gripY, side, o, w, h) + side * h * .014;
      ctx.strokeStyle = this.state.held ? '#fff4c4' : '#c7fff1';
      ctx.shadowColor = side < 0 ? '#27f6ff' : '#ffc36b'; ctx.shadowBlur = h * .026;
      ctx.lineWidth = Math.max(1.5, h * .0035); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx + side * h * .012, gripY - h * .025);
      ctx.lineTo(gx, gripY); ctx.lineTo(gx + side * h * .012, gripY + h * .025); ctx.stroke();
      if (this.state.held) {
        ctx.beginPath(); ctx.moveTo(gx, gripY); ctx.lineTo(gx + side * h * .04, gripY); ctx.stroke();
      }
    }
    ctx.restore();
    // Ground reflection makes the opening belong to the supplied interior.
    if (o > .05) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const reflect = ctx.createLinearGradient(0, h * .78, 0, h);
      reflect.addColorStop(0, 'rgba(37,255,225,0)'); reflect.addColorStop(.55, `rgba(64,255,218,${o * .10})`); reflect.addColorStop(1, 'rgba(242,181,77,0)');
      ctx.fillStyle = reflect; ctx.fillRect(w * .25, h * .78, w * .5, h * .22); ctx.restore();
    }
  }

  drawAtmosphere() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 46; i++) {
      const x = ((i * .6180339887 + Math.sin(i * 13.13) * .02 + this.time * .0017) % 1) * w;
      const y = ((i * .381966 + Math.cos(i * 4.43) * .1 - this.time * (.002 + i % 3 * .0008)) % 1 + 1) % 1 * h;
      const alpha = .10 + .20 * (.5 + .5 * Math.sin(i + this.time * .45));
      ctx.fillStyle = `rgba(172,255,240,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, Math.max(.5, h * (.00065 + (i % 4) * .00015)), 0, TAU); ctx.fill();
    }
    ctx.restore();
    const vignette = ctx.createRadialGradient(w * .5, h * .46, h * .24, w * .5, h * .46, Math.max(w, h) * .72);
    vignette.addColorStop(0, 'rgba(0,5,10,0)'); vignette.addColorStop(.65, 'rgba(0,5,10,.06)'); vignette.addColorStop(1, 'rgba(0,5,10,.35)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.groundEffects.dispose?.();
    this.exposure = null;
    this.exposures = {};
    this.photos = {};
    this.images = {};
    this.light.canvas.width = this.mask.canvas.width = 1;
  }
}

export default PhotoCaveWorld;
