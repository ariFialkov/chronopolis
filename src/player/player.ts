import type { Scene } from 'three';
import { Humanoid } from '../engine/humanoid';
import type { World } from '../world/world';
import type { Collider } from '../world/collision';
import { blocks, resolveCircle } from '../world/collision';
import { waterDepth, WORLD_HALF } from '../world/macro';
import { angleLerp } from '../util/math';

export const PLAYER_RADIUS = 0.42;

export class Player {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  vy = 0;
  grounded = true;
  speed = 0;
  readonly figure: Humanoid;
  private tmp: Collider[] = [];

  constructor(scene: Scene) {
    this.figure = new Humanoid({ body: 0x5a4a3a, legs: 0x2f3440, skin: 0xd8b094, hat: 'cap', hatColor: 0x3a3a3a, hair: 0x3a2a1a });
    scene.add(this.figure.group);
  }

  teleport(x: number, z: number, world: World): void {
    this.x = x;
    this.z = z;
    this.y = world.groundY(x, z);
    this.vy = 0;
    this.grounded = true;
    this.figure.group.position.set(this.x, this.y, this.z);
  }

  update(dt: number, moveX: number, moveY: number, sprint: boolean, jump: boolean, camForward: [number, number], world: World): void {
    const [fx, fz] = camForward;
    const rx = -fz;
    const rz = fx;
    let dx = fx * moveY + rx * moveX;
    let dz = fz * moveY + rz * moveX;
    const len = Math.hypot(dx, dz);
    const target = sprint ? 17 : 9.2;
    if (len > 0.01) {
      dx /= len;
      dz /= len;
      const desired = target * Math.min(1, len);
      this.speed += (desired - this.speed) * Math.min(1, dt * 10);
      this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 12));
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 12);
    }
    const stepX = Math.sin(this.yaw) * this.speed * dt;
    const stepZ = Math.cos(this.yaw) * this.speed * dt;
    let nx = this.x + stepX;
    let nz = this.z + stepZ;
    // water and world edge: water blocks unless there is a deck to walk on
    if (waterDepth(nx, nz) > -1.5 && world.groundY(nx, nz, this.y) < -0.5) {
      if (waterDepth(nx, this.z) <= -1.5 || world.groundY(nx, this.z, this.y) >= -0.5) nz = this.z;
      else if (waterDepth(this.x, nz) <= -1.5 || world.groundY(this.x, nz, this.y) >= -0.5) nx = this.x;
      else {
        nx = this.x;
        nz = this.z;
      }
    }
    nx = Math.max(-WORLD_HALF + 2, Math.min(WORLD_HALF - 2, nx));
    nz = Math.max(-WORLD_HALF + 2, Math.min(WORLD_HALF - 2, nz));
    // collisions: solid colliders always block; floors and steps only when out of step reach
    const cols = world.collidersNear(nx, nz, PLAYER_RADIUS + 1, this.tmp);
    for (let pass = 0; pass < 2; pass++) {
      for (const c of cols) {
        if (!blocks(c, nx, nz, this.y)) continue;
        [nx, nz] = resolveCircle(c, nx, nz, PLAYER_RADIUS);
      }
    }
    this.x = nx;
    this.z = nz;
    // vertical: step up onto anything within reach, fall off ledges
    const ground = world.groundY(this.x, this.z, this.y);
    if (jump && this.grounded) {
      this.vy = 5.2;
      this.grounded = false;
    }
    this.vy -= 14 * dt;
    this.y += this.vy * dt;
    if (this.y <= ground) {
      this.y = ground;
      this.vy = 0;
      this.grounded = true;
    } else if (this.grounded && this.y - ground < 0.35 && this.vy <= 0) {
      // stick to the ground going down slopes and steps instead of hopping
      this.y = ground;
      this.vy = 0;
    } else if (this.y - ground > 0.05) {
      this.grounded = false;
    }
    this.figure.group.position.set(this.x, this.y, this.z);
    this.figure.group.rotation.y = this.yaw;
    this.figure.animate(dt, this.grounded ? this.speed : 0);
  }
}
