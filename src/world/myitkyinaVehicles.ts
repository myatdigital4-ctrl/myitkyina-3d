/**
 * Vehicles seen on Myitkyina streets in 2026 photos (Google Images, past year):
 * - Red three-wheel motorcycle truck with a green canopy (သုံးဘီး) — also parked at the station
 * - Bicycle trishaw with a sidecar (ဆိုက်ကား)
 * - Green-and-white town bus
 * - Cargo truck with a painted wooden body, people riding on the load
 * - White Toyota Land Cruiser-style SUV
 * plus the game's own Kachin Sky EV (ကချင်မိုးပျံ EV), a flying electric car.
 *
 * Every builder returns a group whose +z is forward, sitting on y = 0.
 */
import * as THREE from 'three';

export interface BuiltVehicle {
  group: THREE.Group;
  /** Meshes that roll about their x axis (or, for the Sky EV, axle groups — see buildSkyEV) */
  wheels: THREE.Object3D[];
}

const mat = (color: string, roughness = 0.6, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.5 });

const TYRE = mat('#16181b', 0.9, 0.05);
const RIM = mat('#c7cdd2', 0.35, 0.7);
const GLASS = mat('#1e2a33', 0.15, 0.5);
const DARK = mat('#22252a', 0.7, 0.3);
const SKIN = mat('#b07a52', 0.8);

function box(m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D, rx = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function wheel(r: number, w: number, x: number, z: number, parent: THREE.Object3D, wheels: THREE.Object3D[]) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), TYRE);
  g.rotation.z = Math.PI / 2;
  g.position.set(x, r, z);
  g.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10), RIM);
  g.add(hub);
  parent.add(g);
  wheels.push(g);
}

/** A seated rider (driver / pedaller) facing +z. */
function rider(parent: THREE.Object3D, x: number, y: number, z: number, shirt: string, helmet = true) {
  const r = new THREE.Group();
  r.position.set(x, y, z);
  box(mat(shirt), 0.42, 0.55, 0.26, 0, 0.42, 0, r);
  box(mat('#2b3a55'), 0.38, 0.18, 0.5, 0, 0.1, 0.12, r); // thighs (longyi)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), SKIN);
  head.position.set(0, 0.86, 0.02);
  r.add(head);
  if (helmet) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8e2d0', 0.4));
    h.position.set(0, 0.88, 0.02);
    r.add(h);
  }
  box(mat(shirt), 0.1, 0.1, 0.42, -0.24, 0.55, 0.22, r); // arms reaching forward
  box(mat(shirt), 0.1, 0.1, 0.42, 0.24, 0.55, 0.22, r);
  parent.add(r);
  return r;
}

/** Red three-wheel motorcycle truck with a green canopy — the town's workhorse. */
export function buildThreeWheeler(body = '#c2342b', canopy = '#3f8d3c', withRider = true): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const red = mat(body, 0.55, 0.2);
  // motorcycle front: fork, tank, seat, handlebar, headlamp
  box(DARK, 0.12, 0.9, 0.12, 0, 0.75, 1.55, group, -0.35);
  box(red, 0.42, 0.32, 0.9, 0, 0.82, 1.05, group); // tank / front body
  box(DARK, 0.36, 0.14, 0.6, 0, 0.98, 0.55, group); // seat
  box(DARK, 0.85, 0.05, 0.05, 0, 1.22, 1.38, group); // handlebar
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#fff6cc', 0.3));
  (lamp.material as THREE.MeshStandardMaterial).emissive.set('#fde68a');
  lamp.position.set(0, 1.05, 1.66);
  group.add(lamp);
  wheel(0.3, 0.12, 0, 1.6, group, wheels);
  // chassis and rear cargo box
  box(DARK, 0.5, 0.12, 2.2, 0, 0.5, -0.2, group);
  box(red, 1.45, 0.08, 1.9, 0, 0.66, -0.95, group); // bed floor
  for (const s of [-1, 1]) box(red, 0.06, 0.5, 1.9, s * 0.72, 0.93, -0.95, group);
  box(red, 1.45, 0.5, 0.06, 0, 0.93, -1.9, group);
  box(mat('#f3e2a5'), 1.46, 0.1, 1.91, 0, 1.0, -0.95, group); // yellow side stripe
  wheel(0.3, 0.18, -0.68, -1.25, group, wheels);
  wheel(0.3, 0.18, 0.68, -1.25, group, wheels);
  // green canopy on four posts
  for (const sx of [-0.68, 0.68]) for (const sz of [-1.85, -0.05]) box(DARK, 0.04, 1.05, 0.04, sx, 1.5, sz, group);
  const roof = box(mat(canopy, 0.85), 1.6, 0.06, 2.15, 0, 2.05, -0.95, group);
  roof.rotation.x = 0.03;
  if (withRider) rider(group, 0, 0.98, 0.45, '#e9e4d6');
  return { group, wheels };
}

/** Bicycle trishaw (ဆိုက်ကား): pedaller on the bike, passenger sidecar on the right. */
export function buildTrishaw(withRider = true): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const frame = mat('#2d5f8a', 0.5, 0.3);
  wheel(0.33, 0.06, 0, 0.75, group, wheels);
  wheel(0.33, 0.06, 0, -0.45, group, wheels);
  box(frame, 0.06, 0.06, 1.25, 0, 0.62, 0.15, group);
  box(frame, 0.06, 0.6, 0.06, 0, 0.75, -0.2, group);
  box(DARK, 0.2, 0.06, 0.28, 0, 1.06, -0.25, group); // saddle
  box(frame, 0.55, 0.04, 0.04, 0, 1.1, 0.68, group); // handlebar
  // sidecar: two seats back to back, small roof
  const side = mat('#7a2b2b', 0.6);
  box(side, 0.8, 0.08, 1.3, 0.75, 0.5, 0.15, group);
  box(side, 0.8, 0.45, 0.06, 0.75, 0.72, 0.15, group);
  box(mat('#d9c9a0'), 0.7, 0.1, 0.5, 0.75, 0.6, 0.45, group);
  box(mat('#d9c9a0'), 0.7, 0.1, 0.5, 0.75, 0.6, -0.15, group);
  wheel(0.28, 0.06, 1.2, 0.15, group, wheels);
  box(mat('#1f4a7a', 0.8), 0.9, 0.04, 1.2, 0.75, 1.45, 0.15, group);
  for (const sz of [-0.4, 0.7]) box(DARK, 0.03, 0.9, 0.03, 1.15, 1.0, sz, group);
  if (withRider) rider(group, 0, 1.0, -0.15, '#d8e2ea', false);
  return { group, wheels };
}

/** Green-and-white town bus. */
export function buildTownBus(): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const green = mat('#2f8a4a', 0.5, 0.2);
  const white = mat('#f1f3ee', 0.5, 0.15);
  box(green, 2.4, 1.4, 9.6, 0, 1.25, 0, group);
  box(white, 2.42, 0.95, 9.62, 0, 2.4, 0, group);
  box(GLASS, 2.44, 0.75, 8.2, 0, 2.35, -0.5, group);
  box(GLASS, 2.1, 1.0, 0.06, 0, 2.3, 4.82, group); // windscreen
  box(white, 2.3, 0.18, 9.4, 0, 2.95, 0, group); // roof
  box(mat('#f4c430', 0.5), 2.44, 0.12, 9.64, 0, 1.75, 0, group); // yellow stripe
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.05), mat('#fff6cc', 0.3));
    hl.position.set(s * 0.85, 0.95, 4.81);
    group.add(hl);
  }
  for (const z of [3.3, -3.0]) for (const x of [-1.05, 1.05]) wheel(0.5, 0.35, x, z, group, wheels);
  return { group, wheels };
}

/** Cargo truck: red cab, painted wooden body, tarp and a few people riding on the load. */
export function buildCargoTruck(cab = '#c8462b'): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const cabM = mat(cab, 0.5, 0.25);
  box(DARK, 1.0, 0.3, 7.0, 0, 0.75, 0, group); // chassis
  box(cabM, 2.3, 1.6, 1.8, 0, 1.75, 2.6, group);
  box(GLASS, 2.0, 0.7, 0.06, 0, 2.15, 3.51, group);
  box(mat('#e6e6e0', 0.5), 2.32, 0.25, 0.2, 0, 1.05, 3.55, group); // bumper
  // wooden body with painted panels
  const wood = mat('#8a5a32', 0.85);
  box(wood, 2.4, 0.12, 4.6, 0, 1.05, -0.9, group);
  for (const s of [-1, 1]) {
    box(wood, 0.08, 1.3, 4.6, s * 1.18, 1.75, -0.9, group);
    box(mat('#2f7fbf', 0.7), 0.09, 0.3, 4.6, s * 1.19, 2.25, -0.9, group); // blue painted rail
    box(mat('#e2b53b', 0.7), 0.09, 0.2, 4.6, s * 1.19, 1.45, -0.9, group); // yellow band
  }
  box(wood, 2.4, 1.3, 0.08, 0, 1.75, -3.2, group);
  // load under a green tarp, with riders on top
  const tarp = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 4.4, 10, 1, false, 0, Math.PI), mat('#4c7a46', 0.9));
  tarp.rotation.z = Math.PI / 2;
  tarp.rotation.y = Math.PI / 2;
  tarp.scale.set(1, 1, 0.55);
  tarp.position.set(0, 2.35, -0.9);
  tarp.castShadow = true;
  group.add(tarp);
  rider(group, -0.5, 2.85, -0.2, '#c94a3a', false);
  rider(group, 0.5, 2.85, -1.6, '#3a6ea8', false);
  for (const z of [2.5, -1.6, -2.6]) for (const x of [-1.0, 1.0]) wheel(0.48, 0.32, x, z, group, wheels);
  return { group, wheels };
}

/** White SUV in the style of the Land Cruisers seen around town. */
export function buildWhiteSUV(color = '#f2f3f1'): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.4, clearcoat: 0.8, envMapIntensity: 0.8 });
  box(paint, 1.95, 0.9, 4.8, 0, 0.95, 0, group);
  box(paint, 1.85, 0.75, 2.9, 0, 1.8, -0.35, group);
  box(GLASS, 1.87, 0.55, 2.7, 0, 1.82, -0.35, group);
  box(GLASS, 1.7, 0.55, 0.06, 0, 1.8, 1.11, group, -0.35);
  box(mat('#b9bec2', 0.4, 0.6), 1.7, 0.3, 0.1, 0, 1.0, 2.41, group); // grille
  box(mat('#2a2d31', 0.6), 1.98, 0.22, 4.82, 0, 0.55, 0, group); // lower trim
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.05), mat('#fff6cc', 0.3));
    hl.position.set(s * 0.7, 1.12, 2.41);
    group.add(hl);
  }
  for (const z of [1.5, -1.5]) for (const x of [-0.92, 0.92]) wheel(0.4, 0.3, x, z, group, wheels);
  return { group, wheels };
}

/** Kachin diamond weave for the Sky EV's side stripe (red, green, black, white). */
function kachinStripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1b1b';
  g.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 16; i++) {
    const x = i * 16;
    g.fillStyle = i % 2 ? '#c8102e' : '#1f7a3a';
    g.beginPath();
    g.moveTo(x + 8, 3);
    g.lineTo(x + 15, 16);
    g.lineTo(x + 8, 29);
    g.lineTo(x + 1, 16);
    g.closePath();
    g.fill();
    g.fillStyle = '#f2c12e';
    g.fillRect(x + 6, 14, 4, 4);
  }
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, 256, 2);
  g.fillRect(0, 30, 256, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

export interface SkyEVParts {
  /** Glow materials of the lift thrusters; opacity follows how airborne the car is */
  glow: THREE.MeshBasicMaterial[];
}

/**
 * Kachin Sky EV (ကချင်မိုးပျံ EV): a sleek fastback electric car (about the size of a Tesla
 * Model 3) in pearl white with a Kachin weave stripe. Its wheels fold flat and spin as lift
 * rotors in flight. `wheels` holds the four axle groups: rotate an axle's z from π/2 (rolling)
 * to 0 (rotor) and spin its first child about y.
 */
export function buildSkyEV(): BuiltVehicle & { parts: SkyEVParts } {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const wheels: THREE.Object3D[] = [];
  const paint = new THREE.MeshPhysicalMaterial({
    color: '#f4f4f2',
    roughness: 0.18,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.1,
  });

  // Side profile (forward z, up y), extruded across the car's width
  const prof = new THREE.Shape();
  const pts: [number, number][] = [
    [2.32, 0.32],
    [2.4, 0.52],
    [2.3, 0.72],
    [1.75, 0.86],
    [1.05, 0.95],
    [0.35, 1.38],
    [-0.35, 1.46],
    [-1.2, 1.3],
    [-1.95, 1.02],
    [-2.32, 0.98],
    [-2.38, 0.6],
    [-2.3, 0.32],
  ];
  prof.moveTo(pts[0][0], pts[0][1]);
  for (const [a, b] of pts.slice(1)) prof.lineTo(a, b);
  prof.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(prof, {
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 4,
    curveSegments: 6,
  });
  bodyGeo.rotateY(-Math.PI / 2); // shape x (forward) → +z, extrusion → -x
  bodyGeo.translate(0.8, 0, 0);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  group.add(body);

  // Panoramic glass roof
  const glassShape = new THREE.Shape();
  const g2: [number, number][] = [
    [1.02, 0.97],
    [0.36, 1.42],
    [-0.35, 1.5],
    [-1.18, 1.34],
    [-1.85, 1.07],
    [-1.6, 1.0],
    [0.9, 0.95],
  ];
  glassShape.moveTo(g2[0][0], g2[0][1]);
  for (const [a, b] of g2.slice(1)) glassShape.lineTo(a, b);
  glassShape.closePath();
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  glassGeo.rotateY(-Math.PI / 2);
  glassGeo.translate(0.81, 0.1, 0);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ color: '#0d1418', roughness: 0.05, metalness: 0.6, clearcoat: 1, envMapIntensity: 1.4 }));
  group.add(glass);

  // Kachin weave stripe along both sides
  const stripeMat = new THREE.MeshStandardMaterial({ map: kachinStripeTexture(), roughness: 0.4, metalness: 0.2 });
  for (const s of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.24), stripeMat);
    plane.rotation.y = s * Math.PI / 2;
    plane.position.set(s * 0.95, 0.62, -0.05);
    group.add(plane);
  }
  // Light bars
  const front = new THREE.MeshStandardMaterial({ color: '#e8fbff', emissive: '#bdf3ff', emissiveIntensity: 1.6 });
  const rear = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff1f1f', emissiveIntensity: 1.4 });
  box(front, 1.5, 0.05, 0.05, 0, 0.74, 2.5, group);
  box(rear, 1.6, 0.06, 0.05, 0, 0.92, -2.5, group);
  box(DARK, 1.82, 0.18, 4.6, 0, 0.26, 0, group); // dark sill / underbody

  // Wheels that fold into lift rotors
  const glow: THREE.MeshBasicMaterial[] = [];
  for (const [x, z] of [
    [-0.9, 1.45],
    [0.9, 1.45],
    [-0.9, -1.45],
    [0.9, -1.45],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const axle = new THREE.Group();
    axle.rotation.z = Math.PI / 2;
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 20), TYRE);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.26, 5), mat('#3a3f45', 0.3, 0.8));
    tyre.add(rim);
    tyre.castShadow = true;
    axle.add(tyre);
    pivot.add(axle);
    // thruster glow ring under each corner
    const gm = new THREE.MeshBasicMaterial({ color: '#5ee7ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), gm);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    pivot.add(ring);
    glow.push(gm);
    group.add(pivot);
    wheels.push(axle);
  }
  return { group, wheels, parts: { glow } };
}
