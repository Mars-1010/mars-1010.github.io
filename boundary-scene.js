import * as THREE from './vendor/three.module.js';

const LIMIT = { x: 4, z: 2.6 };
const INITIAL = [
  { id: 'a', label: 'Thresholds', x: -2.6, z: -.8 },
  { id: 'b', label: 'Between spaces', x: -.8, z: .6 },
  { id: 'c', label: 'Quiet structures', x: 1.1, z: -.8 },
  { id: 'd', label: 'Traces of light', x: 2.8, z: .7 },
];
const INK = '#343137';
const PALETTE = ['#b0a4c9', '#c9a576', '#9daa9c', '#c29d96'];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const normalizedRegion = (a, b) => ({
  x1: Math.min(a.x, b.x), z1: Math.min(a.z, b.z),
  x2: Math.max(a.x, b.x), z2: Math.max(a.z, b.z),
});

/** A small exhibition model. State and all application UI belong to the caller. */
export class BoundaryScene {
  constructor(canvas, { onSelect = () => {}, onRegion = () => {}, onMessage = () => {} } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('BoundaryScene needs a canvas.');
    this.canvas = canvas;
    this.callbacks = { onSelect, onRegion, onMessage };
    this.snapshot = { panels: INITIAL.map(p => ({ ...p })), selected: 'a', boundary: null, draftBoundary: null, suggestion: null, stage: 'arrange' };
    this.tool = 'select';
    this.view = 'perspective';
    this.azimuth = .31;
    this.elevation = .61;
    this.distance = 10.2;
    this.planScale = 6.15;
    this.visible = true;
    this.disposed = false;
    this.dirty = true;
    this.textures = new Set();
    this.panelObjects = new Map();
    this.panelMotions = new Map();
    this.motionFrame = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.hitObjects = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.originalTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
      this._build();
    } catch (error) {
      this._activateFallback();
    }
    this._bind();
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(this.canvas);
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && this.dirty) this._render();
      }, { rootMargin: '80px' });
      this.intersectionObserver.observe(this.canvas);
    }
    this._resize();
    this.update(this.snapshot);
  }

  _activateFallback() {
    // A canvas cannot switch from WebGL to 2D after a context was acquired.
    // Preserve its public attributes while replacing only the drawing surface.
    const oldCanvas = this.canvas;
    if (this.scene) this._clear(this.scene);
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    let context = null;
    if (!this.renderer) {
      try { context = oldCanvas.getContext('2d'); } catch { /* A partial WebGL initialization may own this canvas. */ }
    }
    if (!context) {
      this.canvas = oldCanvas.cloneNode(false);
      oldCanvas.replaceWith(this.canvas);
      context = this.canvas.getContext('2d');
    }
    this.renderer = null; this.scene = null;
    this.panelObjects.clear(); this.hitObjects = [];
    this.context = context; this.fallback = true; this.view = 'plan';
    this.callbacks.onMessage('3D graphics are unavailable on this device. The interactive plan view is available.');
  }

  _texture(width, height, draw) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    this.textures.add(t);
    return t;
  }

  _artwork(id, label) {
    const index = Math.max(0, 'abcd'.indexOf(id));
    return this._texture(768, 1280, (ctx, w, h) => {
      ctx.fillStyle = '#f5f1e9'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ded9d0'; ctx.lineWidth = 1;
      ctx.strokeRect(25, 25, w - 50, h - 50);
      ctx.fillStyle = INK;
      ctx.font = '500 29px Arial, sans-serif';
      ctx.fillText(`EXHIBITION STUDY  /  0${index + 1}`, 54, 81);
      ctx.font = '400 102px Georgia, serif'; ctx.fillText(id.toUpperCase(), 49, 202);
      ctx.save(); ctx.beginPath(); ctx.rect(54, 253, w - 108, 722); ctx.clip();
      const g = ctx.createLinearGradient(0, 280, w, 950);
      g.addColorStop(0, '#e5dfdf'); g.addColorStop(1, '#f0e8df');
      ctx.fillStyle = g; ctx.fillRect(54, 253, w - 108, 722);
      if (index === 0) {
        const arch = ctx.createLinearGradient(200, 350, 540, 880);
        arch.addColorStop(0, '#cfc7dc'); arch.addColorStop(.5, '#aa9cbe'); arch.addColorStop(1, '#857694');
        ctx.fillStyle = arch;
        ctx.beginPath(); ctx.moveTo(168, 975); ctx.lineTo(168, 539); ctx.bezierCurveTo(168, 277, 600, 277, 600, 539); ctx.lineTo(600, 975); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e7e0da'; ctx.beginPath(); ctx.moveTo(272, 975); ctx.lineTo(272, 564); ctx.bezierCurveTo(272, 415, 495, 415, 495, 564); ctx.lineTo(495, 975); ctx.fill();
        ctx.strokeStyle = 'rgba(246,240,231,.55)'; ctx.lineWidth = 2;
        for (let n = 0; n < 8; n++) { ctx.beginPath(); ctx.arc(384, 555, 237 + n * 15, Math.PI, 0); ctx.stroke(); }
      } else if (index === 1) {
        ctx.fillStyle = '#b58f65'; ctx.beginPath(); ctx.ellipse(390, 670, 212, 275, -.24, 0, Math.PI * 2); ctx.fill();
        const cut = ctx.createLinearGradient(220, 400, 510, 850); cut.addColorStop(0, '#e7dfd2'); cut.addColorStop(1, '#cabba6');
        ctx.fillStyle = cut; ctx.beginPath(); ctx.ellipse(390, 670, 130, 190, -.24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#eadac0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(380, 660, 183, 248, -.24, Math.PI, Math.PI * 1.8); ctx.stroke();
      } else if (index === 2) {
        ctx.fillStyle = '#a3aea1'; ctx.fillRect(163, 425, 221, 550);
        ctx.fillStyle = '#6f7f76'; ctx.beginPath(); ctx.moveTo(384, 425); ctx.lineTo(521, 352); ctx.lineTo(521, 975); ctx.lineTo(384, 975); ctx.fill();
        ctx.fillStyle = '#c7cfc3'; ctx.beginPath(); ctx.moveTo(163, 425); ctx.lineTo(300, 352); ctx.lineTo(521, 352); ctx.lineTo(384, 425); ctx.fill();
        ctx.fillStyle = '#e7e3d9'; ctx.fillRect(163, 595, 140, 28); ctx.fillRect(163, 795, 140, 28);
        ctx.strokeStyle = 'rgba(244,241,229,.7)'; ctx.lineWidth = 1;
        for (let n = 0; n < 8; n++) { ctx.beginPath(); ctx.moveTo(163 + n * 27, 425); ctx.lineTo(163 + n * 27, 975); ctx.stroke(); }
      } else {
        const orb = ctx.createRadialGradient(325, 510, 10, 380, 610, 270);
        orb.addColorStop(0, '#eadbd2'); orb.addColorStop(.5, '#caa79a'); orb.addColorStop(1, '#977a77');
        ctx.fillStyle = orb; ctx.beginPath(); ctx.ellipse(386, 628, 238, 284, -.18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#eadbcf'; ctx.lineWidth = 2;
        for (let n = -9; n < 10; n++) { ctx.beginPath(); ctx.ellipse(388, 626, 236, 55 + Math.abs(n) * 20, -.18, .1 + n * .018, Math.PI * .98); ctx.stroke(); }
      }
      ctx.restore();
      ctx.fillStyle = INK; ctx.font = '500 41px Arial, sans-serif';
      const words = String(label || INITIAL[index].label).split(' ');
      let line = '', y = 1060;
      for (const word of words) {
        if (ctx.measureText(`${line} ${word}`).width > 650 && line) { ctx.fillText(line, 54, y); line = word; y += 50; }
        else line = line ? `${line} ${word}` : word;
      }
      ctx.fillText(line, 54, y);
      ctx.fillStyle = '#827a73'; ctx.font = '400 23px Arial, sans-serif';
      ctx.fillText('FORM · MATERIAL · SPACE', 54, 1197);
    });
  }

  _mesh(geometry, material, position, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    parent.add(mesh); return mesh;
  }

  _build() {
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.18;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e8e5de');
    this.scene.fog = new THREE.Fog('#e8e5de', 21, 45);
    this.camera = new THREE.PerspectiveCamera(39, 1, .1, 70);
    this.planCamera = new THREE.OrthographicCamera(-6, 6, 4, -4, .1, 35);
    this.planCamera.position.set(0, 15, 0); this.planCamera.up.set(0, 0, -1); this.planCamera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#aeb0b1', 2.25));
    const sun = new THREE.DirectionalLight('#fff4dc', 3.2);
    sun.position.set(-4, 9, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
    sun.shadow.normalBias = .025; sun.shadow.bias = -.0001;
    sun.shadow.radius = 4; this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#d8d4f0', 1.1); fill.position.set(5, 4, -3); this.scene.add(fill);
    const floor = new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: .97 });
    const ground = this._mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: '#e8e5de', roughness: 1 }), [0, -.145, 0]);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    const slab = this._mesh(new THREE.BoxGeometry(9.5, .14, 6.65), floor, [0, -.07, 0]); slab.receiveShadow = true;
    this._floorLines();
    const backWall = this._mesh(new THREE.BoxGeometry(9.5, .32, .13), new THREE.MeshStandardMaterial({ color: '#e2dbcf', roughness: .92 }), [0, .16, -3.25]);
    backWall.receiveShadow = true;
    const rail = this._mesh(new THREE.BoxGeometry(9.5, .025, .025), new THREE.MeshStandardMaterial({ color: '#c6bbaa', metalness: .2, roughness: .7 }), [0, .33, -3.16]);
    rail.castShadow = true;
    this._sculpture();
    for (const data of this.snapshot.panels) this._createPanel(data);
    this.markers = new THREE.Group(); this.scene.add(this.markers);
    this.proposals = new THREE.Group(); this.scene.add(this.proposals);
    this.liveRegion = new THREE.Group(); this.scene.add(this.liveRegion);
    this._placeCamera();
  }

  _floorLines() {
    const points = [];
    for (let x = -4; x <= 4; x += .5) points.push(new THREE.Vector3(x, .006, -2.6), new THREE.Vector3(x, .006, 2.6));
    for (let z = -2.5; z <= 2.5; z += .5) points.push(new THREE.Vector3(-4, .006, z), new THREE.Vector3(4, .006, z));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#bfb6a8', transparent: true, opacity: .21 }));
    this.scene.add(lines);
    const border = [new THREE.Vector3(-4, .009, -2.6), new THREE.Vector3(4, .009, -2.6), new THREE.Vector3(4, .009, 2.6), new THREE.Vector3(-4, .009, 2.6), new THREE.Vector3(-4, .009, -2.6)];
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(border), new THREE.LineBasicMaterial({ color: '#aaa08e', transparent: true, opacity: .48 })));
  }

  _sculpture() {
    const platform = this._mesh(new THREE.CylinderGeometry(.67, .7, .13, 64), new THREE.MeshStandardMaterial({ color: '#e2d9c8', roughness: .85 }), [-3.45, .065, -2.27]);
    platform.castShadow = platform.receiveShadow = true;
    const form = this._mesh(new THREE.TorusGeometry(.33, .1, 20, 64), new THREE.MeshStandardMaterial({ color: '#beac8b', roughness: .49, metalness: .13 }), [-3.45, .51, -2.27]);
    form.rotation.set(.08, -.22, .13); form.castShadow = true;
    const plinth = this._mesh(new THREE.CylinderGeometry(.3, .31, .25, 48), new THREE.MeshStandardMaterial({ color: '#d3c6b1', roughness: .8 }), [3.55, .125, -2.23]);
    plinth.castShadow = true;
    const orb = this._mesh(new THREE.SphereGeometry(.27, 32, 24), new THREE.MeshStandardMaterial({ color: '#b5a8bf', roughness: .38, metalness: .08 }), [3.55, .5, -2.23]); orb.castShadow = true;
  }

  _createPanel(data) {
    const group = new THREE.Group(); group.userData.id = data.id; this.scene.add(group);
    const frame = this._mesh(new THREE.BoxGeometry(1.19, 2.1, .085), new THREE.MeshStandardMaterial({ color: '#aba398', roughness: .58, metalness: .22 }), [0, 1.3, 0], group);
    frame.castShadow = true; frame.receiveShadow = true; frame.userData.id = data.id; this.hitObjects.push(frame);
    const texture = this._artwork(data.id, data.label);
    const front = this._mesh(new THREE.PlaneGeometry(1.145, 2.055), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }), [0, 1.3, .044], group);
    const back = this._mesh(new THREE.PlaneGeometry(1.145, 2.055), new THREE.MeshStandardMaterial({ color: '#d7d0c4', roughness: .95 }), [0, 1.3, -.044], group); back.rotation.y = Math.PI;
    const stem = new THREE.MeshStandardMaterial({ color: '#a79b88', metalness: .44, roughness: .5 });
    for (const x of [-.4, .4]) {
      this._mesh(new THREE.CylinderGeometry(.016, .016, .25, 10), stem, [x, .13, 0], group).castShadow = true;
      this._mesh(new THREE.BoxGeometry(.045, .025, .49), stem, [x, .02, 0], group).castShadow = true;
    }
    const planLabel = this._texture(256, 180, ctx => {
      ctx.fillStyle = '#f7f3e9'; ctx.fillRect(0, 0, 256, 180);
      ctx.fillStyle = PALETTE[Math.max(0, 'abcd'.indexOf(data.id))]; ctx.fillRect(0, 0, 256, 15);
      ctx.fillStyle = INK; ctx.font = '400 92px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(data.id.toUpperCase(), 128, 126);
    });
    const labelMesh = this._mesh(new THREE.PlaneGeometry(.83, .58), new THREE.MeshBasicMaterial({ map: planLabel, side: THREE.DoubleSide }), [0, .03, .41], group);
    labelMesh.rotation.x = -Math.PI / 2; labelMesh.userData.id = data.id; this.hitObjects.push(labelMesh);
    this.panelObjects.set(data.id, { group, frame, front, texture, label: data.label, labelMesh });
  }

  _clear(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children[0]; group.remove(child);
      child.traverse(object => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
        else object.material?.dispose();
      });
    }
  }

  _outline(points, color, dashed = false, parent = this.markers, opacity = 1) {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: .1, gapSize: .065, transparent: true, opacity, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), material);
    if (dashed) line.computeLineDistances(); parent.add(line); return line;
  }

  _rectangle(region, color, dashed, parent, fill = .08) {
    const { x1, x2, z1, z2 } = region;
    const points = [[x1, .027, z1], [x2, .027, z1], [x2, .027, z2], [x1, .027, z2], [x1, .027, z1]];
    this._outline(points, color, dashed, parent);
    const plane = this._mesh(new THREE.PlaneGeometry(Math.max(.001, x2 - x1), Math.max(.001, z2 - z1)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fill, depthWrite: false, side: THREE.DoubleSide }), [(x1 + x2) / 2, .022, (z1 + z2) / 2], parent);
    plane.rotation.x = -Math.PI / 2;
    if (!dashed) {
      const hatch = [];
      for (let d = -(z2 - z1); d < (x2 - x1); d += .32) {
        const xA = Math.max(x1, x1 + d), zA = z1 + Math.max(0, -d);
        const length = Math.min(x2 - xA, z2 - zA);
        if (length > 0) hatch.push(new THREE.Vector3(xA, .026, zA), new THREE.Vector3(xA + length, .026, zA + length));
      }
      parent.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hatch), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .19, depthWrite: false })));
    }
  }

  _boundary(boundary, draft = false) {
    if (!boundary?.target) return;
    const color = draft ? '#aa9270' : '#9c7948';
    if (boundary.target.type === 'region') {
      this._rectangle(boundary.target, color, draft, this.markers, draft ? .045 : .095); return;
    }
    const panel = this.snapshot.panels.find(p => p.id === boundary.target.id);
    if (!panel) return;
    this._rectangle({ x1: panel.x - .72, x2: panel.x + .72, z1: panel.z - .32, z2: panel.z + .73 }, color, draft, this.markers, .045);
    if (!draft) {
      const pinMaterial = new THREE.MeshStandardMaterial({ color: '#aa864d', metalness: .7, roughness: .3 });
      this._mesh(new THREE.SphereGeometry(.064, 18, 14), pinMaterial, [panel.x + .42, 2.42, panel.z + .075], this.markers);
      const pin = this._mesh(new THREE.CylinderGeometry(.012, .016, .19, 10), pinMaterial, [panel.x + .42, 2.31, panel.z + .075], this.markers); pin.rotation.z = -.3;
    }
  }

  _proposal() {
    const proposal = this.snapshot.suggestion;
    if (!proposal) return;
    const panel = this.snapshot.panels.find(p => p.id === proposal.panelId);
    if (!panel) return;
    const original = this.panelObjects.get(panel.id);
    if (proposal.type === 'layout' && proposal.to) {
      const { x, z } = proposal.to;
      const ghost = new THREE.Group(); ghost.position.set(x, 0, z); this.proposals.add(ghost);
      this._mesh(new THREE.BoxGeometry(1.19, 2.1, .065), new THREE.MeshBasicMaterial({ color: '#a590ca', transparent: true, opacity: .17, depthWrite: false }), [0, 1.3, 0], ghost);
      this._mesh(new THREE.PlaneGeometry(1.145, 2.055), new THREE.MeshBasicMaterial({ map: original?.texture, color: '#c5b3e8', transparent: true, opacity: .43, side: THREE.DoubleSide, depthWrite: false }), [0, 1.3, .038], ghost);
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.19, 2.1, .065));
      const outline = new THREE.LineSegments(edges, new THREE.LineDashedMaterial({ color: '#8872ac', dashSize: .08, gapSize: .05, transparent: true, opacity: .85, depthWrite: false }));
      outline.position.y = 1.3; outline.computeLineDistances(); ghost.add(outline);
      this._rectangle({ x1: x - .72, x2: x + .72, z1: z - .32, z2: z + .73 }, '#9b83bf', true, this.proposals, .06);
      this._outline([[panel.x, .07, panel.z + .5], [x, .07, z + .5]], '#9b83bf', true, this.proposals, .85);
    } else {
      const line = [[panel.x + .62, 1.9, panel.z + .1], [panel.x + .83, 2.2, panel.z + .1], [panel.x + 1.02, 2.2, panel.z + .1]];
      this._outline(line, '#8b73b0', false, this.proposals);
      this._mesh(new THREE.SphereGeometry(.055, 16, 12), new THREE.MeshBasicMaterial({ color: '#a58cc7' }), line[0], this.proposals);
      this._mesh(new THREE.BoxGeometry(.16, .16, .025), new THREE.MeshStandardMaterial({ color: '#c5b3dd', roughness: .8 }), line[2], this.proposals);
    }
  }

  update(snapshot) {
    if (this.disposed) return;
    const previousPanels = this.snapshot.panels;
    const now = performance.now();
    this._advanceMotion(now);
    this.snapshot = { ...this.snapshot, ...snapshot, panels: snapshot.panels || this.snapshot.panels };
    if (this.renderer) {
      for (const panel of this.snapshot.panels) {
        const existed = this.panelObjects.has(panel.id);
        if (!existed) this._createPanel(panel);
        const object = this.panelObjects.get(panel.id);
        const previous = previousPanels.find(p => p.id === panel.id);
        const moved = previous && (previous.x !== panel.x || previous.z !== panel.z);
        if (existed && moved && !this.reducedMotion.matches) {
          this.panelMotions.set(panel.id, { x: object.group.position.x, z: object.group.position.z, toX: panel.x, toZ: panel.z, start: now });
        } else if (!this.panelMotions.has(panel.id) || this.reducedMotion.matches) {
          this.panelMotions.delete(panel.id);
          object.group.position.set(panel.x, 0, panel.z);
        }
        object.frame.material.color.set(panel.id === this.snapshot.selected ? '#9281a6' : '#aba398');
        if (object.label !== panel.label) {
          const previous = object.texture;
          object.label = panel.label; object.texture = this._artwork(panel.id, panel.label);
          object.front.material.map = object.texture; object.front.material.needsUpdate = true;
          previous.dispose(); this.textures.delete(previous);
        }
      }
      this._clear(this.markers); this._clear(this.proposals);
      this.selectionMarker = null;
      const selected = this.snapshot.panels.find(p => p.id === this.snapshot.selected);
      if (selected) {
        this.selectionMarker = new THREE.Group(); this.markers.add(this.selectionMarker);
        this._rectangle({ x1: -.65, x2: .65, z1: -.24, z2: .66 }, '#8d79a7', false, this.selectionMarker, .055);
        this._outline([[-.6, .25, .06], [-.6, 2.35, .06], [.6, 2.35, .06], [.6, .25, .06]], '#8d79a7', false, this.selectionMarker, .8);
      }
      this._boundary(this.snapshot.boundary);
      this._boundary(this.snapshot.draftBoundary, true);
      this._proposal();
      this._advanceMotion(now);
      this._queueMotion();
    }
    this._requestRender();
  }

  _advanceMotion(now) {
    for (const [id, motion] of this.panelMotions) {
      const object = this.panelObjects.get(id);
      if (!object) { this.panelMotions.delete(id); continue; }
      const progress = this.reducedMotion.matches ? 1 : clamp((now - motion.start) / 450, 0, 1);
      const ease = progress * progress * (3 - 2 * progress);
      object.group.position.set(motion.x + (motion.toX - motion.x) * ease, 0, motion.z + (motion.toZ - motion.z) * ease);
      if (progress === 1) this.panelMotions.delete(id);
    }
    const selected = this.panelObjects.get(this.snapshot.selected);
    if (this.selectionMarker && selected) this.selectionMarker.position.copy(selected.group.position);
  }

  _queueMotion() {
    if (this.disposed || this.motionFrame !== null || !this.panelMotions.size) return;
    this.motionFrame = requestAnimationFrame(now => {
      this.motionFrame = null;
      if (this.disposed) return;
      this._advanceMotion(now); this._requestRender(); this._queueMotion();
    });
  }

  setTool(tool) {
    this.tool = tool === 'region' ? 'region' : 'select';
    if (this.tool === 'region') this.setView('plan');
    this.canvas.style.cursor = this.tool === 'region' ? 'crosshair' : 'grab';
    this._cancelPointer();
    this._requestRender();
  }

  setView(view) {
    this.view = view === 'plan' ? 'plan' : 'perspective';
    this._placeCamera(); this._requestRender();
  }

  resetView() {
    this.azimuth = .31; this.elevation = .61; this.distance = 10.2; this.planScale = 6.15;
    this._placeCamera(); this._requestRender();
  }

  _placeCamera() {
    if (!this.renderer) return;
    const aspect = Math.max(.3, (this.width || 900) / (this.height || 650));
    const radius = this.distance * (aspect < 1.15 ? 1.15 / aspect : 1);
    this.camera.position.set(Math.sin(this.azimuth) * Math.cos(this.elevation) * radius, Math.sin(this.elevation) * radius + .6, Math.cos(this.azimuth) * Math.cos(this.elevation) * radius);
    this.camera.aspect = aspect; this.camera.lookAt(0, .85, 0); this.camera.updateProjectionMatrix();
    const halfW = Math.max(this.planScale, this.planScale * aspect / 1.45), halfH = halfW / aspect;
    Object.assign(this.planCamera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.planCamera.updateProjectionMatrix();
    for (const object of this.panelObjects.values()) object.labelMesh.visible = this.view === 'plan';
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width)); this.height = Math.max(1, Math.round(rect.height));
    if (this.renderer) { this.renderer.setSize(this.width, this.height, false); this._placeCamera(); }
    else { const ratio = Math.min(window.devicePixelRatio || 1, 2); this.canvas.width = this.width * ratio; this.canvas.height = this.height * ratio; this.pixelRatio = ratio; }
    this._requestRender();
  }

  _coords(event) {
    const r = this.canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  _world(event) {
    const p = this._coords(event);
    if (!this.renderer) {
      const v = this._planMetrics();
      return { x: clamp((p.x - v.cx) / v.scale, -LIMIT.x, LIMIT.x), z: clamp((p.y - v.cy) / v.scale, -LIMIT.z, LIMIT.z) };
    }
    this.pointer.set(p.x / this.width * 2 - 1, -(p.y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.view === 'plan' ? this.planCamera : this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, hit)) return null;
    return { x: clamp(hit.x, -LIMIT.x, LIMIT.x), z: clamp(hit.z, -LIMIT.z, LIMIT.z) };
  }

  _pick(event) {
    const p = this._coords(event);
    if (!this.renderer) {
      const v = this._planMetrics();
      return this.snapshot.panels.slice().reverse().find(panel => Math.abs(p.x - v.cx - panel.x * v.scale) < .75 * v.scale && Math.abs(p.y - v.cy - (panel.z + .1) * v.scale) < .48 * v.scale)?.id;
    }
    this.pointer.set(p.x / this.width * 2 - 1, -(p.y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.view === 'plan' ? this.planCamera : this.camera);
    return this.raycaster.intersectObjects(this.hitObjects, false)[0]?.object.userData.id;
  }

  _bind() {
    this.handlers = {
      pointerdown: e => {
        if (e.button !== 0 || this.drag) return;
        e.preventDefault(); this.canvas.setPointerCapture(e.pointerId);
        this.drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, startWorld: this._world(e), moved: false };
        this.canvas.style.cursor = this.tool === 'region' ? 'crosshair' : 'grabbing';
      },
      pointermove: e => {
        if (!this.drag || this.drag.id !== e.pointerId) return;
        const d = this.drag; d.moved ||= Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5;
        if (this.tool === 'region') {
          const end = this._world(e);
          if (d.startWorld && end) {
            this.pendingRegion = normalizedRegion(d.startWorld, end);
            if (this.renderer) { this._clear(this.liveRegion); this._rectangle(this.pendingRegion, '#9f8057', true, this.liveRegion, .11); }
          }
        } else if (this.view === 'perspective' && this.renderer && d.moved) {
          this.azimuth -= (e.clientX - d.lastX) * .006;
          this.elevation = clamp(this.elevation + (e.clientY - d.lastY) * .004, .23, 1.2); this._placeCamera();
        }
        d.lastX = e.clientX; d.lastY = e.clientY; this._requestRender();
      },
      pointerup: e => {
        if (!this.drag || this.drag.id !== e.pointerId) return;
        const d = this.drag;
        if (this.tool === 'region' && d.startWorld) {
          const end = this._world(e) || d.startWorld;
          let region = normalizedRegion(d.startWorld, end);
          if (region.x2 - region.x1 < .5) { const center = (region.x1 + region.x2) / 2; region.x1 = clamp(center - .25, -4, 3.5); region.x2 = region.x1 + .5; }
          if (region.z2 - region.z1 < .5) { const center = (region.z1 + region.z2) / 2; region.z1 = clamp(center - .25, -2.6, 2.1); region.z2 = region.z1 + .5; }
          this.callbacks.onRegion(region);
        } else if (!d.moved) { const id = this._pick(e); if (id) this.callbacks.onSelect(id); }
        this._cancelPointer();
      },
      pointercancel: () => this._cancelPointer(),
      lostpointercapture: () => this._cancelPointer(),
      wheel: e => {
        e.preventDefault();
        if (this.view === 'perspective') this.distance = clamp(this.distance + e.deltaY * .008, 8.7, 17);
        else this.planScale = clamp(this.planScale + e.deltaY * .004, 4.6, 8);
        this._placeCamera(); this._requestRender();
      },
      contextmenu: e => e.preventDefault(),
    };
    for (const [name, handler] of Object.entries(this.handlers)) this.canvas.addEventListener(name, handler, { passive: false });
  }

  _cancelPointer() {
    const id = this.drag?.id; this.drag = null; this.pendingRegion = null;
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    if (this.renderer) this._clear(this.liveRegion);
    this.canvas.style.cursor = this.tool === 'region' ? 'crosshair' : 'grab';
    this._requestRender();
  }

  _requestRender() { this.dirty = true; if (this.visible && !this.disposed) this._render(); }

  _render() {
    if (this.disposed) return;
    this.dirty = false;
    if (this.renderer) this.renderer.render(this.scene, this.view === 'plan' ? this.planCamera : this.camera);
    else this._drawFallback();
  }

  _planMetrics() {
    return { cx: this.width / 2, cy: this.height / 2 + 10, scale: Math.min(this.width / 10.1, this.height / 7) };
  }

  _drawFallback() {
    const ctx = this.context; if (!ctx) return;
    const { cx, cy, scale } = this._planMetrics();
    ctx.setTransform(this.pixelRatio || 1, 0, 0, this.pixelRatio || 1, 0, 0);
    ctx.fillStyle = '#e8e5de'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
    ctx.fillStyle = '#eee8dd'; ctx.fillRect(-4.75, -3.325, 9.5, 6.65);
    ctx.lineWidth = 1 / scale; ctx.strokeStyle = '#d8cfc0';
    for (let x = -4; x <= 4; x += .5) { ctx.beginPath(); ctx.moveTo(x, -2.6); ctx.lineTo(x, 2.6); ctx.stroke(); }
    for (let z = -2.5; z <= 2.5; z += .5) { ctx.beginPath(); ctx.moveTo(-4, z); ctx.lineTo(4, z); ctx.stroke(); }
    const region = (target, draft = false) => {
      if (!target) return;
      let r = target;
      if (target.type === 'object') { const p = this.snapshot.panels.find(p => p.id === target.id); if (!p) return; r = { x1: p.x - .72, x2: p.x + .72, z1: p.z - .32, z2: p.z + .73 }; }
      ctx.save(); ctx.setLineDash(draft ? [.1, .07] : []); ctx.strokeStyle = '#9c7948'; ctx.fillStyle = '#b4966020';
      ctx.fillRect(r.x1, r.z1, r.x2 - r.x1, r.z2 - r.z1); ctx.strokeRect(r.x1, r.z1, r.x2 - r.x1, r.z2 - r.z1); ctx.restore();
    };
    region(this.snapshot.boundary?.target); region(this.snapshot.draftBoundary?.target, true); region(this.pendingRegion, true);
    for (const [i, p] of this.snapshot.panels.entries()) {
      ctx.fillStyle = p.id === this.snapshot.selected ? '#b4a3c2' : '#aaa094'; ctx.fillRect(p.x - .61, p.z - .07, 1.22, .14);
      ctx.fillStyle = '#f7f2e7'; ctx.fillRect(p.x - .43, p.z + .12, .86, .65);
      ctx.fillStyle = PALETTE[i % 4]; ctx.fillRect(p.x - .43, p.z + .12, .86, .06);
      ctx.fillStyle = INK; ctx.font = '.45px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(p.id.toUpperCase(), p.x, p.z + .63);
      if (p.id === this.snapshot.selected) { ctx.strokeStyle = '#8d79a7'; ctx.strokeRect(p.x - .67, p.z - .24, 1.34, 1.05); }
      if (this.snapshot.boundary?.target.type === 'object' && this.snapshot.boundary.target.id === p.id) { ctx.fillStyle = '#9c7948'; ctx.beginPath(); ctx.arc(p.x + .42, p.z, .075, 0, Math.PI * 2); ctx.fill(); }
    }
    const proposal = this.snapshot.suggestion;
    if (proposal?.type === 'layout' && proposal.to) {
      const p = this.snapshot.panels.find(p => p.id === proposal.panelId), t = proposal.to;
      ctx.strokeStyle = '#9b83bf'; ctx.fillStyle = '#a58cc72c'; ctx.setLineDash([.09, .06]);
      ctx.fillRect(t.x - .61, t.z - .15, 1.22, .65); ctx.strokeRect(t.x - .61, t.z - .15, 1.22, .65);
      if (p) { ctx.beginPath(); ctx.moveTo(p.x, p.z + .5); ctx.lineTo(t.x, t.z + .5); ctx.stroke(); }
    }
    ctx.restore();
  }

  dispose() {
    if (this.disposed) return;
    this._cancelPointer(); this.disposed = true;
    if (this.motionFrame !== null) cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null; this.panelMotions.clear();
    this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect();
    for (const [name, handler] of Object.entries(this.handlers)) this.canvas.removeEventListener(name, handler);
    this.canvas.style.touchAction = this.originalTouchAction;
    if (this.scene) this._clear(this.scene);
    for (const texture of this.textures) texture.dispose();
    this.textures.clear(); this.renderer?.dispose();
  }
}
