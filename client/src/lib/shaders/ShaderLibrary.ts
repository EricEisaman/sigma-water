/**
 * Modular Ocean Shader Library
 * Provides a clean API for managing multiple shader materials
 * Supports extensibility for future shader implementations
 */

import { Scene, ShaderMaterial, Mesh } from '@babylonjs/core';

export interface ShaderConfig {
  name: string;
  displayName: string;
  description: string;
  uniforms: string[];
  attributes: string[];
  uniqueParams?: Record<string, { min: number; max: number; default: number }>;
}

export interface ShaderInstance {
  name: string;
  material: ShaderMaterial;
  config: ShaderConfig;
  updateUniforms: (uniforms: Record<string, any>) => void;
}

export class ShaderLibrary {
  private scene: Scene;
  private shaders: Map<string, ShaderInstance> = new Map();
  private currentShader: ShaderInstance | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Register a new shader material
   */
  registerShader(
    name: string,
    config: ShaderConfig,
    vertexCode: string,
    fragmentCode: string,
    defaultUniforms: Record<string, any>
  ): ShaderInstance {
    // Register shader code in Babylon's store
    (BABYLON.Effect.ShadersStore as any)[`${name}VertexShader`] = vertexCode;
    (BABYLON.Effect.ShadersStore as any)[`${name}FragmentShader`] = fragmentCode;

    // Create shader material
    const material = new ShaderMaterial(name, this.scene, {
      vertex: name,
      fragment: name,
    }, {
      attributes: config.attributes,
      uniforms: config.uniforms,
    });

    // Set default uniforms
    Object.entries(defaultUniforms).forEach(([key, value]) => {
      (material as any)[key] = value;
    });

    const instance: ShaderInstance = {
      name,
      material,
      config,
      updateUniforms: (uniforms: Record<string, any>) => {
        Object.entries(uniforms).forEach(([key, value]) => {
          (material as any)[key] = value;
        });
      },
    };

    this.shaders.set(name, instance);
    return instance;
  }

  /**
   * Get a registered shader by name
   */
  getShader(name: string): ShaderInstance | undefined {
    return this.shaders.get(name);
  }

  /**
   * Get all registered shaders
   */
  getAllShaders(): ShaderInstance[] {
    return Array.from(this.shaders.values());
  }

  /**
   * Apply shader to mesh
   */
  applyShader(mesh: Mesh, shaderName: string): boolean {
    const shader = this.shaders.get(shaderName);
    if (!shader) {
      console.warn(`Shader "${shaderName}" not found`);
      return false;
    }

    mesh.material = shader.material;
    this.currentShader = shader;
    return true;
  }

  /**
   * Get current active shader
   */
  getCurrentShader(): ShaderInstance | null {
    return this.currentShader;
  }

  /**
   * Update uniforms for current shader
   */
  updateCurrentShaderUniforms(uniforms: Record<string, any>): void {
    if (this.currentShader) {
      this.currentShader.updateUniforms(uniforms);
    }
  }

  /**
   * Get shader configuration
   */
  getShaderConfig(name: string): ShaderConfig | undefined {
    return this.shaders.get(name)?.config;
  }
}

// Import BABYLON globally for shader registration
declare const BABYLON: any;
