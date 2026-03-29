/**
 * Camera Controller with WASD and Mouse Look
 */

export class CameraController {
  private position = { x: 0, y: 50, z: 100 };
  private rotation = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0, z: 0 };

  private keys: Record<string, boolean> = {};
  private mouseDelta = { x: 0, y: 0 };
  private lastMouseX = 0;
  private lastMouseY = 0;

  private speed = 50; // units per second (base)
  private speedMultiplier = 1.0; // Controlled by UI slider
  private mouseSensitivity = 0.005;
  private friction = 0.85;

  constructor(private canvas: HTMLCanvasElement) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse movement
    this.canvas.addEventListener("mousemove", (e) => {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // Only rotate if middle mouse or specific key held
      if (e.buttons & 4 || this.keys["shift"]) {
        this.rotation.y += deltaX * this.mouseSensitivity;
        this.rotation.x += deltaY * this.mouseSensitivity;

        // Clamp pitch
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
      }
    });

    // Scroll zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomSpeed = 5;
      const direction = e.deltaY > 0 ? 1 : -1;
      
      const forward = {
        x: Math.sin(this.rotation.y),
        y: 0,
        z: Math.cos(this.rotation.y),
      };
      
      this.position.x += forward.x * zoomSpeed * direction;
      this.position.z += forward.z * zoomSpeed * direction;
    });
  }

  public update(deltaTime: number): void {
    // Calculate forward/right vectors from rotation
    const forward = {
      x: Math.sin(this.rotation.y),
      y: 0,
      z: Math.cos(this.rotation.y),
    };

    const right = {
      x: Math.cos(this.rotation.y),
      y: 0,
      z: -Math.sin(this.rotation.y),
    };

    const up = { x: 0, y: 1, z: 0 };

    // Apply input
    let moveX = 0,
      moveY = 0,
      moveZ = 0;

    if (this.keys["w"]) moveZ += 1;
    if (this.keys["s"]) moveZ -= 1;
    if (this.keys["a"]) moveX -= 1;
    if (this.keys["d"]) moveX += 1;
    if (this.keys[" "]) moveY += 1;
    if (this.keys["control"]) moveY -= 1;

    // Apply movement
    const moveDir = {
      x: forward.x * moveZ + right.x * moveX,
      y: moveY,
      z: forward.z * moveZ + right.z * moveX,
    };

    const moveLength = Math.sqrt(moveDir.x ** 2 + moveDir.y ** 2 + moveDir.z ** 2);
    if (moveLength > 0) {
      const moveNorm = {
        x: moveDir.x / moveLength,
        y: moveDir.y / moveLength,
        z: moveDir.z / moveLength,
      };

      const effectiveSpeed = this.speed * this.speedMultiplier;
      this.velocity.x = moveNorm.x * effectiveSpeed;
      this.velocity.y = moveNorm.y * effectiveSpeed;
      this.velocity.z = moveNorm.z * effectiveSpeed;
    } else {
      this.velocity.x *= this.friction;
      this.velocity.y *= this.friction;
      this.velocity.z *= this.friction;
    }

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Clamp to world bounds
    this.position.x = Math.max(-200, Math.min(200, this.position.x));
    this.position.z = Math.max(-200, Math.min(200, this.position.z));
  }

  public getPosition() {
    return { ...this.position };
  }

  public getRotation() {
    return { ...this.rotation };
  }

  public isUnderwater(): boolean {
    return this.position.y < 0;
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  public dispose(): void {
    // Cleanup if needed
  }
}
