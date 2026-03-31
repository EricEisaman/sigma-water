import { afterEach, beforeEach, vi } from 'vitest';

vi.mock('./ShaderContext', () => {
  class MockShaderContext {
    private readonly id: string;

    constructor(_: unknown, config: { id: string }) {
      this.id = config.id;
    }

    initialize(): void {}
    getId(): string {
      return this.id;
    }
    setUniforms(): void {}
  }

  return {
    ShaderContext: MockShaderContext,
  };
});

import { ShaderRegistry } from './ShaderRegistry';

describe('ShaderRegistry source resolution', () => {
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

  test('register accepts module-like shader sources with default string', () => {
    const registry = new ShaderRegistry({} as any);

    expect(() =>
      registry.register({
        id: 'test',
        displayName: 'Test',
        description: 'Test shader',
        features: {
          supportsFoam: false,
          supportsCaustics: false,
          supportsCollisions: false,
          supportsWake: false,
        },
        shader: {
          vertex: { default: '@vertex fn main() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0); }' } as any,
          fragment: { default: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(0.0, 0.3, 0.6, 1.0); }' } as any,
        },
        babylon: {
          uniforms: [],
          attributes: ['position'],
          uniformBuffers: ['Scene', 'Mesh'],
        },
      })
    ).not.toThrow();
  });

  test('register accepts nested default wrappers from bundler interop', () => {
    const registry = new ShaderRegistry({} as any);

    expect(() =>
      registry.register({
        id: 'nested-default-test',
        displayName: 'Nested Default Test',
        description: 'Test shader',
        features: {
          supportsFoam: false,
          supportsCaustics: false,
          supportsCollisions: false,
          supportsWake: false,
        },
        shader: {
          vertex: { default: { default: '@vertex fn main() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0); }' } } as any,
          fragment: { default: { default: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(0.0, 0.3, 0.6, 1.0); }' } } as any,
        },
        babylon: {
          uniforms: [],
          attributes: ['position'],
          uniformBuffers: ['Scene', 'Mesh'],
        },
      })
    ).not.toThrow();
  });

  test('register rejects unresolved non-string shader sources', () => {
    const registry = new ShaderRegistry({} as any);

    expect(() =>
      registry.register({
        id: 'invalid-source-test',
        displayName: 'Invalid Source Test',
        description: 'Test shader',
        features: {
          supportsFoam: false,
          supportsCaustics: false,
          supportsCollisions: false,
          supportsWake: false,
        },
        shader: {
          vertex: { bad: true } as any,
          fragment: { default: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(0.0, 0.3, 0.6, 1.0); }' } as any,
        },
        babylon: {
          uniforms: [],
          attributes: ['position'],
          uniformBuffers: ['Scene', 'Mesh'],
        },
      })
    ).toThrow(/Invalid vertex shader source/);
  });
});
