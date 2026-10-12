/**
 * Unified input: keyboard + mouse on desktop, virtual joystick + touch-look + buttons on mobile.
 * The key set is deliberately tiny. E is "do the thing", whatever the thing is.
 */
export interface InputState {
  moveX: number; // -1..1 strafe
  moveY: number; // -1..1 forward
  lookX: number; // accumulated this frame
  lookY: number;
  zoom: number; // wheel delta this frame
  sprint: boolean;
  jump: boolean; // edge
  interact: boolean; // edge
  map: boolean; // edge
  pause: boolean; // edge
  any: boolean; // any press this frame (for dismissing screens)
}

export class Input {
  state: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, zoom: 0, sprint: false, jump: false, interact: false, map: false, pause: false, any: false };
  readonly isTouch: boolean;
  private keys = new Set<string>();
  private edges = new Set<string>();
  private locked = false;
  private dragging = false;
  private lastMouse: [number, number] = [0, 0];
  // touch
  private joyId: number | null = null;
  private joyOrigin: [number, number] = [0, 0];
  private joyVec: [number, number] = [0, 0];
  private lookId: number | null = null;
  private lookLast: [number, number] = [0, 0];
  private sprintToggle = false;
  enabled = true;
  /** when true, movement input is ignored (menus open) but edges still fire */
  blocked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this.edges.add(k);
      if (['Space', 'Tab', 'KeyE', 'KeyM', 'Escape'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch) return;
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastMouse = [e.clientX, e.clientY];
      if (!this.locked && this.enabled && !this.blocked) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.state.lookX += e.movementX;
        this.state.lookY += e.movementY;
      } else if (this.dragging) {
        this.state.lookX += e.clientX - this.lastMouse[0];
        this.state.lookY += e.clientY - this.lastMouse[1];
        this.lastMouse = [e.clientX, e.clientY];
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('wheel', (e) => {
      this.state.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    // touch: left half = joystick, right half = look
    const onStart = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        const target = t.target as HTMLElement;
        if (target.closest('.btn') || target.closest('.ui-block')) continue;
        if (t.clientX < window.innerWidth * 0.45 && this.joyId === null) {
          this.joyId = t.identifier;
          this.joyOrigin = [t.clientX, t.clientY];
          this.joyVec = [0, 0];
          this.showJoystick(t.clientX, t.clientY);
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLast = [t.clientX, t.clientY];
        }
      }
      if (e.cancelable && e.target === canvas) e.preventDefault();
    };
    const onMove = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          const dx = t.clientX - this.joyOrigin[0];
          const dy = t.clientY - this.joyOrigin[1];
          const r = 55;
          const len = Math.hypot(dx, dy);
          const k = len > r ? r / len : 1;
          this.joyVec = [(dx * k) / r, (dy * k) / r];
          this.moveJoystick(dx * k, dy * k);
        } else if (t.identifier === this.lookId) {
          this.state.lookX += (t.clientX - this.lookLast[0]) * 2.2;
          this.state.lookY += (t.clientY - this.lookLast[1]) * 2.2;
          this.lookLast = [t.clientX, t.clientY];
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          this.joyVec = [0, 0];
          this.hideJoystick();
        } else if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
  }

  /** Wire the on-screen buttons (mobile). */
  bindButton(el: HTMLElement, action: 'interact' | 'jump' | 'sprint' | 'map' | 'pause'): void {
    const down = (e: Event): void => {
      e.preventDefault();
      if (action === 'sprint') {
        this.sprintToggle = !this.sprintToggle;
        el.classList.toggle('active', this.sprintToggle);
      } else this.edges.add('btn:' + action);
    };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('mousedown', down);
  }

  private joyBase: HTMLElement | null = null;
  private joyKnob: HTMLElement | null = null;
  setJoystickElements(base: HTMLElement, knob: HTMLElement): void {
    this.joyBase = base;
    this.joyKnob = knob;
  }
  private showJoystick(x: number, y: number): void {
    if (!this.joyBase) return;
    this.joyBase.style.display = 'block';
    this.joyBase.style.left = `${x}px`;
    this.joyBase.style.top = `${y}px`;
    this.moveJoystick(0, 0);
  }
  private moveJoystick(dx: number, dy: number): void {
    if (this.joyKnob) this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  private hideJoystick(): void {
    if (this.joyBase) this.joyBase.style.display = 'none';
  }

  /** Call once per frame before reading state. */
  poll(): void {
    const s = this.state;
    const k = this.keys;
    let mx = 0;
    let my = 0;
    if (!this.blocked) {
      if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      mx += this.joyVec[0];
      my -= this.joyVec[1];
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    s.moveX = mx;
    s.moveY = my;
    s.sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.sprintToggle;
    s.jump = this.edges.has('Space') || this.edges.has('btn:jump');
    s.interact = this.edges.has('KeyE') || this.edges.has('Enter') || this.edges.has('btn:interact');
    s.map = this.edges.has('KeyM') || this.edges.has('Tab') || this.edges.has('btn:map');
    s.pause = this.edges.has('Escape') || this.edges.has('btn:pause');
    s.any = this.edges.size > 0;
    if (this.blocked) {
      s.lookX = 0;
      s.lookY = 0;
      s.zoom = 0;
    }
  }

  /** Call at end of frame. */
  endFrame(): void {
    this.edges.clear();
    this.state.lookX = 0;
    this.state.lookY = 0;
    this.state.zoom = 0;
  }

  releasePointer(): void {
    if (this.locked) document.exitPointerLock?.();
  }
}
