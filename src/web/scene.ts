// Static geometry per night, built from the same data the sim uses (src/sim/maps.ts). Render only: no rules here.
import * as THREE from "three";
import { NIGHTS } from "../sim/maps";

const std = (color: number, emissive = 0x000000, ei = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.9 });

const GRASS = 0x4d7d4a;
const SAND = 0xc9b48a;
const WOOD = 0x6b4a2f;

function disc(cx: number, cz: number, r: number, h: number, topY: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), std(color));
  m.position.set(cx, topY - h / 2, cz);
  return m;
}

/** Group with everything that is fixed for a night. Dispose by removing it from the scene. */
export function buildNight(night: 1 | 2 | 3): THREE.Group {
  const g = new THREE.Group();
  const def = NIGHTS[night];

  if (night === 1) {
    const base = disc(0, 0, 40, 6, 0, GRASS);
    g.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(40, 0.25, 8, 96), std(SAND));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  } else if (night === 2) {
    for (const cx of [0, 70]) {
      g.add(disc(cx, 0, 28, 6, 0, GRASS));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(28, 0.25, 8, 72), std(SAND));
      rim.rotation.x = Math.PI / 2;
      rim.position.x = cx;
      g.add(rim);
    }
    // bamboo bridge: x 26..44, z -2..2, no railing
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(WOOD));
    bridge.position.set(35, -0.15, 0);
    g.add(bridge);
    for (let x = 27; x < 44; x += 1.5) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 4.05), std(0x8a6a44));
      plank.position.set(x, 0.02, 0);
      g.add(plank);
    }
  } else {
    g.add(disc(0, 0, 45, 6, 0, GRASS));
    // tier 1 (Y 3): half annulus r 12..24 where z > 0; vertical walls
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false); // shape y < 0 maps to z > 0 after the X rotation below
    const hole = new THREE.Path();
    hole.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    shape.holes.push(hole);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), std(0x5f8f55));
    tier1.rotation.x = -Math.PI / 2;
    g.add(tier1);
    g.add(disc(0, 0, 8, 6, 6, 0x6a9a60)); // tier 2 (Y 6)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), std(0x8a7a6a));
    tower.position.y = 4;
    g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 24), std(0x7a3030));
    roof.position.y = 9;
    g.add(roof);
    // two ramps, 3 m wide, r 30 (Y 0) up to r 24 (Y 3)
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const pivot = new THREE.Group();
      pivot.rotation.y = -a; // local +x points along the radius (cos a, sin a)
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), std(WOOD));
      ramp.position.set(27, 1.5 - 0.15, 0);
      ramp.rotation.z = -Math.atan2(3, 6); // rises towards the centre
      pivot.add(ramp);
      g.add(pivot);
    }
  }

  // launch pads
  for (const pad of def.pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius, 0.12, 24), std(0xf2c14e, 0xf2a020, 0.8));
    m.position.set(pad.center[0], pad.center[1] + 0.06, pad.center[2]);
    g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(pad.radius, 0.06, 8, 32), std(0xfff0b0, 0xffd060, 1));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pad.center[0], pad.center[1] + 0.14, pad.center[2]);
    g.add(ring);
  }
  return g;
}

/** The night's background sea plane, centred under the islands. */
export function buildSea(night: 1 | 2 | 3): THREE.Mesh {
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshBasicMaterial({ color: 0x12384a }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(night === 2 ? 35 : 0, -8, 0);
  return sea;
}
