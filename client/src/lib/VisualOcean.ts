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
  private shaderMaterial: BABYLON.ShaderMaterial | null = null;
  private light: BABYLON.DirectionalLight | null = null;
  private shadowGenerator: BABYLON.ShadowGenerator | null = null;
  private initialized = false;

  private waveParams = {
    amplitude: 2.0,
    frequency: 1.2,
    windDirection: 45,
    windSpeed: 0.6,
    foamIntensity: 0.7,
    causticIntensity: 0.85,
    causticScale: 2.5,
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

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let t = time;
  let wave1 = amplitude * sin(input.position.x * frequency + t) * cos(input.position.z * frequency + t * 0.7);
  let wave2 = amplitude * 0.6 * sin(input.position.x * frequency * 1.3 + t * 1.3) * cos(input.position.z * frequency * 1.3 + t * 0.9);
  let wave3 = amplitude * 0.35 * sin(input.position.x * frequency * 2.1 + t * 0.8) * cos(input.position.z * frequency * 2.1 + t * 1.2);
  let totalWave = wave1 + wave2 + wave3;

  var displacedPos = input.position;
  displacedPos.y += totalWave;

  let worldPos = mesh.world * vec4<f32>(displacedPos, 1.0);
  vertexOutputs.position = scene.viewProjection * worldPos;

  let depthFactor = clamp(displacedPos.y * 0.18 + 0.5, 0.0, 1.0);
  vertexOutputs.vColor = vec4<f32>(0.02, 0.35 + depthFactor * 0.22, 0.62 + depthFactor * 0.22, 1.0);
  vertexOutputs.vNormal = input.normal;
  vertexOutputs.vWorldPos = worldPos.xyz;
  vertexOutputs.vUv = input.uv;
  return vertexOutputs;
}`;

    const fragmentCode = `
varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;
uniform time : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let n = normalize(input.vNormal);
  let viewDir = normalize(vec3<f32>(0.0, 1.0, 0.35));
  let fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);

  let foamBand = smoothstep(0.35, 0.85, fract((input.vWorldPos.x + input.vWorldPos.z) * 0.03 + time * 0.25));
  let crestMask = smoothstep(0.05, 0.35, abs(input.vWorldPos.y));
  let foam = foamBand * crestMask * 0.55;

  let caustic = (sin(input.vWorldPos.x * 0.2 + time * 0.8) * sin(input.vWorldPos.z * 0.23 + time * 0.6)) * 0.5 + 0.5;
  let causticColor = vec3<f32>(0.18, 0.28, 0.32) * caustic * 0.25;

  var finalColor = input.vColor.rgb;
  finalColor = mix(finalColor, vec3<f32>(0.55, 0.73, 0.95), fresnel * 0.35);
  finalColor += causticColor;
  finalColor = mix(finalColor, vec3<f32>(0.96, 0.99, 1.0), foam);

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
          uniforms: ['time', 'amplitude', 'frequency'],
          needAlphaBlending: false,
        }
      );

      // Explicitly keep WGSL mode on Babylon.js template pipeline.
      (this.shaderMaterial as any).shaderLanguage = BABYLON.ShaderLanguage.WGSL;

      console.log('✅ Ocean shader material created successfully (pure WGSL, no file loading)');

      // Keep water opaque so it is clearly visible against bright sky backgrounds.
      this.shaderMaterial.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
      this.shaderMaterial.alpha = 1.0;
      this.shaderMaterial.backFaceCulling = false;
      this.shaderMaterial.wireframe = false;

      this.shaderMaterial.setFloat('time', this.waveParams.time);
      this.shaderMaterial.setFloat('amplitude', this.waveParams.amplitude);
      this.shaderMaterial.setFloat('frequency', this.waveParams.frequency * 0.08);

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
      }

      this.scene!.render();
    });

    console.log('✅ Render loop started');
  }

  private updateBoatPhysics(): void {
    if (!this.boatMesh) return;

    const boatWorldPos = this.boatMesh.getAbsolutePosition();

    const waterHeight = 
      Math.sin(boatWorldPos.x * 0.01 + this.waveParams.time) * this.waveParams.amplitude * 0.5 +
      Math.cos(boatWorldPos.z * 0.01 + this.waveParams.time) * this.waveParams.amplitude * 0.5;

    this.boatMesh.position.y = waterHeight + 3;

    const rotX = Math.sin(boatWorldPos.z * 0.01 + this.waveParams.time) * 0.12;
    const rotZ = Math.sin(boatWorldPos.x * 0.01 + this.waveParams.time) * 0.12;

    this.boatMesh.rotation = new BABYLON.Vector3(rotX, 0, rotZ);
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
