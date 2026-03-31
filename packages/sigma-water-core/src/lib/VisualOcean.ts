/**
 * Photorealistic Ocean Renderer - Babylon.js 9 + WebGPU + WGSL
 * Pure modular shader system - NO inline shader code
 */

import {
  WebGPUEngine,
  Scene,
  FreeCamera,
  DirectionalLight,
  ShadowGenerator,
  Mesh,
  Vector3,
  Color4,
  EXRCubeTexture,
  DepthRenderer,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { parseWaterTypeId, type WaterTypeId } from '../water/WaterTypeRegistry';
import { ShaderRegistry } from './shaders/ShaderRegistry';
import { SHADER_DEFINITIONS } from './shaders/definitions';
import { filterParameterStateForShader, isParameterSupportedForShader } from './water/ShaderParameterFilter';
import { WaterMeshFactory } from './water/WaterMeshFactory';
import { topDownCameraPosition } from './camera';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: WebGPUEngine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private oceanMesh: Mesh | null = null;
  private shaderRegistry: ShaderRegistry | null = null;
  private currentShaderName: WaterTypeId = 'gerstnerWaves';
  private depthRenderer: DepthRenderer | null = null;
  private parameterState: Record<string, number> = {};
  private lastFrameTimeMs = 0;
  private elapsedTime = 0;
  private renderHealthCheckHandle: ReturnType<typeof setTimeout> | null = null;
  private hasLoggedFirstFrame = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    console.log('🌊 Initializing Sigma Water Ocean Renderer...');
    
    this.engine = new WebGPUEngine(this.canvas);
    await this.engine.initAsync();
    
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.3, 0.5, 1.0);
    
    await this.setupCamera();
    await this.setupLighting();
    await this.setupEnvironment();
    await this.createOceanMesh();
    
    console.log('✅ Ocean Renderer initialized');
    
    this.lastFrameTimeMs = performance.now();
    this.engine.runRenderLoop(() => {
      try {
        this.updateRuntimeUniforms();
        this.scene?.render();
        if (!this.hasLoggedFirstFrame) {
          this.hasLoggedFirstFrame = true;
          console.log('✅ First render frame completed');
        }
      } catch (error) {
        console.error('❌ Render loop error:', error);
      }
    });
    
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  private async setupCamera(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.camera = new FreeCamera('camera', new Vector3(0, 50, -100), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(this.canvas, true);
    this.camera.speed = 50;
    this.camera.angularSensibility = 1000;
  }

  private async setupLighting(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    
    const light = new DirectionalLight('sunLight', new Vector3(0.5, 1, 0.5), this.scene);
    light.intensity = 1.5;
    light.range = 5000;
    
    const shadowGen = new ShadowGenerator(2048, light);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 32;
  }

  private async setupEnvironment(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    
    try {
      const exrUrl = '/assets/images/citrus_orchard_road_puresky_1k.exr';
      const envTexture = new EXRCubeTexture(exrUrl, this.scene, 512);
      this.scene.environmentTexture = envTexture;
      this.scene.environmentIntensity = 1.2;
      this.scene.createDefaultSkybox(envTexture, true, 5000, 0.3, false);
      console.log('✅ Environment loaded');
    } catch (e) {
      console.warn('⚠️ Environment load failed', e);
    }
  }

  private async createOceanMesh(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    console.log('🌊 Creating ocean mesh...');
    this.oceanMesh = WaterMeshFactory.createWaterMesh('gerstnerWaves', this.scene);

    console.log('📦 Initializing ShaderRegistry...');
    this.shaderRegistry = new ShaderRegistry(this.scene);
    this.shaderRegistry.registerBatch(SHADER_DEFINITIONS);
    console.log('✅ ShaderRegistry initialized with all shader definitions');

    // Apply initial shader
    await this.switchShader('gerstnerWaves');

    // In dev/HMR cycles, recover automatically if the first material attach is lost.
    this.renderHealthCheckHandle = setTimeout(() => {
      this.verifyRenderStateAndRecover();
    }, 300);
  }

  private verifyRenderStateAndRecover(): void {
    if (!this.oceanMesh || !this.shaderRegistry) {
      return;
    }

    const activeId = this.shaderRegistry.getActiveId();
    const material = this.oceanMesh.material;
    const hasMaterial = !!material;
    let isMaterialReady = false;

    if (material) {
      try {
        isMaterialReady = material.isReady(this.oceanMesh);
      } catch (error) {
        console.warn('⚠️ Material readiness check failed', error);
      }
    }

    if (!activeId || !hasMaterial || !isMaterialReady) {
      const fallbackId = activeId ?? this.currentShaderName;
      console.warn(`⚠️ Render health check failed (materialReady=${isMaterialReady}), recovering with shader: ${fallbackId}`);
      void this.switchShader(fallbackId);
      return;
    }

    console.log(`✅ Render health check passed (shader=${activeId})`);
  }

  public async switchShader(shaderName: string): Promise<void> {
    if (!this.oceanMesh || !this.shaderRegistry || !this.scene) {
      console.error('❌ Ocean mesh, shader registry, or scene not initialized');
      return;
    }

    const nextWaterType = parseWaterTypeId(shaderName);

    try {
      // Check if mesh needs to be replaced
      const needsRecreation = WaterMeshFactory.needsMeshRecreation(this.oceanMesh, nextWaterType);

      // Always dispose active material before switching.
      // If mesh is reused, a fresh material will be created on the new context.
      this.shaderRegistry.disposeActiveMaterial();

      if (needsRecreation) {
        console.log(`🔄 Mesh recreation needed for ${nextWaterType}`);
        this.oceanMesh = WaterMeshFactory.replaceWaterMesh(this.oceanMesh, nextWaterType, this.scene);
      }

      // Switch shader in registry
      this.shaderRegistry.switchTo(nextWaterType, this.oceanMesh);
      this.currentShaderName = nextWaterType;
      this.shaderRegistry.setUniforms(filterParameterStateForShader(this.parameterState, nextWaterType));
      this.shaderRegistry.setUniform('time', this.elapsedTime);

      if (!this.oceanMesh.material) {
        throw new Error(`Shader switch completed without material assignment (${nextWaterType})`);
      }

      console.log(`✅ Switched to ${nextWaterType} at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to switch shader: ${error}`);
    }
  }

  public async switchWaterType(waterTypeId: WaterTypeId): Promise<void> {
    return this.switchShader(waterTypeId);
  }

  public updateParameter(key: string, value: number): void {
    this.parameterState[key] = value;

    if (!isParameterSupportedForShader(key, this.currentShaderName)) {
      return;
    }

    this.shaderRegistry?.setUniform(key, value);
  }

  public updateCamera(x: number, y: number, z: number): void {
    if (!this.camera) return;
    this.camera.position = new Vector3(x, y, z);
    this.camera.setTarget(Vector3.Zero());
  }

  public setTopDownView(height: number): void {
    if (!this.camera) return;
    const p = topDownCameraPosition(height);
    this.camera.position = new Vector3(p.x, p.y, p.z);
    this.camera.setTarget(Vector3.Zero());
  }

  public getCurrentShader(): string {
    return this.currentShaderName;
  }

  private updateRuntimeUniforms(): void {
    if (!this.shaderRegistry) return;

    const now = performance.now();
    const deltaTime = Math.max(0, (now - this.lastFrameTimeMs) / 1000);
    this.lastFrameTimeMs = now;
    this.elapsedTime += deltaTime;

    this.shaderRegistry.update(deltaTime);
    this.shaderRegistry.setUniform('time', this.elapsedTime);

    if (this.camera) {
      const p = this.camera.position;
      this.shaderRegistry.setUniform('cameraPosition', [p.x, p.y, p.z]);
    }
  }

  public dispose(): void {
    if (this.renderHealthCheckHandle) {
      clearTimeout(this.renderHealthCheckHandle);
      this.renderHealthCheckHandle = null;
    }
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
