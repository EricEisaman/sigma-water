/**
 * Photorealistic Ocean Renderer - Babylon.js 9 + WebGPU + WGSL + Dynamic Foam
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.UniversalCamera | null = null;
  private oceanMesh: BABYLON.Mesh | null = null;
  private boatMesh: BABYLON.Mesh | null = null;
  private islandMesh: BABYLON.Mesh | null = null;
  private shaderMaterial: BABYLON.ShaderMaterial | null = null;
  private light: BABYLON.DirectionalLight | null = null;
  private shadowGenerator: BABYLON.ShadowGenerator | null = null;
  private initialized = false;
  private islandCenter = new BABYLON.Vector2(180, -120);
  private islandRadius = 64;

  private waveParams = {
    amplitude: 2.0,
    frequency: 1.2,
    windDirection: 45,
    windSpeed: 0.6,
    foamIntensity: 0.7,
    causticIntensity: 0.85,
    causticScale: 2.5,
    foamDistanceScale: 0.23,
    time: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🌊 VisualOcean.initialize() - WGSL Ocean Renderer with Dynamic Foam');

      if (!navigator.gpu) {
        throw new Error('WebGPU not supported. Use Chrome 113+, Edge 113+, or Firefox with WebGPU enabled.');
      }

      this.engine = new BABYLON.WebGPUEngine(this.canvas, {
        enableAllFeatures: true,
        antialias: true,
      });

      (this.engine as any).dbgShowShaderCode = true;

      await this.engine.initAsync();
      console.log('✅ WebGPU engine initialized');

      this.scene = new BABYLON.Scene(this.engine);
      this.scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.92, 1.0);
      this.scene.shadowsEnabled = true;

      this.setupCamera();
      this.setupLighting();
      await this.setupIBLEnvironment();
      await this.createOceanMesh();
      await this.createBoat();
      await this.createIsland();
      this.setupRenderLoop();

      window.addEventListener('resize', () => this.onWindowResize());

      this.initialized = true;
      console.log('🎉 Ocean scene ready with dynamic foam!');
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  }

  private setupCamera(): void {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 100, 150));
    this.camera.attachControl(this.canvas, true);
    this.camera.speed = 50;
    this.camera.angularSensibility = 1000;
    this.camera.inertia = 0.7;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 10000;

    this.scene.activeCamera = this.camera;
    this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
    console.log('✅ Camera configured');
  }

  private setupLighting(): void {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.light = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(-0.8, 1.0, -0.6), this.scene);
    this.light.intensity = 1.5;
    this.light.range = 2500;

    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, this.light);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    console.log('✅ Lighting configured');
  }

  private async setupIBLEnvironment(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    try {
      // Load local Kiara Dawn 1K EXR using EXRCubeTexture
      const exrUrl = '/assets/images/kiara_1_dawn_1k.exr';
      const envTexture = new BABYLON.EXRCubeTexture(exrUrl, this.scene, 512);
      this.scene.environmentTexture = envTexture;
      this.scene.environmentIntensity = 1.2;
      // Create skybox from the IBL texture (true = PBR skybox)
      this.scene.createDefaultSkybox(envTexture, true, 5000, 0.3, false);
      console.log('✅ Kiara Dawn 1K EXR loaded via EXRCubeTexture');
    } catch (e) {
      console.warn('⚠️ EXR load failed - using solid sky color', e);
    }
  }

  private async createOceanMesh(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    console.log('Creating ocean mesh...');
    
    const gridSize = 256;
    const meshSize = 5000;
    this.oceanMesh = BABYLON.MeshBuilder.CreateGround('ocean', {
      width: meshSize,
      height: meshSize,
      subdivisions: gridSize,
    }, this.scene);

    this.oceanMesh.receiveShadows = true;

    console.log('Loading WGSL shaders...');

    // Use Babylon WGSL shader template path for reliable Scene/Mesh bindings on WebGPU.
    const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;
uniform frequency : f32;
uniform windDirection : f32;
uniform windSpeed : f32;
uniform foamIntensity : f32;
uniform causticIntensity : f32;
uniform causticScale : f32;
uniform boatPos : vec2<f32>;
uniform islandCenter : vec2<f32>;
uniform islandRadius : f32;
uniform foamDistanceScale : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;
varying vFoamMask : f32;

fn waveHeight(xz: vec2<f32>, t: f32) -> f32 {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let dir0 = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  let dir1 = normalize(vec2<f32>(-dir0.y, dir0.x));
  let dir2 = normalize(dir0 + dir1 * 0.6);

  let speed = 0.65 + uniforms.windSpeed * 1.35;
  let f0 = uniforms.frequency;
  let f1 = uniforms.frequency * 1.87;
  let f2 = uniforms.frequency * 3.41;

  let p0 = dot(xz, dir0) * f0 + t * speed;
  let p1 = dot(xz, dir1) * f1 + t * speed * 1.41;
  let p2 = dot(xz, dir2) * f2 + t * speed * 0.73;

  let a0 = uniforms.amplitude;
  let a1 = uniforms.amplitude * 0.45;
  let a2 = uniforms.amplitude * 0.2;

  return sin(p0) * a0 + sin(p1) * a1 + sin(p2) * a2;
}

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let t = uniforms.time;
  let xz = input.position.xz;
  let totalWave = waveHeight(xz, t);
  var displacedPos = input.position;
  displacedPos.y += totalWave;

  // Reconstruct local slope from nearby samples for stable high-frequency normals.
  let eps = 0.85;
  let hL = waveHeight(xz - vec2<f32>(eps, 0.0), t);
  let hR = waveHeight(xz + vec2<f32>(eps, 0.0), t);
  let hD = waveHeight(xz - vec2<f32>(0.0, eps), t);
  let hU = waveHeight(xz + vec2<f32>(0.0, eps), t);
  let dHdX = (hR - hL) / (2.0 * eps);
  let dHdZ = (hU - hD) / (2.0 * eps);
  let localNormal = normalize(vec3<f32>(-dHdX, 1.0, -dHdZ));
  let worldNormal = normalize((mesh.world * vec4<f32>(localNormal, 0.0)).xyz);

  let worldPos = mesh.world * vec4<f32>(displacedPos, 1.0);
  vertexOutputs.position = scene.viewProjection * worldPos;

  let depthFactor = clamp(0.5 + displacedPos.y * 0.06, 0.0, 1.0);
  vertexOutputs.vColor = vec4<f32>(0.012, 0.16 + depthFactor * 0.28, 0.28 + depthFactor * 0.42, 1.0);
  vertexOutputs.vNormal = worldNormal;
  vertexOutputs.vWorldPos = worldPos.xyz;
  vertexOutputs.vUv = input.uv;
  vertexOutputs.vWaveHeight = totalWave;
  vertexOutputs.vFoamMask = clamp(length(vec2<f32>(dHdX, dHdZ)) * 0.35, 0.0, 1.0);
  return vertexOutputs;
}`;

    const fragmentCode = `
  #include<sceneUboDeclaration>

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;
varying vFoamMask : f32;
uniform time : f32;

fn pow5(v: f32) -> f32 {
  let v2 = v * v;
  return v2 * v2 * v;
}

fn sdfCircle(p: vec2<f32>, center: vec2<f32>, radius: f32) -> f32 {
  return length(p - center) - radius;
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let n = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.42, 0.81, 0.25));
  let halfVec = normalize(lightDir + viewDir);

  let NoL = max(dot(n, lightDir), 0.0);
  let NoV = max(dot(n, viewDir), 0.0);
  let fresnel = pow5(1.0 - NoV);

  let deepColor = vec3<f32>(0.008, 0.085, 0.15);
  let shallowColor = vec3<f32>(0.08, 0.31, 0.47);
  let heightTint = clamp(0.5 + input.vWaveHeight * 0.07, 0.0, 1.0);
  var waterColor = mix(deepColor, shallowColor, heightTint);

  let specPower = mix(70.0, 190.0, clamp(uniforms.windSpeed * 0.5, 0.0, 1.0));
  let spec = pow(max(dot(n, halfVec), 0.0), specPower) * (0.18 + 0.65 * fresnel);

  // Approximate subsurface glow on wave backs facing away from light.
  let backScatter = pow(max(dot(-viewDir, lightDir), 0.0), 4.0) * clamp(input.vWaveHeight * 0.08 + 0.5, 0.0, 1.0);
  let sss = vec3<f32>(0.11, 0.42, 0.49) * backScatter * 0.35;

  let ripple = sin(input.vUv.x * 190.0 + uniforms.time * 3.2) * sin(input.vUv.y * 170.0 - uniforms.time * 2.7);
  let foamNoise = ripple * 0.5 + 0.5;
  let foamMask = clamp(input.vFoamMask * 1.35 + foamNoise * 0.22, 0.0, 1.0);

  // Distance-field foam around dynamic boat hull and static island shoreline.
  let worldXZ = input.vWorldPos.xz;
  let boatDist = sdfCircle(worldXZ, uniforms.boatPos, 11.0);
  let boatRim = smoothstep(3.0, 0.0, abs(boatDist));
  let wakeDir = normalize(vec2<f32>(0.0, 1.0));
  let rel = worldXZ - uniforms.boatPos;
  let wakeLong = max(dot(rel, -wakeDir), 0.0);
  let wakeLat = abs(dot(rel, vec2<f32>(wakeDir.y, -wakeDir.x)));
  let wakeSdf = wakeLat - (2.5 + wakeLong * 0.12);
  let wakeFoam = smoothstep(2.0, 0.0, wakeSdf) * exp(-wakeLong * 0.02);

  let shoreDist = abs(sdfCircle(worldXZ, uniforms.islandCenter, uniforms.islandRadius));
  let shoreFoam = smoothstep(6.0, 0.0, shoreDist);

  let distanceFoam = clamp((boatRim + wakeFoam) * uniforms.foamDistanceScale * 4.5 + shoreFoam * 0.85, 0.0, 1.0);
  let foam = clamp(smoothstep(0.44, 0.9, foamMask) * uniforms.foamIntensity + distanceFoam, 0.0, 1.0);

  let c = (sin(input.vWorldPos.x * uniforms.causticScale * 0.12 + uniforms.time * 0.7) * sin(input.vWorldPos.z * uniforms.causticScale * 0.09 + uniforms.time * 0.51)) * 0.5 + 0.5;
  let causticColor = vec3<f32>(0.12, 0.22, 0.28) * c * uniforms.causticIntensity * 0.32;

  var finalColor = waterColor;
  finalColor *= (0.38 + NoL * 0.62);
  finalColor += causticColor;
  finalColor += sss;
  finalColor += vec3<f32>(spec);
  finalColor = mix(finalColor, vec3<f32>(0.66, 0.78, 0.9), fresnel * 0.35);
  finalColor = mix(finalColor, vec3<f32>(0.96, 0.98, 1.0), foam);

  fragmentOutputs.color = vec4<f32>(finalColor, 1.0);
  return fragmentOutputs;
}`;
    
    console.log('✅ Inline WGSL shaders ready');

    try {
      // Create ShaderMaterial with inline WGSL
      this.shaderMaterial = new BABYLON.ShaderMaterial(
        'oceanShader',
        this.scene,
        {
          vertexSource: vertexCode,
          fragmentSource: fragmentCode,
        },
        {
          attributes: ['position', 'normal', 'uv'],
          uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'windSpeed', 'foamIntensity', 'causticIntensity', 'causticScale', 'boatPos', 'islandCenter', 'islandRadius', 'foamDistanceScale'],
          uniformBuffers: ['Scene', 'Mesh'],
          needAlphaBlending: false,
          shaderLanguage: BABYLON.ShaderLanguage.WGSL,
        }
      );

      console.log('✅ Ocean shader material created successfully (pure WGSL, no file loading)');

      // Keep water opaque so it is clearly visible against bright sky backgrounds.
      this.shaderMaterial.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
      this.shaderMaterial.alpha = 1.0;
      this.shaderMaterial.backFaceCulling = false;
      this.shaderMaterial.wireframe = false;

      this.shaderMaterial.setFloat('time', this.waveParams.time);
      this.shaderMaterial.setFloat('amplitude', this.waveParams.amplitude);
      this.shaderMaterial.setFloat('frequency', this.waveParams.frequency * 0.08);
      this.shaderMaterial.setFloat('windDirection', this.waveParams.windDirection);
      this.shaderMaterial.setFloat('windSpeed', this.waveParams.windSpeed);
      this.shaderMaterial.setFloat('foamIntensity', this.waveParams.foamIntensity);
      this.shaderMaterial.setFloat('causticIntensity', this.waveParams.causticIntensity);
      this.shaderMaterial.setFloat('causticScale', this.waveParams.causticScale);
      this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new BABYLON.Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : BABYLON.Vector2.Zero());
      this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
      this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
      this.shaderMaterial.setFloat('foamDistanceScale', this.waveParams.foamDistanceScale);

      console.log('✅ Ocean uniforms initialized');
    } catch (error) {
      console.error('❌ Failed to create ocean shader material:', error);
      throw error;
    }

    this.oceanMesh.material = this.shaderMaterial;
    this.oceanMesh.position.y = 0;
    this.oceanMesh.scaling.setAll(1);
    this.oceanMesh.visibility = 1.0;
    this.oceanMesh.setEnabled(true);
    this.oceanMesh.renderingGroupId = 1;
    
    console.log(`✅ Ocean mesh created: ${this.oceanMesh.getTotalVertices()} vertices`);
    console.log('🔍 DEBUG - Mesh material:', this.oceanMesh.material?.name || 'MISSING!');
    console.log('🔍 DEBUG - Mesh position:', this.oceanMesh.position);
    console.log('🔍 DEBUG - Mesh visible:', this.oceanMesh.isVisible);
    console.log('🔍 DEBUG - Mesh enabled:', this.oceanMesh.isEnabled());
  }

  private async createBoat(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    this.boatMesh = BABYLON.MeshBuilder.CreateBox('boat', {
      width: 12,
      height: 6,
      depth: 24,
    }, this.scene);

    this.boatMesh.position = new BABYLON.Vector3(0, 2, 0);

    const boatMaterial = new BABYLON.PBRMaterial('boatMaterial', this.scene);
    boatMaterial.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.45);
    boatMaterial.metallic = 0.1;
    boatMaterial.roughness = 0.6;

    this.boatMesh.material = boatMaterial;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(this.boatMesh);
    }

    console.log('✅ Boat created');
  }

  private async createIsland(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    this.islandMesh = BABYLON.MeshBuilder.CreateCylinder('island', {
      diameterTop: this.islandRadius * 1.45,
      diameterBottom: this.islandRadius * 2.2,
      height: 26,
      tessellation: 32,
    }, this.scene);

    this.islandMesh.position = new BABYLON.Vector3(this.islandCenter.x, 6, this.islandCenter.y);
    this.islandMesh.receiveShadows = true;

    const islandMaterial = new BABYLON.PBRMaterial('islandMaterial', this.scene);
    islandMaterial.albedoColor = new BABYLON.Color3(0.38, 0.34, 0.28);
    islandMaterial.metallic = 0.0;
    islandMaterial.roughness = 0.95;
    this.islandMesh.material = islandMaterial;

    const sandRing = BABYLON.MeshBuilder.CreateCylinder('islandShore', {
      diameterTop: this.islandRadius * 1.75,
      diameterBottom: this.islandRadius * 1.95,
      height: 3.5,
      tessellation: 40,
    }, this.scene);
    sandRing.position = new BABYLON.Vector3(this.islandCenter.x, 1.2, this.islandCenter.y);

    const sandMaterial = new BABYLON.PBRMaterial('islandShoreMaterial', this.scene);
    sandMaterial.albedoColor = new BABYLON.Color3(0.79, 0.74, 0.62);
    sandMaterial.metallic = 0;
    sandMaterial.roughness = 0.9;
    sandRing.material = sandMaterial;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(this.islandMesh);
      this.shadowGenerator.addShadowCaster(sandRing);
    }

    console.log('✅ Island created');
  }

  private setupRenderLoop(): void {
    if (!this.engine || !this.scene) throw new Error('Engine or scene not initialized');

    let lastFrameTime = performance.now();

    this.engine.runRenderLoop(() => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastFrameTime) / 1000;
      lastFrameTime = currentTime;

      this.waveParams.time += 0.02;

      this.updateBoatPhysics();

      if (this.shaderMaterial) {
        this.shaderMaterial.setFloat('time', this.waveParams.time);
        this.shaderMaterial.setFloat('amplitude', this.waveParams.amplitude);
        this.shaderMaterial.setFloat('frequency', this.waveParams.frequency * 0.08);
        this.shaderMaterial.setFloat('windDirection', this.waveParams.windDirection);
        this.shaderMaterial.setFloat('windSpeed', this.waveParams.windSpeed);
        this.shaderMaterial.setFloat('foamIntensity', this.waveParams.foamIntensity);
        this.shaderMaterial.setFloat('causticIntensity', this.waveParams.causticIntensity);
        this.shaderMaterial.setFloat('causticScale', this.waveParams.causticScale);
        this.shaderMaterial.setFloat('foamDistanceScale', this.waveParams.foamDistanceScale);
        this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new BABYLON.Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : BABYLON.Vector2.Zero());
        this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
        this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
      }

      this.scene!.render();
    });

    console.log('✅ Render loop started');
  }

  private updateBoatPhysics(): void {
    if (!this.boatMesh) return;

    const boatPos = this.boatMesh.getAbsolutePosition();
    const t = this.waveParams.time;

    const halfLength = 10;
    const halfWidth = 5;

    const bow = this.sampleWaveAt(boatPos.x, boatPos.z + halfLength, t);
    const stern = this.sampleWaveAt(boatPos.x, boatPos.z - halfLength, t);
    const port = this.sampleWaveAt(boatPos.x - halfWidth, boatPos.z, t);
    const starboard = this.sampleWaveAt(boatPos.x + halfWidth, boatPos.z, t);
    const center = this.sampleWaveAt(boatPos.x, boatPos.z, t);

    const targetY = (bow + stern + port + starboard + center) / 5 + 2.7;
    const targetPitch = Math.atan2(stern - bow, halfLength * 2) * 0.95;
    const targetRoll = Math.atan2(port - starboard, halfWidth * 2) * 0.9;

    this.boatMesh.position.y = BABYLON.Scalar.Lerp(this.boatMesh.position.y, targetY, 0.1);
    this.boatMesh.rotation.x = BABYLON.Scalar.Lerp(this.boatMesh.rotation.x, targetPitch, 0.12);
    this.boatMesh.rotation.z = BABYLON.Scalar.Lerp(this.boatMesh.rotation.z, targetRoll, 0.12);
  }

  private sampleWaveAt(x: number, z: number, t: number): number {
    const angle = (this.waveParams.windDirection * Math.PI) / 180;
    const dir0x = Math.cos(angle);
    const dir0z = Math.sin(angle);
    const dir1x = -dir0z;
    const dir1z = dir0x;
    const dir2x = dir0x + dir1x * 0.6;
    const dir2z = dir0z + dir1z * 0.6;
    const dir2Len = Math.hypot(dir2x, dir2z) || 1;

    const speed = 0.65 + this.waveParams.windSpeed * 1.35;
    const f0 = this.waveParams.frequency * 0.08;
    const f1 = f0 * 1.87;
    const f2 = f0 * 3.41;

    const p0 = (x * dir0x + z * dir0z) * f0 + t * speed;
    const p1 = (x * dir1x + z * dir1z) * f1 + t * speed * 1.41;
    const p2 = (x * (dir2x / dir2Len) + z * (dir2z / dir2Len)) * f2 + t * speed * 0.73;

    const a0 = this.waveParams.amplitude;
    const a1 = this.waveParams.amplitude * 0.45;
    const a2 = this.waveParams.amplitude * 0.2;

    return Math.sin(p0) * a0 + Math.sin(p1) * a1 + Math.sin(p2) * a2;
  }

  private onWindowResize(): void {
    if (this.engine) {
      this.engine.resize();
    }
  }

  public updateParameter(key: string, value: number): void {
    const keyMap: { [key: string]: string } = {
      waveAmplitude: 'amplitude',
      waveFrequency: 'frequency',
      windDirection: 'windDirection',
      windSpeed: 'windSpeed',
      foamIntensity: 'foamIntensity',
      causticIntensity: 'causticIntensity',
      foamDistanceScale: 'foamDistanceScale',
    };

    const internalKey = keyMap[key] || key;
    if (internalKey in this.waveParams) {
      (this.waveParams as any)[internalKey] = value;
    }
  }

  public updateCamera(x: number, y: number, z: number): void {
    if (this.camera) {
      this.camera.position = new BABYLON.Vector3(x, y, z);
    }
  }

  public render(): void {
    // Babylon.js handles rendering
  }

  public dispose(): void {
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}
