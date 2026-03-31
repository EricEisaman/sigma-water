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
  SceneLoader,
  Mesh,
  AbstractMesh,
  TransformNode,
  Quaternion,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  Color3,
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
  private boatRoot: TransformNode | null = null;
  private islandRoot: TransformNode | null = null;
  private boatMeshes: AbstractMesh[] = [];
  private islandMeshes: AbstractMesh[] = [];
  private boatCollisionSphere: Mesh | null = null;
  private islandCollisionSphere: Mesh | null = null;
  private boatCollisionCenter = new Vector3(0, 0.4, -12);
  private islandCollisionCenter = new Vector3(22, 0, 10);
  private boatCollisionRadius = 2.2;
  private islandCollisionRadius = 4.0;
  private showProxySpheres = true;
  private collisionMode = 0;

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
    await this.setupSceneObjects();
    
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

    this.setupCollisionDebugProxies();

    // Apply initial shader
    await this.switchShader('gerstnerWaves');

    // In dev/HMR cycles, recover automatically if the first material attach is lost.
    this.renderHealthCheckHandle = setTimeout(() => {
      this.verifyRenderStateAndRecover();
    }, 300);
  }

  private setupCollisionDebugProxies(): void {
    if (!this.scene) {
      return;
    }

    const boatSphere = MeshBuilder.CreateSphere('boatCollisionSphere', { diameter: 1, segments: 24 }, this.scene);
    const islandSphere = MeshBuilder.CreateSphere('islandCollisionSphere', { diameter: 1, segments: 24 }, this.scene);

    const boatMat = new StandardMaterial('boatCollisionSphereMaterial', this.scene);
    boatMat.diffuseColor = new Color3(0.95, 0.35, 0.25);
    boatMat.emissiveColor = new Color3(0.6, 0.12, 0.08);
    boatMat.alpha = 0.35;

    const islandMat = new StandardMaterial('islandCollisionSphereMaterial', this.scene);
    islandMat.diffuseColor = new Color3(0.95, 0.7, 0.2);
    islandMat.emissiveColor = new Color3(0.4, 0.24, 0.07);
    islandMat.alpha = 0.35;

    boatSphere.material = boatMat;
    islandSphere.material = islandMat;

    this.boatCollisionSphere = boatSphere;
    this.islandCollisionSphere = islandSphere;

    this.updateCollisionSimulation();
    this.updateProxySphereVisibility();
  }

  private async setupSceneObjects(): Promise<void> {
    if (!this.scene) {
      return;
    }

    this.boatRoot = new TransformNode('boatRoot', this.scene);
    this.islandRoot = new TransformNode('islandRoot', this.scene);

    this.boatRoot.position = new Vector3(0, this.parameterState.boatYOffset ?? 0.4, -12);
    this.islandRoot.position = new Vector3(22, this.parameterState.islandYOffset ?? 0, 10);

    try {
      const boatResult = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'diving-boat.glb', this.scene);
      this.boatMeshes = boatResult.meshes.filter((m) => m.name !== '__root__');
      this.boatMeshes.forEach((mesh) => {
        if (!mesh.parent) {
          mesh.parent = this.boatRoot;
        }
      });
      console.log('✅ Boat GLB loaded');
    } catch (error) {
      console.warn('⚠️ Boat GLB load failed, using proxy-only boat collision', error);
    }

    try {
      const islandResult = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'island.glb', this.scene);
      this.islandMeshes = islandResult.meshes.filter((m) => m.name !== '__root__');
      this.islandMeshes.forEach((mesh) => {
        if (!mesh.parent) {
          mesh.parent = this.islandRoot;
        }
      });
      console.log('✅ Island GLB loaded');
    } catch (error) {
      console.warn('⚠️ Island GLB load failed, using proxy-only island collision', error);
    }

    this.applyObjectScales();
    this.updateCollisionSimulation();
  }

  private getWaveHeightAt(x: number, z: number): number {
    const waveAmplitude = Math.max(this.parameterState.waveAmplitude ?? 1.8, 0.05) * 0.42;
    const waveFrequency = Math.max(this.parameterState.waveFrequency ?? 1.2, 0.12) * 0.78;
    const windDirectionDeg = this.parameterState.windDirection ?? 45;
    const windSpeed = Math.max(this.parameterState.windSpeed ?? 0.6, 0.05);

    const angle = windDirectionDeg * 0.017453292519943295;
    const windDir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const crossDir = new Vector3(-windDir.z, 0, windDir.x);
    const rippleDir = windDir.add(crossDir.scale(0.35)).normalize();

    const xzWind = x * windDir.x + z * windDir.z;
    const xzCross = x * crossDir.x + z * crossDir.z;
    const xzRipple = x * rippleDir.x + z * rippleDir.z;

    const swellPhase = xzWind * waveFrequency + this.elapsedTime * (0.22 + windSpeed * 0.34);
    const mediumPhase = xzCross * (waveFrequency * 1.65) - this.elapsedTime * (0.44 + windSpeed * 0.58);
    const ripplePhase = xzRipple * (waveFrequency * 2.5) + this.elapsedTime * (0.95 + windSpeed * 1.05);

    const swell = Math.sin(swellPhase) * waveAmplitude;
    const mediumWave = Math.sin(mediumPhase) * waveAmplitude * (0.42 + windSpeed * 0.1);
    const ripples = Math.sin(ripplePhase) * waveAmplitude * (0.16 + windSpeed * 0.06);

    return swell + mediumWave + ripples;
  }

  private applyBoatFlotation(deltaTime: number): void {
    if (!this.boatRoot) {
      return;
    }

    const boatX = this.boatRoot.position.x;
    const boatZ = this.boatRoot.position.z;

    const boatLength = 8.5;
    const boatWidth = 3.2;
    const baseOffset = this.parameterState.boatYOffset ?? 0.4;

    const centerHeight = this.getWaveHeightAt(boatX, boatZ);
    const frontHeight = this.getWaveHeightAt(boatX, boatZ + boatLength * 0.5);
    const backHeight = this.getWaveHeightAt(boatX, boatZ - boatLength * 0.5);
    const leftHeight = this.getWaveHeightAt(boatX - boatWidth * 0.5, boatZ);
    const rightHeight = this.getWaveHeightAt(boatX + boatWidth * 0.5, boatZ);

    const targetY = centerHeight + baseOffset;
    const smoothing = Math.min(deltaTime * 4.5, 1.0);
    this.boatRoot.position.y += (targetY - this.boatRoot.position.y) * smoothing;

    const pitch = Math.atan2(frontHeight - backHeight, boatLength) * 0.72;
    const roll = Math.atan2(rightHeight - leftHeight, boatWidth) * 0.68;
    const yaw = Math.sin(this.elapsedTime * 0.15) * 0.08;

    const targetRotation = Quaternion.RotationYawPitchRoll(yaw, pitch, -roll);
    if (!this.boatRoot.rotationQuaternion) {
      this.boatRoot.rotationQuaternion = targetRotation;
    } else {
      this.boatRoot.rotationQuaternion = Quaternion.Slerp(this.boatRoot.rotationQuaternion, targetRotation, Math.min(deltaTime * 4.0, 1.0));
    }
  }

  private applyObjectScales(): void {
    const boatScale = this.parameterState.boatScale ?? 1;
    const islandScale = this.parameterState.islandScale ?? 1;

    if (this.boatRoot) {
      this.boatRoot.scaling = new Vector3(boatScale, boatScale, boatScale);
    }

    if (this.islandRoot) {
      this.islandRoot.scaling = new Vector3(islandScale, islandScale, islandScale);
    }
  }

  private tryUpdateFromBounds(meshes: AbstractMesh[], outCenter: Vector3): number | null {
    if (meshes.length === 0) {
      return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const mesh of meshes) {
      if (!mesh.isEnabled()) {
        continue;
      }
      const bounds = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bounds.minimumWorld.x);
      minY = Math.min(minY, bounds.minimumWorld.y);
      minZ = Math.min(minZ, bounds.minimumWorld.z);
      maxX = Math.max(maxX, bounds.maximumWorld.x);
      maxY = Math.max(maxY, bounds.maximumWorld.y);
      maxZ = Math.max(maxZ, bounds.maximumWorld.z);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return null;
    }

    outCenter.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    const extentX = maxX - minX;
    const extentZ = maxZ - minZ;
    return Math.max(extentX, extentZ) * 0.5;
  }

  private updateProxySphereVisibility(): void {
    const show = this.showProxySpheres;
    this.boatCollisionSphere?.setEnabled(show);
    this.islandCollisionSphere?.setEnabled(show);
  }

  private updateCollisionSimulation(): void {
    const waveAmplitude = Math.max(this.parameterState.waveAmplitude ?? 1.8, 0.0);
    const windSpeed = Math.max(this.parameterState.windSpeed ?? 0.6, 0.0);

    const bobAmount = 0.18 + waveAmplitude * 0.08;
    const boatYOffset = this.parameterState.boatYOffset ?? 0.4;
    const islandYOffset = this.parameterState.islandYOffset ?? 0;

    if (this.boatRoot) {
      this.boatRoot.position.x = Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
      this.boatRoot.position.z = -12 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
      this.boatRoot.position.y += Math.sin(this.elapsedTime * (0.85 + windSpeed * 0.45)) * bobAmount * 0.02;
    } else {
      this.boatCollisionCenter.x = Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
      this.boatCollisionCenter.z = -12 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
      this.boatCollisionCenter.y = boatYOffset + Math.sin(this.elapsedTime * (0.85 + windSpeed * 0.45)) * bobAmount;
    }

    if (this.islandRoot) {
      this.islandRoot.position.x = 22;
      this.islandRoot.position.z = 10;
      this.islandRoot.position.y = islandYOffset;
    } else {
      this.islandCollisionCenter.x = 22;
      this.islandCollisionCenter.z = 10;
      this.islandCollisionCenter.y = islandYOffset;
    }

    if (this.collisionMode === 0) {
      const boatRadiusFromBounds = this.tryUpdateFromBounds(this.boatMeshes, this.boatCollisionCenter);
      const islandRadiusFromBounds = this.tryUpdateFromBounds(this.islandMeshes, this.islandCollisionCenter);

      this.boatCollisionRadius = boatRadiusFromBounds ?? Math.max(0.5, 2.2 * (this.parameterState.boatScale ?? 1));
      this.islandCollisionRadius = islandRadiusFromBounds ?? Math.max(1.0, 4.0 * (this.parameterState.islandScale ?? 1));
    } else {
      if (this.boatRoot) {
        this.boatCollisionCenter.copyFrom(this.boatRoot.position);
      }
      if (this.islandRoot) {
        this.islandCollisionCenter.copyFrom(this.islandRoot.position);
      }
      this.boatCollisionRadius = Math.max(0.5, 2.2 * (this.parameterState.boatScale ?? 1));
      this.islandCollisionRadius = Math.max(1.0, 4.0 * (this.parameterState.islandScale ?? 1));
    }

    if (this.boatCollisionSphere) {
      this.boatCollisionSphere.position.copyFrom(this.boatCollisionCenter);
      const boatDiameter = this.boatCollisionRadius * 2;
      this.boatCollisionSphere.scaling = new Vector3(boatDiameter, boatDiameter, boatDiameter);
    }

    if (this.islandCollisionSphere) {
      this.islandCollisionSphere.position.copyFrom(this.islandCollisionCenter);
      const islandDiameter = this.islandCollisionRadius * 2;
      this.islandCollisionSphere.scaling = new Vector3(islandDiameter, islandDiameter, islandDiameter);
    }
  }

  private applyCollisionUniforms(): void {
    if (!this.shaderRegistry) {
      return;
    }

    this.shaderRegistry.setUniform('boatCollisionCenter', [this.boatCollisionCenter.x, this.boatCollisionCenter.y, this.boatCollisionCenter.z]);
    this.shaderRegistry.setUniform('islandCollisionCenter', [this.islandCollisionCenter.x, this.islandCollisionCenter.y, this.islandCollisionCenter.z]);
    this.shaderRegistry.setUniform('boatCollisionRadius', this.boatCollisionRadius);
    this.shaderRegistry.setUniform('islandCollisionRadius', this.islandCollisionRadius);
    this.shaderRegistry.setUniform('collisionFoamStrength', this.collisionMode === 1 ? 1.2 : 1.0);
  }

  private verifyRenderStateAndRecover(): void {
    if (!this.oceanMesh || !this.shaderRegistry) {
      return;
    }

    const activeId = this.shaderRegistry.getActiveId();
    const hasMaterial = !!this.oceanMesh.material;

    if (!activeId || !hasMaterial) {
      const fallbackId = activeId ?? this.currentShaderName;
      console.warn(`⚠️ Render health check failed, recovering with shader: ${fallbackId}`);
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
      this.applyCollisionUniforms();

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

    if (key === 'showProxySpheres') {
      this.showProxySpheres = value >= 0.5;
      this.updateProxySphereVisibility();
      return;
    }

    if (key === 'collisionMode') {
      this.collisionMode = value >= 0.5 ? 1 : 0;
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'boatScale') {
      this.applyObjectScales();
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'islandScale') {
      this.applyObjectScales();
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'boatYOffset' || key === 'islandYOffset') {
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'waveAmplitude' || key === 'waveFrequency' || key === 'windDirection' || key === 'windSpeed') {
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
    }

    if (key === 'logSiblingOffsets' && value >= 0.5) {
      console.log('🧭 Proxy spheres', {
        showProxySpheres: this.showProxySpheres,
        boatCollisionCenter: this.boatCollisionCenter.asArray(),
        islandCollisionCenter: this.islandCollisionCenter.asArray(),
        boatCollisionRadius: this.boatCollisionRadius,
        islandCollisionRadius: this.islandCollisionRadius,
      });
      return;
    }

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

    this.updateCollisionSimulation();
    this.applyBoatFlotation(deltaTime);
    this.shaderRegistry.update(deltaTime);
    this.shaderRegistry.setUniform('time', this.elapsedTime);
    this.applyCollisionUniforms();

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
    this.boatCollisionSphere?.dispose();
    this.islandCollisionSphere?.dispose();
    this.boatCollisionSphere = null;
    this.islandCollisionSphere = null;
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
