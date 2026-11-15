import * as THREE from "three";

/**
 * The journey's objects, built from primitives so nothing is downloaded: a paper plane and six
 * things from a school day. Every model is about 100 units tall, centred on its origin, with
 * +Y up, in the site's own colours (DESIGN.md §4). One world unit is one CSS pixel.
 */
export const C = {
  gold: 0xffb800,
  goldDeep: 0xdb9a00,
  ink: 0x1a1712,
  cream: 0xfbf7ef,
  paper: 0xf1eadc,
  clay: 0xc4623a,
  green: 0x1f7a5a,
  greenDeep: 0x17624a,
  wood: 0xe6c79c,
  metal: 0xcfc8b8,
  glow: 0xffdf80,
};

const cache = new Map<number, THREE.MeshLambertMaterial>();
export function mat(color: number): THREE.MeshLambertMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
    cache.set(color, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

/** A folded paper dart, nose along +Z, wings in the XZ plane. */
export function paperPlane(): THREE.Group {
  const g = new THREE.Group();
  const N = [0, 0, 40];
  const WL = [-31, 6, -32];
  const CL = [-4, 0, -32];
  const CR = [4, 0, -32];
  const WR = [31, 6, -32];
  const K = [0, -13, -32];
  const tri = (pts: number[][]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    geo.computeVertexNormals();
    return geo;
  };
  g.add(new THREE.Mesh(tri([N, CL, WL, N, WR, CR]), mat(C.gold)));
  g.add(new THREE.Mesh(tri([N, K, CL, N, CR, K]), mat(C.goldDeep)));
  // The centre crease, so the fold reads from above.
  g.add(new THREE.Mesh(tri([N, CR, CL]), mat(C.goldDeep)));
  return g;
}

/** Debate and public speaking. */
export function microphone(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(new THREE.IcosahedronGeometry(23, 1), C.gold, 0, 36));
  const band = mesh(new THREE.TorusGeometry(23.6, 2.4, 6, 22), C.ink, 0, 36);
  band.rotation.x = Math.PI / 2;
  body.add(band);
  body.add(mesh(new THREE.CylinderGeometry(13, 10.5, 11, 12), C.ink, 0, 9));
  body.add(mesh(new THREE.CylinderGeometry(10, 7, 60, 12), C.clay, 0, -26));
  body.add(mesh(new THREE.CylinderGeometry(7.6, 7.6, 5, 12), C.ink, 0, -58));
  body.rotation.z = -0.5;
  body.rotation.x = 0.25;
  g.add(body);
  return g;
}

function book(color: number, w: number, h: number, d: number) {
  const b = new THREE.Group();
  b.add(mesh(new THREE.BoxGeometry(w - 5, h - 4, d - 4), C.cream, 2, 0, 1));
  b.add(mesh(new THREE.BoxGeometry(w, 2.4, d), color, 0, h / 2 - 1.2));
  b.add(mesh(new THREE.BoxGeometry(w, 2.4, d), color, 0, -h / 2 + 1.2));
  b.add(mesh(new THREE.BoxGeometry(3, h, d), color, -w / 2 + 1.5));
  return b;
}

/** Reading and study. */
export function books(): THREE.Group {
  const g = new THREE.Group();
  const stack = new THREE.Group();
  const a = book(C.green, 88, 17, 62);
  a.position.y = -19;
  const b = book(C.clay, 78, 15, 56);
  b.position.y = -3;
  b.rotation.y = 0.28;
  const c = book(C.gold, 66, 13, 48);
  c.position.y = 11;
  c.rotation.y = -0.22;
  stack.add(a, b, c);
  stack.rotation.x = 0.5;
  stack.rotation.z = -0.08;
  g.add(stack);
  return g;
}

/** The wider world a student argues about. */
export function globe(): THREE.Group {
  const g = new THREE.Group();
  const tilt = new THREE.Group();
  const ball = new THREE.Group();
  ball.name = "spin";
  ball.add(mesh(new THREE.IcosahedronGeometry(30, 2), C.green));
  // Land: flattened blobs lying on the surface.
  const land: [number, number, number, number][] = [
    [0.4, 0.5, 15, 10],
    [1.9, 0.2, 12, 14],
    [3.3, -0.3, 16, 9],
    [4.6, 0.6, 10, 8],
    [5.4, -0.6, 9, 11],
    [2.6, -0.9, 8, 6],
  ];
  for (const [lon, lat, w, h] of land) {
    const blob = mesh(new THREE.IcosahedronGeometry(1, 1), C.gold);
    blob.scale.set(w, h, 2.2);
    blob.position.setFromSphericalCoords(29.4, Math.PI / 2 - lat, lon);
    blob.lookAt(0, 0, 0);
    ball.add(blob);
  }
  tilt.add(ball);
  const ring = mesh(new THREE.TorusGeometry(35, 2, 6, 28, Math.PI * 1.15), C.ink);
  ring.rotation.z = -Math.PI * 0.62;
  tilt.add(ring);
  tilt.rotation.z = 0.38;
  tilt.position.y = 10;
  g.add(tilt);
  g.add(mesh(new THREE.CylinderGeometry(3, 3, 12, 8), C.ink, 0, -32));
  g.add(mesh(new THREE.CylinderGeometry(19, 23, 6, 20), C.ink, 0, -41));
  return g;
}

/** Writing: the essay track and every sign-up form. */
export function pencil(): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Group();
  p.add(mesh(new THREE.CylinderGeometry(9, 9, 68, 6), C.gold, 0, 2));
  p.add(mesh(new THREE.CylinderGeometry(9.4, 9.4, 8, 12), C.metal, 0, 40));
  p.add(mesh(new THREE.CylinderGeometry(8.8, 8.8, 12, 12), C.clay, 0, 50));
  const wood = mesh(new THREE.ConeGeometry(9, 18, 6), C.wood, 0, -41);
  wood.rotation.x = Math.PI;
  p.add(wood);
  const lead = mesh(new THREE.ConeGeometry(3.3, 7, 6), C.ink, 0, -47.5);
  lead.rotation.x = Math.PI;
  p.add(lead);
  p.rotation.z = 0.62;
  p.rotation.x = 0.2;
  g.add(p);
  return g;
}

/** The debate competition. */
export function trophy(): THREE.Group {
  const g = new THREE.Group();
  const t = new THREE.Group();
  const profile = [
    [0, -6],
    [6, -6],
    [8, 2],
    [17, 12],
    [24, 27],
    [27, 45],
    [24.5, 46],
    [22, 28],
    [14, 13],
    [0, 6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  t.add(mesh(new THREE.LatheGeometry(profile, 18), C.gold));
  for (const s of [-1, 1]) {
    const h = mesh(new THREE.TorusGeometry(10, 2.3, 6, 12, Math.PI), C.gold, s * 25, 28);
    h.rotation.z = (-s * Math.PI) / 2;
    t.add(h);
  }
  t.add(mesh(new THREE.CylinderGeometry(4, 6.5, 13, 10), C.gold, 0, -12));
  t.add(mesh(new THREE.CylinderGeometry(15, 18, 6, 16), C.clay, 0, -21));
  t.add(mesh(new THREE.BoxGeometry(44, 11, 44), C.ink, 0, -29.5));
  t.position.y = -8;
  t.rotation.x = 0.28;
  g.add(t);
  return g;
}

/** The end of the journey. */
export function gradCap(): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(92, 4, 92), C.green, 0, 10);
  board.rotation.y = Math.PI / 4;
  c.add(board);
  c.add(mesh(new THREE.CylinderGeometry(30, 33, 22, 16), C.greenDeep, 0, -3));
  c.add(mesh(new THREE.SphereGeometry(4.2, 10, 8), C.gold, 0, 13.5));
  const cord = mesh(new THREE.CylinderGeometry(1.3, 1.3, 50, 6), C.gold, 25, 13);
  cord.rotation.z = Math.PI / 2;
  c.add(cord);
  c.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 24, 6), C.gold, 50, 1));
  c.add(mesh(new THREE.ConeGeometry(4.6, 14, 8), C.gold, 50, -17));
  c.rotation.x = 0.5;
  c.rotation.z = -0.14;
  g.add(c);
  return g;
}

/** An idea. */
export function lightBulb(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Group();
  b.add(mesh(new THREE.IcosahedronGeometry(27, 2), C.glow, 0, 18));
  b.add(mesh(new THREE.CylinderGeometry(15, 11.5, 14, 14), C.glow, 0, -9));
  b.add(mesh(new THREE.CylinderGeometry(11.5, 10, 16, 12), C.metal, 0, -23));
  for (const y of [-19, -25]) {
    const ridge = mesh(new THREE.TorusGeometry(11.4, 1.3, 5, 16), C.ink, 0, y);
    ridge.rotation.x = Math.PI / 2;
    b.add(ridge);
  }
  b.add(mesh(new THREE.CylinderGeometry(5, 3, 6, 8), C.ink, 0, -34));
  // The filament, seen through the glass as a small gold loop.
  const filament = mesh(new THREE.TorusGeometry(8, 1.4, 5, 14), C.gold, 0, 16, 26);
  b.add(filament);
  b.rotation.z = 0.32;
  b.rotation.x = 0.15;
  g.add(b);
  return g;
}

export const MILESTONES = [microphone, books, globe, pencil, trophy, lightBulb] as const;

/** A soft round shadow that lies on the page under a floating object. */
export function softShadow(): THREE.Mesh {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(26,23,18,0.55)");
  grad.addColorStop(0.55, "rgba(26,23,18,0.18)");
  grad.addColorStop(1, "rgba(26,23,18,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.3 }),
  );
  m.renderOrder = -1;
  return m;
}
