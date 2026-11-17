/**
 * Street life details that make the town feel lived-in (as in Myitkyina street photos and the
 * reference style): concrete power poles with sagging wires along the main paved streets, and
 * small flocks of birds wheeling over the player.
 */
import * as THREE from 'three';
import { OSM_ROAD_SEGMENTS } from './mapData.generated';
import { groundHeightAt } from './terrain';

const POLE_SPACING = 42;
const POLE_H = 8.5;

export function createPowerLines(): THREE.Group {
  const root = new THREE.Group();
  const poles: { x: number; y: number; z: number; heading: number }[] = [];
  const wirePos: number[] = [];

  for (const s of OSM_ROAD_SEGMENTS) {
    if (s.surface !== 'asphalt') continue;
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const len = Math.hypot(dx, dz);
    if (len < 30) continue;
    const ux = dx / len;
    const uz = dz / len;
    // right-hand side of the street, just past the sidewalk
    const off = s.width / 2 + 2.6;
    const nx = uz;
    const nz = -ux;
    const n = Math.max(1, Math.floor(len / POLE_SPACING));
    const segPoles: { x: number; y: number; z: number }[] = [];
    for (let k = 0; k <= n; k++) {
      const t = (k * len) / n;
      const x = s.x1 + ux * t + nx * off;
      const z = s.z1 + uz * t + nz * off;
      if (poles.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.z - z) < 6)) continue;
      const y = groundHeightAt(x, z);
      poles.push({ x, y, z, heading: Math.atan2(ux, uz) });
      segPoles.push({ x, y, z });
    }
    // three wires between neighbouring poles, sagging in the middle
    for (let k = 0; k < segPoles.length - 1; k++) {
      const a = segPoles[k];
      const b = segPoles[k + 1];
      for (const w of [-0.75, 0, 0.75]) {
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps;
          const t1 = (i + 1) / steps;
          const sag = (t: number) => Math.sin(t * Math.PI) * 0.7;
          const p = (t: number) => [
            a.x + (b.x - a.x) * t + nx * w,
            a.y + (b.y - a.y) * t + POLE_H - 0.3 - sag(t),
            a.z + (b.z - a.z) * t + nz * w,
          ];
          wirePos.push(...p(t0), ...p(t1));
        }
      }
    }
  }

  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, POLE_H, 7);
  poleGeo.translate(0, POLE_H / 2, 0);
  const armGeo = new THREE.BoxGeometry(1.9, 0.12, 0.12);
  armGeo.translate(0, POLE_H - 0.35, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#a9a8a2', roughness: 0.85, envMapIntensity: 0.3 }), poles.length);
  const armMesh = new THREE.InstancedMesh(armGeo, new THREE.MeshStandardMaterial({ color: '#5b5f63', roughness: 0.7, envMapIntensity: 0.3 }), poles.length);
  const d = new THREE.Object3D();
  poles.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z);
    d.rotation.set(0, p.heading + Math.PI / 2, 0);
    d.updateMatrix();
    poleMesh.setMatrixAt(i, d.matrix);
    armMesh.setMatrixAt(i, d.matrix);
  });
  poleMesh.castShadow = true;
  root.add(poleMesh, armMesh);

  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
  root.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: '#2b2f33', transparent: true, opacity: 0.75 })));
  return root;
}

/** A few flocks of small dark birds circling above the player. */
export function createBirds() {
  const root = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  // two triangles: left and right wing, body at the origin, pointing +z
  wing.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0, -0.1, 0, 0, -0.25, 0, 0, 0.25, 0, 0, -0.25, 0.9, 0, -0.1], 3),
  );
  wing.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#2b2622', side: THREE.DoubleSide });
  const flocks: { center: THREE.Vector3; radius: number; speed: number; birds: { mesh: THREE.Mesh; phase: number; off: THREE.Vector3 }[] }[] = [];
  for (let f = 0; f < 3; f++) {
    const flock = { center: new THREE.Vector3(), radius: 40 + f * 25, speed: 0.12 + f * 0.04, birds: [] as { mesh: THREE.Mesh; phase: number; off: THREE.Vector3 }[] };
    for (let b = 0; b < 6; b++) {
      const mesh = new THREE.Mesh(wing, mat);
      mesh.scale.setScalar(0.6 + Math.random() * 0.3);
      root.add(mesh);
      flock.birds.push({ mesh, phase: Math.random() * 6, off: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8) });
    }
    flocks.push(flock);
  }
  const update = (elapsed: number, px: number, py: number, pz: number) => {
    flocks.forEach((fl, fi) => {
      const a = elapsed * fl.speed + fi * 2.1;
      const cx = px + Math.cos(a) * fl.radius;
      const cz = pz + Math.sin(a) * fl.radius;
      const cy = py + 30 + fi * 8;
      const heading = Math.atan2(-Math.sin(a), Math.cos(a));
      for (const b of fl.birds) {
        b.mesh.position.set(cx + b.off.x, cy + b.off.y + Math.sin(elapsed * 1.3 + b.phase) * 0.6, cz + b.off.z);
        b.mesh.rotation.set(0, heading, 0);
        b.mesh.scale.x = 0.35 + Math.abs(Math.sin(elapsed * 9 + b.phase)) * 0.85; // flapping
      }
    });
  };
  return { group: root, update };
}
