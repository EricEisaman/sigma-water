/**
 * ShaderContext - Fluid Shader/Mesh/Material Abstraction
 * 
 * Enables seamless switching between different WGSL shaders, each with:
 * - Independent mesh topology
 * - Custom material properties
 * - Shader-specific uniforms
 * - Lifecycle management (setup, update, cleanup)
 */

import { BaseTexture, Scene, Mesh, ShaderMaterial, Material, ShaderLanguage } from '@babylonjs/core';

export interface ShaderContextConfig {
  /** Unique shader identifier */
  id: string;
  
  /** Display name for UI */
  displayName: string;
  
  /** Shader description */
  description: string;
  
  /** Vertex shader WGSL code */
  vertexCode: string;
  
  /** Fragment shader WGSL code */
  fragmentCode: string;
  
  /** Babylon.js uniform names */
  uniforms: string[];
  
  /** Babylon.js attribute names */
  attributes: string[];
  
  /** Sampler names for textures */
  samplers?: string[];
  
  /** Uniform buffer names */
  uniformBuffers?: string[];
}

export interface ShaderContextState {
  /** Active shader material */
  material: ShaderMaterial | null;
  
  /** Active mesh (may differ per shader) */
  mesh: Mesh | null;
  
  /** Shader-specific uniform values */
  uniforms: Record<string, any>;
  
  /** Whether shader is currently active */
  isActive: boolean;
}

export class ShaderContext {
  private config: ShaderContextConfig;
  private state: ShaderContextState;
  private scene: Scene;
  private setupFn?: (context: ShaderContext) => void;
  private updateFn?: (context: ShaderContext, deltaTime: number) => void;
  private cleanupFn?: () => void;

  constructor(
    scene: Scene,
    config: ShaderContextConfig,
    setupFn?: (context: ShaderContext) => void,
    updateFn?: (context: ShaderContext, deltaTime: number) => void,
    cleanupFn?: () => void
  ) {
    this.scene = scene;
    this.config = config;
    this.setupFn = setupFn;
    this.updateFn = updateFn;
    this.cleanupFn = cleanupFn;
    
    this.state = {
      material: null,
      mesh: null,
      uniforms: {},
      isActive: false,
    };
  }

  private static normalizeShaderSource(source: unknown, shaderId: string, stage: 'vertex' | 'fragment'): string {
    let current = source;

    // Some bundler interop modes wrap default exports multiple times.
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

  private createMaterial(): ShaderMaterial {
    const vertexCode = ShaderContext.normalizeShaderSource(this.config.vertexCode, this.config.id, 'vertex');
    const fragmentCode = ShaderContext.normalizeShaderSource(this.config.fragmentCode, this.config.id, 'fragment');

    const material = new ShaderMaterial(
      `${this.config.id}_${Date.now()}`,
      this.scene,
      {
        vertexSource: vertexCode,
        fragmentSource: fragmentCode,
      },
      {
        attributes: this.config.attributes,
        uniforms: this.config.uniforms,
        samplers: this.config.samplers || [],
        uniformBuffers: this.config.uniformBuffers || ['Scene', 'Mesh'],
        needAlphaBlending: false,
        shaderLanguage: ShaderLanguage.WGSL,
      }
    );

    material.transparencyMode = Material.MATERIAL_OPAQUE;
    material.alpha = 1.0;
    material.backFaceCulling = false;
    material.wireframe = false;

    return material;
  }

  /**
   * Initialize shader context - create material and setup
   */
  public initialize(): void {
    try {
      console.log(`🎨 Initializing shader context: ${this.config.id}`);
      
      // Create shader material
      this.state.material = this.createMaterial();

      // Run custom setup if provided
      if (this.setupFn) {
        this.setupFn(this);
      }

      console.log(`✅ Shader context initialized: ${this.config.id}`);
    } catch (error) {
      console.error(`❌ Failed to initialize shader context: ${error}`);
      throw error;
    }
  }

  /**
   * Activate this shader context on a mesh
   */
  public activate(mesh: Mesh): void {
    const materialAlreadyBound = this.state.material !== null
      && this.state.mesh === mesh
      && mesh.material === this.state.material;

    if (this.state.isActive && materialAlreadyBound) {
      console.log(`ℹ️ Shader context already active: ${this.config.id}`);
      return;
    }

    try {
      console.log(`🎬 Activating shader context: ${this.config.id}`);
      
      if (!this.state.material) {
        this.state.material = this.createMaterial();
      }

      // Apply material to mesh. This path also rebinds when the context stays active
      // but the mesh instance changed (adaptive retier).
      this.state.mesh = mesh;
      mesh.material = this.state.material;
      this.state.isActive = true;
      this.setUniforms(this.state.uniforms);

      console.log(`✅ Shader context activated: ${this.config.id}`);
    } catch (error) {
      console.error(`❌ Failed to activate shader context: ${error}`);
      throw error;
    }
  }

  /**
   * Deactivate this shader context
   */
  public deactivate(): void {
    if (!this.state.isActive) {
      console.log(`ℹ️ Shader context already inactive: ${this.config.id}`);
      return;
    }

    try {
      console.log(`🎬 Deactivating shader context: ${this.config.id}`);
      this.state.isActive = false;
      console.log(`✅ Shader context deactivated: ${this.config.id}`);
    } catch (error) {
      console.error(`❌ Failed to deactivate shader context: ${error}`);
    }
  }

  /**
   * Update shader uniforms
   */
  public setUniform(name: string, value: any): void {
    this.state.uniforms[name] = value;

    if (!this.state.material) {
      return;
    }

    try {
      // Apply to material based on type
      if (typeof value === 'number') {
        this.state.material.setFloat(name, value);
      } else if (value instanceof BaseTexture) {
        this.state.material.setTexture(name, value);
      } else if (value instanceof Array) {
        if (value.length === 2) {
          this.state.material.setVector2(name, { x: value[0], y: value[1] });
        } else if (value.length === 3) {
          this.state.material.setVector3(name, { x: value[0], y: value[1], z: value[2] });
        } else if (value.length === 4) {
          this.state.material.setVector4(name, { x: value[0], y: value[1], z: value[2], w: value[3] });
        }
      } else if (value && typeof value === 'object' && 'x' in value) {
        // Vector-like object
        if ('w' in value) {
          this.state.material.setVector4(name, value);
        } else if ('z' in value) {
          this.state.material.setVector3(name, value);
        } else if ('y' in value) {
          this.state.material.setVector2(name, value);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to set uniform ${name}: ${error}`);
    }
  }

  /**
   * Dispose current material but keep context alive for future re-activation.
   */
  public disposeMaterial(): void {
    if (this.state.material) {
      this.state.material.dispose();
      this.state.material = null;
    }
  }

  /**
   * Set multiple uniforms at once
   */
  public setUniforms(uniforms: Record<string, any>): void {
    Object.entries(uniforms).forEach(([name, value]) => {
      this.setUniform(name, value);
    });
  }

  /**
   * Get uniform value
   */
  public getUniform(name: string): any {
    return this.state.uniforms[name];
  }

  /**
   * Update shader (called per frame)
   */
  public update(deltaTime: number): void {
    if (!this.state.isActive) return;

    try {
      if (this.updateFn) {
        this.updateFn(this, deltaTime);
      }
    } catch (error) {
      console.error(`❌ Error updating shader context: ${error}`);
    }
  }

  /**
   * Cleanup and dispose resources
   */
  public dispose(): void {
    try {
      console.log(`🧹 Disposing shader context: ${this.config.id}`);
      
      if (this.cleanupFn) {
        this.cleanupFn();
      }

      this.disposeMaterial();

      this.state.mesh = null;
      this.state.isActive = false;

      console.log(`✅ Shader context disposed: ${this.config.id}`);
    } catch (error) {
      console.error(`❌ Error disposing shader context: ${error}`);
    }
  }

  // Getters
  public getId(): string {
    return this.config.id;
  }

  public getDisplayName(): string {
    return this.config.displayName;
  }

  public getDescription(): string {
    return this.config.description;
  }

  public getMaterial(): ShaderMaterial | null {
    return this.state.material;
  }

  public getMesh(): Mesh | null {
    return this.state.mesh;
  }

  public isInitialized(): boolean {
    return this.state.material !== null;
  }

  public isCurrentlyActive(): boolean {
    return this.state.isActive;
  }

  public getConfig(): ShaderContextConfig {
    return this.config;
  }

  public getState(): ShaderContextState {
    return this.state;
  }
}
