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
  Constants,
  RawTexture,
  Texture,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { parseWaterTypeId, type WaterTypeId } from '../water/WaterTypeRegistry';
import { normalizeBoatModelId, isIslandModelId, type BoatModelId, type IslandModelId } from '../models/objectModels';
import { ShaderRegistry } from './shaders/ShaderRegistry';
import { SHADER_DEFINITIONS } from './shaders/definitions';
import { filterParameterStateForShader, isParameterSupportedForShader } from './water/ShaderParameterFilter';
import { WaterMeshFactory } from './water/WaterMeshFactory';
import { boostedCameraSpeed, topDownCameraPosition } from './camera';
import { buildIntersectionFoamField } from './water/IntersectionFoamField';

export interface VisualOceanConfig {
  assetBaseUrl?: string;
  environmentMapPath?: string;
  modelsBasePath?: string;
  enableGlobalListeners?: boolean;
}

const BOAT_MODEL_FILES: Record<BoatModelId, string> = {
  divingBoat: 'diving-boat.glb',
  zodiacBoat: 'zodiac-boat.glb',
};

const ISLAND_MODEL_FILES: Record<IslandModelId, string> = {
  boathouseIsland: 'island.glb',
  lighthouseIsland: 'lighthouse-island.glb',
};

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private config: Required<VisualOceanConfig>;
  private engine: WebGPUEngine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private oceanMesh: Mesh | null = null;
  private shaderRegistry: ShaderRegistry | null = null;
  private currentShaderName: WaterTypeId = 'gerstnerWaves';
  private depthRenderer: DepthRenderer | null = null;
  private parameterState: Record<string, number> = {};
  private lastFrameTimeMs = 0;
  private lastAdaptiveRetierCheckMs = 0;
  private elapsedTime = 0;
  private hasLoggedFirstFrame = false;
  private boatRoot: TransformNode | null = null;
  private islandRoot: TransformNode | null = null;
  private boatMeshes: AbstractMesh[] = [];
  private islandMeshes: AbstractMesh[] = [];
  private boatModelNodes: Array<AbstractMesh | TransformNode> = [];
  private islandModelNodes: Array<AbstractMesh | TransformNode> = [];
  private boatCollisionSphere: Mesh | null = null;
  private islandCollisionSphere: Mesh | null = null;
  private boatModelId: BoatModelId = 'divingBoat';
  private islandModelId: IslandModelId = 'boathouseIsland';
  private boatModelLoading = false;
  private pendingBoatModel: BoatModelId | null = null;
  private islandModelLoading = false;
  private pendingIslandModel: IslandModelId | null = null;
  private boatCollisionCenter = new Vector3(-12, 0.4, -24);
  private islandCollisionCenter = new Vector3(22, 0, 10);
  private boatCollisionRadius = 2.2;
  private islandCollisionRadius = 4.0;
  private boatIntersectionFactor = 0;
  private islandIntersectionFactor = 0;
  private boatIntersectionFoamTexture: RawTexture | null = null;
  private islandIntersectionFoamTexture: RawTexture | null = null;
  private boatIntersectionFoamFieldBounds: [number, number, number, number] = [-16, -28, 8, 8];
  private islandIntersectionFoamFieldBounds: [number, number, number, number] = [16, 4, 12, 12];
  private boatIntersectionFoamFieldBoundsBase: [number, number, number, number] = [-16, -28, 8, 8];
  private islandIntersectionFoamFieldBoundsBase: [number, number, number, number] = [16, 4, 12, 12];
  private boatIntersectionFoamFieldBakeCenterXZ: [number, number] = [-12, -24];
  private islandIntersectionFoamFieldBakeCenterXZ: [number, number] = [22, 10];
  private boatIntersectionFoamFieldMaxDistance = 6;
  private islandIntersectionFoamFieldMaxDistance = 8;
  private boatIntersectionFoamFieldValid = 0;
  private islandIntersectionFoamFieldValid = 0;
  private boatIntersectionFoamFieldCacheKey: string | null = null;
  private islandIntersectionFoamFieldCacheKey: string | null = null;
  private underwaterFactor = 0;
  private boatVerticalVelocity = 0;
  private islandAlignmentOffset = new Vector3(0, 0, 0);
  private showProxySpheres = false;
  private collisionMode = 0;
  private readonly baseCameraSpeed = 0.5;
  private readonly speedBoostMultiplier = 4;
  private isSpeedBoostActive = false;
  private isMoveUpActive = false;
  private isMoveDownActive = false;
  private readonly handleResize = (): void => {
    this.engine?.resize();
  };
  private applySpeedBoostState(active: boolean): void {
    this.isSpeedBoostActive = active;
    if (!this.camera) {
      return;
    }
    this.camera.speed = boostedCameraSpeed(this.baseCameraSpeed, active, this.speedBoostMultiplier);
  }
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.camera) {
      return;
    }

    if (event.key === 'Shift') {
      if (this.isSpeedBoostActive) {
        return;
      }
      this.applySpeedBoostState(true);
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
      if (!this.isSpeedBoostActive) {
        return;
      }
      this.applySpeedBoostState(false);
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

  constructor(canvas: HTMLCanvasElement, config: VisualOceanConfig = {}) {
    this.canvas = canvas;
    const assetBaseUrl = config.assetBaseUrl ?? '/assets';
    this.config = {
      assetBaseUrl,
      environmentMapPath: config.environmentMapPath ?? `${assetBaseUrl}/images/citrus_orchard_road_puresky_1k.exr`,
      modelsBasePath: config.modelsBasePath ?? `${assetBaseUrl}/models/`,
      enableGlobalListeners: config.enableGlobalListeners ?? true,
    };
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
    
    if (this.config.enableGlobalListeners) {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private async setupCamera(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.camera = new FreeCamera('camera', new Vector3(0, 50, -100), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.1;
    this.camera.maxZ = 20000;
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(this.canvas, true);
    this.camera.speed = this.baseCameraSpeed;
    this.camera.angularSensibility = 1000;
    this.camera.keysUp = [38, 87];
    this.camera.keysDown = [40, 83];
    this.camera.keysLeft = [37, 65];
    this.camera.keysRight = [39, 68];

    // Keep camera speed coherent if boost state changed before camera setup completed.
    this.applySpeedBoostState(this.isSpeedBoostActive);

    if (this.config.enableGlobalListeners) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
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
      const envTexture = new EXRCubeTexture(this.config.environmentMapPath, this.scene, 512);
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
    const cameraPos = this.camera?.position;
    this.oceanMesh = WaterMeshFactory.createWaterMesh(
      'gerstnerWaves',
      this.scene,
      cameraPos ? { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z } : undefined
    );

    console.log('📦 Initializing ShaderRegistry...');
    this.shaderRegistry = new ShaderRegistry(this.scene);
    this.shaderRegistry.registerBatch(SHADER_DEFINITIONS);
    console.log('✅ ShaderRegistry initialized with all shader definitions');

    this.ensureIntersectionFoamFieldTextures();

    this.setupCollisionDebugProxies();

    // Apply initial shader
    await this.switchShader('gerstnerWaves');

    // Event-driven first-frame health check to recover material loss during dev/HMR.
    this.scene.onAfterRenderObservable.addOnce(() => {
      this.verifyRenderStateAndRecover();
    });
  }

  private createFallbackIntersectionFoamTexture(name: string): RawTexture | null {
    if (!this.scene) {
      return null;
    }

    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = new RawTexture(
      data,
      1,
      1,
      Constants.TEXTUREFORMAT_RGBA,
      this.scene,
      false,
      false,
      Texture.BILINEAR_SAMPLINGMODE,
      Constants.TEXTURETYPE_UNSIGNED_BYTE
    );
    texture.name = name;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    return texture;
  }

  private ensureIntersectionFoamFieldTextures(): void {
    if (!this.boatIntersectionFoamTexture) {
      this.boatIntersectionFoamTexture = this.createFallbackIntersectionFoamTexture('boatIntersectionFoamFieldFallback');
    }
    if (!this.islandIntersectionFoamTexture) {
      this.islandIntersectionFoamTexture = this.createFallbackIntersectionFoamTexture('islandIntersectionFoamFieldFallback');
    }
  }

  private resolveLiveFoamFieldBounds(
    baseBounds: [number, number, number, number],
    bakeCenterXZ: [number, number],
    meshes: AbstractMesh[]
  ): [number, number, number, number] {
    const live = this.getBoundsData(meshes);
    if (!live) {
      return [...baseBounds] as [number, number, number, number];
    }

    const dx = live.center.x - bakeCenterXZ[0];
    const dz = live.center.z - bakeCenterXZ[1];
    return [baseBounds[0] + dx, baseBounds[1] + dz, baseBounds[2], baseBounds[3]];
  }

  private rebuildBoatIntersectionFoamField(): void {
    if (!this.scene) {
      return;
    }

    const boatScale = this.parameterState.boatScale ?? 1;
    const boatBounds = this.getBoundsData(this.boatMeshes);
    const nextKey = boatBounds
      ? `${this.boatModelId}|${boatScale.toFixed(4)}|${boatBounds.extentX.toFixed(3)}|${boatBounds.extentY.toFixed(3)}|${boatBounds.extentZ.toFixed(3)}`
      : `${this.boatModelId}|${boatScale.toFixed(4)}|empty`;
    if (this.boatIntersectionFoamFieldCacheKey === nextKey) {
      return;
    }

    const field = buildIntersectionFoamField({
      scene: this.scene,
      meshes: this.boatMeshes,
      resolution: 256,
      textureName: 'boatIntersectionFoamField',
    });

    if (!field) {
      this.boatIntersectionFoamFieldCacheKey = nextKey;
      this.boatIntersectionFoamFieldValid = 0;
      console.warn('⚠️ Boat intersection foam field build failed; mesh-based intersection foam disabled for boat', {
        modelId: this.boatModelId,
        meshCount: this.boatMeshes.length,
        cacheKey: nextKey,
      });
      this.ensureIntersectionFoamFieldTextures();
      return;
    }

    this.boatIntersectionFoamTexture?.dispose();
    this.boatIntersectionFoamTexture = field.texture;
    this.boatIntersectionFoamFieldBounds = field.bounds;
    this.boatIntersectionFoamFieldBoundsBase = field.bounds;
    if (boatBounds) {
      this.boatIntersectionFoamFieldBakeCenterXZ = [boatBounds.center.x, boatBounds.center.z];
    }
    this.boatIntersectionFoamFieldMaxDistance = field.maxDistance;
    this.boatIntersectionFoamFieldValid = 1;
    this.boatIntersectionFoamFieldCacheKey = nextKey;
  }

  private rebuildIslandIntersectionFoamField(): void {
    if (!this.scene) {
      return;
    }

    const islandScale = this.parameterState.islandScale ?? 1;
    const islandBounds = this.getBoundsData(this.islandMeshes);
    const nextKey = islandBounds
      ? `${this.islandModelId}|${islandScale.toFixed(4)}|${islandBounds.extentX.toFixed(3)}|${islandBounds.extentY.toFixed(3)}|${islandBounds.extentZ.toFixed(3)}`
      : `${this.islandModelId}|${islandScale.toFixed(4)}|empty`;
    if (this.islandIntersectionFoamFieldCacheKey === nextKey) {
      return;
    }

    const field = buildIntersectionFoamField({
      scene: this.scene,
      meshes: this.islandMeshes,
      resolution: 384,
      textureName: 'islandIntersectionFoamField',
    });

    if (!field) {
      this.islandIntersectionFoamFieldCacheKey = nextKey;
      this.islandIntersectionFoamFieldValid = 0;
      console.warn('⚠️ Island intersection foam field build failed; mesh-based intersection foam disabled for island', {
        modelId: this.islandModelId,
        meshCount: this.islandMeshes.length,
        cacheKey: nextKey,
      });
      this.ensureIntersectionFoamFieldTextures();
      return;
    }

    this.islandIntersectionFoamTexture?.dispose();
    this.islandIntersectionFoamTexture = field.texture;
    this.islandIntersectionFoamFieldBounds = field.bounds;
    this.islandIntersectionFoamFieldBoundsBase = field.bounds;
    if (islandBounds) {
      this.islandIntersectionFoamFieldBakeCenterXZ = [islandBounds.center.x, islandBounds.center.z];
    }
    this.islandIntersectionFoamFieldMaxDistance = field.maxDistance;
    this.islandIntersectionFoamFieldValid = 1;
    this.islandIntersectionFoamFieldCacheKey = nextKey;
  }

  private rebuildIntersectionFoamFields(): void {
    this.rebuildBoatIntersectionFoamField();
    this.rebuildIslandIntersectionFoamField();
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

    if (this.boatCollisionSphere) {
      this.boatRoot.parent = this.boatCollisionSphere;
      this.boatRoot.position = Vector3.Zero();
    }

    await this.loadBoatModel(this.boatModelId);
    await this.loadIslandModel(this.islandModelId);

    this.applyObjectScales();
    this.rebuildIntersectionFoamFields();
    this.updateCollisionSimulation();
  }

  private disposeModelNodes(nodes: Array<AbstractMesh | TransformNode>): void {
    const uniqueNodes = Array.from(new Set(nodes));
    for (const node of uniqueNodes.reverse()) {
      node.dispose(false, true);
    }
  }

  private getModelRoot(
    result: Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>,
    fallbackRoot: TransformNode
  ): AbstractMesh | TransformNode | null {
    return result.transformNodes.find((n) => n.name === '__root__')
      ?? result.meshes.find((n) => n.name === '__root__')
      ?? result.transformNodes[0]
      ?? result.meshes[0]
      ?? fallbackRoot;
  }

  private getBoatAnchorCenter(): Vector3 {
    const boatBounds = this.getBoundsData(this.boatMeshes);
    if (boatBounds) {
      return boatBounds.center.clone();
    }
    if (this.boatCollisionSphere) {
      return this.boatCollisionSphere.position.clone();
    }
    return new Vector3(-12, this.parameterState.boatYOffset ?? 0.4, -24);
  }

  private getIslandAnchorCenter(): Vector3 {
    const islandBounds = this.getBoundsData(this.islandMeshes);
    if (islandBounds) {
      return islandBounds.center.clone();
    }
    return this.islandRoot?.getAbsolutePosition().clone() ?? new Vector3(22, this.parameterState.islandYOffset ?? 0, 10);
  }

  private async loadBoatModel(modelId: BoatModelId): Promise<void> {
    if (!this.scene || !this.boatRoot) {
      return;
    }

    const anchorCenter = this.getBoatAnchorCenter();
    const previousBoatModelNodes = this.boatModelNodes;
    const previousBoatMeshes = this.boatMeshes;

    try {
      const boatResult = await SceneLoader.ImportMeshAsync('', this.config.modelsBasePath, BOAT_MODEL_FILES[modelId], this.scene);
      const nextBoatMeshes = boatResult.meshes.filter((m) => m.name !== '__root__');
      const boatSceneRoot = this.getModelRoot(boatResult, this.boatRoot);

      if (boatSceneRoot && boatSceneRoot !== this.boatRoot) {
        boatSceneRoot.parent = this.boatRoot;
      } else {
        nextBoatMeshes.forEach((mesh) => {
          if (!mesh.parent) {
            mesh.parent = this.boatRoot;
          }
        });
      }

      const nextBoatModelNodes = [
        ...boatResult.transformNodes.filter((node) => node !== this.boatRoot),
        ...boatResult.meshes.filter((mesh) => mesh !== this.boatRoot),
      ];

      this.boatMeshes = nextBoatMeshes;
      this.boatModelNodes = nextBoatModelNodes;

      this.disposeModelNodes(previousBoatModelNodes);

      this.alignRootToBoundsCenter(this.boatRoot, this.boatMeshes, anchorCenter);
      this.applyObjectScales();
      this.rebuildBoatIntersectionFoamField();
      this.boatModelId = modelId;
      console.log(`✅ Boat GLB loaded (${BOAT_MODEL_FILES[modelId]})`);
    } catch (error) {
      this.boatMeshes = previousBoatMeshes;
      this.boatModelNodes = previousBoatModelNodes;
      console.warn(`⚠️ Boat GLB load failed (${BOAT_MODEL_FILES[modelId]}), using proxy-only boat collision`, error);
    }
  }

  private async loadIslandModel(modelId: IslandModelId): Promise<void> {
    if (!this.scene || !this.islandRoot) {
      return;
    }

    const anchorCenter = this.getIslandAnchorCenter();
    this.disposeModelNodes(this.islandModelNodes);
    this.islandModelNodes = [];
    this.islandMeshes = [];

    try {
      const islandResult = await SceneLoader.ImportMeshAsync('', this.config.modelsBasePath, ISLAND_MODEL_FILES[modelId], this.scene);
      this.islandMeshes = islandResult.meshes.filter((m) => m.name !== '__root__');
      const islandSceneRoot = this.getModelRoot(islandResult, this.islandRoot);

      if (islandSceneRoot && islandSceneRoot !== this.islandRoot) {
        islandSceneRoot.parent = this.islandRoot;
      } else {
        this.islandMeshes.forEach((mesh) => {
          if (!mesh.parent) {
            mesh.parent = this.islandRoot;
          }
        });
      }

      this.islandModelNodes = [
        ...islandResult.transformNodes.filter((node) => node !== this.islandRoot),
        ...islandResult.meshes.filter((mesh) => mesh !== this.islandRoot),
      ];

      this.alignRootToBoundsCenter(this.islandRoot, this.islandMeshes, anchorCenter);
      this.applyObjectScales();
      this.rebuildIslandIntersectionFoamField();
      this.islandModelId = modelId;
      console.log(`✅ Island GLB loaded (${ISLAND_MODEL_FILES[modelId]})`);
    } catch (error) {
      console.warn(`⚠️ Island GLB load failed (${ISLAND_MODEL_FILES[modelId]}), using proxy-only island collision`, error);
    }
  }

  private getWaveHeightAt(x: number, z: number): number {
    const waveAmplitude = Math.max(this.parameterState.waveAmplitude ?? 1.8, 0.05) * 0.42;
    const waveFrequency = Math.max(this.parameterState.waveFrequency ?? 1.2, 0.12) * 0.78;
    const windDirectionDeg = this.parameterState.windDirection ?? 45;
    const windSpeed = Math.max(this.parameterState.windSpeed ?? 0.6, 0.05);

    const angle = windDirectionDeg * 0.017453292519943295;
    const windDir = new Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
    const crossDir = new Vector3(-windDir.z, 0, windDir.x).normalize();
    const dirA = windDir;
    const dirB = windDir.scale(0.9).add(crossDir.scale(0.42)).normalize();
    const dirC = windDir.scale(0.64).add(crossDir.scale(-0.78)).normalize();
    const dirD = crossDir.scale(0.98).add(windDir.scale(0.18)).normalize();
    const dirE = crossDir.scale(-0.82).add(windDir.scale(0.42)).normalize();
    const dirF = windDir.scale(-0.3).add(crossDir.scale(0.95)).normalize();

    const travel = 0.24 + windSpeed * 0.36;
    const pA = (x * dirA.x + z * dirA.z) * (waveFrequency * 0.86) - this.elapsedTime * (travel * 0.88);
    const pB = (x * dirB.x + z * dirB.z) * (waveFrequency * 1.12) - this.elapsedTime * (travel * 1.16) + 1.7;
    const pC = (x * dirC.x + z * dirC.z) * (waveFrequency * 1.44) - this.elapsedTime * (travel * 1.36) + 4.2;
    const pD = (x * dirD.x + z * dirD.z) * (waveFrequency * 1.82) - this.elapsedTime * (travel * 1.72) + 2.3;
    const pE = (x * dirE.x + z * dirE.z) * (waveFrequency * 2.08) - this.elapsedTime * (travel * 2.04) + 5.1;
    const pF = (x * dirF.x + z * dirF.z) * (waveFrequency * 2.42) - this.elapsedTime * (travel * 2.36) + 0.9;

    const crestness = Math.min(Math.max(0.22 + windSpeed * 0.58, 0.0), 1.0);
    const crestWave = (phase: number, asym: number): number => {
      const s = Math.sin(phase);
      const crest = Math.max(s, 0);
      const trough = Math.min(s, 0);
      const sharpened = crest * (1 + crest * (0.65 + asym * 0.55));
      return trough * (1 - asym * 0.35) + sharpened;
    };

    const wA = crestWave(pA, crestness) * waveAmplitude * 0.28;
    const wB = crestWave(pB, crestness * 0.9) * waveAmplitude * 0.22;
    const wC = crestWave(pC, crestness * 0.75) * waveAmplitude * 0.18;
    const wD = crestWave(pD, crestness * 0.62) * waveAmplitude * 0.14;
    const wE = Math.sin(pE) * waveAmplitude * 0.1;
    const wF = Math.sin(pF) * waveAmplitude * 0.08;
    const interference = (
      Math.sin((pA - pC) * 0.63)
      + Math.sin((pB - pD) * 0.57)
      + Math.sin((pE - pF) * 0.71)
    ) * waveAmplitude * 0.03;

    return wA + wB + wC + wD + wE + wF + interference;
  }

  private applyBoatFlotation(deltaTime: number): void {
    if (!this.boatRoot || !this.boatCollisionSphere) {
      return;
    }

    // In GLB geometry collision mode we derive contact from mesh bounds each frame.
    // Avoid proxy-driven spring updates here, otherwise parent/proxy feedback can jitter.
    if (this.collisionMode === 0) {
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
    const boatAnchor = this.getBoundsData(this.boatMeshes)?.center ?? this.getBoatAnchorCenter();
    const islandAnchor = this.getBoundsData(this.islandMeshes)?.center ?? this.getIslandAnchorCenter();
    const boatScale = this.parameterState.boatScale ?? 1;
    const islandScale = this.parameterState.islandScale ?? 1;

    if (this.boatRoot) {
      this.boatRoot.scaling = new Vector3(boatScale, boatScale, boatScale);
      this.alignRootToBoundsCenter(this.boatRoot, this.boatMeshes, boatAnchor);
    }

    if (this.islandRoot) {
      this.islandRoot.scaling = new Vector3(islandScale, islandScale, islandScale);
      this.alignRootToBoundsCenter(this.islandRoot, this.islandMeshes, islandAnchor);
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
    root.setAbsolutePosition(root.getAbsolutePosition().add(delta));
  }

  private computeIntersectionFactor(bounds: {
    min: Vector3;
    max: Vector3;
    extentY: number;
  }, waterHeight: number): number {
    const minY = bounds.min.y;
    const maxY = bounds.max.y;
    if (waterHeight <= minY || waterHeight >= maxY) {
      return 0;
    }

    const objectHeight = Math.max(bounds.extentY, 0.25);
    const t = Math.min(Math.max((waterHeight - minY) / objectHeight, 0), 1);
    return Math.sin(t * Math.PI);
  }

  private computeIslandShorelineFactor(bounds: {
    min: Vector3;
    extentY: number;
  }, waterHeight: number, bandWidthScale: number): number {
    const shorelineBand = Math.max(bounds.extentY * bandWidthScale, 0.45);
    const shorelineMin = bounds.min.y;
    const shorelineMax = shorelineMin + shorelineBand;

    if (waterHeight <= shorelineMin || waterHeight >= shorelineMax) {
      return 0;
    }

    const t = Math.min(Math.max((waterHeight - shorelineMin) / shorelineBand, 0), 1);
    return Math.sin(t * Math.PI);
  }

  private updateProxySphereVisibility(): void {
    const show = this.showProxySpheres;
    // Only affect visibility, keep spheres active as parent transform nodes
    if (this.boatCollisionSphere) {
      this.boatCollisionSphere.visibility = show ? 1.0 : 0.0;
    }
    if (this.islandCollisionSphere) {
      this.islandCollisionSphere.visibility = show ? 1.0 : 0.0;
    }
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

    console.log('🧭 GLB to Proxy offsets', {
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

    if (this.collisionMode === 0 && this.boatCollisionSphere) {
      this.boatCollisionSphere.position.x = -12;
      this.boatCollisionSphere.position.z = -24;
      this.boatCollisionSphere.position.y = this.getWaveHeightAt(this.boatCollisionSphere.position.x, this.boatCollisionSphere.position.z) + boatYOffset;
    }

    if (this.collisionMode === 1) {
      if (this.boatCollisionSphere) {
        this.boatCollisionSphere.position.x = -12 + Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
        this.boatCollisionSphere.position.z = -24 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
        this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
      } else {
        this.boatCollisionCenter.x = -12 + Math.sin(this.elapsedTime * (0.19 + windSpeed * 0.11)) * 0.75;
        this.boatCollisionCenter.z = -24 + Math.cos(this.elapsedTime * (0.16 + windSpeed * 0.09)) * 0.55;
        this.boatCollisionCenter.y = boatYOffset + Math.sin(this.elapsedTime * (0.85 + windSpeed * 0.45)) * bobAmount;
      }
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

    if (this.collisionMode === 1) {
      this.autoCenterGlbsToSpheres();
    }

    if (this.collisionMode === 0) {
      // === GLB Geometry Mode: derive collision center & radius strictly from GLB mesh bounds ===
      const boatBounds = this.getBoundsData(this.boatMeshes);
      const islandBounds = this.getBoundsData(this.islandMeshes);

      // Boat: use GLB bounds if available, else use scale-based fallback (but NOT sphere position)
      if (boatBounds) {
        const boatWaterHeight = this.getWaveHeightAt(boatBounds.center.x, boatBounds.center.z);
        this.boatCollisionCenter.set(boatBounds.center.x, boatWaterHeight, boatBounds.center.z);
        const hullRadius = Math.max(boatBounds.extentX, boatBounds.extentZ) * 0.42;
        this.boatCollisionRadius = Math.max(0.45, hullRadius);
        this.boatIntersectionFactor = this.computeIntersectionFactor(boatBounds, boatWaterHeight);
      } else {
        // Fallback: use boatRoot position if available, otherwise keep existing
        if (this.boatRoot) {
          this.boatCollisionCenter.copyFrom(this.boatRoot.position);
        }
        this.boatCollisionRadius = Math.max(0.5, 2.2 * (this.parameterState.boatScale ?? 1));
        const boatWaterHeight = this.getWaveHeightAt(this.boatCollisionCenter.x, this.boatCollisionCenter.z);
        this.boatCollisionCenter.y = boatWaterHeight;
        this.boatIntersectionFactor = Math.max(0, Math.min(1, (boatWaterHeight - boatYOffset + 0.6) / 1.5));
      }

      // Island: use GLB bounds if available, else use scale-based fallback (but NOT sphere position)
      if (islandBounds) {
        const shorelineBandWidth = Math.min(Math.max(this.parameterState.islandShorelineBandWidth ?? 0.28, 0.08), 0.8);
        const shorelineFoamGain = Math.max(this.parameterState.islandShorelineFoamGain ?? 1, 0);
        const islandWaterHeight = this.getWaveHeightAt(islandBounds.center.x, islandBounds.center.z);
        this.islandCollisionCenter.set(islandBounds.center.x, islandWaterHeight, islandBounds.center.z);
        const shorelineRadius = (islandBounds.extentX + islandBounds.extentZ) * 0.25;
        this.islandCollisionRadius = Math.max(1.0, shorelineRadius);
        const shorelineFactor = this.computeIslandShorelineFactor(islandBounds, islandWaterHeight, shorelineBandWidth);
        this.islandIntersectionFactor = Math.min(1, shorelineFactor * shorelineFoamGain);
      } else {
        // Fallback: use islandRoot position if available, otherwise keep existing
        if (this.islandRoot) {
          this.islandCollisionCenter.copyFrom(this.islandRoot.position);
        }
        this.islandCollisionRadius = Math.max(1.0, 4.0 * (this.parameterState.islandScale ?? 1));
        const islandWaterHeight = this.getWaveHeightAt(this.islandCollisionCenter.x, this.islandCollisionCenter.z);
        this.islandCollisionCenter.y = islandWaterHeight;
        this.islandIntersectionFactor = Math.max(0, Math.min(1, (islandWaterHeight - islandYOffset + 1.2) / 2.5));
      }
    } else {
      // === Parent Physics Proxies Mode: derive collision center & radius from proxy sphere positions ===
      // Boat: use proxy sphere position directly
      if (this.boatCollisionSphere) {
        this.boatCollisionCenter.copyFrom(this.boatCollisionSphere.position);
      }
      // Island: use proxy sphere position directly
      if (this.islandCollisionSphere) {
        this.islandCollisionCenter.copyFrom(this.islandCollisionSphere.position);
      }
      // Use scale-based radii for this mode
      this.boatCollisionRadius = Math.max(0.5, 2.2 * (this.parameterState.boatScale ?? 1));
      this.islandCollisionRadius = Math.max(1.0, 4.0 * (this.parameterState.islandScale ?? 1));
      const boatWaterHeight = this.getWaveHeightAt(this.boatCollisionCenter.x, this.boatCollisionCenter.z);
      const islandWaterHeight = this.getWaveHeightAt(this.islandCollisionCenter.x, this.islandCollisionCenter.z);
      this.boatIntersectionFactor = Math.max(
        0,
        Math.min(1, (boatWaterHeight - (this.boatCollisionCenter.y - this.boatCollisionRadius * 0.45)) / Math.max(this.boatCollisionRadius, 0.1))
      );
      this.islandIntersectionFactor = Math.max(
        0,
        Math.min(1, (islandWaterHeight - (this.islandCollisionCenter.y - this.islandCollisionRadius * 0.35)) / Math.max(this.islandCollisionRadius, 0.1))
      );

      // === Parent Physics Proxies Mode: update sphere positions and sizes ===
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
  }

  private applyCollisionUniforms(): void {
    if (!this.shaderRegistry) {
      return;
    }

    this.ensureIntersectionFoamFieldTextures();

    this.boatIntersectionFoamFieldBounds = this.resolveLiveFoamFieldBounds(
      this.boatIntersectionFoamFieldBoundsBase,
      this.boatIntersectionFoamFieldBakeCenterXZ,
      this.boatMeshes
    );
    this.islandIntersectionFoamFieldBounds = this.resolveLiveFoamFieldBounds(
      this.islandIntersectionFoamFieldBoundsBase,
      this.islandIntersectionFoamFieldBakeCenterXZ,
      this.islandMeshes
    );

    this.shaderRegistry.setUniform('boatCollisionCenter', [this.boatCollisionCenter.x, this.boatCollisionCenter.y, this.boatCollisionCenter.z]);
    this.shaderRegistry.setUniform('islandCollisionCenter', [this.islandCollisionCenter.x, this.islandCollisionCenter.y, this.islandCollisionCenter.z]);
    this.shaderRegistry.setUniform('boatCollisionRadius', this.boatCollisionRadius);
    this.shaderRegistry.setUniform('islandCollisionRadius', this.islandCollisionRadius);
    this.shaderRegistry.setUniform('boatIntersectionFoamFieldBounds', this.boatIntersectionFoamFieldBounds);
    this.shaderRegistry.setUniform('islandIntersectionFoamFieldBounds', this.islandIntersectionFoamFieldBounds);
    this.shaderRegistry.setUniform('boatIntersectionFoamFieldMaxDistance', this.boatIntersectionFoamFieldMaxDistance);
    this.shaderRegistry.setUniform('islandIntersectionFoamFieldMaxDistance', this.islandIntersectionFoamFieldMaxDistance);
    this.shaderRegistry.setUniform('boatIntersectionFoamFieldValid', this.boatIntersectionFoamFieldValid);
    this.shaderRegistry.setUniform('islandIntersectionFoamFieldValid', this.islandIntersectionFoamFieldValid);
    if (this.boatIntersectionFoamTexture) {
      this.shaderRegistry.setUniform('boatIntersectionFoamField', this.boatIntersectionFoamTexture);
    }
    if (this.islandIntersectionFoamTexture) {
      this.shaderRegistry.setUniform('islandIntersectionFoamField', this.islandIntersectionFoamTexture);
    }
    if (this.currentShaderName === 'gerstnerWaves') {
      this.shaderRegistry.setUniform('collisionFoamStrength', this.collisionMode === 1 ? 1.2 : 1.0);
    }
    this.shaderRegistry.setUniform('boatIntersectionFactor', this.boatIntersectionFactor);
    this.shaderRegistry.setUniform('islandIntersectionFactor', this.islandIntersectionFactor);
  }

  private updateUnderwaterState(deltaTime: number): void {
    if (!this.scene || !this.camera || !this.shaderRegistry) {
      return;
    }

    const enabled = (this.parameterState.underwaterEnabled ?? 1) >= 0.5;
    const transitionDepth = Math.max(this.parameterState.underwaterTransitionDepth ?? 8, 0.25);
    const fogDensity = Math.max(this.parameterState.underwaterFogDensity ?? 0.32, 0);
    const horizonMix = Math.max(0, Math.min(1, this.parameterState.underwaterHorizonMix ?? 0.38));

    const cameraY = this.camera.position.y;
    const target = enabled ? Math.max(0, Math.min(1, (-cameraY + transitionDepth) / (transitionDepth * 2))) : 0;
    const lerpRate = Math.min(1, deltaTime * 2.8);
    this.underwaterFactor += (target - this.underwaterFactor) * lerpRate;

    const u = this.underwaterFactor;
    const underwaterColor = new Color4(
      Math.max(0, Math.min(1, this.parameterState.underwaterColorR ?? 0.03)),
      Math.max(0, Math.min(1, this.parameterState.underwaterColorG ?? 0.16)),
      Math.max(0, Math.min(1, this.parameterState.underwaterColorB ?? 0.24)),
      1
    );
    const surfaceColor = new Color4(0.1, 0.3, 0.5, 1);
    this.scene.clearColor = Color4.Lerp(surfaceColor, underwaterColor, u * (0.6 + fogDensity * 0.4));

    this.shaderRegistry.setUniform('underwaterEnabled', enabled ? 1 : 0);
    this.shaderRegistry.setUniform('underwaterTransitionDepth', transitionDepth);
    this.shaderRegistry.setUniform('underwaterFogDensity', fogDensity);
    this.shaderRegistry.setUniform('underwaterHorizonMix', horizonMix);
    this.shaderRegistry.setUniform('underwaterColorR', underwaterColor.r);
    this.shaderRegistry.setUniform('underwaterColorG', underwaterColor.g);
    this.shaderRegistry.setUniform('underwaterColorB', underwaterColor.b);
    this.shaderRegistry.setUniform('underwaterFactor', u);
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
        const cameraPos = this.camera?.position;
        this.oceanMesh = WaterMeshFactory.replaceWaterMesh(
          this.oceanMesh,
          nextWaterType,
          this.scene,
          cameraPos ? { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z } : undefined
        );
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
      this.rebuildBoatIntersectionFoamField();
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'islandScale') {
      this.applyObjectScales();
      this.rebuildIslandIntersectionFoamField();
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'boatYOffset' || key === 'islandYOffset') {
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'islandShorelineBandWidth' || key === 'islandShorelineFoamGain') {
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
      return;
    }

    if (key === 'waveAmplitude' || key === 'waveFrequency' || key === 'windDirection' || key === 'windSpeed') {
      this.updateCollisionSimulation();
      this.applyCollisionUniforms();
    }

    if ((key === 'logSiblingOffsets' || key === 'logProxyOffsets') && value >= 0.5) {
      this.logGlbSphereOffsets();
      return;
    }

    if ((key === 'moveGlbsToSpheres' || key === 'moveGlbsToProxies') && value >= 0.5) {
      this.moveGlbsToSpheres();
      return;
    }

    if (!isParameterSupportedForShader(key, this.currentShaderName)) {
      return;
    }

    this.shaderRegistry?.setUniform(key, value);
  }

  public async setBoatModel(modelId: string): Promise<void> {
    const normalizedModelId = normalizeBoatModelId(modelId);
    if (!normalizedModelId) {
      return;
    }

    this.pendingBoatModel = normalizedModelId;

    if (this.boatModelLoading) {
      return;
    }

    this.boatModelLoading = true;
    try {
      while (this.pendingBoatModel !== null) {
        const nextModel = this.pendingBoatModel;
        this.pendingBoatModel = null;
        await this.loadBoatModel(nextModel);
        this.updateCollisionSimulation();
        this.applyCollisionUniforms();
      }
    } finally {
      this.boatModelLoading = false;
    }
  }

  public async setIslandModel(modelId: string): Promise<void> {
    if (!isIslandModelId(modelId)) {
      return;
    }

    this.pendingIslandModel = modelId;

    if (this.islandModelLoading) {
      return;
    }

    this.islandModelLoading = true;
    try {
      while (this.pendingIslandModel !== null) {
        const nextModel = this.pendingIslandModel;
        this.pendingIslandModel = null;
        await this.loadIslandModel(nextModel);
        this.updateCollisionSimulation();
        this.applyCollisionUniforms();
      }
    } finally {
      this.islandModelLoading = false;
    }
  }

  public updateCamera(x: number, y: number, z: number): void {
    if (!this.camera) return;
    this.camera.position = new Vector3(x, y, z);
    this.camera.setTarget(Vector3.Zero());
  }

  public setSpeedBoostActive(active: boolean): void {
    if (this.isSpeedBoostActive === active) {
      return;
    }
    this.applySpeedBoostState(active);
  }

  public setTopDownView(height: number): void {
    if (!this.camera) return;
    const p = topDownCameraPosition(height);
    this.camera.position = new Vector3(p.x, p.y, p.z);
    this.camera.setTarget(Vector3.Zero());
  }

  public resize(): void {
    this.engine?.resize();
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

      if (this.oceanMesh && now - this.lastAdaptiveRetierCheckMs > 900) {
        this.lastAdaptiveRetierCheckMs = now;
        const shouldRetier = WaterMeshFactory.needsAdaptiveRetier(
          this.oceanMesh,
          this.currentShaderName,
          { x: p.x, y: p.y, z: p.z }
        );

        if (shouldRetier && this.scene) {
          try {
            this.oceanMesh = WaterMeshFactory.replaceWaterMesh(
              this.oceanMesh,
              this.currentShaderName,
              this.scene,
              { x: p.x, y: p.y, z: p.z }
            );
            this.shaderRegistry.switchTo(this.currentShaderName, this.oceanMesh);
            this.shaderRegistry.setUniforms(filterParameterStateForShader(this.parameterState, this.currentShaderName));
            this.shaderRegistry.setUniform('time', this.elapsedTime);
            this.applyCollisionUniforms();

            if (!this.oceanMesh.material) {
              throw new Error('Adaptive retier completed without assigning a material');
            }
          } catch (error) {
            console.error('❌ Adaptive retier failed, attempting recovery', error);
            this.verifyRenderStateAndRecover();
          }
        }
      }
    }

    this.updateUnderwaterState(deltaTime);

  }

  public dispose(): void {
    this.applySpeedBoostState(false);
    this.boatIntersectionFoamTexture?.dispose();
    this.islandIntersectionFoamTexture?.dispose();
    this.boatIntersectionFoamTexture = null;
    this.islandIntersectionFoamTexture = null;
    this.boatCollisionSphere?.dispose();
    this.islandCollisionSphere?.dispose();
    this.disposeModelNodes(this.boatModelNodes);
    this.disposeModelNodes(this.islandModelNodes);
    this.boatCollisionSphere = null;
    this.islandCollisionSphere = null;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
