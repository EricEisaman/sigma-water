class MockShaderContext {
  private readonly id: string;
  public activated = 0;
  public deactivated = 0;
  public disposedMaterial = 0;
  public disposed = 0;
  private readonly state: { uniforms: Record<string, any> };
  private readonly ownUniforms: Record<string, any> = {};

  constructor(id: string, uniforms: Record<string, any> = {}) {
    this.id = id;
    this.state = { uniforms };
  }

  getId(): string {
    return this.id;
  }

  activate(): void {
    this.activated += 1;
  }

  deactivate(): void {
    this.deactivated += 1;
  }

  getState(): { uniforms: Record<string, any> } {
    return this.state;
  }

  setUniforms(uniforms: Record<string, any>): void {
    Object.assign(this.ownUniforms, uniforms);
  }

  getAppliedUniforms(): Record<string, any> {
    return this.ownUniforms;
  }

  update(): void {}

  setUniform(name: string, value: any): void {
    this.ownUniforms[name] = value;
  }

  getUniform(name: string): any {
    return this.ownUniforms[name];
  }

  disposeMaterial(): void {
    this.disposedMaterial += 1;
  }

  dispose(): void {
    this.disposed += 1;
  }
}

import { afterEach, beforeEach, vi } from 'vitest';
import { ShaderManager } from './ShaderManager';

describe('ShaderManager', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('switching contexts deactivates previous and activates next', () => {
    const manager = new ShaderManager();
    const a = new MockShaderContext('a');
    const b = new MockShaderContext('b');

    manager.registerContext(a as any);
    manager.registerContext(b as any);

    manager.switchTo('a', {} as any);
    manager.switchTo('b', {} as any);

    expect(manager.getActiveContextId()).toBe('b');
    expect(a.activated).toBe(1);
    expect(a.deactivated).toBe(1);
    expect(b.activated).toBe(1);
  });

  test('preserveUniforms copies previous uniforms to next context', () => {
    const manager = new ShaderManager();
    const a = new MockShaderContext('a', { waveAmplitude: 2.5, windSpeed: 1.1 });
    const b = new MockShaderContext('b');

    manager.registerContext(a as any);
    manager.registerContext(b as any);

    manager.switchTo('a', {} as any);
    manager.switchTo('b', {} as any, { preserveUniforms: true });

    expect(b.getAppliedUniforms()).toMatchObject({
      waveAmplitude: 2.5,
      windSpeed: 1.1,
    });
  });

  test('disposeActiveMaterial only disposes active context material', () => {
    const manager = new ShaderManager();
    const a = new MockShaderContext('a');
    const b = new MockShaderContext('b');

    manager.registerContext(a as any);
    manager.registerContext(b as any);

    manager.switchTo('a', {} as any);
    manager.disposeActiveMaterial();

    expect(a.disposedMaterial).toBe(1);
    expect(b.disposedMaterial).toBe(0);
  });

  test('rapid switching keeps manager stable', () => {
    const manager = new ShaderManager();
    const ids = ['a', 'b', 'c', 'd'];
    const contexts = ids.map((id) => new MockShaderContext(id));

    for (const context of contexts) {
      manager.registerContext(context as any);
    }

    for (let i = 0; i < 100; i += 1) {
      manager.switchTo(ids[i % ids.length], {} as any);
    }

    expect(ids.includes(manager.getActiveContextId() || '')).toBe(true);
    expect(manager.getActiveContext()).not.toBeNull();
  });
});
