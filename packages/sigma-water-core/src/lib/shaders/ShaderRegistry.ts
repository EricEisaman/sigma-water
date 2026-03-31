/**
 * ShaderRegistry - Scalable Shader Declaration System
 * 
 * Declarative registry for managing 20+ water type shaders.
 * Each shader is defined once with all its properties and logic.
 * 
 * Adding a new shader is as simple as:
 * ```
 * registry.register({
 *   id: 'tropicalWaves',
 *   displayName: 'Tropical Waves',
 *   ...
 * })
 * ```
 */

import { Scene, Mesh } from '@babylonjs/core';
import { ShaderContext, ShaderContextConfig } from './ShaderContext';
import { ShaderManager } from './ShaderManager';

export interface ShaderRegistryEntry {
  /** Unique shader ID */
  id: string;
  
  /** Display name for UI */
  displayName: string;
  
  /** Shader description */
  description: string;
  
  /** Feature flags */
  features: {
    supportsFoam: boolean;
    supportsCaustics: boolean;
    supportsCollisions: boolean;
    supportsWake: boolean;
  };
  
  /** Shader code */
  shader: {
    vertex: string;
    fragment: string;
  };
  
  /** Babylon.js metadata */
  babylon: {
    uniforms: string[];
    attributes: string[];
    samplers?: string[];
    uniformBuffers?: string[];
  };
  
  /** Setup function (called on initialization) */
  setup?: (context: ShaderContext) => void;
  
  /** Update function (called per frame) */
  update?: (context: ShaderContext, deltaTime: number) => void;
  
  /** Cleanup function (called on disposal) */
  cleanup?: () => void;
  
  /** Default uniform values */
  defaults?: Record<string, any>;
}

export class ShaderRegistry {
  private entries: Map<string, ShaderRegistryEntry> = new Map();
  private manager: ShaderManager;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.manager = new ShaderManager();
  }

  private resolveShaderSource(source: unknown, shaderId: string, stage: 'vertex' | 'fragment'): string {
    let current = source;

    for (let i = 0; i < 5; i += 1) {
      if (typeof current === 'string') {
        const normalized = current.trim();
        if (!normalized) {
          throw new Error(`Empty ${stage} shader source for ${shaderId}`);
        }
        return normalized;
      }

      if (!current || typeof current !== 'object' || !('default' in current)) {
        break;
      }

      current = (current as { default?: unknown }).default;
    }

    throw new Error(`Invalid ${stage} shader source for ${shaderId}: expected WGSL string`);
  }

  /**
   * Register a new shader
   */
  public register(entry: ShaderRegistryEntry): void {
    try {
      console.log(`📝 Registering shader: ${entry.id}`);
      
      // Validate entry
      const vertexSource = this.resolveShaderSource(entry.shader.vertex, entry.id, 'vertex');
      const fragmentSource = this.resolveShaderSource(entry.shader.fragment, entry.id, 'fragment');

      if (!entry.id || !vertexSource || !fragmentSource) {
        throw new Error('Invalid shader entry: missing required fields');
      }

      // Store entry
      this.entries.set(entry.id, entry);

      // Create and register context
      const config: ShaderContextConfig = {
        id: entry.id,
        displayName: entry.displayName,
        description: entry.description,
        vertexCode: vertexSource,
        fragmentCode: fragmentSource,
        uniforms: entry.babylon.uniforms,
        attributes: entry.babylon.attributes,
        samplers: entry.babylon.samplers,
        uniformBuffers: entry.babylon.uniformBuffers,
      };

      const context = new ShaderContext(
        this.scene,
        config,
        entry.setup,
        entry.update,
        entry.cleanup
      );

      // Initialize shader context immediately
      context.initialize();

      this.manager.registerContext(context);

      // Set default uniforms if provided
      if (entry.defaults) {
        context.setUniforms(entry.defaults);
      }

      console.log(`✅ Shader registered and initialized: ${entry.id}`);
    } catch (error) {
      console.error(`❌ Failed to register shader: ${error}`);
      throw error;
    }
  }

  /**
   * Register multiple shaders at once
   */
  public registerBatch(entries: ShaderRegistryEntry[]): void {
    entries.forEach(entry => this.register(entry));
  }

  /**
   * Get shader entry by ID
   */
  public getEntry(id: string): ShaderRegistryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all registered shaders
   */
  public getAllEntries(): ShaderRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get shaders with specific feature
   */
  public getByFeature(feature: keyof ShaderRegistryEntry['features']): ShaderRegistryEntry[] {
    return Array.from(this.entries.values()).filter(
      entry => entry.features[feature]
    );
  }

  /**
   * Switch to a shader
   */
  public switchTo(
    shaderId: string,
    mesh: Mesh,
    options?: { fadeDuration?: number; preserveUniforms?: boolean }
  ): void {
    const entry = this.entries.get(shaderId);
    if (!entry) {
      console.error(`❌ Shader not found: ${shaderId}`);
      return;
    }

    console.log(`🌊 Switching to shader: ${shaderId}`);

    this.manager.switchTo(shaderId, mesh, {
      fadeDuration: options?.fadeDuration,
      preserveUniforms: options?.preserveUniforms,
      onTransition: (fromId, toId) => {
        console.log(`🔄 Transitioned from ${fromId} to ${toId}`);
      },
    });
  }

  /**
   * Update active shader
   */
  public update(deltaTime: number): void {
    this.manager.update(deltaTime);
  }

  /**
   * Set uniform on active shader
   */
  public setUniform(name: string, value: any): void {
    this.manager.setUniform(name, value);
  }

  /**
   * Set multiple uniforms
   */
  public setUniforms(uniforms: Record<string, any>): void {
    this.manager.setUniforms(uniforms);
  }

  /**
   * Get uniform from active shader
   */
  public getUniform(name: string): any {
    return this.manager.getUniform(name);
  }

  /**
   * Get active shader ID
   */
  public getActiveId(): string | null {
    return this.manager.getActiveContextId();
  }

  /**
   * Get active shader entry
   */
  public getActiveEntry(): ShaderRegistryEntry | null {
    const activeId = this.manager.getActiveContextId();
    if (!activeId) return null;
    return this.entries.get(activeId) || null;
  }

  /**
   * Check if shader exists
   */
  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Get all shader IDs
   */
  public getAllIds(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get shader count
   */
  public getCount(): number {
    return this.entries.size;
  }

  /**
   * Dispose the active shader material while leaving the context registered.
   */
  public disposeActiveMaterial(): void {
    this.manager.disposeActiveMaterial();
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.manager.dispose();
    this.entries.clear();
  }

  /**
   * Get underlying manager (for advanced use)
   */
  public getManager(): ShaderManager {
    return this.manager;
  }
}
