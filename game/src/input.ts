import type { InputState } from './sim/types';

/** Keyboard + gamepad input. Remappable later; layout documented on the start screen. */
export class Input {
  private keys = new Set<string>();
  /** Keys pressed since last poll (for UI toggles). */
  private pressed = new Set<string>();
  anyKey = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  endFrame(): void {
    this.pressed.clear();
    this.anyKey = false;
  }

  state(): InputState {
    const k = this.keys;
    const s: InputState = {
      left: k.has('KeyA') || k.has('ArrowLeft'),
      right: k.has('KeyD') || k.has('ArrowRight'),
      down: k.has('KeyS') || k.has('ArrowDown'),
      jump: k.has('Space') || k.has('KeyW') || k.has('ArrowUp'),
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC'),
      interact: k.has('KeyE') || k.has('Enter'),
    };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      s.left ||= ax < -0.35 || !!p.buttons[14]?.pressed;
      s.right ||= ax > 0.35 || !!p.buttons[15]?.pressed;
      s.down ||= (p.axes[1] ?? 0) > 0.6 || !!p.buttons[13]?.pressed;
      s.jump ||= !!p.buttons[0]?.pressed;
      s.interact ||= !!p.buttons[2]?.pressed || !!p.buttons[3]?.pressed;
      s.crouch ||= !!p.buttons[1]?.pressed || !!p.buttons[6]?.pressed;
      s.run ||= !!p.buttons[7]?.pressed || !!p.buttons[5]?.pressed;
      if (p.buttons.some((b) => b.pressed)) this.anyKey = true;
    }
    return s;
  }
}
