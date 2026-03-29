/**
 * Photorealistic Ocean Renderer - Babylon.js 9 + WebGPU + WGSL + Dynamic Foam
 */

import {
  WebGPUEngine,
  Scene,
  FreeCamera,
  DirectionalLight,
  ShadowGenerator,
  ShaderMaterial,
  ShaderLanguage,
  MeshBuilder,
  Mesh,
  AbstractMesh,
  Material,
  Vector2,
  Vector3,
  Color4,
  Matrix,
  Quaternion,
  Scalar,
  KeyboardEventTypes,
  EXRCubeTexture,
  SceneLoader,
  DepthRenderer,
} from '@babylonjs/core';
import '@babylonjs/loaders';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: WebGPUEngine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private oceanMesh: Mesh | null = null;
  private boatMesh: AbstractMesh | null = null;
  private islandMesh: AbstractMesh | null = null;
  private islandShoreMesh: AbstractMesh | null = null;
  private boatMeshes: AbstractMesh[] = [];
  private islandMeshes: AbstractMesh[] = [];
  private shaderMaterial: ShaderMaterial | null = null;
  private depthRenderer: DepthRenderer | null = null;
  private light: DirectionalLight | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private initialized = false;
  private readonly baseIslandRadius = 18;
  private readonly baseBoatHalfLen = 4.0;
  private readonly baseBoatHalfWid = 1.4;
  private readonly baseBoatFoamRadius = 2.0;
  private readonly baseWakeWidth = 0.9;
  private islandCenter = new Vector2(22, 10);
  private islandRadius = this.baseIslandRadius;

  private waveParams = {
    amplitude: 2.6,
    frequency: 1.35,
    windDirection: 38,
    windSpeed: 0.72,
    foamIntensity: 0.7,
    causticIntensity: 0.85,
    causticScale: 2.5,
    foamDistanceScale: 0.23,
    depthFadeDistance: 1.15,
    depthFadeExponent: 1.65,
    boatScale: 1,
    boatYOffset: 0.4,
    islandScale: 1,
    islandYOffset: 0,
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

      this.engine = new WebGPUEngine(this.canvas, {
        enableAllFeatures: true,
        antialias: true,
      });

      (this.engine as any).dbgShowShaderCode = true;

      await this.engine.initAsync();
      console.log('✅ WebGPU engine initialized');

      this.scene = new Scene(this.engine);
      this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1.0);
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
    
    this.camera = new FreeCamera('camera', new Vector3(-17.3, 5, -9));
    this.camera.attachControl(this.canvas, true);
    this.camera.rotation.set(0.21402315044176745, 1.5974857677541419, 0);
    const normalSpeed = 4;
    const boostSpeed = 12;
    this.camera.speed = normalSpeed;
    this.camera.angularSensibility = 1000;
    this.camera.inertia = 0.8;
    this.camera.minZ = 1;
    this.camera.maxZ = 10000;

    this.scene.activeCamera = this.camera;
    this.depthRenderer = this.scene.enableDepthRenderer(this.camera, false);

    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (!this.camera) return;
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          if (kbInfo.event.key === 'Shift') {
            this.camera.speed = boostSpeed;
          }
          break;
        case KeyboardEventTypes.KEYUP:
          if (kbInfo.event.key === 'Shift') {
            this.camera.speed = normalSpeed;
          }
          break;
      }
    });

    // Keep startup framing just above water level while allowing full navigation.
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.camera && this.camera.position.y < 1.8) {
        this.camera.position.y = 1.8;
      }
    });

    console.log('✅ Camera configured');
  }

  private setupLighting(): void {
    if (!this.scene) throw new Error('Scene not initialized');
    
    this.light = new DirectionalLight('sunLight', new Vector3(-0.8, 1.0, -0.6), this.scene);
    this.light.intensity = 1.5;
    this.light.range = 2500;

    this.shadowGenerator = new ShadowGenerator(2048, this.light);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    console.log('✅ Lighting configured');
  }

  private async setupIBLEnvironment(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');
    try {
      // Load local Kiara Dawn 1K EXR using EXRCubeTexture
      const exrUrl = '/assets/images/citrus_orchard_road_puresky_1k.exr';
      const envTexture = new EXRCubeTexture(exrUrl, this.scene, 512);
      this.scene.environmentTexture = envTexture;
      this.scene.environmentIntensity = 1.2;
      // Create skybox from the IBL texture (true = PBR skybox)
      this.scene.createDefaultSkybox(envTexture, true, 5000, 0.3, false);
      console.log('✅ Citrus Orchard Road Puresky 1K EXR loaded');
    } catch (e) {
      console.warn('⚠️ EXR load failed - using solid sky color', e);
    }
  }

  private async createOceanMesh(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    console.log('Creating ocean mesh...');
    
    const gridSize = 320;
    const meshSize = 3000;
    this.oceanMesh = MeshBuilder.CreateGround('ocean', {
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
uniform boatFoamRadius : f32;
uniform wakeWidth : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;
varying vFoamMask : f32;

fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn noise2(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash2(i + vec2<f32>(0.0, 0.0));
  let b = hash2(i + vec2<f32>(1.0, 0.0));
  let c = hash2(i + vec2<f32>(0.0, 1.0));
  let d = hash2(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var freq = 1.0;

  for (var i = 0; i < 4; i = i + 1) {
    value += noise2(p * freq) * amp;
    freq *= 2.02;
    amp *= 0.53;
  }

  return value;
}

fn waveDisplacement(xz: vec2<f32>, t: f32) -> vec3<f32> {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let baseDir = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  let crossDir = normalize(vec2<f32>(-baseDir.y, baseDir.x));
  let dir0 = baseDir;
  let dir1 = normalize(baseDir * 0.78 + crossDir * 0.62);
  let dir2 = normalize(baseDir * 0.4 - crossDir * 0.92);
  let dir3 = normalize(baseDir * 0.95 - crossDir * 0.3);
  let dir4 = normalize(baseDir * 0.18 + crossDir * 0.98);

  let speed = 0.55 + uniforms.windSpeed * 1.75;
  let f0 = uniforms.frequency;
  let f1 = uniforms.frequency * 1.62;
  let f2 = uniforms.frequency * 2.64;
  let f3 = uniforms.frequency * 3.85;
  let f4 = uniforms.frequency * 5.4;

  let a0 = uniforms.amplitude * 0.56;
  let a1 = uniforms.amplitude * 0.3;
  let a2 = uniforms.amplitude * 0.2;
  let a3 = uniforms.amplitude * 0.1;
  let a4 = uniforms.amplitude * 0.06;

  let p0 = dot(xz, dir0) * f0 + t * speed;
  let p1 = dot(xz, dir1) * f1 + t * speed * 1.17;
  let p2 = dot(xz, dir2) * f2 + t * speed * 0.87;
  let p3 = dot(xz, dir3) * f3 + t * speed * 1.53;
  let p4 = dot(xz, dir4) * f4 + t * speed * 1.95;

  let gerstner = sin(p0) * a0 + sin(p1) * a1 + sin(p2) * a2 + sin(p3) * a3 + sin(p4) * a4;
  let chop = 0.28 + uniforms.windSpeed * 0.24;
  let dispX = (cos(p0) * a0 * dir0.x + cos(p1) * a1 * dir1.x + cos(p2) * a2 * dir2.x + cos(p3) * a3 * dir3.x + cos(p4) * a4 * dir4.x) * chop;
  let dispZ = (cos(p0) * a0 * dir0.y + cos(p1) * a1 * dir1.y + cos(p2) * a2 * dir2.y + cos(p3) * a3 * dir3.y + cos(p4) * a4 * dir4.y) * chop;
  let lowNoise = fbm(xz * 0.012 + vec2<f32>(t * 0.07, -t * 0.05));
  let highNoise = fbm(xz * 0.04 + vec2<f32>(-t * 0.2, t * 0.15));
  let noiseTerm = (lowNoise - 0.5) * uniforms.amplitude * 0.38 + (highNoise - 0.5) * uniforms.amplitude * 0.18;

  return vec3<f32>(dispX, gerstner + noiseTerm, dispZ);
}

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let t = uniforms.time;
  let xz = input.position.xz;
  let wave = waveDisplacement(xz, t);
  let totalWave = wave.y;
  var displacedPos = input.position;
  displacedPos.x += wave.x;
  displacedPos.y += totalWave;
  displacedPos.z += wave.z;

  // Reconstruct local slope from nearby samples for stable high-frequency normals.
  let eps = 0.65;
  let hL = waveDisplacement(xz - vec2<f32>(eps, 0.0), t).y;
  let hR = waveDisplacement(xz + vec2<f32>(eps, 0.0), t).y;
  let hD = waveDisplacement(xz - vec2<f32>(0.0, eps), t).y;
  let hU = waveDisplacement(xz + vec2<f32>(0.0, eps), t).y;
  let dHdX = (hR - hL) / (2.0 * eps);
  let dHdZ = (hU - hD) / (2.0 * eps);
  let d2HdX = (hR - 2.0 * totalWave + hL) / (eps * eps);
  let d2HdZ = (hU - 2.0 * totalWave + hD) / (eps * eps);
  let curvature = max((d2HdX + d2HdZ) * 0.5, 0.0);
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
  let slopeFoam = length(vec2<f32>(dHdX, dHdZ)) * 0.22;
  let crestFoam = curvature * 2.6;
  vertexOutputs.vFoamMask = clamp(slopeFoam + crestFoam, 0.0, 1.0);
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
uniform cameraNear : f32;
uniform cameraFar : f32;
uniform depthFadeDistance : f32;
uniform depthFadeExponent : f32;
var sceneDepthSampler: sampler;
var sceneDepth: texture_2d<f32>;

fn pow5(v: f32) -> f32 {
  let v2 = v * v;
  return v2 * v2 * v;
}

fn sdfCircle(p: vec2<f32>, center: vec2<f32>, radius: f32) -> f32 {
  return length(p - center) - radius;
}

fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn noise2(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash2(i + vec2<f32>(0.0, 0.0));
  let b = hash2(i + vec2<f32>(1.0, 0.0));
  let c = hash2(i + vec2<f32>(0.0, 1.0));
  let d = hash2(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var freq = 1.0;

  for (var i = 0; i < 5; i = i + 1) {
    value += noise2(p * freq) * amp;
    freq *= 2.07;
    amp *= 0.52;
  }

  return value;
}

fn linearizeDepth(depth: f32) -> f32 {
  let z = clamp(depth, 0.00001, 0.99999);
  let n = uniforms.cameraNear;
  let f = uniforms.cameraFar;
  return (n * f) / max(f - z * (f - n), 0.0001);
}

fn getDepthContactFoam(screenPos: vec4<f32>) -> f32 {
  let texSize = vec2<f32>(textureDimensions(sceneDepth));
  let uv = clamp(screenPos.xy / texSize, vec2<f32>(0.001), vec2<f32>(0.999));

  // WebGPU depth textures can be inverted depending on backend / render path;
  // selecting the nearer valid sample keeps the fade robust across platforms.
  let sceneDepthA = textureSample(sceneDepth, sceneDepthSampler, uv).r;
  let sceneDepthB = textureSample(sceneDepth, sceneDepthSampler, vec2<f32>(uv.x, 1.0 - uv.y)).r;
  let sceneDepthRaw = min(sceneDepthA, sceneDepthB);
  let validDepth = 1.0 - step(0.9999, sceneDepthRaw);

  let sceneLinear = linearizeDepth(sceneDepthRaw);
  let surfaceLinear = linearizeDepth(screenPos.z);
  let depthDelta = abs(sceneLinear - surfaceLinear);
  let contact = 1.0 - smoothstep(0.0, uniforms.depthFadeDistance, depthDelta);

  return contact * validDepth;
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

  let worldXZ = input.vWorldPos.xz;
  let lowFoamNoise = fbm(worldXZ * 0.14 + vec2<f32>(uniforms.time * 0.09, -uniforms.time * 0.07));
  let highFoamNoise = fbm(worldXZ * 0.43 + vec2<f32>(-uniforms.time * 0.31, uniforms.time * 0.27));
  let foamNoise = lowFoamNoise * 0.64 + highFoamNoise * 0.36;
  let cutoff = 0.52;
  let crestFoam = smoothstep(cutoff, cutoff + 0.20, input.vFoamMask + (foamNoise - 0.5) * 0.45);

  // Distance-field foam around dynamic boat hull and static island shoreline.
  // diving-boat.glb is ~8m long × 2.8m wide; hull radius ~2.0m.
  let boatDist = sdfCircle(worldXZ, uniforms.boatPos, uniforms.boatFoamRadius);
  let boatRimWidth = max(uniforms.boatFoamRadius * 0.75, 0.6);
  let boatRim = smoothstep(boatRimWidth, 0.0, abs(boatDist));
  let wakeDir = normalize(vec2<f32>(0.0, 1.0));
  let rel = worldXZ - uniforms.boatPos;
  let wakeLong = max(dot(rel, -wakeDir), 0.0);
  let wakeLat = abs(dot(rel, vec2<f32>(wakeDir.y, -wakeDir.x)));
  let wakeSdf = wakeLat - (uniforms.wakeWidth + wakeLong * 0.06);
  let wakeStreaks = smoothstep(0.36, 0.86, fbm(vec2<f32>(wakeLong * 0.12, wakeLat * 0.85) + vec2<f32>(-uniforms.time * 0.48, uniforms.time * 0.12)));
  let wakeFoam = smoothstep(1.0, 0.0, wakeSdf) * exp(-wakeLong * 0.05) * wakeStreaks;

  let shoreDist = abs(sdfCircle(worldXZ, uniforms.islandCenter, uniforms.islandRadius));
  let shoreFoam = smoothstep(6.0, 0.0, shoreDist);

  let contactNoise = smoothstep(0.25, 0.85, fbm(worldXZ * 0.38 + vec2<f32>(uniforms.time * 0.21, uniforms.time * 0.16)));
  let sdfContactFoam = ((boatRim + wakeFoam) * 4.5 + shoreFoam * 0.85) * uniforms.foamDistanceScale * mix(0.72, 1.18, contactNoise);
  let depthContactFoam = pow(getDepthContactFoam(input.position), uniforms.depthFadeExponent) * uniforms.foamDistanceScale * 2.2;
  let distanceFoam = clamp(max(sdfContactFoam, depthContactFoam), 0.0, 1.0);
  let foam = clamp(max(crestFoam, distanceFoam), 0.0, 1.0) * uniforms.foamIntensity;

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
      this.shaderMaterial = new ShaderMaterial(
        'oceanShader',
        this.scene,
        {
          vertexSource: vertexCode,
          fragmentSource: fragmentCode,
        },
        {
          attributes: ['position', 'normal', 'uv'],
          uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'windSpeed', 'foamIntensity', 'causticIntensity', 'causticScale', 'boatPos', 'islandCenter', 'islandRadius', 'foamDistanceScale', 'boatFoamRadius', 'wakeWidth', 'cameraNear', 'cameraFar', 'depthFadeDistance', 'depthFadeExponent'],
          samplers: ['sceneDepth'],
          uniformBuffers: ['Scene', 'Mesh'],
          needAlphaBlending: false,
          shaderLanguage: ShaderLanguage.WGSL,
        }
      );

      console.log('✅ Ocean shader material created successfully (pure WGSL, no file loading)');

      // Keep water opaque so it is clearly visible against bright sky backgrounds.
      this.shaderMaterial.transparencyMode = Material.MATERIAL_OPAQUE;
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
      this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : Vector2.Zero());
      this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
      this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
      this.shaderMaterial.setFloat('foamDistanceScale', this.waveParams.foamDistanceScale);
      this.shaderMaterial.setFloat('boatFoamRadius', this.baseBoatFoamRadius * this.waveParams.boatScale);
      this.shaderMaterial.setFloat('wakeWidth', this.baseWakeWidth * this.waveParams.boatScale);
      this.shaderMaterial.setFloat('cameraNear', this.camera?.minZ ?? 1.0);
      this.shaderMaterial.setFloat('cameraFar', this.camera?.maxZ ?? 10000.0);
      this.shaderMaterial.setFloat('depthFadeDistance', this.waveParams.depthFadeDistance);
      this.shaderMaterial.setFloat('depthFadeExponent', this.waveParams.depthFadeExponent);
      if (this.depthRenderer) {
        this.shaderMaterial.setTexture('sceneDepth', this.depthRenderer.getDepthMap());
      }

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

    const result = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'diving-boat.glb', this.scene);

    const root = result.meshes[0];
    root.name = 'boat';
    // Position the boat near its starting point; Y=0 lets the physics heave it onto the waves.
    root.position = new Vector3(-6, 0, -12);
    root.rotationQuaternion = Quaternion.Identity();
    root.scaling.setAll(this.waveParams.boatScale);

    this.boatMesh = root;
    // Collect only geometry-bearing meshes for shadow casting and depth rendering.
    this.boatMeshes = result.meshes.filter(m => (m as Mesh).getTotalVertices?.() > 0);

    this.boatMeshes.forEach(m => {
      if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(m);
    });

    this.updateDepthRenderList();
    console.log('✅ Boat loaded from diving-boat.glb');
  }

  private async createIsland(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    const result = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'island.glb', this.scene);

    const root = result.meshes[0];
    root.name = 'island';
    // Place island so its base sits at water level.
    root.position = new Vector3(this.islandCenter.x, this.waveParams.islandYOffset, this.islandCenter.y);
    root.scaling.setAll(this.waveParams.islandScale);

    this.islandMesh = root;
    this.islandShoreMesh = null; // Shore geometry is embedded in the GLB.
    this.islandMeshes = result.meshes.filter(m => (m as Mesh).getTotalVertices?.() > 0);

    this.islandMeshes.forEach(m => {
      m.receiveShadows = true;
      if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(m);
    });

    this.updateDepthRenderList();
    console.log('✅ Island loaded from island.glb');
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
        this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : Vector2.Zero());
        this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
        this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
        this.shaderMaterial.setFloat('cameraNear', this.camera?.minZ ?? 1.0);
        this.shaderMaterial.setFloat('cameraFar', this.camera?.maxZ ?? 10000.0);
        this.shaderMaterial.setFloat('boatFoamRadius', this.baseBoatFoamRadius * this.waveParams.boatScale);
        this.shaderMaterial.setFloat('wakeWidth', this.baseWakeWidth * this.waveParams.boatScale);
        this.shaderMaterial.setFloat('depthFadeDistance', this.waveParams.depthFadeDistance);
        this.shaderMaterial.setFloat('depthFadeExponent', this.waveParams.depthFadeExponent);
      }

      this.scene!.render();
    });

    console.log('✅ Render loop started');
  }

  private updateBoatPhysics(): void {
    if (!this.boatMesh) return;

    const bx = this.boatMesh.position.x;
    const bz = this.boatMesh.position.z;
    const t = this.waveParams.time;

    // Hull half-extents for diving-boat.glb (approx 8m long, 2.8m wide).
    const halfLen = this.baseBoatHalfLen * this.waveParams.boatScale;
    const halfWid = this.baseBoatHalfWid * this.waveParams.boatScale;

    // Sample 5 hull points from the same wave function the shader uses.
    const hCenter    = this.sampleWaveAt(bx,           bz,           t);
    const hBow       = this.sampleWaveAt(bx,           bz + halfLen, t);
    const hStern     = this.sampleWaveAt(bx,           bz - halfLen, t);
    const hStarboard = this.sampleWaveAt(bx + halfWid, bz,           t);
    const hPort      = this.sampleWaveAt(bx - halfWid, bz,           t);

    // Heave: average water height + draft offset so waterline sits at roughly 40% hull height.
    const targetY = (hCenter + hBow + hStern + hStarboard + hPort) / 5 + this.waveParams.boatYOffset;
    this.boatMesh.position.y = Scalar.Lerp(this.boatMesh.position.y, targetY, 0.12);

    // Derive orientation basis vectors from the water surface (article approach).
    // forward = bow point − stern point (in world space, xz span is fixed, y from wave)
    const forward = new Vector3(0, hBow - hStern, halfLen * 2).normalize();
    // right = starboard point − port point
    const right = new Vector3(halfWid * 2, hStarboard - hPort, 0).normalize();
    // up = surface normal derived from cross product
    const up = Vector3.Cross(forward, right).normalize();
    // Re-orthogonalize right so basis is truly orthonormal
    const rightOrtho = Vector3.Cross(up, forward).normalize();

    // Build a row-major rotation matrix from the three basis vectors.
    const rotMatrix = Matrix.FromValues(
      rightOrtho.x, rightOrtho.y, rightOrtho.z, 0,
      up.x,         up.y,         up.z,         0,
      forward.x,    forward.y,    forward.z,    0,
      0,            0,            0,             1
    );

    const targetQuat = Quaternion.FromRotationMatrix(rotMatrix);

    if (!this.boatMesh.rotationQuaternion) {
      this.boatMesh.rotationQuaternion = Quaternion.Identity();
    }
    // Slerp from current orientation to the wave-derived orientation each frame.
    Quaternion.SlerpToRef(
      this.boatMesh.rotationQuaternion,
      targetQuat,
      0.12,
      this.boatMesh.rotationQuaternion
    );
  }

  private sampleWaveAt(x: number, z: number, t: number): number {
    const angle = (this.waveParams.windDirection * Math.PI) / 180;
    const baseDirX = Math.cos(angle);
    const baseDirZ = Math.sin(angle);
    const crossX = -baseDirZ;
    const crossZ = baseDirX;

    const dir0 = this.normalize2(baseDirX, baseDirZ);
    const dir1 = this.normalize2(baseDirX * 0.78 + crossX * 0.62, baseDirZ * 0.78 + crossZ * 0.62);
    const dir2 = this.normalize2(baseDirX * 0.4 - crossX * 0.92, baseDirZ * 0.4 - crossZ * 0.92);
    const dir3 = this.normalize2(baseDirX * 0.95 - crossX * 0.3, baseDirZ * 0.95 - crossZ * 0.3);

    const speed = 0.55 + this.waveParams.windSpeed * 1.75;
    const f0 = this.waveParams.frequency * 0.08;
    const f1 = f0 * 1.62;
    const f2 = f0 * 2.64;
    const f3 = f0 * 3.85;

    const a0 = this.waveParams.amplitude * 0.56;
    const a1 = this.waveParams.amplitude * 0.3;
    const a2 = this.waveParams.amplitude * 0.2;
    const a3 = this.waveParams.amplitude * 0.1;

    const p0 = (x * dir0.x + z * dir0.y) * f0 + t * speed;
    const p1 = (x * dir1.x + z * dir1.y) * f1 + t * speed * 1.17;
    const p2 = (x * dir2.x + z * dir2.y) * f2 + t * speed * 0.87;
    const p3 = (x * dir3.x + z * dir3.y) * f3 + t * speed * 1.53;

    const gerstner = Math.sin(p0) * a0 + Math.sin(p1) * a1 + Math.sin(p2) * a2 + Math.sin(p3) * a3;
    const lowNoise = this.fbm2(x * 0.012 + t * 0.07, z * 0.012 - t * 0.05);
    const highNoise = this.fbm2(x * 0.04 - t * 0.2, z * 0.04 + t * 0.15);
    const noiseTerm = (lowNoise - 0.5) * this.waveParams.amplitude * 0.38 + (highNoise - 0.5) * this.waveParams.amplitude * 0.18;

    return gerstner + noiseTerm;
  }

  private normalize2(x: number, y: number): { x: number; y: number } {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  private hash2(x: number, y: number): number {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  private noise2(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = this.hash2(ix, iy);
    const b = this.hash2(ix + 1, iy);
    const c = this.hash2(ix, iy + 1);
    const d = this.hash2(ix + 1, iy + 1);

    const x1 = a + (b - a) * ux;
    const x2 = c + (d - c) * ux;
    return x1 + (x2 - x1) * uy;
  }

  private fbm2(x: number, y: number): number {
    let value = 0;
    let amp = 0.5;
    let freq = 1;

    for (let i = 0; i < 4; i += 1) {
      value += this.noise2(x * freq, y * freq) * amp;
      freq *= 2.02;
      amp *= 0.53;
    }

    return value;
  }

  private onWindowResize(): void {
    if (this.engine) {
      this.engine.resize();
    }
  }

  private updateDepthRenderList(): void {
    if (!this.depthRenderer) return;

    const depthMap = this.depthRenderer.getDepthMap();
    // Use the geometry sub-mesh arrays populated when GLBs were loaded.
    const renderList: AbstractMesh[] = [
      ...this.boatMeshes,
      ...this.islandMeshes,
    ];

    depthMap.renderList = renderList;

    if (this.shaderMaterial) {
      this.shaderMaterial.setTexture('sceneDepth', depthMap);
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
      depthFadeDistance: 'depthFadeDistance',
      depthFadeExponent: 'depthFadeExponent',
      boatScale: 'boatScale',
      boatYOffset: 'boatYOffset',
      islandScale: 'islandScale',
      islandYOffset: 'islandYOffset',
    };

    const internalKey = keyMap[key] || key;
    if (internalKey in this.waveParams) {
      (this.waveParams as any)[internalKey] = value;
    }

    if (internalKey === 'boatScale' && this.boatMesh) {
      this.boatMesh.scaling.setAll(this.waveParams.boatScale);
    }

    if ((internalKey === 'islandScale' || internalKey === 'islandYOffset') && this.islandMesh) {
      this.islandMesh.scaling.setAll(this.waveParams.islandScale);
      this.islandMesh.position.y = this.waveParams.islandYOffset;
      this.islandRadius = this.baseIslandRadius * this.waveParams.islandScale;
    }
  }

  public updateCamera(x: number, y: number, z: number): void {
    if (this.camera) {
      this.camera.position = new Vector3(x, y, z);
      this.camera.setTarget(new Vector3(this.islandCenter.x, 0, this.islandCenter.y));
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
