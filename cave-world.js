/**
 * A procedural browser study of a responsive projection environment.
 * The three modes are interaction concepts, not a reconstruction of the
 * installation, a physical sensor system, or an emotion classifier.
 */
const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }
`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uEnergy;
uniform float uCalm;
uniform float uPinch;
uniform float uMode;
uniform sampler2D uMemory;
uniform float uXR;
uniform mat4 uInvProjection;
uniform mat4 uViewTransform;

const float PI = 3.14159265359;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
    mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
}
float rock(vec2 p) {
  return noise(p) * .58 + noise(p * 2.13) * .27 + noise(p * 4.27) * .15;
}

// A small distance field gives the projected light a spatial, irregular shell.
float shell(vec3 p) {
  vec2 center = vec2(.12 * sin(p.z * .18), .40 + .08 * sin(p.z * .22));
  vec2 q = (p.xy - center) / vec2(3.85, 2.88);
  float a = atan(q.y, q.x);
  float r = 1. + .056 * sin(a * 7. + p.z * .7)
    + .029 * sin(a * 15. - p.z * .38)
    + .014 * sin(a * 29. + p.z * 1.2);
  float cave = (r - length(q)) * 2.48;
  float floorD = p.y + 1.72 + .012 * sin(p.x * 2.3 + p.z * .7);
  return min(cave, floorD);
}
vec3 normalAt(vec3 p) {
  const float e = .025;
  float d = shell(p);
  return normalize(vec3(shell(p + vec3(e,0.,0.)) - d,
    shell(p + vec3(0.,e,0.)) - d, shell(p + vec3(0.,0.,e)) - d));
}
float streak(float f, float width) {
  return exp(-abs(sin(f)) / width);
}

void main() {
  vec2 uv = (vUv - .5) * vec2(uResolution.x / uResolution.y, 1.);
  float time = uTime;
  float tempo = mix(.76, .32, uCalm);
  float drift = time * .115;
  vec3 ro = vec3((uPointer.x - .5) * .32, .05 + (uPointer.y - .5) * .15, drift);
  vec3 rd = normalize(vec3(uv * 1.45, 1.32));
  float yaw = (uPointer.x - .5) * .085;
  float pitch = (uPointer.y - .5) * .045;
  rd.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * rd.xz;
  rd.yz = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch)) * rd.yz;
  if (uXR > .5) {
    vec4 viewRay = uInvProjection * vec4(vUv * 2. - 1., 1., 1.);
    vec3 worldRay = mat3(uViewTransform) * normalize(viewRay.xyz / viewRay.w);
    // WebXR looks down -Z; the procedural chamber's forward axis is +Z.
    rd = normalize(worldRay * vec3(1., 1., -1.));
    ro += uViewTransform[3].xyz * vec3(1., 1., -1.);
  }

  float distance = .1;
  float hit = 0.;
  for (int i = 0; i < 46; i++) {
    float d = shell(ro + rd * distance);
    if (d < .025) { hit = 1.; break; }
    distance += max(.025, min(d * .80, 1.75));
    if (distance > 41.) break;
  }
  vec3 p = ro + rd * distance;
  vec3 n = normalAt(p);
  bool isFloor = p.y < -1.64;
  float a = atan((p.y - .4) / 2.88, p.x / 3.85);
  vec2 surface = vec2(a * 5.4, p.z * .53);
  float grain = rock(surface * 3.8);
  float strata = noise(vec2(a * 17., p.z * .42));
  float contour = p.z * 2.4 + sin(a * 9. + p.z * .21) * 1.4
    + strata * 5.1;
  float ribs = streak(contour, .12);
  float fine = streak(contour * 2. + grain * 2., .055);
  float veins = streak(a * 52. + sin(p.z * .85 + a * 8.) * 2.4 + grain * 6., .075);
  float lightPatch = smoothstep(.20, .82, noise(surface * .32 + vec2(time * .035, 0.)));
  vec3 cyan = vec3(.018, .57, .91);
  vec3 ice = vec3(.28, .94, 1.);
  vec3 blue = vec3(.012, .12, .37);
  float rim = pow(1. - max(0., dot(n, -rd)), 2.);
  vec3 lightDir = normalize(vec3(1.5, 1.3, ro.z + 4.5) - p);
  float diffuse = max(0., dot(n, lightDir));
  vec3 color = vec3(.005, .014, .029) * (1. + grain * 2.5);
  color += blue * (.075 + diffuse * .29 + rim * .22);
  color += cyan * (ribs * 1.08 + fine * .22 + veins * .17) * lightPatch;
  color += ice * pow(ribs, 4.) * lightPatch * .18;

  // Proximity is a direct input mapping. There is no inferred internal emotion.
  vec3 source = vec3((uPointer.x - .5) * 5.4, -1.35 + uPointer.y * 1.9, ro.z + 5.8);
  float radial = length((p - source) * vec3(1., .95, .9));
  float phase = radial * 3.5 - time * (1.9 + uEnergy * 1.4) * tempo;
  float ripple = pow(.5 + .5 * sin(phase), 16.) * exp(-radial * .085);
  float wideGlow = exp(-radial * .36);
  if (uMode < .5) {
    color += mix(cyan, ice, .34) * ripple * (.24 + uEnergy * 1.35);
    color += cyan * wideGlow * .14;
    color += vec3(.48, .18, .026) * pow(.5 + .5 * sin(phase + .35), 28.)
      * exp(-radial * .24) * uEnergy * .25;
  }

  // Reflective floor: geometry-aligned ribbons carry light towards the visitor.
  if (isFloor) {
    float path = abs(p.x + sin(p.z * .42 + time * .12) * .38);
    float flowing = streak(path * 4.3 + sin(p.z * .75 - time * tempo) * .5, .14);
    float reflection = streak(p.z * 1.1 + noise(vec2(p.x * 3., p.z)) * .8, .06);
    color *= .59;
    color += cyan * flowing * (.07 + .16 * uEnergy) / (1. + path * .38);
    color += ice * reflection * .027;
    color += vec3(.025, .12, .20) * exp(-path * 1.6);
  }

  // The warm aperture is drawn at an actual plane in the procedural chamber.
  float portalT = 8. / max(.001, rd.z);
  vec3 portalP = ro + rd * portalT - vec3(0., .28, ro.z + 8.);
  vec2 portalQ = portalP.xy;
  float portalR = length(portalQ);
  float theta = atan(portalQ.y, portalQ.x);
  float portalRadius = max(.015, 1.95 * uPinch);
  float ringDistance = abs(portalR - portalRadius);
  float portalActive = uMode > .5 && uMode < 1.5 ? smoothstep(0., .12, uPinch) : .0;
  float visible = step(portalT, distance + .15);
  float thinRing = exp(-ringDistance * 70.);
  float corona = exp(-ringDistance * 9.);
  float arc = .6 + .4 * sin(theta * 8. - time * 1.6 + sin(theta * 3. + time * .4));
  vec3 portalColor = mix(vec3(.015,.65,1.), vec3(1.,.40,.06),
    smoothstep(-.4,.8,sin(theta + time * .23)));
  float aperture = 1. - smoothstep(portalRadius - .07, portalRadius, portalR);
  if (portalActive > .001 && visible > .5) {
    float tunnel = streak(log(max(.06, portalR / portalRadius)) * 5. - time * .9, .09);
    float spiral = streak(theta * 5. + log(max(.06, portalR)) * 7. + time * .8, .10);
    vec3 beyond = vec3(.001, .007, .020) + cyan * tunnel * .10 + ice * spiral * .08;
    color = mix(color, beyond, aperture * .90 * portalActive);
    color += portalColor * (thinRing * 2. + corona * arc * .75) * portalActive;
    color += ice * exp(-ringDistance * 160.) * 1.3 * portalActive;
    // Small deterministic sparks rotate with a radius set by the pinch input.
    for (int j = 0; j < 12; j++) {
      float jf = float(j);
      float spin = jf * 2.39996 + time * (.14 + mod(jf, 3.) * .055);
      float radius = portalRadius + .10 + .29 * hash(vec2(jf, 9.));
      vec2 spark = vec2(cos(spin), sin(spin)) * radius;
      float sparkD = length(portalQ - spark);
      color += mix(ice, vec3(1., .63, .20), mod(jf, 2.)) * exp(-sparkD * 105.) * 1.5 * portalActive;
      color += portalColor * exp(-sparkD * 20.) * .08 * portalActive;
    }
  }
  if (portalActive > .001) {
    color += portalColor * exp(-length(p - vec3(0., .28, ro.z + 8.)) * .55)
      * (.15 + ribs * .7) * portalActive;
    if (isFloor) {
      float refl = exp(-abs(abs(p.x) - portalRadius * .38) * 3.)
        * exp(-abs(p.z - ro.z - 8.) * .18);
      color += vec3(.19, .30, .32) * refl * (.12 + .12 * sin(p.z * 10.)) * portalActive;
    }
  }

  // A decaying local texture retains the visitor's previous movement.
  if (uMode > 1.5) {
    vec4 memory = texture2D(uMemory, vec2(vUv.x, 1. - vUv.y));
    float trace = memory.r;
    float aura = memory.g;
    vec3 traceColor = mix(vec3(.11, .65, 1.), vec3(1., .49, .15), memory.b);
    color += traceColor * (trace * 1.65 + aura * .55) * (.60 + grain * .5);
    color += ice * pow(trace, 3.) * .55;
    color += cyan * veins * .25;
  }

  vec3 fog = vec3(.002, .012, .030);
  float mist = 1. - exp(-distance * .033);
  color = mix(color, fog, mist * .82);
  color += vec3(.012,.10,.19) * exp(-length(uv - vec2(0.,.05)) * 5.) * .50;
  // Subtle floating dust is depth independent and deliberately understated.
  vec2 dustUV = uv * vec2(100.,65.) + vec2(time * .1, -time * .18);
  vec2 cell = floor(dustUV);
  float dust = pow(max(0., 1. - length(fract(dustUV) - .5) * 7.), 3.);
  dust *= step(.988, hash(cell));
  color += ice * dust * .38;
  float vignette = 1. - smoothstep(.35, 1.25, length((vUv - .5) * vec2(1.3, 1.)));
  color *= .68 + vignette * .50;
  color = vec3(1.) - exp(-max(vec3(0.), color) * 1.35);
  color = pow(color, vec3(.88));
  gl_FragColor = vec4(color, 1.);
}
`;

const clamp = (value, fallback = .5) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;

function inverseMatrix(matrix) {
  // Gauss-Jordan inversion uses column-major WebXR matrices.
  const rows = Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_, column) => column < 4 ? matrix[column * 4 + row] : Number(column - 4 === row)));
  for (let column = 0; column < 4; column++) {
    let pivot = column;
    for (let row = column + 1; row < 4; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-12) return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    for (let item = 0; item < 8; item++) rows[column][item] /= divisor;
    for (let row = 0; row < 4; row++) if (row !== column) {
      const factor = rows[row][column];
      for (let item = 0; item < 8; item++) rows[row][item] -= factor * rows[column][item];
    }
  }
  return new Float32Array(Array.from({ length: 16 }, (_, i) => rows[i % 4][4 + Math.floor(i / 4)]));
}

export class CaveWorld {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('CaveWorld needs a canvas element.');
    this.canvas = canvas;
    this.disposed = false;
    this.xrGeneration = 0;
    this.time = 0;
    this.lastFrame = 0;
    this.lastMemoryTime = 0;
    this.lastPaint = null;
    this.dirty = true;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.state = { mode: 'ripple', x: .5, y: .5, energy: .45, calm: .55, pinch: .45, paused: this.reducedMotion.matches };
    this.memory = document.createElement('canvas');
    this.memory.width = 512;
    this.memory.height = 320;
    this.memoryCtx = this.memory.getContext('2d', { alpha: false });
    this.memoryCtx.fillStyle = '#000';
    this.memoryCtx.fillRect(0, 0, this.memory.width, this.memory.height);
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    this.kind = this.gl ? 'webgl' : 'canvas2d';
    if (this.gl) this.initGL();
    else this.ctx = canvas.getContext('2d', { alpha: false });
    this.boundResize = () => this.resize();
    this.boundVisibility = () => { this.lastFrame = 0; this.dirty = true; this.schedule(); };
    this.boundMotion = event => this.setState({ paused: event.matches });
    window.addEventListener('resize', this.boundResize, { passive: true });
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.reducedMotion.addEventListener?.('change', this.boundMotion);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.boundResize) : null;
    this.resizeObserver?.observe(canvas);
    this.boundLost = event => { event.preventDefault(); this.contextLost = true; cancelAnimationFrame(this.frame); };
    this.boundRestored = () => { this.contextLost = false; this.initGL(); this.resize(); this.schedule(); };
    canvas.addEventListener('webglcontextlost', this.boundLost);
    canvas.addEventListener('webglcontextrestored', this.boundRestored);
    this.resize();
    this.schedule();
  }

  initGL() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Cave shader could not compile: ${message}`);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    // highp is supported by current browsers; mediump allows older mobile GPUs.
    const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const fragment = compile(gl.FRAGMENT_SHADER, highp?.precision ? FRAGMENT : FRAGMENT.replace('precision highp float;', 'precision mediump float;'));
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex);
    gl.attachShader(this.program, fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(`Cave shader could not link: ${gl.getProgramInfoLog(this.program)}`);
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['uResolution','uPointer','uTime','uEnergy','uCalm','uPinch','uMode','uMemory','uXR','uInvProjection','uViewTransform'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    this.texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.uniforms.uMemory, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.memoryDirty = true;
  }

  setState(partial = {}) {
    const previousMode = this.state.mode;
    for (const key of ['x','y','energy','calm','pinch']) {
      if (key in partial) this.state[key] = clamp(partial[key], this.state[key]);
    }
    if (['ripple','portal','memory'].includes(partial.mode)) this.state.mode = partial.mode;
    if (typeof partial.paused === 'boolean') this.state.paused = partial.paused;
    if (previousMode !== this.state.mode) this.lastPaint = null;
    if (this.state.mode === 'memory') this.paintMemory();
    this.dirty = true;
    this.schedule();
  }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || this.canvas.clientWidth || 1200);
    const height = Math.max(1, rect.height || this.canvas.clientHeight || 800);
    const mobile = width < 700;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.5, Math.sqrt(1050000 / (width * height)));
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    if (this.gl && !this.contextLost) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = true;
    this.schedule();
  }

  paintMemory() {
    const ctx = this.memoryCtx;
    if (!ctx) return;
    const point = { x: this.state.x * this.memory.width, y: (1 - this.state.y) * this.memory.height };
    if (this.lastPaint && Math.hypot(point.x - this.lastPaint.x, point.y - this.lastPaint.y) < 1) return;
    const old = this.lastPaint || point;
    const warm = Math.floor(50 + this.state.energy * 180);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const layers = [[20, `rgba(0,14,${Math.floor(warm * .35)},.10)`], [8, `rgba(15,40,${warm},.28)`], [2.0, `rgba(210,100,${warm},.85)`]];
    for (const [width, color] of layers) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(old.x, old.y);
      ctx.lineTo(point.x + .01, point.y + .01);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.lastPaint = point;
    this.memoryDirty = true;
  }

  clearMemory() {
    this.memoryCtx.fillStyle = '#000';
    this.memoryCtx.fillRect(0, 0, this.memory.width, this.memory.height);
    this.lastPaint = null;
    this.memoryDirty = true;
    this.dirty = true;
    this.schedule();
  }

  schedule() {
    if (this.disposed || this.contextLost || this.frame || this.xrSession || document.hidden) return;
    this.frame = requestAnimationFrame(now => this.tick(now));
  }

  tick(now) {
    this.frame = 0;
    if (this.disposed || this.contextLost || document.hidden) return;
    // Hidden tab panels retain traces while skipping the expensive raymarch.
    if (!this.canvas.clientWidth || !this.canvas.getClientRects().length) {
      this.lastFrame = 0;
      this.schedule();
      return;
    }
    const elapsed = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 30;
    if (elapsed < 1 / 30) { this.schedule(); return; }
    const dt = Math.min(.1, elapsed);
    this.lastFrame = now;
    if (!this.state.paused) this.time += dt;
    if (!this.state.paused && now - this.lastMemoryTime > 160) {
      this.memoryCtx.globalCompositeOperation = 'source-over';
      this.memoryCtx.fillStyle = 'rgba(0,0,0,.012)';
      this.memoryCtx.fillRect(0, 0, this.memory.width, this.memory.height);
      this.lastMemoryTime = now;
      this.memoryDirty = true;
    }
    if (this.gl) this.drawGL(); else this.draw2D();
    this.dirty = false;
    if (!this.state.paused) this.schedule();
  }

  drawGL(xr = null) {
    const gl = this.gl;
    const u = this.uniforms;
    gl.useProgram(this.program);
    if (!xr) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.uniform2f(u.uResolution, xr?.width || this.canvas.width, xr?.height || this.canvas.height);
    gl.uniform1f(u.uXR, xr ? 1 : 0);
    if (xr) {
      gl.uniformMatrix4fv(u.uInvProjection, false, inverseMatrix(xr.view.projectionMatrix));
      gl.uniformMatrix4fv(u.uViewTransform, false, xr.view.transform.matrix);
    }
    gl.uniform2f(u.uPointer, this.state.x, this.state.y);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uEnergy, this.state.energy);
    gl.uniform1f(u.uCalm, this.state.calm);
    gl.uniform1f(u.uPinch, this.state.pinch);
    gl.uniform1f(u.uMode, { ripple: 0, portal: 1, memory: 2 }[this.state.mode]);
    if (this.memoryDirty) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.memory);
      this.memoryDirty = false;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  async isXRSupported() {
    if (!this.gl || !window.isSecureContext || !navigator.xr || !window.XRWebGLLayer) return false;
    try { return await navigator.xr.isSessionSupported('immersive-vr'); } catch { return false; }
  }

  async enterXR() {
    if (this.disposed || !this.gl) throw new Error('This renderer needs WebGL for headset mode.');
    if (this.xrSession) return this.xrSession;
    if (!window.isSecureContext || !navigator.xr || !window.XRWebGLLayer) throw new Error('Immersive VR requires HTTPS and a compatible WebXR browser and headset.');
    const generation = ++this.xrGeneration;
    const assertCurrent = () => {
      if (this.disposed || generation !== this.xrGeneration) throw new DOMException('The headset request was cancelled.', 'AbortError');
    };
    let session;
    // Call from a user click: browsers require user activation for immersive VR.
    try {
      session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      assertCurrent();
      await this.gl.makeXRCompatible();
      assertCurrent();
      const referenceSpace = await session.requestReferenceSpace('local');
      assertCurrent();
      const layer = new XRWebGLLayer(session, this.gl, { alpha: false, antialias: false, depth: false, framebufferScaleFactor: .7 });
      session.updateRenderState({ baseLayer: layer, depthNear: .1, depthFar: 60 });
      this.xrSession = session;
      this.xrReferenceSpace = referenceSpace;
      this.xrLastFrame = 0;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      const announce = active => {
        this.canvas.dispatchEvent(new CustomEvent('cave-xr-state', { detail: { active } }));
        if (typeof this.onXRChange === 'function') this.onXRChange(active);
      };
      session.addEventListener('end', () => {
        // An older request's eventual end must not clear a newer live session.
        if (this.xrSession !== session) return;
        this.xrSession = null;
        this.xrReferenceSpace = null;
        this.lastFrame = 0;
        announce(false);
        this.resize();
        this.schedule();
      }, { once: true });
      const frame = (now, xrFrame) => {
        if (this.disposed || generation !== this.xrGeneration || this.xrSession !== session) return;
        session.requestAnimationFrame(frame);
        if (this.contextLost) return;
        const pose = xrFrame.getViewerPose(referenceSpace);
        if (!pose) return;
        const dt = this.xrLastFrame ? Math.min(.1, (now - this.xrLastFrame) / 1000) : 0;
        this.xrLastFrame = now;
        if (!this.state.paused) this.time += dt;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, layer.framebuffer);
        for (const view of pose.views) {
          const viewport = layer.getViewport(view);
          this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          this.drawGL({ view, width: viewport.width, height: viewport.height });
        }
      };
      session.requestAnimationFrame(frame);
      announce(true);
      return session;
    } catch (error) {
      // Only end the session owned by this attempt; newer state stays intact.
      if (session) await session.end().catch(() => {});
      throw error;
    }
  }

  async exitXR() {
    // Invalidate permission prompts and setup awaits even before a session exists.
    ++this.xrGeneration;
    const session = this.xrSession;
    if (session) await session.end();
  }

  draw2D() {
    const ctx = this.ctx;
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    const cx = w * (.5 + (this.state.x - .5) * .04);
    const cy = h * .43;
    const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,w*.8);
    bg.addColorStop(0,'#031421'); bg.addColorStop(.5,'#031e33'); bg.addColorStop(1,'#01050d');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    ctx.save(); ctx.translate(cx,cy);
    for (let i = 27; i > 0; i--) {
      const phase = (i + this.time * .17) / 28;
      const rx = w * .80 * phase * phase + 5;
      const ry = h * .82 * phase * phase + 4;
      ctx.beginPath();
      for (let j=0; j<=120; j++) {
        const a = j / 120 * Math.PI * 2;
        const r = 1 + .035*Math.sin(a*11+i*.2)+.018*Math.sin(a*23-i*.3);
        const x = Math.cos(a)*rx*r;
        const y = Math.min(h*.38, Math.sin(a)*ry*r);
        if (j===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.strokeStyle=`rgba(25,175,240,${.12+phase*.35})`;
      ctx.shadowColor='#17bfff';ctx.shadowBlur=7;ctx.lineWidth=Math.max(1,phase*2);ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (this.state.mode === 'portal' && this.state.pinch > .001) {
      const r = h * Math.max(.001, this.state.pinch * .23);
      ctx.globalAlpha = Math.min(1, this.state.pinch / .12);
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);ctx.lineWidth=3;
      ctx.strokeStyle='#8deeff';ctx.shadowColor='#10bdff';ctx.shadowBlur=25;ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,r+5,.5+this.time*.2,2.5+this.time*.2);
      ctx.strokeStyle='#ffc17b';ctx.shadowColor='#ff8a35';ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.state.mode === 'ripple') {
      const x=(this.state.x-.5)*w*.7,y=(.5-this.state.y)*h*.65;
      for(let i=0;i<4;i++){
        const r=((this.time*.12+i*.25)%1)*w*.5;
        ctx.beginPath();ctx.ellipse(x,y,r,r*.38,0,0,Math.PI*2);
        ctx.strokeStyle=`rgba(123,234,255,${(1-r/(w*.5))*.48})`;ctx.lineWidth=2;ctx.stroke();
      }
    }
    ctx.restore();
    if(this.state.mode==='memory') {ctx.globalCompositeOperation='screen';ctx.drawImage(this.memory,0,0,w,h);ctx.globalCompositeOperation='source-over';}
  }

  dispose() {
    this.disposed = true;
    ++this.xrGeneration;
    cancelAnimationFrame(this.frame);
    this.xrSession?.end().catch(() => {});
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.reducedMotion.removeEventListener?.('change', this.boundMotion);
    this.canvas.removeEventListener('webglcontextlost', this.boundLost);
    this.canvas.removeEventListener('webglcontextrestored', this.boundRestored);
    if (this.gl && !this.contextLost) {
      this.gl.deleteTexture(this.texture);
      this.gl.deleteBuffer(this.buffer);
      this.gl.deleteProgram(this.program);
    }
    this.memory.width = 1;
    this.memory.height = 1;
  }
}

export default CaveWorld;
