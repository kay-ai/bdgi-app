import * as THREE from "three";
import { C, MILESTONES, gradCap, mat, paperPlane, softShadow } from "./models";

/**
 * The journey: a paper plane takes off in the hero and flies down the page as the visitor
 * scrolls. Between sections float objects from a school day; the plane circles each one, which
 * spins and throws off sparks, and it ends at a graduation cap.
 *
 * World space is the page itself: one unit is one CSS pixel, x runs right, y runs up from the
 * top of the document (so page-y 900 is world-y -900), z comes toward the viewer. The camera
 * moves down with the scroll, so objects stay pinned to the page while the canvas stays fixed.
 */

type Milestone = {
  group: THREE.Group;
  shadow: THREE.Mesh;
  x: number;
  y: number; // page coordinates
  size: number;
  spinner: THREE.Object3D;
  spin: number;
  kick: number;
  near: boolean;
  isEnd: boolean;
  phase: number;
};

const FOV = 30;
const INTRO_KEYS = 700;
const TRAIL = 44;
const SPARKS = 90;

export function createJourney(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbb94, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-0.5, 0.9, 1.2);
  scene.add(sun);

  let W = 1;
  let H = 1;
  let dist = 1;
  let mobile = false;

  /* ---------- The plane ---------- */
  const plane = paperPlane();
  plane.up.set(0, 0.22, 1).normalize();
  scene.add(plane);
  const planeShadow = softShadow();
  scene.add(planeShadow);

  /* ---------- Trail: dashes that fade behind the plane ---------- */
  const trail = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.6, 11), new THREE.MeshBasicMaterial({ color: C.gold }), TRAIL);
  trail.frustumCulled = false;
  scene.add(trail);
  const dashes = Array.from({ length: TRAIL }, () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), born: -1e9 }));
  let dashIndex = 0;
  const lastDash = new THREE.Vector3(1e9, 0, 0);

  /* ---------- Sparks ---------- */
  const sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(3.4, 0), mat(C.gold), SPARKS);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkState = Array.from({ length: SPARKS }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), born: -1e9, life: 1, rot: 0 }));
  let sparkIndex = 0;
  function burst(x: number, y: number, z: number, count: number, power: number, now: number) {
    for (let i = 0; i < count; i++) {
      const s = sparkState[sparkIndex++ % SPARKS]!;
      const a = Math.random() * Math.PI * 2;
      const p = power * (0.45 + Math.random() * 0.75);
      s.pos.set(x, y, z);
      s.vel.set(Math.cos(a) * p, Math.sin(a) * p + power * 0.35, (Math.random() - 0.2) * p * 0.6);
      s.born = now;
      s.life = 0.9 + Math.random() * 0.7;
      s.rot = Math.random() * 6;
    }
  }

  /* ---------- Path ---------- */
  let milestones: Milestone[] = [];
  let curve: THREE.CatmullRomCurve3 | null = null;
  let keys: number[] = [];
  let endArmed = true;

  function clearMilestones() {
    for (const m of milestones) {
      scene.remove(m.group, m.shadow);
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      (m.shadow.material as THREE.Material).dispose();
      m.shadow.geometry.dispose();
    }
    milestones = [];
  }

  /** Reads the page and lays the journey over it. Called on load, resize and route change. */
  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    mobile = W < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    dist = H / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.far = dist + 2000;
    camera.updateProjectionMatrix();

    clearMilestones();
    const main = document.getElementById("main");
    if (!main) return;
    const sy = window.scrollY;
    const mainRect = main.getBoundingClientRect();
    const top0 = mainRect.top + sy;
    const bottom = mainRect.bottom + sy;
    const sections = [...main.querySelectorAll<HTMLElement>(":scope > section")].filter((s) => s.offsetHeight > 0);
    const wrap = main.querySelector<HTMLElement>(".wrap");
    const gutter = wrap ? Math.max(16, wrap.getBoundingClientRect().left) : 24;

    const size = mobile ? 66 : 108;
    const lane = Math.max(gutter * 0.5, 22);
    const sideX = (side: number, s: number) => (side > 0 ? W - gutter - s * (mobile ? 0.6 : 0.95) : gutter + s * (mobile ? 0.6 : 0.95));

    // Milestones sit on the line between two sections, where the padding leaves room.
    const spots: { x: number; y: number; side: number; size: number; isEnd: boolean }[] = [];
    let side = 1;
    for (let i = 0; i < sections.length - 1; i++) {
      const r = sections[i]!.getBoundingClientRect();
      spots.push({ x: sideX(side, size), y: r.bottom + sy, side, size, isEnd: false });
      side = -side;
    }
    // The cap: in the open half of a closing section when there is one, else at the foot of the page.
    const last = sections[sections.length - 1];
    if (last?.hasAttribute("data-journey-end") && !mobile) {
      const r = last.getBoundingClientRect();
      const big = Math.min(190, W * 0.16);
      spots.push({ x: W - gutter - big * 0.9, y: r.top + sy + r.height * 0.5, side: 1, size: big, isEnd: true });
    } else {
      spots.push({ x: sideX(side, size), y: bottom - (mobile ? 6 : 0), side, size, isEnd: true });
    }

    let n = 0;
    for (const s of spots) {
      const group = s.isEnd ? gradCap() : MILESTONES[n++ % MILESTONES.length]!();
      const scale = s.size / 100;
      group.scale.setScalar(scale);
      group.position.set(s.x, -s.y, 46);
      const shadow = softShadow();
      shadow.scale.set(s.size * 1.05, s.size * 0.5, 1);
      shadow.position.set(s.x + s.size * 0.1, -s.y - s.size * 0.62, 1);
      scene.add(group, shadow);
      milestones.push({
        group,
        shadow,
        x: s.x,
        y: s.y,
        size: s.size,
        spinner: group.getObjectByName("spin") ?? group.children[0]!,
        spin: 0,
        kick: 0,
        near: false,
        isEnd: s.isEnd,
        phase: Math.random() * 6,
      });
    }

    // Waypoints in page coordinates, each with the scroll position at which the plane reaches it.
    const pts: THREE.Vector3[] = [];
    keys = [];
    const add = (x: number, y: number, z: number, key: number) => {
      const prev = keys.length ? keys[keys.length - 1]! : -Infinity;
      pts.push(new THREE.Vector3(x, -y, z));
      keys.push(Math.max(key, prev + 26));
    };
    const center = (y: number) => y - H * 0.46;

    // Take-off: in from the left edge, across the hero.
    const startY = top0 + Math.min(H * 0.3, 260);
    add(-140, top0 + H * 0.78, 260, -INTRO_KEYS);
    add(W * 0.3, top0 + H * 0.52, 230, -INTRO_KEYS * 0.5);
    add(W * (mobile ? 0.7 : 0.74), startY, 150, 0);

    let from = 1; // which side the plane is on
    spots.forEach((s, i) => {
      const r = s.size * (s.isEnd ? 0.72 : 0.78);
      const base = center(s.y);
      if (s.side !== from) {
        // Cross the page above the object, close to the viewer.
        add(W * 0.5, s.y - r - (mobile ? 90 : 150), 190, base - 330);
        from = s.side;
      }
      // One and a half turns around it: outside, under, inside (behind), over, outside, under.
      for (let j = 0; j < 7; j++) {
        const phi = (-45 + j * 82) * (Math.PI / 180);
        add(s.x + s.side * r * Math.cos(phi), s.y + r * Math.sin(phi), 46 + 78 * Math.cos(phi), base + (j - 3) * 46);
      }
      const next = spots[i + 1];
      if (next) {
        // Leave along the boundary, then drift down the gutter on the next object's side.
        const laneX = next.side > 0 ? W - lane : lane;
        if (next.side !== s.side) add(W * 0.5, s.y + 6, 150, base + 250);
        const span = next.y - s.y;
        add(laneX + next.side * -14, s.y + Math.min(span * 0.35, r + 170), 110, center(s.y + span * 0.35));
        add(laneX, s.y + span * 0.62, 90, center(s.y + span * 0.62));
        from = next.side;
      } else {
        // Land beside the cap.
        add(s.x - s.side * r * 1.5, s.y - r * 0.15, 120, base + 230);
      }
    });

    // The last waypoint must be reachable at the bottom of the scroll.
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
    const lastKey = keys[keys.length - 1]!;
    if (lastKey > maxScroll) keys = keys.map((k) => (k > 0 ? (k * maxScroll) / lastKey : k));

    curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    plane.scale.setScalar(mobile ? 0.75 : 1.5);
  }

  /** Scroll key to a parameter on the curve. */
  function paramAt(key: number) {
    const n = keys.length;
    if (n < 2) return 0;
    if (key <= keys[0]!) return 0;
    if (key >= keys[n - 1]!) return 1;
    let i = 1;
    while (keys[i]! < key) i++;
    const f = (key - keys[i - 1]!) / (keys[i]! - keys[i - 1]!);
    return (i - 1 + f) / (n - 1);
  }

  /* ---------- Frame loop ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / W) * 2 - 1;
    pointer.y = (e.clientY / H) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let raf = 0;
  let prev = performance.now();
  let introStart = prev;
  let key = -INTRO_KEYS;
  let bank = 0;
  const dummy = new THREE.Object3D();
  dummy.up.set(0, 0, 1);
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  function frame(nowMs: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !curve) return;
    const dt = Math.min(0.05, (nowMs - prev) / 1000);
    prev = nowMs;
    const now = nowMs / 1000;
    const sy = window.scrollY;

    camera.position.set(W / 2, -(sy + H / 2), dist);

    // Where the plane should be: the scroll, held back during the take-off.
    const intro = Math.min(1, (nowMs - introStart) / 1700);
    const eased = 1 - Math.pow(1 - intro, 3);
    const target = sy - INTRO_KEYS * (1 - eased);
    key += (target - key) * (1 - Math.exp(-dt * 4.2));
    const moving = Math.abs(target - key);

    const u = paramAt(key);
    curve.getPoint(u, p0);
    curve.getPoint(Math.min(1, u + 0.004), p1);
    curve.getPoint(Math.min(1, u + 0.012), p2);

    // Heading, with a bank into each turn and a slow hover when the page is still.
    const hover = Math.sin(now * 1.7) * 4;
    plane.position.set(p0.x, p0.y + hover, p0.z);
    if (p1.distanceToSquared(p0) > 0.01) plane.lookAt(p1.x, p1.y + hover, p1.z);
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let turn = a2 - a1;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    const wantBank = THREE.MathUtils.clamp(turn * 5, -0.6, 0.6) + Math.sin(now * 1.3) * 0.08;
    bank += (wantBank - bank) * (1 - Math.exp(-dt * 5));
    plane.rotateZ(-bank);

    // Its shadow lies on the page, further away and fainter the higher it flies.
    const lift = Math.max(0, p0.z);
    const ps = (mobile ? 62 : 104) * (1 + lift / 400);
    planeShadow.position.set(p0.x + lift * 0.16, p0.y - 14 - lift * 0.3, 0.5);
    planeShadow.scale.set(ps, ps * 0.62, 1);
    (planeShadow.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.34 - lift / 900, 0.1, 0.34);

    // Trail.
    if (moving > 3 && p0.distanceTo(lastDash) > 17) {
      const d = dashes[dashIndex++ % TRAIL]!;
      dummy.position.copy(p0);
      dummy.lookAt(p1);
      d.pos.copy(p0);
      d.quat.copy(dummy.quaternion);
      d.born = now + 0.12; // appears just behind the tail
      lastDash.copy(p0);
    }
    for (let i = 0; i < TRAIL; i++) {
      const d = dashes[i]!;
      const age = now - d.born;
      if (age < 0 || age > 1.9) {
        trail.setMatrixAt(i, zero);
        continue;
      }
      const s = 1 - age / 1.9;
      dummy.position.copy(d.pos);
      dummy.quaternion.copy(d.quat);
      dummy.scale.set(s, s, 0.55 + 0.45 * s);
      dummy.updateMatrix();
      trail.setMatrixAt(i, dummy.matrix);
    }
    trail.instanceMatrix.needsUpdate = true;
    dummy.scale.set(1, 1, 1);

    // Milestones: float, turn toward the pointer, and react when the plane arrives.
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    for (const m of milestones) {
      const onScreen = m.y > sy - 300 && m.y < sy + H + 300;
      m.group.visible = m.shadow.visible = onScreen;
      if (!onScreen) continue;
      const dx = p0.x - m.x;
      const dy = -p0.y - m.y;
      const near = dx * dx + dy * dy < (m.size * 1.25) ** 2;
      if (near && !m.near && intro === 1) {
        m.spin = m.isEnd ? 16 : 11;
        m.kick = 1;
        if (m.isEnd) {
          if (endArmed) burst(m.x, -m.y, 60, 46, 300, now);
          endArmed = false;
        } else burst(m.x, -m.y, 60, 12, 190, now);
      }
      if (!near && m.isEnd && Math.abs(dy) > m.size * 3) endArmed = true;
      m.near = near;

      m.spin *= Math.exp(-dt * 2.4);
      m.kick *= Math.exp(-dt * 3.2);
      m.spinner.rotation.y += dt * (0.45 + m.spin);
      const bob = Math.sin(now * 1.15 + m.phase) * 5;
      const toss = m.isEnd ? m.kick * m.size * 0.5 : 0;
      m.group.position.y = -m.y + bob + toss;
      m.group.rotation.x = pointer.sy * 0.22;
      m.group.rotation.y = pointer.sx * 0.3;
      m.group.rotation.z = Math.sin(now * 0.8 + m.phase) * 0.05;
      m.group.scale.setScalar((m.size / 100) * (1 + m.kick * 0.16));
      const sh = 1 - (bob + toss) / 120;
      m.shadow.scale.set(m.size * 1.05 * sh, m.size * 0.5 * sh, 1);
    }

    // Sparks.
    for (let i = 0; i < SPARKS; i++) {
      const s = sparkState[i]!;
      const age = now - s.born;
      if (age < 0 || age > s.life) {
        sparks.setMatrixAt(i, zero);
        continue;
      }
      s.vel.y -= 420 * dt;
      s.vel.multiplyScalar(Math.exp(-dt * 1.6));
      s.pos.addScaledVector(s.vel, dt);
      const k = 1 - age / s.life;
      dummy.position.copy(s.pos);
      dummy.rotation.set(s.rot + age * 5, s.rot + age * 3, 0);
      dummy.scale.setScalar((mobile ? 0.8 : 1.25) * k);
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);

    renderer.render(scene, camera);
  }

  layout();
  raf = requestAnimationFrame(frame);

  return {
    layout,
    /** Replays the take-off, for a new page. */
    restart() {
      introStart = performance.now();
      key = window.scrollY - INTRO_KEYS;
      endArmed = true;
      lastDash.set(1e9, 0, 0);
      for (const d of dashes) d.born = -1e9;
      layout();
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      clearMilestones();
      trail.geometry.dispose();
      (trail.material as THREE.Material).dispose();
      sparks.geometry.dispose();
      plane.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.dispose();
    },
  };
}

export type JourneyApi = ReturnType<typeof createJourney>;
