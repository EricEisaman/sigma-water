/**
 * ShaderManager - Orchestrates Fluid Shader Switching
 * 
 * Manages multiple ShaderContexts and handles:
 * - Registration of shader contexts
 * - Smooth transitions between shaders
 * - Uniform synchronization
 * - Lifecycle management
 */

import { Mesh } from '@babylonjs/core';
import { ShaderContext, ShaderContextConfig } from './ShaderContext';

export interface ShaderTransitionOptions {
  /** Fade duration in milliseconds (0 = instant) */
  fadeDuration?: number;
  
  /** Preserve uniforms from previous shader */
  preserveUniforms?: boolean;
  
  /** Custom transition callback */
  onTransition?: (fromId: string, toId: string) => void;
}

export class ShaderManager {
  private contexts: Map<string, ShaderContext> = new Map();
  private activeContextId: string | null = null;
  private targetMesh: Mesh | null = null;
  private transitionInProgress = false;
  private transitionStartTime = 0;
  private transitionDuration = 0;
  private previousContextId: string | null = null;

  /**
   * Register a new shader context
   */
  public registerContext(context: ShaderContext): void {
    try {
      const id = context.getId();
      console.log(`📝 Registering shader context: ${id}`);
      
      this.contexts.set(id, context);
      
      console.log(`✅ Shader context registered: ${id}`);
    } catch (error) {
      console.error(`❌ Failed to register shader context: ${error}`);
      throw error;
    }
  }

  /**
   * Get a registered shader context
   */
  public getContext(id: string): ShaderContext | undefined {
    return this.contexts.get(id);
  }

  /**
   * Get all registered contexts
   */
  public getAllContexts(): ShaderContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Switch to a different shader context
   */
  public switchTo(
    contextId: string,
    mesh: Mesh,
    options: ShaderTransitionOptions = {}
  ): void {
    try {
      const targetContext = this.contexts.get(contextId);
      if (!targetContext) {
        console.error(`❌ Shader context not found: ${contextId}`);
        return;
      }

      if (this.activeContextId === contextId) {
        console.log(`ℹ️ Already using shader: ${contextId}`);
        return;
      }

      console.log(`🔄 Switching to shader: ${contextId}`);

      // Deactivate previous context
      if (this.activeContextId) {
        const previousContext = this.contexts.get(this.activeContextId);
        if (previousContext) {
          previousContext.deactivate();
        }
        this.previousContextId = this.activeContextId;
      }

      // Store target mesh
      this.targetMesh = mesh;

      // Handle transition
      const fadeDuration = options.fadeDuration ?? 0;
      if (fadeDuration > 0) {
        this.transitionInProgress = true;
        this.transitionStartTime = Date.now();
        this.transitionDuration = fadeDuration;
      }

      // Activate new context
      targetContext.activate(mesh);
      this.activeContextId = contextId;

      // Preserve uniforms if requested
      if (options.preserveUniforms && this.previousContextId) {
        const previousContext = this.contexts.get(this.previousContextId);
        if (previousContext) {
          const previousUniforms = previousContext.getState().uniforms;
          targetContext.setUniforms(previousUniforms);
        }
      }

      // Call transition callback
      if (options.onTransition && this.previousContextId) {
        options.onTransition(this.previousContextId, contextId);
      }

      console.log(`✅ Switched to shader: ${contextId}`);
    } catch (error) {
      console.error(`❌ Error switching shader: ${error}`);
    }
  }

  /**
   * Update active shader (call per frame)
   */
  public update(deltaTime: number): void {
    if (!this.activeContextId) return;

    const activeContext = this.contexts.get(this.activeContextId);
    if (activeContext) {
      activeContext.update(deltaTime);
    }

    // Handle transition completion
    if (this.transitionInProgress) {
      const elapsed = Date.now() - this.transitionStartTime;
      if (elapsed >= this.transitionDuration) {
        this.transitionInProgress = false;
        console.log(`✅ Shader transition complete`);
      }
    }
  }

  /**
   * Set uniform on active shader
   */
  public setUniform(name: string, value: any): void {
    if (!this.activeContextId) return;

    const activeContext = this.contexts.get(this.activeContextId);
    if (activeContext) {
      activeContext.setUniform(name, value);
    }
  }

  /**
   * Set multiple uniforms on active shader
   */
  public setUniforms(uniforms: Record<string, any>): void {
    if (!this.activeContextId) return;

    const activeContext = this.contexts.get(this.activeContextId);
    if (activeContext) {
      activeContext.setUniforms(uniforms);
    }
  }

  /**
   * Get uniform from active shader
   */
  public getUniform(name: string): any {
    if (!this.activeContextId) return undefined;

    const activeContext = this.contexts.get(this.activeContextId);
    return activeContext?.getUniform(name);
  }

  /**
   * Get active shader context
   */
  public getActiveContext(): ShaderContext | null {
    if (!this.activeContextId) return null;
    return this.contexts.get(this.activeContextId) || null;
  }

  /**
   * Get active shader ID
   */
  public getActiveContextId(): string | null {
    return this.activeContextId;
  }

  /**
   * Check if transition is in progress
   */
  public isTransitioning(): boolean {
    return this.transitionInProgress;
  }

  /**
   * Get transition progress (0-1)
   */
  public getTransitionProgress(): number {
    if (!this.transitionInProgress) return 0;
    
    const elapsed = Date.now() - this.transitionStartTime;
    return Math.min(elapsed / this.transitionDuration, 1.0);
  }

  /**
   * Cleanup and dispose all contexts
   */
  public dispose(): void {
    try {
      console.log('🧹 Disposing shader manager');
      
      this.contexts.forEach((context) => {
        context.dispose();
      });

      this.contexts.clear();
      this.activeContextId = null;
      this.targetMesh = null;

      console.log('✅ Shader manager disposed');
    } catch (error) {
      console.error(`❌ Error disposing shader manager: ${error}`);
    }
  }
}
