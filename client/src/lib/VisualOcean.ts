/**
 * Photorealistic Ocean Renderer - Babylon.js 9 + WebGPU + WGSL + Dynamic Foam
 */

import * as BABYLON from '@babylonjs/core';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.UniversalCamera | null = null;
  private oceanMesh: BABYLON.Mesh | null = null;
  private boatMesh: BABYLON.Mesh | null = null;
  private skyMesh: BABYLON.Mesh | null = null;
  private shaderMaterial: BABYLON.ShaderMaterial | null = null;
  private light: BABYLON.DirectionalLight | null = null;
  private shadowGenerator: BABYLON.ShadowGenerator | null = null;
  private foamComputeShader: BABYLON.ComputeShader | null = null;
  private foamTexture: BABYLON.DynamicTexture | null = null;
  private foamStorageBuffer: BABYLON.StorageBuffer | null = null;
  private foamParamsBuffer: BABYLON.UniformBuffer | null = null;
  private waveParamsBuffer: BABYLON.UniformBuffer | null = null;
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

  private foamSimParams = {
    time: 0,
    deltaTime: 0.016,
    windDir: new BABYLON.Vector2(1, 0),
    windSpeed: 0.6,
    gravity: 9.81,
    boatPos: new BABYLON.Vector3(0, 2, 0),
    boatRadius: 12,
    dissipation: 0.95,
    foamSpawnRate: 0.8,
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
      // await this.createBoat();  // Skip GLSL-based StandardMaterial
      // await this.createSkyDome();  // Skip GLSL-based StandardMaterial
      // await this.setupFoamCompute(); // TODO: Fix compute shader bindings
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
      // Load local Kiara Dawn 1K EXR - Babylon.js v9 WebGPU supports EXR natively
      const exrUrl = '/assets/images/kiara_1_dawn_1k.exr';
      this.scene.environmentTexture = await BABYLON.CubeTexture.CreateFromPrefilteredData(exrUrl, this.scene);
      this.scene.environmentIntensity = 1.0;
      console.log('✅ Kiara Dawn 1K EXR loaded from local assets');
    } catch (e) {
      console.log('ℹ️ HDRI fallback - using procedural sky', e);
    }
  }

  private async createOceanMesh(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    console.log('Creating ocean mesh...');
    
    const gridSize = 256;
    const meshSize = 1000;
    this.oceanMesh = BABYLON.MeshBuilder.CreateGround('ocean', {
      width: meshSize,
      height: meshSize,
      subdivisions: gridSize,
    }, this.scene);

    this.oceanMesh.receiveShadows = true;

    console.log('Loading WGSL shaders...');
    
    // Inline WGSL shaders to bypass file serving issues
    const vertexCode = `
struct Scene {
  viewProjection : mat4x4f,
  view : mat4x4f,
  projection : mat4x4f,
  vEyePosition : vec4f,
};

struct Mesh {
  world : mat4x4f,
  visibility : f32,
};

struct WaveParams {
  time : f32,
  amplitude : f32,
  frequency : f32,
  windDir : f32,
  windSpeed : f32,
  foamIntensity : f32,
  causticIntensity : f32,
  causticScale : f32,
};

struct OceanVertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) uv : vec2f,
};

struct OceanVertexOutput {
  @builtin(position) position : vec4f,
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

// NO @group/@binding - Babylon adds them automatically!
var<uniform> scene : Scene;
var<uniform> mesh : Mesh;
var<uniform> waveParams : WaveParams;

@vertex
fn main(input: OceanVertexInput) -> OceanVertexOutput {
  var output: OceanVertexOutput;
  let time = waveParams.time;
  let waveAmp = waveParams.amplitude;
  let waveFreq = waveParams.frequency;
  let wave1 = waveAmp * sin(input.position.x * waveFreq + time) * cos(input.position.z * waveFreq + time * 0.7);
  let wave2 = waveAmp * 0.6 * sin(input.position.x * waveFreq * 1.3 + time * 1.3) * cos(input.position.z * waveFreq * 1.3 + time * 0.9);
  let wave3 = waveAmp * 0.4 * sin(input.position.x * waveFreq * 2.0 + time * 0.8) * cos(input.position.z * waveFreq * 2.0 + time * 1.1);
  let totalWave = wave1 + wave2 + wave3;
  var displaced = input.position;
  displaced.y += totalWave;
  let worldPos = mesh.world * vec4f(displaced, 1.0);
  output.position = scene.viewProjection * worldPos;
  let depthFactor = clamp(displaced.y * 0.1 + 0.5, 0.0, 1.0);
  output.vColor = vec4f(0.0, 0.3 + depthFactor * 0.2, 0.6 + depthFactor * 0.2, 0.95);
  output.vNormal = input.normal;
  output.vWorldPos = worldPos.xyz;
  output.vUv = input.uv;
  return output;
}`;
    
    const fragmentCode = `
struct OceanFragmentInput {
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

@fragment
fn main(input: OceanFragmentInput) -> @location(0) vec4f {
  var finalColor = input.vColor.rgb;
  let viewDir = normalize(vec3f(0.0, 1.0, 0.5));
  let n = normalize(input.vNormal);
  let fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);
  let sunDir = normalize(vec3f(1.0, 1.0, 0.5));
  let reflection = reflect(-viewDir, n);
  let specular = pow(max(dot(reflection, sunDir), 0.0), 32.0);
  let causticPattern = sin(input.vWorldPos.x * 3.0) * 0.5 + 0.5;
  let causticColor = vec3f(0.8, 0.9, 1.0) * causticPattern * 0.5;
  let foam = smoothstep(0.2, 0.8, input.vWorldPos.y) * 0.3;
  let foamColor = vec3f(1.0, 1.0, 1.0) * foam;
  finalColor = mix(finalColor, vec3f(0.5, 0.7, 1.0), fresnel * 0.3);
  finalColor += causticColor + foamColor + vec3f(1.0, 0.95, 0.8) * specular * 0.8;
  return vec4f(finalColor, input.vColor.a);
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
          uniformBuffers: ['Scene', 'Mesh', 'waveParams'],
          needAlphaBlending: true,
        }
      );
      
      // Force WebGPU mode to use raw WGSL without Babylon template preprocessing
      (this.shaderMaterial as any).webgpuOptions = {
        wgslVertexSource: vertexCode,
        wgslFragmentSource: fragmentCode,
      };
      

      console.log('✅ Ocean shader material created successfully (pure WGSL, no file loading)');
      
      if (!this.engine) throw new Error('Engine not initialized');
      this.waveParamsBuffer = new BABYLON.UniformBuffer(this.engine);
      this.waveParamsBuffer.addUniform('time', 1);
      this.waveParamsBuffer.addUniform('amplitude', 1);
      this.waveParamsBuffer.addUniform('frequency', 1);
      this.waveParamsBuffer.addUniform('windDir', 1);
      this.waveParamsBuffer.addUniform('windSpeed', 1);
      this.waveParamsBuffer.addUniform('foamIntensity', 1);
      this.waveParamsBuffer.addUniform('causticIntensity', 1);
      this.waveParamsBuffer.addUniform('causticScale', 1);
      this.waveParamsBuffer.update();
      
      this.shaderMaterial.setUniformBuffer('waveParams', this.waveParamsBuffer);
      
      // Enable transparency for water rendering
      this.shaderMaterial.transparencyMode = 2;  // MATERIAL_ALPHABLEND
      this.shaderMaterial.alpha = 0.9;  // 90% opaque water
      this.shaderMaterial.backFaceCulling = false;
      this.shaderMaterial.wireframe = false;
      
      console.log('✅ WaveParams uniform buffer created and bound');
    } catch (error) {
      console.error('❌ Failed to create ocean shader material:', error);
      throw error;
    }

    this.oceanMesh.material = this.shaderMaterial;
    this.oceanMesh.position.y = 0;
    this.oceanMesh.scaling.setAll(50);  // Scale 50x for optimal visibility
    this.oceanMesh.visibility = 1.0;
    this.oceanMesh.setEnabled(true);
    this.oceanMesh.renderingGroupId = 2;  // Transparent rendering group
    
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

    const boatMaterial = new BABYLON.StandardMaterial('boatMaterial', this.scene);
    boatMaterial.emissiveColor = new BABYLON.Color3(0.85, 0.65, 0.45);
    boatMaterial.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    boatMaterial.specularPower = 128;

    this.boatMesh.material = boatMaterial;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(this.boatMesh);
    }

    console.log('✅ Boat created');
  }

  private async createSkyDome(): Promise<void> {
    if (!this.scene || !this.camera) throw new Error('Scene or camera not initialized');

    this.skyMesh = BABYLON.MeshBuilder.CreateSphere('sky', {
      diameter: 6000,
      segments: 64,
    }, this.scene);

    const skyMaterial = new BABYLON.StandardMaterial('skyMaterial', this.scene);
    skyMaterial.emissiveColor = new BABYLON.Color3(0.92, 0.96, 1.0);
    skyMaterial.backFaceCulling = false;

    this.skyMesh.material = skyMaterial;
    this.skyMesh.parent = this.camera;

    console.log('✅ Sky dome created');
  }

  private async setupFoamCompute(): Promise<void> {
    if (!this.scene || !this.engine) throw new Error('Scene or engine not initialized');

    console.log('Setting up dynamic foam compute shader...');

    try {
      const foamComputeResponse = await fetch('/shaders/foamCompute.wgsl');
      if (!foamComputeResponse.ok) throw new Error('Failed to load foam compute shader');
      const foamComputeCode = await foamComputeResponse.text();

      this.foamStorageBuffer = new BABYLON.StorageBuffer(this.engine, 4096 * 32);
      this.foamParamsBuffer = new BABYLON.UniformBuffer(this.engine);
      this.foamParamsBuffer.addUniform('time', 1);
      this.foamParamsBuffer.addUniform('deltaTime', 1);
      this.foamParamsBuffer.addUniform('windDir', 2);
      this.foamParamsBuffer.addUniform('windSpeed', 1);
      this.foamParamsBuffer.addUniform('gravity', 1);
      this.foamParamsBuffer.addUniform('boatPos', 3);
      this.foamParamsBuffer.addUniform('boatRadius', 1);
      this.foamParamsBuffer.addUniform('dissipation', 1);
      this.foamParamsBuffer.addUniform('foamSpawnRate', 1);
      this.foamParamsBuffer.update();

      this.foamTexture = new BABYLON.DynamicTexture('foamTexture', 512, this.scene);

      this.foamComputeShader = new BABYLON.ComputeShader('foamCompute', this.engine, {
        computeSource: foamComputeCode,
      }, {
        bindingsMapping: {
          particles: { group: 0, binding: 0 },
          params: { group: 0, binding: 1 },
          foamTexture: { group: 0, binding: 2 },
        },
      });

      this.foamComputeShader.setStorageBuffer('particles', this.foamStorageBuffer);
      this.foamComputeShader.setUniformBuffer('params', this.foamParamsBuffer);
      this.foamComputeShader.setTexture('foamTexture', this.foamTexture);

      console.log('✅ Foam compute shader initialized');
    } catch (error) {
      console.error('❌ Foam compute setup failed:', error);
    }
  }

  private setupRenderLoop(): void {
    if (!this.engine || !this.scene || !this.shaderMaterial) throw new Error('Engine, scene, or material not initialized');

    // Wait for WebGPU shader pipeline to compile before starting render loop
    // This prevents GLSL fallback attempts on WGSL shaders
    this.shaderMaterial.onEffectCreatedObservable.add(() => {
      console.log('✅ WebGPU shader pipeline ready - starting render loop');
      
      let lastFrameTime = performance.now();

      this.engine!.runRenderLoop(() => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;

        this.waveParams.time += 0.02;  // Fixed 0.02 per frame for consistent wave animation
        this.foamSimParams.time += deltaTime;
        this.foamSimParams.deltaTime = deltaTime;

        this.updateBoatPhysics();
        this.updateFoamSimulation();

        if (this.waveParamsBuffer) {
          this.waveParamsBuffer.updateFloat('time', this.waveParams.time);
          this.waveParamsBuffer.updateFloat('amplitude', this.waveParams.amplitude);
          this.waveParamsBuffer.updateFloat('frequency', this.waveParams.frequency);
          this.waveParamsBuffer.updateFloat('windDir', (this.waveParams.windDirection * Math.PI) / 180);
          this.waveParamsBuffer.updateFloat('windSpeed', this.waveParams.windSpeed);
          this.waveParamsBuffer.updateFloat('foamIntensity', this.waveParams.foamIntensity);
          this.waveParamsBuffer.updateFloat('causticIntensity', this.waveParams.causticIntensity);
          this.waveParamsBuffer.updateFloat('causticScale', this.waveParams.causticScale);
          this.waveParamsBuffer.update();
        }

        this.scene!.render();
      });
    });
  }

  private updateFoamSimulation(): void {
    if (!this.foamComputeShader || !this.foamParamsBuffer || !this.boatMesh) return;

    const windDir = new BABYLON.Vector2(
      Math.cos((this.waveParams.windDirection * Math.PI) / 180),
      Math.sin((this.waveParams.windDirection * Math.PI) / 180)
    );

    this.foamParamsBuffer.updateFloat('time', this.foamSimParams.time);
    this.foamParamsBuffer.updateFloat('deltaTime', this.foamSimParams.deltaTime);
    this.foamParamsBuffer.updateVector3('windDir', new BABYLON.Vector3(windDir.x, windDir.y, 0));
    this.foamParamsBuffer.updateFloat('windSpeed', this.waveParams.windSpeed);
    this.foamParamsBuffer.updateFloat('gravity', 9.81);
    this.foamParamsBuffer.updateVector3('boatPos', this.boatMesh.position);
    this.foamParamsBuffer.updateFloat('boatRadius', 12);
    this.foamParamsBuffer.updateFloat('dissipation', 0.95);
    this.foamParamsBuffer.updateFloat('foamSpawnRate', 0.8);
    this.foamParamsBuffer.update();

    this.foamComputeShader.dispatchWhenReady(64, 1, 1);
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
