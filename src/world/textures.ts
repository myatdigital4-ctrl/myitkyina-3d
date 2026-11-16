/**
 * Procedural surface textures (no image downloads). Most are "detail" maps: mostly light
 * grey so they multiply the material / vertex color and only add grain, blades, joints.
 */
import * as THREE from 'three';

function make(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let seed = 12345;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function speckle(g: CanvasRenderingContext2D, s: number, count: number, lo: number, hi: number, size: number) {
  for (let i = 0; i < count; i++) {
    const v = Math.round(lo + rand() * (hi - lo));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rand() * s, rand() * s, size, size);
  }
}

/** Grass: soft patches plus thin blades. One tile ≈ 4 m. */
export function grassDetailTexture(): THREE.CanvasTexture {
  return make(512, (g, s) => {
    g.fillStyle = 'rgb(232,232,232)';
    g.fillRect(0, 0, s, s);
    // soft clumps (darker / lighter)
    for (let i = 0; i < 220; i++) {
      const v = Math.round(200 + rand() * 55);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.beginPath();
      g.arc(rand() * s, rand() * s, 6 + rand() * 26, 0, Math.PI * 2);
      g.fill();
    }
    // blades
    g.lineWidth = 1.2;
    for (let i = 0; i < 9000; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const v = Math.round(170 + rand() * 85);
      g.strokeStyle = `rgba(${v},${v + 8 > 255 ? 255 : v + 8},${v},0.7)`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 3, y - 3 - rand() * 5);
      g.stroke();
    }
  });
}

/** Asphalt: fine aggregate grain and a few darker patches. Multiplies the road color. */
export function asphaltDetailTexture(): THREE.CanvasTexture {
  return make(256, (g, s) => {
    g.fillStyle = 'rgb(225,225,225)';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 9000, 150, 255, 1.4);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(120,120,120,0.12)';
      g.beginPath();
      g.ellipse(rand() * s, rand() * s, 10 + rand() * 30, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Concrete paving: light grain with slab joints at the tile edges. */
export function concreteDetailTexture(): THREE.CanvasTexture {
  return make(256, (g, s) => {
    g.fillStyle = 'rgb(240,240,238)';
    g.fillRect(0, 0, s, s);
    speckle(g, s, 4000, 200, 255, 1.2);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = 'rgba(150,150,140,0.08)';
      g.beginPath();
      g.arc(rand() * s, rand() * s, 10 + rand() * 30, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(110,110,105,0.55)';
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
  });
}

/** Red brick with mortar. One tile = 1 m wide × 0.5 m tall (≈ 4 × 6 courses). */
export function brickTexture(): THREE.CanvasTexture {
  return make(256, (g, s) => {
    g.fillStyle = '#d9cfc0'; // mortar
    g.fillRect(0, 0, s, s);
    const rows = 8;
    const bh = s / rows;
    const bw = s / 4;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 === 0 ? 0 : bw / 2;
      for (let k = -1; k < 5; k++) {
        const x = k * bw + off;
        const hue = 8 + rand() * 10;
        const light = 32 + rand() * 12;
        g.fillStyle = `hsl(${hue}, 55%, ${light}%)`;
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
  });
}

/**
 * Planar world-space UVs (x, z) / tile for flat geometry, so textures keep a constant
 * real-world size across meshes of any shape. Call after the geometry is in world space.
 */
export function planarUV(geo: THREE.BufferGeometry, tile: number, offsetX = 0, offsetZ = 0): void {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + offsetX) / tile;
    uv[i * 2 + 1] = (pos.getZ(i) + offsetZ) / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
