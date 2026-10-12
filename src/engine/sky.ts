import { BackSide, BufferAttribute, Color, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { Era } from '../eras/types';

/** Gradient sky dome that follows the camera: zenith colour to horizon colour, darker below. */
export class SkyDome {
  readonly mesh: Mesh;
  private geo: SphereGeometry;

  constructor() {
    this.geo = new SphereGeometry(1000, 24, 12);
    const n = this.geo.attributes.position.count;
    this.geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
    this.mesh = new Mesh(this.geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  setEra(era: Era): void {
    const pos = this.geo.attributes.position;
    const col = this.geo.attributes.color as BufferAttribute;
    const zenith = new Color(era.sky);
    const horizon = new Color(era.horizon);
    const below = new Color(era.fog).multiplyScalar(0.9);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1000; // -1..1
      if (y >= 0) c.copy(horizon).lerp(zenith, Math.pow(y, 0.55));
      else c.copy(horizon).lerp(below, Math.min(1, -y * 4));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  follow(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y - 40, z);
  }
}
