/*
 * Reference-based study models after the supplied 2021 survey boards.
 * These are newly authored presentation geometries, not the original CAD /
 * Rhino survey model, and do not represent resolved concealed joinery.
 * Y is up; the main entrance faces +Z. Dimensions are relative model units.
 */

function surface(T, rows, columns, point) {
  const positions = [], indices = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    const p = point(c / columns, r / rows);
    positions.push(p[0], p[1], p[2]);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const a = r * (columns + 1) + c, b = a + columns + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function seedNoise(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function woodTexture(T) {
  // A small procedural surface gives the timber a quiet grain and paint wear.
  const w = 64, h = 256, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = seedNoise(x * 11 + Math.floor(y / 3) * 71);
    const grain = Math.sin(x * 1.6 + Math.sin(y * .04) * .85) * .055;
    const f = .8 + n * .22 + grain;
    const i = (y * w + x) * 4;
    data[i] = Math.min(255, 213 * f);
    data[i + 1] = Math.min(255, 196 * f);
    data[i + 2] = Math.min(255, 155 * f);
    data[i + 3] = 255;
  }
  const texture = new T.DataTexture(data, w, h, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function palette(T) {
  const map = woodTexture(T);
  const mat = (color, options = {}) => new T.MeshStandardMaterial({color, roughness: .91, metalness: 0, side: T.DoubleSide, ...options});
  return {
    timber: mat('#77633f', {map}),
    timberLight: mat('#a58b5b', {map}),
    timberDark: mat('#4c4838', {map}),
    paint: mat('#697565', {map}),
    paintLight: mat('#9b9c7b', {map}),
    red: mat('#9c4438', {map}),
    redLight: mat('#b95743', {map}),
    redDark: mat('#673a30', {map}),
    plaster: mat('#b54d3c'),
    plasterDark: mat('#913d32'),
    tile: mat('#727a74'),
    tileRidge: mat('#92988a'),
    tileDark: mat('#414d48'),
    greenTile: mat('#4f6952'),
    greenRidge: mat('#7a8d65'),
    stone: mat('#b2aaa0'),
    stoneLight: mat('#d0c6b6'),
    stoneDark: mat('#7e7b72'),
    recess: mat('#343c32'),
    gold: mat('#b29a60'),
    lattice: mat('#9b8365', {map}),
    paper: mat('#d0c5a9'),
  };
}

// Batch each layer and material into one draw call. A temple has detailed
// rafters / tile rolls without one scene-graph node for every small component.
class Parts {
  constructor(T, materials) { this.T = T; this.materials = materials; this.batches = new Map(); }
  add(geometry, material, part, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const T = this.T, matrix = new T.Matrix4();
    matrix.compose(new T.Vector3(...position), new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const key = material + ':' + part;
    if (!this.batches.has(key)) this.batches.set(key, {material, part, positions: [], normals: [], uv: []});
    const batch = this.batches.get(key);
    const pos = flat.getAttribute('position'), normal = flat.getAttribute('normal'), uv = flat.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      batch.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      batch.normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      batch.uv.push(uv ? uv.getX(i) : pos.getX(i) * .22, uv ? uv.getY(i) : pos.getY(i) * .22);
    }
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }
  box(w, h, d, position, material = 'timber', part = 'frame', rotation) {
    this.add(new this.T.BoxGeometry(w, h, d), material, part, position, rotation);
  }
  column(radius, height, position, material = 'timber', part = 'frame') {
    this.add(new this.T.CylinderGeometry(radius * .92, radius, height, 12), material, part, position);
  }
  beam(a, b, radius, material = 'timber', part = 'frame', sides = 7) {
    const T = this.T, start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
    if (direction.lengthSq() < .00000001) return;
    const geometry = new T.CylinderGeometry(radius, radius, direction.length(), sides);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()));
    this.add(geometry, material, part, start.add(end).multiplyScalar(.5).toArray());
  }
  finish(group) {
    const T = this.T;
    for (const b of this.batches.values()) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(b.positions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(b.normals, 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
      const mesh = new T.Mesh(geometry, this.materials[b.material]);
      mesh.name = b.part + ':' + b.material;
      mesh.userData.part = b.part;
      mesh.userData.category = b.material;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

function makeLayer(T, group, id, label, explode) {
  const layer = new T.Group();
  layer.name = id;
  layer.userData.part = id;
  group.add(layer);
  group.userData.layers.push({id, label, group: layer, explode: new T.Vector3(...explode)});
  return layer;
}

function makeModel(T, name, materials) {
  const group = new T.Group();
  group.name = name;
  group.userData.layers = [];
  group.userData.referenceBased = true;
  group.userData.materials = materials;
  group.userData.front = new T.Vector3(0, 0, 1);
  return group;
}

function bracketArm(T, length, height, depth) {
  // A gong's ends rise gently; its long horizontal bearing surface is not
  // represented by a stack of disconnected decorative cubes.
  const s = new T.Shape(), L = length / 2, H = height;
  s.moveTo(-L, H * .64);
  s.lineTo(-L + length * .1, H * .52);
  s.quadraticCurveTo(-L * .42, H * .06, 0, H * .08);
  s.quadraticCurveTo(L * .42, H * .06, L - length * .1, H * .52);
  s.lineTo(L, H * .64);
  s.lineTo(L - length * .025, H * .1);
  s.quadraticCurveTo(L * .52, -H * .62, L * .25, -H * .65);
  s.lineTo(-L * .25, -H * .65);
  s.quadraticCurveTo(-L * .52, -H * .62, -L + length * .025, H * .1);
  s.closePath();
  const geometry = new T.ExtrudeGeometry(s, {depth, bevelEnabled: false, curveSegments: 5});
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function bracket(P, x, y, z, scale = 1, angle = 0, red = false) {
  const T = P.T, main = red ? 'paint' : 'timberDark', worn = red ? 'paintLight' : 'paint';
  const point = (xx, yy, zz) => [x + (xx * Math.cos(angle) + zz * Math.sin(angle)) * scale, y + yy * scale, z + (-xx * Math.sin(angle) + zz * Math.cos(angle)) * scale];
  const box = (w, h, d, xx, yy, zz, m) => P.box(w * scale, h * scale, d * scale, point(xx, yy, zz), m, 'brackets', [0, angle, 0]);
  const arm = (length, yy, cross, m) => {
    const geo = bracketArm(T, length * scale, .2 * scale, .23 * scale);
    P.add(geo, m, 'brackets', point(0, yy, 0), [0, angle + (cross ? Math.PI / 2 : 0), 0]);
  };
  box(.43, .2, .43, 0, .1, 0, main);
  box(.3, .12, .3, 0, -.055, 0, worn);
  arm(1.06, .28, false, worn);
  for (const side of [-1, 1]) box(.27, .17, .31, side * .37, .43, 0, main);
  arm(1.24, .49, true, main);
  for (const side of [-1, 1]) box(.31, .17, .27, 0, .65, side * .46, worn);
  arm(1.65, .73, false, main);
  for (const side of [-1, 1]) {
    box(.27, .18, .3, side * .63, .91, 0, worn);
    box(.3, .16, .25, side * .35, .86, side * .45, main);
  }
  arm(1.7, 1.01, true, worn);
  arm(1.95, 1.13, false, main);
  for (const side of [-1, 1]) {
    box(.3, .18, .32, side * .72, 1.3, 0, worn);
    box(.32, .18, .3, 0, 1.24, side * .65, main);
  }
  // Inclined projecting bearing members (ang), visible between the tiers.
  for (const side of [-1, 1]) {
    const a = point(0, .2, -.2 * side), b = point(0, .99, .81 * side);
    P.beam(a, b, .09 * scale, main, 'brackets', 4);
  }
}

function edgeCurve(P, points, radius, material = 'tileRidge', part = 'roof') {
  for (let i = 0; i < points.length - 1; i++) P.beam(points[i], points[i + 1], radius, material, part, 6);
}

function roof(P, options) {
  const T = P.T;
  const {w, d, y, rise, ridge, gable = true, green = false, rafters = true} = options;
  const tile = green ? 'greenTile' : 'tile', cap = green ? 'greenRidge' : 'tileRidge';
  const halfW = w / 2, halfD = d / 2, ridgeHalf = ridge / 2;
  const joint = gable ? .48 : 0;
  const endAt = ridgeHalf;
  const mainX = v => gable ? endAt + (halfW - endAt) * Math.pow(Math.max(0, (v - joint) / (1 - joint)), .85) : ridgeHalf + (halfW - ridgeHalf) * v;
  const Y = (v, u) => y + rise * (1 - Math.pow(v, .68)) + .17 * Math.pow(v, 7) + .23 * Math.pow(Math.abs(u), 7) * Math.pow(v, 5);
  const main = (u, v, side) => [(u * 2 - 1) * mainX(v), Y(v, u * 2 - 1), side * halfD * v];
  for (const side of [-1, 1]) {
    P.add(surface(T, 18, 30, (u, v) => main(u, v, side)), tile, 'roof');
    // Raised barrel-tile runs. Each is a smooth narrow ribbon across the roof
    // rather than a separate mesh per tile, keeping the viewer responsive.
    const rolls = Math.round(w / .25);
    for (let k = 0; k <= rolls; k++) {
      const fixedX = (k / rolls * 2 - 1) * halfW;
      const excess = Math.max(0, (Math.abs(fixedX) - endAt) / (halfW - endAt));
      const startV = gable ? excess > 0 ? joint + (1 - joint) * Math.pow(excess, 1 / .85) : 0 : excess;
      if (startV > .995) continue;
      P.add(surface(T, 24, 4, (a, progress) => {
        const v = startV + (1 - startV) * progress;
        const p = [fixedX, Y(v, fixedX / mainX(v)), side * halfD * v], theta = a * Math.PI;
        p[0] += Math.cos(theta) * .047;
        p[1] += .022 + Math.sin(theta) * .047;
        return p;
      }), k % 4 === 0 ? cap : tile, 'roof');
    }
    const edge = [];
    for (let k = 0; k <= 36; k++) edge.push(main(k / 36, 1, side));
    edgeCurve(P, edge, .075, cap);
    edgeCurve(P, edge.map(p => [p[0], p[1] - .17, p[2] - side * .04]), .05, 'timberDark');
    // Disc-like tile ends form a legible fine rhythm at the eave.
    for (let k = 0; k <= rolls; k++) {
      const p = main(k / rolls, 1, side);
      const geo = new T.CylinderGeometry(.065, .065, .075, 7);
      P.add(geo, cap, 'roof', [p[0], p[1] - .025, p[2] + side * .018], [Math.PI / 2, 0, 0]);
    }
    if (rafters) for (let k = 0; k <= Math.round(w / .4); k++) {
      const fixedX = (k / Math.round(w / .4) * 2 - 1) * halfW, pts = [];
      const excess = Math.max(0, (Math.abs(fixedX) - endAt) / (halfW - endAt));
      const startV = gable ? excess > 0 ? joint + (1 - joint) * Math.pow(excess, 1 / .85) : 0 : excess;
      if (startV > .995) continue;
      for (let j = 0; j <= 7; j++) {
        const v = startV + (1 - startV) * j / 7;
        pts.push([fixedX, Y(v, fixedX / mainX(v)) - .14, side * halfD * v]);
      }
      edgeCurve(P, pts, .045, 'timberLight', 'roof');
    }
  }
  // The lower hip roof at each end is distinct from the exposed upper gable.
  // This is the key silhouette of the Wenshu Hall roof on the supplied board.
  for (const side of [-1, 1]) {
    const end = (u, t) => {
      const v = joint + (1 - joint) * t;
      const widthZ = halfD * (gable ? v : t);
      const x = gable ? endAt + (halfW - endAt) * t : ridgeHalf + (halfW - ridgeHalf) * t;
      return [side * x, Y(v, u * 2 - 1), (u * 2 - 1) * widthZ];
    };
    P.add(surface(T, 14, 26, end), tile, 'roof');
    const rolls = Math.round(d / .25);
    for (let k = 0; k <= rolls; k++) {
      const fixedZ = (k / rolls * 2 - 1) * halfD;
      const startT = Math.max(0, (Math.abs(fixedZ) / halfD - joint) / (1 - joint));
      if (startT > .995) continue;
      P.add(surface(T, 20, 4, (a, progress) => {
        const t = startT + (1 - startT) * progress, v = joint + (1 - joint) * t;
        const p = [side * (endAt + (halfW - endAt) * t), Y(v, fixedZ / (halfD * v)), fixedZ], theta = a * Math.PI;
        p[2] += Math.cos(theta) * .045;
        p[1] += .022 + Math.sin(theta) * .045;
        return p;
      }), k % 4 === 0 ? cap : tile, 'roof');
    }
    const eave = [];
    for (let k = 0; k <= 32; k++) eave.push(end(k / 32, 1));
    edgeCurve(P, eave, .075, cap);
    for (const sign of [-1, 1]) {
      const hip = [];
      for (let j = 0; j <= 16; j++) hip.push(end(sign > 0 ? 1 : 0, j / 16));
      edgeCurve(P, hip, .085, cap);
    }
    if (gable) {
      const vTop = joint, zEdge = halfD * vTop, heightEdge = Y(vTop, 0) - .06;
      // Closed triangular gable board, visible above the low hip skirt.
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute([
        side * endAt, y + rise - .08, 0,
        side * endAt, heightEdge, -zEdge,
        side * endAt, heightEdge, zEdge,
      ], 3));
      geometry.computeVertexNormals();
      P.add(geometry, 'timber', 'roof');
      edgeCurve(P, [[side * (endAt + .035), heightEdge, -zEdge], [side * (endAt + .035), y + rise, 0], [side * (endAt + .035), heightEdge, zEdge]], .095, cap);
      P.box(.14, .14, zEdge * 2, [side * endAt, heightEdge, 0], 'timberLight', 'roof');
      P.box(.14, (y + rise - heightEdge) * .85, .15, [side * (endAt + .035), (heightEdge + y + rise) * .5 - .06, 0], 'timberLight', 'roof');
    }
  }
  const ridgeLine = [];
  const ridgeLength = gable ? endAt : ridgeHalf;
  for (let k = 0; k <= 20; k++) {
    const x = (k / 20 * 2 - 1) * ridgeLength;
    ridgeLine.push([x, y + rise + .06 + .09 * Math.pow(Math.abs(x / ridgeLength), 9), 0]);
  }
  edgeCurve(P, ridgeLine, .13, cap);
  // Restrained upturned ridge-end profiles, without invented dragon sculpture.
  for (const s of [-1, 1]) {
    edgeCurve(P, [[s * ridgeLength, y + rise + .12, 0], [s * (ridgeLength + .12), y + rise + .25, 0], [s * (ridgeLength + .1), y + rise + .55, 0], [s * (ridgeLength - .02), y + rise + .53, 0]], .11, cap);
  }
}

function latticePanel(P, x, bottom, z, w, h, options = {}) {
  const {red = false, doors = false, material = red ? 'redLight' : 'lattice', pattern = 0} = options;
  const frame = red ? 'redDark' : 'timberDark', part = 'walls';
  const thickness = .05;
  P.box(w, h, .055, [x, bottom + h / 2, z - .035], 'recess', part);
  for (const s of [-1, 1]) P.box(.095, h + .09, .14, [x + s * w / 2, bottom + h / 2, z + .015], frame, part);
  for (const yy of [bottom, bottom + h, bottom + h * .34, bottom + h * .8]) P.box(w, .09, .14, [x, yy, z + .015], material, part);
  const sillH = h * (doors ? .2 : .32);
  P.box(w - .12, sillH - .09, .085, [x, bottom + sillH / 2, z + .005], material, part);
  const latticeBottom = bottom + h * .36, latticeH = h * .42, latticeW = w - .15;
  const minX = x - latticeW / 2, maxX = x + latticeW / 2, minY = latticeBottom, maxY = latticeBottom + latticeH;
  // Diagonal laths terminate at the frame. The detailed window explorer uses
  // the actual six photographed survey motifs; this is contextual infill.
  const step = pattern ? .19 : .24;
  for (const slope of [-1, 1]) for (let t = -latticeH; t < latticeW + latticeH; t += step) {
    const points = [];
    for (const X of [minX, maxX]) {const Y = minY + slope * (X - minX - t); if (Y >= minY && Y <= maxY) points.push([X, Y, z + .055]);}
    for (const Y of [minY, maxY]) {const X = minX + t + (Y - minY) / slope; if (X >= minX && X <= maxX) points.push([X, Y, z + .055]);}
    if (points.length >= 2) P.beam(points[0], points[1], thickness * .35, material, part, 4);
  }
  for (let j = 0; j < 4; j++) P.box(.025, h * .14, .065, [x - latticeW * .38 + j * latticeW * .25, bottom + h * .9, z + .035], material, part);
}

function stoneCourses(P, w, d, y, height, material = 'stone') {
  P.box(w, height, d, [0, y + height / 2, 0], material, 'base');
  // Thin inset lines read as coursed masonry, not a noisy brick texture.
  const rows = Math.max(2, Math.round(height / .24));
  for (let j = 1; j < rows; j++) {
    const yy = y + j * height / rows;
    P.box(w + .012, .012, d + .012, [0, yy, 0], 'stoneDark', 'base');
  }
}

function railing(P, width, z, y, red = false) {
  const material = red ? 'red' : 'stoneLight';
  for (let j = 0; j <= Math.round(width / .63); j++) {
    const x = -width / 2 + j / Math.round(width / .63) * width;
    P.box(.085, .65, .085, [x, y + .325, z], material, red ? 'frame' : 'base');
    P.box(.14, .11, .14, [x, y + .7, z], material, red ? 'frame' : 'base');
  }
  for (const yy of [y + .18, y + .57]) P.box(width + .1, .085, .095, [0, yy, z], material, red ? 'frame' : 'base');
}

export function createGeyuan(T) {
  const M = palette(T), model = makeModel(T, 'Geyuan Temple · Wenshu Hall', M);
  model.userData.title = '阁院寺 · 文殊殿';
  model.userData.focus = new T.Vector3(0, 3.6, 0);
  const B = new Parts(T, M), W = new Parts(T, M), F = new Parts(T, M), D = new Parts(T, M), R = new Parts(T, M);
  const base = makeLayer(T, model, 'base', '台基', [0, 0, 0]);
  const walls = makeLayer(T, model, 'walls', '墙体与门窗', [0, .15, 0]);
  const frame = makeLayer(T, model, 'frame', '柱梁木构', [0, 1.15, 0]);
  const brackets = makeLayer(T, model, 'brackets', '斗拱', [0, 2.7, 0]);
  const roofLayer = makeLayer(T, model, 'roof', '屋面与椽架', [0, 4.2, 0]);
  stoneCourses(B, 12.5, 12.1, 0, .48);
  B.box(12.7, .13, 12.3, [0, .52, 0], 'stoneLight', 'base');
  for (let j = 0; j < 3; j++) B.box(3.4, .15, 1.15 - j * .32, [0, .075 + j * .15, 6.5 - j * .15], 'stoneLight', 'base');
  // The drawings show a broad, almost square THREE-bay hall. Door leaves are
  // subdivisions within those bays, not additional structural column bays.
  const halfW = 5.45, halfD = 5.2, floor = .59, columnTop = 3.82;
  const xs = [-halfW, -1.92, 1.92, halfW];
  const post = (x, z) => {
    B.column(.28, .12, [x, floor + .06, z], 'stoneLight', 'base');
    F.column(.19, columnTop - floor, [x, (floor + columnTop) / 2, z], 'timber', 'frame');
    F.box(.43, .17, .43, [x, columnTop, z], 'timberDark', 'frame');
  };
  for (const x of xs) for (const z of [-halfD, halfD]) post(x, z);
  for (const x of [-halfW, halfW]) for (const z of [-halfD / 3, halfD / 3]) post(x, z);
  // Two rear inner supports keep the central visitor space open, consistent
  // with the reduced-column arrangement visible in the section study.
  for (const x of [-1.92, 1.92]) post(x, -2.15);
  W.box(.23, 2.85, halfD * 2, [-halfW, floor + 1.425, 0], 'plaster', 'walls');
  W.box(.23, 2.85, halfD * 2, [halfW, floor + 1.425, 0], 'plaster', 'walls');
  W.box(halfW * 2, 2.85, .23, [0, floor + 1.425, -halfD], 'plasterDark', 'walls');
  W.box(halfW * 2, .17, .32, [0, floor + .08, halfD], 'timberDark', 'walls');
  // Five narrow leaves inside each of the three structural bays make the
  // fifteen window / screen subdivisions visible in the reference elevation.
  for (let bay = 0; bay < 3; bay++) {
    const left = xs[bay] + .24, width = xs[bay + 1] - xs[bay] - .48;
    const leafW = width / 5;
    for (let leaf = 0; leaf < 5; leaf++) latticePanel(W, left + leafW * (leaf + .5), floor + .04, halfD + .025, leafW - .035, 2.7, {doors: bay === 1, pattern: leaf % 2});
    F.box(width + .35, .29, .3, [(xs[bay] + xs[bay + 1]) / 2, 3.55, halfD], 'timberLight', 'frame');
  }
  W.box(1.25, 2.6, .11, [0, floor + 1.3, -halfD - .16], 'timberDark', 'walls');
  for (const x of [-halfW, halfW]) F.box(.27, .34, halfD * 2 + .35, [x, 3.7, 0], 'timberDark', 'frame');
  for (const z of [-halfD, halfD]) F.box(halfW * 2 + .38, .34, .29, [0, 3.7, z], 'timberDark', 'frame');
  // Horizontal ties and stepped beam-and-purlin levels, rather than a modern
  // triangular truss. The ends are exposed when the roof is lifted or sliced.
  for (const x of xs) {
    F.box(.3, .36, 9.7, [x, 4.05, 0], 'timber', 'frame');
    for (let j = 0; j < 3; j++) {
      const beamY = 4.63 + j * .65, beamD = 7.5 - j * 2.2;
      F.box(.27, .34, beamD, [x, beamY, 0], 'timberDark', 'frame');
      if (j < 2) for (const z of [-beamD * .35, beamD * .35]) F.box(.26, .48, .26, [x, beamY + .35, z], 'timberLight', 'frame');
      else F.box(.26, 1.06, .26, [x, 6.59, 0], 'timberLight', 'frame');
    }
  }
  for (const z of [-4.3, -2.7, -1.25, 0, 1.25, 2.7, 4.3]) {
    const yy = 7.08 - Math.pow(Math.abs(z) / 7.2, .68) * 2.5;
    F.beam([-5.7, yy, z], [5.7, yy, z], .1, 'timber', 'frame', 10);
  }
  // Main post clusters and intermediate bracket sets form a continuous eave
  // bearing ring; corner sets turn diagonally to support the projecting hip.
  const bracketXs = [xs[0], (xs[0] + xs[1]) / 2, xs[1], 0, xs[2], (xs[2] + xs[3]) / 2, xs[3]];
  for (const z of [-halfD, halfD]) for (const x of bracketXs) {
    bracket(D, x, 3.82, z, .69, z > 0 ? 0 : Math.PI);
  }
  for (const x of [-halfW, halfW]) for (let j = 1; j < 6; j++) bracket(D, x, 3.82, -halfD + j * halfD / 3, .69, Math.PI / 2);
  for (const x of [-halfW, halfW]) for (const z of [-halfD, halfD]) bracket(D, x, 3.86, z, .77, x * z > 0 ? Math.PI / 4 : -Math.PI / 4);
  for (const z of [-5.75, 5.75]) D.box(12.7, .18, .19, [0, 4.79, z], 'paint', 'brackets');
  for (const x of [-5.95, 5.95]) D.box(.19, .18, 12, [x, 4.79, 0], 'paint', 'brackets');
  roof(R, {w: 15.2, d: 14.4, y: 4.84, rise: 2.5, ridge: 11.1, gable: true});
  // A plaque is a small architectural mass; no fake inscription is drawn.
  W.box(2.1, .65, .12, [0, 4.0, 5.39], 'timberDark', 'walls');
  W.box(1.95, .51, .035, [0, 4.0, 5.47], 'redDark', 'walls');
  B.finish(base); W.finish(walls); F.finish(frame); D.finish(brackets); R.finish(roofLayer);
  model.userData.bounds = {width: 15.5, height: 8.05, depth: 14.7};
  return model;
}

export function createDaci(T) {
  const M = palette(T), model = makeModel(T, 'Daci Pavilion', M);
  model.userData.title = '大慈阁';
  model.userData.focus = new T.Vector3(0, 6.1, 0);
  const B = new Parts(T, M), W = new Parts(T, M), F = new Parts(T, M), D = new Parts(T, M), R = new Parts(T, M);
  const base = makeLayer(T, model, 'base', '高台与踏步', [0, 0, 0]);
  const walls = makeLayer(T, model, 'walls', '朱墙与槅扇', [0, .2, 0]);
  const frame = makeLayer(T, model, 'frame', '柱廊与木构', [0, 1.1, 0]);
  const brackets = makeLayer(T, model, 'brackets', '层檐斗拱', [0, 2.3, 0]);
  const roofLayer = makeLayer(T, model, 'roof', '三重屋面', [0, 3.8, 0]);
  stoneCourses(B, 10.7, 9.2, 0, 2.55);
  B.box(11.05, .18, 9.55, [0, 2.58, 0], 'stoneLight', 'base');
  // A broad, straight central stair climbs the high masonry podium.
  const stairCount = 14, stairDepth = .25;
  for (let j = 0; j < stairCount; j++) {
    const h = (j + 1) * 2.58 / stairCount;
    B.box(3.15, h, stairDepth, [0, h / 2, 7.98 - j * stairDepth], 'stoneLight', 'base');
  }
  for (const s of [-1, 1]) {
    B.box(3.55, .16, .18, [s * 3.59, 2.75, 4.65], 'stoneLight', 'base');
    for (let j = 0; j <= 5; j++) {
      const x = s * (1.85 + j * .68);
      B.box(.14, .77, .14, [x, 3.04, 4.65], 'stoneLight', 'base');
      B.box(.22, .14, .22, [x, 3.49, 4.65], 'stoneLight', 'base');
    }
    B.box(3.6, .12, .14, [s * 3.6, 3.4, 4.65], 'stoneLight', 'base');
    edgeCurve(B, [[s * 1.84, .55, 8.08], [s * 1.84, 3.33, 4.58]], .12, 'stoneLight', 'base');
  }
  const levels = [
    {floor: 2.72, columnTop: 5.04, w: 9.35, d: 7.5, roofW: 11.65, roofD: 9.8, roofY: 5.42, rise: .94, enclosed: true},
    {floor: 6.17, columnTop: 8.02, w: 8.15, d: 6.9, roofW: 11.08, roofD: 9.2, roofY: 8.47, rise: .9, enclosed: false},
    {floor: 9.13, columnTop: 10.57, w: 6.55, d: 5.25, roofW: 9.45, roofD: 7.7, roofY: 11.04, rise: 1.67, enclosed: false},
  ];
  for (let level = 0; level < levels.length; level++) {
    const l = levels[level], hw = l.w / 2, hd = l.d / 2;
    F.box(l.w + .3, .19, l.d + .3, [0, l.floor, 0], level ? 'redDark' : 'red', 'frame');
    const xs = [-hw, -hw / 2, 0, hw / 2, hw];
    for (const x of xs) for (const z of [-hd, hd]) {
      F.column(level === 2 ? .115 : .15, l.columnTop - l.floor, [x, (l.columnTop + l.floor) / 2, z], 'red', 'frame');
      F.box(.29, .17, .29, [x, l.floor + .09, z], 'stoneLight', 'frame');
    }
    for (const x of [-hw, hw]) for (const z of [-hd / 3, hd / 3]) F.column(.14, l.columnTop - l.floor, [x, (l.columnTop + l.floor) / 2, z], 'red', 'frame');
    for (const z of [-hd, hd]) {
      F.box(l.w + .28, .27, .28, [0, l.columnTop - .05, z], 'paint', 'frame');
      F.box(l.w + .35, .1, .32, [0, l.columnTop - .2, z], 'gold', 'frame');
    }
    for (const x of [-hw, hw]) F.box(.3, .27, l.d + .3, [x, l.columnTop - .05, 0], 'paint', 'frame');
    // Each upper floor is an open red gallery around an inset enclosure,
    // matching the survey elevation rather than a solid stacked red tower.
    const innerW = l.enclosed ? l.w - .1 : l.w * .7;
    const innerD = l.enclosed ? l.d - .1 : l.d * .65;
    const wallH = l.columnTop - l.floor - .31;
    for (const s of [-1, 1]) W.box(.17, wallH, innerD, [s * innerW / 2, l.floor + wallH / 2, 0], 'plaster', 'walls');
    W.box(innerW, wallH, .17, [0, l.floor + wallH / 2, -innerD / 2], 'redDark', 'walls');
    const panelCount = l.enclosed ? 11 : 9, panelW = (innerW - .4) / panelCount;
    for (let p = 0; p < panelCount; p++) latticePanel(W, -innerW / 2 + .2 + (p + .5) * panelW, l.floor + .05, innerD / 2 + .025, panelW - .025, wallH - .08, {red: true, doors: true, pattern: p % 2});
    if (level > 0) {
      for (const z of [-hd + .1, hd - .1]) railing(F, l.w - .12, z, l.floor + .08, true);
      for (const x of [-hw + .1, hw - .1]) {
        F.box(.085, .09, l.d - .12, [x, l.floor + .67, 0], 'red', 'frame');
        for (let j = 0; j <= 8; j++) F.box(.085, .57, .085, [x, l.floor + .37, -hd + .12 + j / 8 * (l.d - .24)], 'red', 'frame');
      }
    }
    for (const z of [-hd, hd]) for (let j = 0; j <= 8; j++) bracket(D, -hw + j / 8 * l.w, l.columnTop, z, .43, 0, true);
    for (const x of [-hw, hw]) for (let j = 1; j < 6; j++) bracket(D, x, l.columnTop, -hd + j / 6 * l.d, .43, Math.PI / 2, true);
    roof(R, {w: l.roofW, d: l.roofD, y: l.roofY, rise: l.rise, ridge: level === 2 ? 6.3 : 5.2, gable: true, green: true, rafters: true});
    // Dark underside ring supports each projecting eave.
    for (const z of [-hd - .3, hd + .3]) D.box(l.w + .85, .14, .2, [0, l.roofY + .02, z], 'paintLight', 'brackets');
    for (const x of [-hw - .3, hw + .3]) D.box(.2, .14, l.d + .85, [x, l.roofY + .02, 0], 'paintLight', 'brackets');
  }
  B.finish(base); W.finish(walls); F.finish(frame); D.finish(brackets); R.finish(roofLayer);
  model.userData.bounds = {width: 11.9, height: 13.4, depth: 13.2};
  return model;
}

export function createDougong(T) {
  const M = palette(T), model = makeModel(T, 'Geyuan · bracket study', M);
  model.userData.title = '斗拱 · 构件关系';
  model.userData.focus = new T.Vector3(0, 1.65, 0);
  const F = new Parts(T, M), D = new Parts(T, M), R = new Parts(T, M);
  const frame = makeLayer(T, model, 'frame', '柱头', [0, 0, 0]);
  const brackets = makeLayer(T, model, 'brackets', '交叠拱臂与斗', [0, .9, 0]);
  const roofLayer = makeLayer(T, model, 'roof', '承托横材', [0, 1.8, 0]);
  F.column(.32, 1.2, [0, .6, 0], 'timber', 'frame');
  F.box(.63, .2, .63, [0, 1.22, 0], 'timberDark', 'frame');
  bracket(D, 0, 1.34, 0, 1.4, 0, false);
  R.box(3.2, .24, .36, [0, 3.37, 0], 'paint', 'roof');
  R.box(.35, .23, 2.7, [0, 3.6, 0], 'timberDark', 'roof');
  F.finish(frame); D.finish(brackets); R.finish(roofLayer);
  model.userData.bounds = {width: 3.5, height: 3.85, depth: 3.1};
  model.userData.note = 'Layered bearing relationships are shown; concealed mortise-and-tenon geometry is not resolved from the survey-board images.';
  return model;
}
