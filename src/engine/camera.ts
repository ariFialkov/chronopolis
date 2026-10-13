import { PerspectiveCamera, Vector3 } from 'three';
import { clamp, lerp } from '../util/math';
import type { Collider } from '../world/collision';
import { pointInCollider, topAt } from '../world/collision';

/** Third-person orbit camera that follows the player and avoids clipping into buildings. */
export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.32;
  distance = 7.5;
  private targetDistance = 7.5;
  private smoothed = new Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(62, aspect, 0.2, 1400);
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0028, -0.25, 1.2);
  }

  zoom(delta: number): void {
    this.targetDistance = clamp(this.targetDistance + delta * 1.1, 3, 16);
  }

  /** Forward direction on the ground plane (for movement relative to camera). */
  forward(): [number, number] {
    return [-Math.sin(this.yaw), -Math.cos(this.yaw)];
  }

  update(targetX: number, targetY: number, targetZ: number, dt: number, colliders: Collider[], groundAt: (x: number, z: number) => number): void {
    this.distance = lerp(this.distance, this.targetDistance, 1 - Math.exp(-dt * 6));
    const t = new Vector3(targetX, targetY + 1.7, targetZ);
    if (!this.initialised) {
      this.smoothed.copy(t);
      this.initialised = true;
    } else {
      this.smoothed.lerp(t, 1 - Math.exp(-dt * 14));
    }
    const dir = new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // shorten the boom if it would end up inside a building
    let d = this.distance;
    for (let i = 0; i < 10; i++) {
      const px = this.smoothed.x + dir.x * d;
      const pz = this.smoothed.z + dir.z * d;
      let hit = false;
      for (const c of colliders) {
        const cy = this.smoothed.y + dir.y * d;
        const tall = c.top !== undefined ? topAt(c, px, pz) > cy - 0.3 : c.h > cy - groundAt(px, pz);
        if (tall && pointInCollider(c, px, pz, 0.4)) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      d *= 0.82;
    }
    const pos = this.smoothed.clone().addScaledVector(dir, d);
    const g = groundAt(pos.x, pos.z) + 0.6;
    if (pos.y < g) pos.y = g;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.smoothed);
  }

  snapTo(x: number, y: number, z: number): void {
    this.smoothed.set(x, y + 1.7, z);
    this.initialised = true;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
