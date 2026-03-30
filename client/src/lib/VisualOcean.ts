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
  MeshBuilder,
  Mesh,
  AbstractMesh,
  Material,
  Vector3,
  Color4,
  Color3,
  TransformNode,
  EXRCubeTexture,
  SceneLoader,
  DepthRenderer,
  StandardMaterial,
  KeyboardEventTypes,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { ShaderRegistry } from './shaders/ShaderRegistry';
import { SHADER_DEFINITIONS } from './shaders/definitions';
import { WaterMeshFactory } from './water/WaterMeshFactory';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: WebGPUEngine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private oceanMesh: Mesh | null = null;
  private shaderRegistry: ShaderRegistry | null = null;
  private currentShaderName: string = 'gerstnerWaves';
  private depthRenderer: DepthRenderer | null = null;

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
    
    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
    
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  private async setupCamera(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.camera = new FreeCamera('camera', new Vector3(0, 50, -100), this.scene);
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
    
    const gridSize = 320;
    const meshSize = 3000;
    this.oceanMesh = MeshBuilder.CreateGround('ocean', {
      width: meshSize,
      height: meshSize,
      subdivisions: gridSize,
    }, this.scene);

    this.oceanMesh.receiveShadows = true;

    console.log('📦 Initializing ShaderRegistry...');
    this.shaderRegistry = new ShaderRegistry(this.scene);
    this.shaderRegistry.registerBatch(SHADER_DEFINITIONS);
    console.log('✅ ShaderRegistry initialized with all shader definitions');

    // Apply initial shader
    await this.switchShader('gerstnerWaves');
  }

  public async switchShader(shaderName: string): Promise<void> {
    if (!this.oceanMesh || !this.shaderRegistry || !this.scene) {
      console.error('❌ Ocean mesh, shader registry, or scene not initialized');
      return;
    }

    try {
      // Check if mesh needs to be replaced
      if (WaterMeshFactory.needsMeshRecreation(this.oceanMesh, shaderName)) {
        console.log(`🔄 Mesh recreation needed for ${shaderName}`);
        this.oceanMesh = WaterMeshFactory.replaceWaterMesh(this.oceanMesh, shaderName, this.scene);
      }

      // Switch shader in registry
      await this.shaderRegistry.switchTo(shaderName, this.oceanMesh);
      this.currentShaderName = shaderName;
      console.log(`✅ Switched to ${shaderName}`);
    } catch (error) {
      console.error(`❌ Failed to switch shader: ${error}`);
    }
  }

  public getCurrentShader(): string {
    return this.currentShaderName;
  }

  public dispose(): void {
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
