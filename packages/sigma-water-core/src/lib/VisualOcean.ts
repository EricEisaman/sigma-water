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
  private boatCollisionCenter = new Vector3(-12, 0.4, -24);
  private islandCollisionCenter = new Vector3(22, 0, 10);
  private boatCollisionRadius = 2.2;
  private islandCollisionRadius = 4.0;
  private boatVerticalVelocity = 0;
  private islandAlignmentOffset = new Vector3(0, 0, 0);
  private showProxySpheres = true;
  private collisionMode = 0;
  private readonly baseCameraSpeed = 0.5;
  private readonly speedBoostMultiplier = 4;
  private isSpeedBoostActive = false;
  private isMoveUpActive = false;
  private isMoveDownActive = false;
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.camera) {
      return;
    }

    if (event.key === 'Shift') {
      if (this.isSpeedBoostActive) {
        return;
      }
      this.isSpeedBoostActive = true;
      this.camera.speed = this.baseCameraSpeed * this.speedBoostMultiplier;
      return;
    }

    if (event.code === 'KeyQ') {
      this.isMoveUpActive = true;
      return;
    }

    if (event.code === 'KeyE') {
      this.isMoveDownActive = true;
    }
  };
  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.camera) {
      return;
    }

    if (event.key === 'Shift') {
      this.isSpeedBoostActive = false;
      this.camera.speed = this.baseCameraSpeed;
      return;
    }

    if (event.code === 'KeyQ') {
      this.isMoveUpActive = false;
      return;
    }

    if (event.code === 'KeyE') {
      this.isMoveDownActive = false;
    }
  };

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
    this.camera.speed = this.baseCameraSpeed;
    this.camera.angularSensibility = 1000;
    this.camera.keysUp = [38, 87];
    this.camera.keysDown = [40, 83];
    this.camera.keysLeft = [37, 65];
    this.camera.keysRight = [39, 68];

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
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

    this.boatRoot.position = new Vector3(-12, this.parameterState.boatYOffset ?? 0.4, -24);
    this.islandRoot.position = new Vector3(22, this.parameterState.islandYOffset ?? 0, 10);

    try {
      const boatResult = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'diving-boat.glb', this.scene);
      this.boatMeshes = boatResult.meshes.filter((m) => m.name !== '__root__');

      const boatSceneRoot =
        boatResult.transformNodes.find((n) => n.name === '__root__')
        ?? boatResult.meshes.find((n) => n.name === '__root__')
        ?? boatResult.transformNodes[0]
        ?? boatResult.meshes[0];

      if (boatSceneRoot) {
        boatSceneRoot.parent = this.boatRoot;
      } else {
        this.boatMeshes.forEach((mesh) => {
          if (!mesh.parent) {
            mesh.parent = this.boatRoot;
          }
        });
      }

      this.alignRootToBoundsCenter(this.boatRoot, this.boatMeshes, this.boatRoot.position.clone());

      if (this.boatCollisionSphere) {
        const boatWorldPos = this.boatRoot.position.clone();
        this.boatRoot.parent = this.boatCollisionSphere;
        this.boatRoot.position = boatWorldPos.subtract(this.boatCollisionSphere.position);
      }

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
      this.alignRootToBoundsCenter(this.islandRoot, this.islandMeshes, this.islandRoot.position.clone());
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
    if (!this.boatRoot || !this.boatCollisionSphere) {
      return;
    }

    const boatX = this.boatCollisionSphere.position.x;
    const boatZ = this.boatCollisionSphere.position.z;

    const boatLength = 8.5;
    const boatWidth = 3.2;
    const baseOffset = this.parameterState.boatYOffset ?? 0.4;

    const centerHeight = this.getWaveHeightAt(boatX, boatZ);
    const frontHeight = this.getWaveHeightAt(boatX, boatZ + boatLength * 0.5);
    const backHeight = this.getWaveHeightAt(boatX, boatZ - boatLength * 0.5);
    const leftHeight = this.getWaveHeightAt(boatX - boatWidth * 0.5, boatZ);
    const rightHeight = this.getWaveHeightAt(boatX + boatWidth * 0.5, boatZ);

    const targetY = centerHeight + baseOffset;
    const springK = 9.0;
    const damping = 4.2;
    const displacement = targetY - this.boatCollisionSphere.position.y;
    const acceleration = displacement * springK - this.boatVerticalVelocity * damping;
    this.boatVerticalVelocity += acceleration * deltaTime;
    this.boatCollisionSphere.position.y += this.boatVerticalVelocity * deltaTime;

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

  private getBoundsData(meshes: AbstractMesh[]): {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    extentX: number;
    extentY: number;
    extentZ: number;
  } | null {
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

    const center = new Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    return {
      min: new Vector3(minX, minY, minZ),
      max: new Vector3(maxX, maxY, maxZ),
      center,
      extentX: maxX - minX,
      extentY: maxY - minY,
      extentZ: maxZ - minZ,
    };
  }

  private alignRootToBoundsCenter(root: TransformNode | null, meshes: AbstractMesh[], targetCenter: Vector3): void {
    if (!root) {
      return;
    }

    const bounds = this.getBoundsData(meshes);
    if (!bounds) {
      return;
    }

    const delta = targetCenter.subtract(bounds.center);
    root.position.addInPlace(delta);
  }

  private updateProxySphereVisibility(): void {
    const show = this.showProxySpheres;
    this.boatCollisionSphere?.setEnabled(show);
    this.islandCollisionSphere?.setEnabled(show);
  }

  private getCurrentSphereCenters(): { boat: Vector3; island: Vector3 } {
    const boat = this.boatCollisionSphere ? this.boatCollisionSphere.position.clone() : this.boatCollisionCenter.clone();
    const island = this.islandCollisionSphere ? this.islandCollisionSphere.position.clone() : this.islandCollisionCenter.clone();
    return { boat, island };
  }

  private logGlbSphereOffsets(): void {
    const { boat: boatSphereCenter, island: islandSphereCenter } = this.getCurrentSphereCenters();
    const boatBounds = this.getBoundsData(this.boatMeshes);
    const islandBounds = this.getBoundsData(this.islandMeshes);

    const boatDelta = boatBounds ? boatSphereCenter.subtract(boatBounds.center) : null;
    const islandDelta = islandBounds ? islandSphereCenter.subtract(islandBounds.center) : null;

    console.log('🧭 GLB to Sphere offsets', {
      collisionMode: this.collisionMode,
      showProxySpheres: this.showProxySpheres,
      boat: {
        sphereCenter: boatSphereCenter.asArray(),
        glbCenter: boatBounds ? boatBounds.center.asArray() : null,
        glbMin: boatBounds ? boatBounds.min.asArray() : null,
        glbMax: boatBounds ? boatBounds.max.asArray() : null,
        delta: boatDelta ? boatDelta.asArray() : null,
        deltaLength: boatDelta ? boatDelta.length() : null,
      },
      island: {
        sphereCenter: islandSphereCenter.asArray(),
        glbCenter: islandBounds ? islandBounds.center.asArray() : null,
        glbMin: islandBounds ? islandBounds.min.asArray() : null,
        glbMax: islandBounds ? islandBounds.max.asArray() : null,
        delta: islandDelta ? islandDelta.asArray() : null,
        deltaLength: islandDelta ? islandDelta.length() : null,
      },
      boatCollisionRadius: this.boatCollisionRadius,
      islandCollisionRadius: this.islandCollisionRadius,
    });
  }

  private moveGlbsToSpheres(): void {
    const { boat: boatSphereCenter, island: islandSphereCenter } = this.getCurrentSphereCenters();
    const boatBounds = this.getBoundsData(this.boatMeshes);
    const islandBounds = this.getBoundsData(this.islandMeshes);

    const boatHasBounds = !!boatBounds;
    const islandHasBounds = !!islandBounds;

    if (boatHasBounds && boatBounds && this.boatRoot) {
      const delta = boatSphereCenter.subtract(boatBounds.center);
      delta.y = 0;
      this.boatRoot.position.addInPlace(delta);
    }

    if (islandHasBounds && islandBounds && this.islandRoot) {
      const delta = islandSphereCenter.subtract(islandBounds.center);
      this.islandAlignmentOffset.addInPlace(delta);
      this.islandRoot.position.addInPlace(delta);
    }

    this.updateCollisionSimulation();
    this.applyCollisionUniforms();
    this.logGlbSphereOffsets();
  }

  private autoCenterGlbsToSpheres(): void {
    if (this.collisionMode !== 0) {
      return;
    }

    const boatTarget = this.boatCollisionSphere?.position.clone();
    const islandTarget = this.islandCollisionSphere?.position.clone();

    if (boatTarget && this.boatRoot) {
      const boatBounds = this.getBoundsData(this.boatMeshes);
      if (boatBounds) {
        const delta = boatTarget.subtract(boatBounds.center);
        delta.y = 0;
        const maxStep = 0.2;
        if (delta.length() > maxStep) {
          delta.normalize().scaleInPlace(maxStep);
        }
        if (delta.lengthSquared() > 0.0001) {
          this.boatRoot.position.addInPlace(delta);
        }
      }
    }

    if (islandTarget && this.islandRoot) {
      const islandBounds = this.getBoundsData(this.islandMeshes);
      if (islandBounds) {
        const delta = islandTarget.subtract(islandBounds.center);
        const maxStep = 0.2;
        if (delta.length() > maxStep) {
          delta.normalize().scaleInPlace(maxStep);
        }
        if (delta.lengthSquared() > 0.0001) {
          this.islandAlignmentOffset.addInPlace(delta);
          this.islandRoot.position.addInPlace(delta);
        }
      }
    }
  }

  private updateCollisionSimulation(): void {
    const waveAmplitude = Math.max(this.parameterState.waveAmplitude ?? 1.8, 0.0);
    const windSpeed = Math.max(this.parameterState.windSpeed ?? 0.6, 0.0);

    const bobAmount = 0.18 + waveAmplitude * 0.08;
    const boatYOffset = this.parameterState.boatYOffset ?? 0.4;
    const islandYOffset = this.parameterState.islandYOffset ?? 0;

    if (this.boatCollisionSphere) {
      this.boatCollisionSphere.position.x = -12 + Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
      this.boatCollisionSphere.position.z = -24 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
      this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
    } else {
      this.boatCollisionCenter.x = -12 + Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
      this.boatCollisionCenter.z = -24 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
      this.boatCollisionCenter.y = boatYOffset + Math.sin(this.elapsedTime * (0.85 + windSpeed * 0.45)) * bobAmount;
    }

    if (this.islandRoot) {
      this.islandRoot.position.x = 22 + this.islandAlignmentOffset.x;
      this.islandRoot.position.z = 10 + this.islandAlignmentOffset.z;
      this.islandRoot.position.y = islandYOffset + this.islandAlignmentOffset.y;
    } else {
      this.islandCollisionCenter.x = 22;
      this.islandCollisionCenter.z = 10;
      this.islandCollisionCenter.y = islandYOffset;
    }

    this.autoCenterGlbsToSpheres();

    if (this.collisionMode === 0) {
      const boatBounds = this.getBoundsData(this.boatMeshes);
      const islandBounds = this.getBoundsData(this.islandMeshes);

      if (boatBounds) {
        if (this.boatCollisionSphere) {
          this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
        } else {
          this.boatCollisionCenter.copyFrom(boatBounds.center);
        }

        const hullRadius = Math.max(boatBounds.extentX, boatBounds.extentZ) * 0.42;
        this.boatCollisionRadius = Math.max(0.45, hullRadius);
      } else {
        if (this.boatCollisionSphere) {
          this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
        }
        this.boatCollisionRadius = Math.max(0.5, 2.2 * (this.parameterState.boatScale ?? 1));
      }

      if (islandBounds) {
        this.islandCollisionCenter.set(
          islandBounds.center.x,
          islandYOffset + this.islandAlignmentOffset.y,
          islandBounds.center.z
        );

        const shorelineRadius = (islandBounds.extentX + islandBounds.extentZ) * 0.25;
        this.islandCollisionRadius = Math.max(1.0, shorelineRadius);
      } else {
        if (this.islandRoot) {
          this.islandCollisionCenter.copyFrom(this.islandRoot.position);
        }
        this.islandCollisionRadius = Math.max(1.0, 4.0 * (this.parameterState.islandScale ?? 1));
      }
    } else {
      if (this.boatCollisionSphere) {
        this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
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
      this.logGlbSphereOffsets();
      return;
    }

    if (key === 'moveGlbsToSpheres' && value >= 0.5) {
      this.moveGlbsToSpheres();
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
      if (this.isMoveUpActive || this.isMoveDownActive) {
        const moveDir = (this.isMoveUpActive ? 1 : 0) - (this.isMoveDownActive ? 1 : 0);
        if (moveDir !== 0) {
          const verticalSpeed = this.camera.speed * 12.0;
          this.camera.position.y += moveDir * verticalSpeed * deltaTime;
        }
      }

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
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
