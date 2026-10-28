import * as THREE from './vendor/three.module.js';

// An open, continually folding surface. The page supplies its clock and input.
const PI = Math.PI;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const BG = '#e9e8ec';

export class AssistantPresence {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;
    this.visible = true;
    this.paused = false;
    this.time = 0;
    this.lastClock = null;
    this.held = false;
    this.force = 0;
    this.release = 0;
    this.releaseAge = 0;
    this.pointer = { x: .5, y: .5, active: false };
    this.cursor = { x: 0, y: 0, active: 0 };
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile = window.matchMedia('(max-width: 700px)').matches;
    this.nu = this.mobile ? 112 : 160;
    this.nv = this.mobile ? 12 : 18;
    this.items = [];
    this.resources = [];
    this._point = { x: 0, y: 0, z: 0 };
    try {
      this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.13;
      this.renderer.setClearColor(BG);
      this.setup();
    } catch (error) {
      for (const resource of this.resources) resource.dispose();
      this.resources.length = 0;
      this.items.length = 0;
      this.envTarget?.dispose();
      this.envTarget = null;
      this.renderer?.dispose();
      this.renderer?.forceContextLoss();
      this.renderer = null;
      this.scene = this.camera = this.group = null;
      // A canvas that acquired WebGL cannot subsequently acquire a 2D context.
      // Clone its attributes so IDs, accessibility and layout survive the fallback.
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      canvas = this.canvas = replacement;
      this.fallback = canvas.getContext('2d');
      if (!this.fallback) throw error;
    }
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(canvas);
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? true;
      if (!this.visible) this.lastClock = null;
    }, {rootMargin: '120px'});
    this.observer.observe(canvas);
    this.onLost = event => { event.preventDefault(); this.contextLost = true; };
    this.onRestored = () => { this.contextLost = false; this.lastClock = null; this.paint(); };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.resize();
  }

  setup() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 8.5, 15);
    this.camera = new THREE.PerspectiveCamera(36, 1, .1, 35);
    this.camera.position.set(0, .08, 7.4);
    this.camera.lookAt(0, .08, 0);
    this.pointerWorld = new THREE.Vector3();
    this.group = new THREE.Group();
    this.group.rotation.set(.12, -.28, -.15);
    this.scene.add(this.group);

    // A studio panorama gives the folds real light and dark reflected surfaces.
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 1024; envCanvas.height = 512;
    const c = envCanvas.getContext('2d');
    c.fillStyle = '#a8adb9'; c.fillRect(0, 0, 1024, 512);
    let g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#f4f3ef'); g.addColorStop(.40, '#cad0da');
    g.addColorStop(.54, '#8d94a3'); g.addColorStop(.69, '#3e4658'); g.addColorStop(1, '#b8bbcc');
    c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#fcfcff'; c.fillRect(190, 20, 110, 340);
    c.fillStyle = '#edfaff'; c.fillRect(713, 65, 46, 260);
    c.fillStyle = '#fdf3e7'; c.fillRect(500, 8, 180, 58);
    c.fillStyle = '#252b3c'; c.fillRect(345, 160, 100, 210);
    c.fillStyle = '#777e97'; c.fillRect(840, 150, 70, 245);
    const environment = new THREE.CanvasTexture(envCanvas);
    environment.mapping = THREE.EquirectangularReflectionMapping;
    environment.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromEquirectangular(environment);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose(); environment.dispose();
    this.scene.add(new THREE.HemisphereLight(0xf5f7ff, 0x5e667e, 2.15));
    const key = new THREE.DirectionalLight(0xfff7ed, 3.2);
    key.position.set(-3, 5, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcf5ff, 2.5);
    rim.position.set(4, 1, -3); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xcac9ff, 1.6);
    fill.position.set(-4, -2, 1); this.scene.add(fill);

    const shades = [0xe7e9f0, 0xc8d8df, 0xdbd9e9];
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((this.nu + 1) * (this.nv + 1) * 3);
      const uvs = new Float32Array((this.nu + 1) * (this.nv + 1) * 2);
      const index = [];
      for (let i = 0; i <= this.nu; i++) for (let j = 0; j <= this.nv; j++) {
        const n = i * (this.nv + 1) + j;
        uvs[n * 2] = i / this.nu; uvs[n * 2 + 1] = j / this.nv;
        if (i < this.nu && j < this.nv) {
          const a = n, b = n + this.nv + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(index);
      const mat = new THREE.MeshPhysicalMaterial({
        color: shades[k], metalness: .73, roughness: .255,
        clearcoat: .92, clearcoatRoughness: .16, envMapIntensity: 1.25,
        side: THREE.DoubleSide, iridescence: .17, iridescenceIOR: 1.25,
        iridescenceThicknessRange: [125, 230], sheen: .28, sheenColor: new THREE.Color(0xc1eafa),
      });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
      this.group.add(mesh);
      this.items.push({geo, positions, k});
      this.resources.push(geo, mat);
    }

    // Hairline streams follow the surface and separate gently beyond its edges.
    const strands = this.mobile ? 20 : 32;
    const steps = this.mobile ? 94 : 132;
    this.lineSteps = steps;
    this.lineCount = strands;
    this.linePositions = new Float32Array(strands * steps * 2 * 3);
    this.lineColors = new Float32Array(this.linePositions.length);
    for (let l = 0; l < strands; l++) for (let i = 0; i < steps * 2; i++) {
      const idx = (l * steps * 2 + i) * 3;
      this.lineColors[idx] = .44 + .22 * Math.sin(l * .41) ** 2;
      this.lineColors[idx + 1] = .63 + .12 * Math.sin(l * .7) ** 2;
      this.lineColors[idx + 2] = .73 + .12 * Math.sin(l * .4) ** 2;
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3));
    const lineMat = new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: .27, depthWrite: false});
    this.lines = new THREE.LineSegments(lineGeo, lineMat);
    this.lines.frustumCulled = false; this.group.add(this.lines);
    this.resources.push(lineGeo, lineMat);

    this.particleCount = this.mobile ? 450 : 900;
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleSeeds = new Float32Array(this.particleCount * 4);
    this.particleSizes = new Float32Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) {
      const n = i * 4;
      this.particleSeeds[n] = (i * .61803398875) % 1;
      this.particleSeeds[n + 1] = (i * .754877666) % 1;
      this.particleSeeds[n + 2] = (i * .569840291) % 1;
      this.particleSeeds[n + 3] = (i * .438289) % 1;
      this.particleSizes[i] = .65 + this.particleSeeds[n + 2] * 1.15;
    }
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
    pointGeo.setAttribute('aSize', new THREE.BufferAttribute(this.particleSizes, 1));
    this.pointMaterial = new THREE.ShaderMaterial({
      uniforms: {uDpr: {value: 1}},
      vertexShader: 'attribute float aSize; uniform float uDpr; varying float vFade; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(aSize*uDpr*7./max(2.,-p.z),1.,4.); vFade=.45+.55*clamp((position.z+1.5)/3.,0.,1.); }',
      fragmentShader: 'varying float vFade; void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; float a=pow(1.-d,1.4)*vFade*.78; gl_FragColor=vec4(.43,.64,.70,a);}',
      transparent: true, depthWrite: false,
    });
    const points = new THREE.Points(pointGeo, this.pointMaterial);
    points.frustumCulled = false; this.group.add(points); this.points = points;
    this.resources.push(pointGeo, this.pointMaterial);

    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = 256; shadowCanvas.height = 128;
    const sc = shadowCanvas.getContext('2d');
    const sg = sc.createRadialGradient(128, 64, 5, 128, 64, 120);
    sg.addColorStop(0, 'rgba(74,77,104,.20)'); sg.addColorStop(.35, 'rgba(84,86,110,.12)'); sg.addColorStop(1, 'rgba(84,86,110,0)');
    sc.fillStyle = sg; sc.fillRect(0, 0, 256, 128);
    const shadowMap = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false});
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.4), shadowMat);
    this.shadow.position.set(.05, -1.88, -.8); this.shadow.rotation.x = -.55;
    this.scene.add(this.shadow);
    this.resources.push(this.shadow.geometry, shadowMat, shadowMap);
  }

  // Parametric ribbons stay open at both ends; each fold reveals its reverse side.
  surface(u, v, k, t, out = this._point) {
    const s = u * 2 - 1;
    const envelope = Math.pow(Math.sin(PI * u), .64);
    const cycle = Math.sin(t * .59);
    const phase = k * .72;
    const spread = 1.0 + cycle * .23;
    const twist = s * 2.35 + .58 * Math.sin(u * 4.8 - t * .35) + k * .58;
    const width = (.41 + envelope * .36) * (k === 1 ? .82 : k === 2 ? .69 : 1);
    const lane = v * width;
    const fold = .19 * Math.sin(v * PI * 1.45 + u * 5.1 + phase - t * .3);
    let x = s * .95 + Math.sin(u * PI * 2.0 + .2 + cycle * .21) * .43;
    let y = s * 1.48 + Math.sin(u * PI * 2.4 + phase) * .10;
    let z = Math.sin(u * PI * 1.9 + phase - .4) * .48;
    x += lane * Math.cos(twist) * spread + (k - 1) * .21 * envelope;
    y += lane * Math.sin(twist) * .33 + (k - 1) * .14 * Math.sin(u * PI * 1.35);
    z += lane * Math.sin(twist) * 1.2 + fold * envelope;
    // Smaller waves travel through the membrane, instead of rotating a rigid object.
    z += Math.sin(u * 14.3 - t * 1.15 + phase + v * 1.8) * .025 * envelope;
    y += Math.sin(u * 8.2 + v * 2.5 - t * .8) * .035 * envelope;
    x += Math.sin(u * 4.2 - t * .25 + phase) * .10 * cycle;
    const dx = x - this.cursor.x, dy = y - this.cursor.y;
    const distance = dx * dx + dy * dy;
    const reach = Math.exp(-distance / .72) * this.cursor.active;
    const pull = reach * (.12 + this.force * .75);
    x += (this.cursor.x - x) * pull;
    y += (this.cursor.y - y) * pull;
    z += reach * (.15 + this.force * .65);
    const ripple = Math.sin(Math.sqrt(distance) * 8.5 - this.releaseAge * 8) * Math.exp(-distance / 3) * this.release;
    z += ripple * .15;
    x += ripple * .035;
    out.x = x; out.y = y; out.z = z;
    return out;
  }

  setPointer(x, y, active = true) {
    this.pointer.x = Number.isFinite(x) ? clamp(x, 0, 1) : .5;
    this.pointer.y = Number.isFinite(y) ? clamp(y, 0, 1) : .5;
    this.pointer.active = Boolean(active);
  }
  setHeld(held) {
    if (this.held && !held) { this.release = 1; this.releaseAge = 0; }
    this.held = Boolean(held);
  }
  excite() { this.release = 1.2; this.releaseAge = 0; }
  setPaused(paused) { this.paused = Boolean(paused); }

  resize() {
    if (this.disposed) return;
    const b = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, b.width); this.h = Math.max(1, b.height);
    this.mobile = window.matchMedia('(max-width: 700px)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.65 : 1.8);
    if (this.renderer) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(this.w, this.h, false);
      this.camera.aspect = this.w / this.h;
      // Keep the entire gesture within narrow screens without shrinking desktop sculpture.
      this.camera.position.z = this.camera.aspect < .8 ? Math.max(8.0, 6.6 / this.camera.aspect) : this.camera.aspect < 1.1 ? 7.7 : 7.4;
      this.camera.updateProjectionMatrix();
      this.pointMaterial.uniforms.uDpr.value = dpr;
    } else {
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
      this.fallback?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.paint();
  }

  draw(clock = 0) {
    if (this.disposed || !this.visible || this.contextLost) return;
    const stamp = Number.isFinite(clock) ? clock : 0;
    const delta = this.lastClock === null ? 1 / 30 : clamp(stamp - this.lastClock, 0, .07);
    this.lastClock = stamp;
    const frozen = this.paused || this.reduced.matches;
    const dt = frozen ? 0 : delta;
    if (!frozen) this.time += dt;
    // Even with a frozen clock, an intentional pointer gesture still takes effect.
    const inputDt = dt > 0 ? dt : 1 / 30;
    const ease = 1 - Math.exp(-inputDt * 8);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(18)) * (this.camera?.position.z || 7.4);
    const aspect = this.w / this.h;
    let px = (this.pointer.x - .5) * viewHeight * aspect;
    let py = (.5 - this.pointer.y) * viewHeight;
    if (this.group) {
      this.pointerWorld.set(px, py, 0);
      this.group.worldToLocal(this.pointerWorld);
      px = this.pointerWorld.x; py = this.pointerWorld.y;
    }
    this.cursor.x += (px - this.cursor.x) * ease;
    this.cursor.y += (py - this.cursor.y) * ease;
    this.cursor.active += ((this.pointer.active ? 1 : 0) - this.cursor.active) * ease;
    this.force += ((this.held ? 1 : 0) - this.force) * (1 - Math.exp(-inputDt * 5));
    this.releaseAge = (this.releaseAge || 0) + inputDt;
    this.release *= Math.exp(-inputDt * 1.9);
    this.paint();
  }

  paint() {
    if (this.disposed || this.w < 2 || this.h < 2 || this.contextLost) return;
    if (!this.renderer) { this.paintFallback(); return; }
    const t = this.time;
    this.group.rotation.y = -.28 + Math.sin(t * .17) * .10 + (this.pointer.x - .5) * this.cursor.active * .12;
    this.group.rotation.x = .12 + Math.sin(t * .11) * .045;
    this.group.position.y = -.05 + Math.sin(t * .43) * .055;
    this.group.position.x = this.camera.aspect > 1.2 ? Math.min(.50, (this.camera.aspect - 1.2) * .36) : 0;
    for (const item of this.items) {
      const {positions, geo, k} = item;
      let offset = 0;
      for (let i = 0; i <= this.nu; i++) for (let j = 0; j <= this.nv; j++) {
        this.surface(i / this.nu, j / this.nv * 2 - 1, k, t);
        positions[offset++] = this._point.x; positions[offset++] = this._point.y; positions[offset++] = this._point.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    }
    let n = 0;
    for (let l = 0; l < this.lineCount; l++) {
      const k = l % 3;
      const v = ((l / this.lineCount) * 2 - 1) * 1.19;
      for (let i = 0; i < this.lineSteps; i++) for (let side = 0; side < 2; side++) {
        const u = (i + side) / this.lineSteps;
        this.surface(u, v, k, t);
        const edge = Math.max(0, Math.abs(v) - .85);
        this.linePositions[n++] = this._point.x + Math.sin(u * 8 - t + l) * edge * .10;
        this.linePositions[n++] = this._point.y;
        this.linePositions[n++] = this._point.z + .008 + Math.cos(u * 9 - t + l) * edge * .12;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < this.particleCount; i++) {
      const seed = i * 4, p = i * 3;
      const u = (this.particleSeeds[seed] + t * (.045 + this.particleSeeds[seed + 2] * .028)) % 1;
      const v = (this.particleSeeds[seed + 1] * 2 - 1) * 1.37;
      const k = i % 3;
      this.surface(u, v, k, t);
      const outside = Math.max(0, Math.abs(v) - .85);
      this.particlePositions[p] = this._point.x + Math.sin(t * .65 + i * 2.4) * outside * .25;
      this.particlePositions[p + 1] = this._point.y + Math.cos(t * .5 + i * 1.1) * outside * .12;
      this.particlePositions[p + 2] = this._point.z + .017 + outside * Math.sin(i * 1.7 + t) * .30;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.shadow.scale.x = 1 + Math.sin(t * .59) * .08;
    this.renderer.render(this.scene, this.camera);
  }

  paintFallback() {
    const c = this.fallback; if (!c) return;
    c.fillStyle = BG; c.fillRect(0, 0, this.w, this.h);
    const scale = Math.min(this.w * .26, this.h * .27);
    c.save(); c.translate(this.w * .5, this.h * .5); c.rotate(-.13);
    for (let k = 2; k >= 0; k--) {
      c.beginPath();
      for (let side = 0; side < 2; side++) for (let i = 0; i <= 100; i++) {
        const u = side ? 1 - i / 100 : i / 100;
        this.surface(u, side ? -1 : 1, k, this.time);
        const x = this._point.x * scale, y = -this._point.y * scale;
        if (!side && i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      const g = c.createLinearGradient(-scale, -scale, scale, scale);
      g.addColorStop(0, '#f7f9ff'); g.addColorStop(.28, '#6a7a8d'); g.addColorStop(.42, '#e5ecf4');
      g.addColorStop(.63, '#9194aa'); g.addColorStop(.79, '#f5f6fc'); g.addColorStop(1, '#7f9eab');
      c.fillStyle = g; c.fill();
    }
    c.restore();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.resizer?.disconnect(); this.observer?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    for (const resource of this.resources) resource.dispose();
    this.envTarget?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
