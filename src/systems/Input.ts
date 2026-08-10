export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  private pointerDown = false;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContext: (e: Event) => void;

  constructor(private target: HTMLElement) {
    this.boundKeyDown = (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this.boundKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.boundMouseMove = (e) => {
      if (this.pointerDown || document.pointerLockElement === this.target) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this.boundMouseDown = (e) => {
      if (e.button === 2 || e.button === 0) this.pointerDown = true;
    };
    this.boundMouseUp = () => {
      this.pointerDown = false;
    };
    this.boundContext = (e) => e.preventDefault();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    this.target.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    this.target.addEventListener('contextmenu', this.boundContext);
  }

  consumeMouse(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Edge-triggered key just pressed this frame — call once per frame with snapshot. */
  private prevKeys = new Set<string>();
  pressed(code: string): boolean {
    return this.keys.has(code) && !this.prevKeys.has(code);
  }

  endFrame(): void {
    this.prevKeys = new Set(this.keys);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    this.target.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    this.target.removeEventListener('contextmenu', this.boundContext);
  }
}
