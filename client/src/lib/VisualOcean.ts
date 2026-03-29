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
  Color3,
  Matrix,
  Quaternion,
  Scalar,
  KeyboardEventTypes,
  EXRCubeTexture,
  SceneLoader,
  DepthRenderer,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import '@babylonjs/loaders';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: WebGPUEngine | null = null;
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private oceanMesh: Mesh | null = null;
  private boatMesh: AbstractMesh | TransformNode | null = null;
  private islandMesh: AbstractMesh | TransformNode | null = null;
  private islandShoreMesh: AbstractMesh | null = null;
  private boatMeshes: AbstractMesh[] = [];
  private islandMeshes: AbstractMesh[] = [];
  private shaderMaterial: ShaderMaterial | null = null;
  private depthRenderer: DepthRenderer | null = null;
  private light: DirectionalLight | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private boatProxySphere: Mesh | null = null;
  private islandProxySphere: Mesh | null = null;
  private collisionMode: 'glb' | 'spheres' = 'glb';
  private showProxySpheres = true;
  private initialized = false;
  private readonly baseIslandRadius = 18;
  private readonly baseBoatHalfLen = 4.0;
  private readonly baseBoatHalfWid = 1.4;
  private readonly baseBoatFoamRadius = 2.0;
  private readonly baseWakeWidth = 0.9;
  private boatContactPos = new Vector2(-6, -12);
  private boatHalfLen = this.baseBoatHalfLen;
  private boatHalfWid = this.baseBoatHalfWid;
  private boatDraft = 0.8;
  private boatFoamRadius = this.baseBoatFoamRadius;
  private wakeWidth = this.baseWakeWidth;
  private boatModelBaseScale = 1;
  private islandModelBaseScale = 1;
  private readonly islandAnchor = new Vector2(22, 10);
  private islandCenter = new Vector2(22, 10);
  private islandRadius = this.baseIslandRadius;
  private boatStartOffset = new Vector2(-18, -14);

  private waveParams = {
    amplitude: 2.6,
    frequency: 1.35,
    windDirection: 38,
    windSpeed: 0.72,
    foamIntensity: 0.7,
    causticIntensity: 0.85,
    causticScale: 2.5,
    foamDistanceScale: 0.23,
    foamWidth: 1.0,
    foamNoiseFactor: 0.45,
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

      const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
      if (!webgpuSupported) {
        throw new Error('WebGPU not supported. Use Chrome/Edge with WebGPU enabled.');
      }

      this.engine = new WebGPUEngine(this.canvas, {
        antialias: true,
        deviceDescriptor: {
          requiredFeatures: [
            'depth-clip-control',
            'depth24unorm-stencil8',
            'depth32float-stencil8',
            'texture-compression-bc',
            'texture-compression-etc2',
            'texture-compression-astc',
            'timestamp-query',
            'indirect-first-instance',
          ] as any,
        },
      });

      (this.engine as any).dbgShowShaderCode = true;

      await this.engine.initAsync();
      console.log('✅ WebGPU engine initialized');

      this.scene = new Scene(this.engine);
      // Match glTF + OceanDemo coordinate conventions to avoid space conversion drift.
      this.scene.useRightHandedSystem = true;
      this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1.0);
      this.scene.shadowsEnabled = true;

      this.setupCamera();
      this.setupLighting();
      await this.setupIBLEnvironment();
      await this.createOceanMesh();
      await this.createBoat();
      await this.createIsland();
      this.ensureCollisionProxies();
      this.logSiblingOffsets();
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
    this.camera.maxZ = 100000;

    this.scene.activeCamera = this.camera;
    this.depthRenderer = this.scene.enableDepthRenderer(this.camera, false);

    const keyboardInput = this.camera.inputs.attached.keyboard as any;
    if (keyboardInput) {
      keyboardInput.keysDown = [40, 83];
      keyboardInput.keysLeft = [37, 65];
      keyboardInput.keysRight = [39, 68];
      keyboardInput.keysUp = [38, 87];
      keyboardInput.keysDownward = [34, 32];
      keyboardInput.keysUpward = [33, 69];
    }

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

    const cameraUpdate = this.camera.update.bind(this.camera);
    this.camera.update = function () {
      cameraUpdate();
      if (this.position.y < 1.5) {
        this.position.y = 1.5;
      }
    };

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
uniform foamWidth : f32;
uniform foamNoiseFactor : f32;
uniform boatFoamRadius : f32;
uniform wakeWidth : f32;
uniform collisionMode : f32;
uniform showProxySpheres : f32;
uniform boatSphereCenter : vec3<f32>;
uniform boatSphereRadius : f32;
uniform boatSphereCrossRadius : f32;
uniform islandSphereCenter : vec3<f32>;
uniform islandSphereRadius : f32;
uniform islandSphereCrossRadius : f32;

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
  let baseWorldPos = mesh.world * vec4<f32>(input.position, 1.0);
  let xzWorld = baseWorldPos.xz;
  let wave = waveDisplacement(xzWorld, t);
  let totalWave = wave.y;
  var displacedPos = input.position;
  displacedPos.x += wave.x;
  displacedPos.y += totalWave;
  displacedPos.z += wave.z;

  // Reconstruct local slope from nearby samples for stable high-frequency normals.
  let eps = 0.65;
  let hL = waveDisplacement(xzWorld - vec2<f32>(eps, 0.0), t).y;
  let hR = waveDisplacement(xzWorld + vec2<f32>(eps, 0.0), t).y;
  let hD = waveDisplacement(xzWorld - vec2<f32>(0.0, eps), t).y;
  let hU = waveDisplacement(xzWorld + vec2<f32>(0.0, eps), t).y;
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

fn sphereCrossSectionRingFoam(worldXZ: vec2<f32>, sphereCenter: vec3<f32>, crossRadius: f32, edgeWidth: f32) -> f32 {
  if (crossRadius <= 0.0001) {
    return 0.0;
  }

  let ringDist = abs(length(worldXZ - sphereCenter.xz) - crossRadius);
  return smoothstep(edgeWidth * max(uniforms.foamWidth, 0.05), 0.0, ringDist);
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
  let foamNoise = mix(lowFoamNoise, highFoamNoise, clamp(uniforms.foamNoiseFactor, 0.0, 1.0));
  let cutoff = 0.52;
  let crestFoam = smoothstep(cutoff, cutoff + 0.20, input.vFoamMask + (foamNoise - 0.5) * 0.45);

  // Distance-field foam around dynamic boat hull and static island shoreline.
  // diving-boat.glb is ~8m long × 2.8m wide; hull radius ~2.0m.
  let useSphereCollision = max(step(0.5, uniforms.collisionMode), step(0.5, uniforms.showProxySpheres));

  let boatDist = sdfCircle(worldXZ, uniforms.boatPos, uniforms.boatFoamRadius);
  let boatRimWidth = max(uniforms.boatFoamRadius * 0.75, 0.6) * max(uniforms.foamWidth, 0.05);
  let boatRimGLB = smoothstep(boatRimWidth, 0.0, abs(boatDist));
  let wakeDir = normalize(vec2<f32>(0.0, 1.0));
  let rel = worldXZ - uniforms.boatPos;
  let wakeLong = max(dot(rel, -wakeDir), 0.0);
  let wakeLat = abs(dot(rel, vec2<f32>(wakeDir.y, -wakeDir.x)));
  let wakeSdf = wakeLat - (uniforms.wakeWidth + wakeLong * 0.06);
  let wakeStreaks = smoothstep(0.36, 0.86, fbm(vec2<f32>(wakeLong * 0.12, wakeLat * 0.85) + vec2<f32>(-uniforms.time * 0.48, uniforms.time * 0.12)));
  let wakeFoamGLB = smoothstep(1.0, 0.0, wakeSdf) * exp(-wakeLong * 0.05) * wakeStreaks;

  let shoreDist = abs(sdfCircle(worldXZ, uniforms.islandCenter, uniforms.islandRadius));
  let shoreFoamGLB = smoothstep(6.0 * max(uniforms.foamWidth, 0.05), 0.0, shoreDist);

  let boatRimSphere = sphereCrossSectionRingFoam(worldXZ, uniforms.boatSphereCenter, uniforms.boatSphereCrossRadius, max(uniforms.boatSphereRadius * 0.1, 0.2));
  let shoreFoamSphere = sphereCrossSectionRingFoam(worldXZ, uniforms.islandSphereCenter, uniforms.islandSphereCrossRadius, max(uniforms.islandSphereRadius * 0.06, 0.45));

  let boatRim = mix(boatRimGLB, boatRimSphere, useSphereCollision);
  let wakeFoam = mix(wakeFoamGLB, 0.0, useSphereCollision);
  let shoreFoam = mix(shoreFoamGLB, shoreFoamSphere, useSphereCollision);

  let contactNoise = smoothstep(0.25, 0.85, fbm(worldXZ * 0.38 + vec2<f32>(uniforms.time * 0.21, uniforms.time * 0.16)));
  let sdfContactFoam = ((boatRim + wakeFoam) * 4.5 + shoreFoam * 0.85) * uniforms.foamDistanceScale * mix(0.72, 1.18, contactNoise);
  let rawDepthContactFoam = pow(getDepthContactFoam(input.position), uniforms.depthFadeExponent) * uniforms.foamDistanceScale * 2.2;
  let depthContactFoam = mix(rawDepthContactFoam, 0.0, useSphereCollision);
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
          uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'windSpeed', 'foamIntensity', 'causticIntensity', 'causticScale', 'boatPos', 'islandCenter', 'islandRadius', 'foamDistanceScale', 'foamWidth', 'foamNoiseFactor', 'boatFoamRadius', 'wakeWidth', 'cameraNear', 'cameraFar', 'depthFadeDistance', 'depthFadeExponent', 'collisionMode', 'showProxySpheres', 'boatSphereCenter', 'boatSphereRadius', 'boatSphereCrossRadius', 'islandSphereCenter', 'islandSphereRadius', 'islandSphereCrossRadius'],
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
      this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : this.boatContactPos);
      this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
      this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
      this.shaderMaterial.setFloat('foamDistanceScale', this.waveParams.foamDistanceScale);
      this.shaderMaterial.setFloat('foamWidth', this.waveParams.foamWidth);
      this.shaderMaterial.setFloat('foamNoiseFactor', this.waveParams.foamNoiseFactor);
      this.shaderMaterial.setFloat('boatFoamRadius', this.boatFoamRadius);
      this.shaderMaterial.setFloat('wakeWidth', this.wakeWidth);
      this.shaderMaterial.setFloat('cameraNear', this.camera?.minZ ?? 1.0);
      this.shaderMaterial.setFloat('cameraFar', this.camera?.maxZ ?? 10000.0);
      this.shaderMaterial.setFloat('depthFadeDistance', this.waveParams.depthFadeDistance);
      this.shaderMaterial.setFloat('depthFadeExponent', this.waveParams.depthFadeExponent);
      this.shaderMaterial.setFloat('collisionMode', this.collisionMode === 'spheres' ? 1 : 0);
      this.shaderMaterial.setFloat('showProxySpheres', this.showProxySpheres ? 1 : 0);
      this.shaderMaterial.setVector3('boatSphereCenter', this.boatProxySphere?.getAbsolutePosition() ?? this.boatMesh?.getAbsolutePosition() ?? new Vector3(this.boatContactPos.x, this.waveParams.boatYOffset, this.boatContactPos.y));
      this.shaderMaterial.setFloat('boatSphereRadius', this.boatFoamRadius);
      this.shaderMaterial.setFloat('boatSphereCrossRadius', this.boatFoamRadius);
      this.shaderMaterial.setVector3('islandSphereCenter', this.islandProxySphere?.getAbsolutePosition() ?? this.islandMesh?.getAbsolutePosition() ?? new Vector3(this.islandCenter.x, this.waveParams.islandYOffset, this.islandCenter.y));
      this.shaderMaterial.setFloat('islandSphereRadius', this.islandRadius);
      this.shaderMaterial.setFloat('islandSphereCrossRadius', this.islandRadius);
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
    const sourceRoot = result.meshes[0];
    if (!sourceRoot) {
      throw new Error('diving-boat.glb loaded without meshes');
    }

    const boatRoot = new TransformNode('boatRoot', this.scene);

    const importedSet = new Set(result.meshes);
    for (const node of result.meshes) {
      if (node === boatRoot) continue;
      const parent = node.parent as AbstractMesh | null;
      if (!parent || !importedSet.has(parent)) {
        node.setParent(boatRoot);
      }
    }

    result.animationGroups.forEach((g) => g.stop());

    boatRoot.name = 'boat';
    // Keep boat near island so both are visible in top-down framing.
    boatRoot.position = new Vector3(
      this.islandAnchor.x + this.boatStartOffset.x,
      0,
      this.islandAnchor.y + this.boatStartOffset.y
    );
    boatRoot.rotationQuaternion = Quaternion.Identity();
    boatRoot.scaling.setAll(1);

    this.boatMesh = boatRoot;
    // Collect only geometry-bearing meshes for shadow casting and depth rendering.
    this.boatMeshes = result.meshes.filter(m => (m as Mesh).getTotalVertices?.() > 0);

    this.boatMeshes.forEach(m => {
      m.alwaysSelectAsActiveMesh = true;
      (m as Mesh).refreshBoundingInfo?.();
      const mat = (m as Mesh).material as any;
      if (mat) {
        mat.backFaceCulling = false;
        if ('twoSidedLighting' in mat) {
          mat.twoSidedLighting = true;
        }
      }
      if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(m);
    });

    // Normalize model units to scene units (target boat length ~= 8 world units).
    this.boatModelBaseScale = this.computeModelScaleToTarget(this.boatMeshes, 8.0);
    boatRoot.scaling.setAll(this.boatModelBaseScale * this.waveParams.boatScale);

    boatRoot.position.x = this.islandAnchor.x + this.boatStartOffset.x;
    boatRoot.position.y = this.waveParams.boatYOffset;
    boatRoot.position.z = this.islandAnchor.y + this.boatStartOffset.y;

    this.updateContactBoundaries();
    this.updateDepthRenderList();
    console.log('✅ Boat loaded from diving-boat.glb');
  }

  private async createIsland(): Promise<void> {
    if (!this.scene) throw new Error('Scene not initialized');

    const result = await SceneLoader.ImportMeshAsync('', '/assets/models/', 'island.glb', this.scene);
    const sourceRoot = result.meshes[0];
    if (!sourceRoot) {
      throw new Error('island.glb loaded without meshes');
    }

    const islandRoot = new TransformNode('islandRoot', this.scene);

    const importedSet = new Set(result.meshes);
    for (const node of result.meshes) {
      if (node === islandRoot) continue;
      const parent = node.parent as AbstractMesh | null;
      if (!parent || !importedSet.has(parent)) {
        node.setParent(islandRoot);
      }
    }

    result.animationGroups.forEach((g) => g.stop());

    islandRoot.name = 'island';
    // Place island so its base sits at water level.
    islandRoot.position = new Vector3(this.islandAnchor.x, this.waveParams.islandYOffset, this.islandAnchor.y);
    islandRoot.scaling.setAll(1);

    this.islandMesh = islandRoot;
    this.islandShoreMesh = null; // Shore geometry is embedded in the GLB.
    this.islandMeshes = result.meshes.filter(m => (m as Mesh).getTotalVertices?.() > 0);

    this.islandMeshes.forEach(m => {
      m.alwaysSelectAsActiveMesh = true;
      (m as Mesh).refreshBoundingInfo?.();
      const mat = (m as Mesh).material as any;
      if (mat) {
        mat.backFaceCulling = false;
        if ('twoSidedLighting' in mat) {
          mat.twoSidedLighting = true;
        }
      }
      m.receiveShadows = true;
      if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(m);
    });

    // Normalize model units to scene units (target island radius ~= baseIslandRadius).
    this.islandModelBaseScale = this.computeModelScaleToTarget(this.islandMeshes, this.baseIslandRadius * 2.0);
    islandRoot.scaling.setAll(this.islandModelBaseScale * this.waveParams.islandScale);

    islandRoot.position.x = this.islandAnchor.x;
    islandRoot.position.y = this.waveParams.islandYOffset;
    islandRoot.position.z = this.islandAnchor.y;

    this.islandCenter.copyFromFloats(this.islandAnchor.x, this.islandAnchor.y);

    this.updateContactBoundaries();
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
      this.syncCollisionProxies();

      if (this.shaderMaterial) {
        const boatSphereCenter = this.boatProxySphere?.getAbsolutePosition() ?? this.boatMesh?.getAbsolutePosition() ?? new Vector3(this.boatContactPos.x, this.waveParams.boatYOffset, this.boatContactPos.y);
        const islandSphereCenter = this.islandProxySphere?.getAbsolutePosition() ?? this.islandMesh?.getAbsolutePosition() ?? new Vector3(this.islandCenter.x, this.waveParams.islandYOffset, this.islandCenter.y);
        const boatSphereRadius = this.boatProxySphere ? Math.max(this.boatProxySphere.scaling.x * 0.5, 0.01) : this.boatFoamRadius;
        const islandSphereRadius = this.islandProxySphere ? Math.max(this.islandProxySphere.scaling.x * 0.5, 0.01) : this.islandRadius;
        const boatWater = this.sampleWaveAt(boatSphereCenter.x, boatSphereCenter.z, this.waveParams.time);
        const islandWater = this.sampleWaveAt(islandSphereCenter.x, islandSphereCenter.z, this.waveParams.time);
        const boatDelta = Math.abs(boatSphereCenter.y - boatWater);
        const islandDelta = Math.abs(islandSphereCenter.y - islandWater);
        const boatCrossRadius = boatDelta >= boatSphereRadius ? 0 : Math.sqrt(Math.max(boatSphereRadius * boatSphereRadius - boatDelta * boatDelta, 0));
        const islandCrossRadius = islandDelta >= islandSphereRadius ? 0 : Math.sqrt(Math.max(islandSphereRadius * islandSphereRadius - islandDelta * islandDelta, 0));

        this.shaderMaterial.setFloat('time', this.waveParams.time);
        this.shaderMaterial.setFloat('amplitude', this.waveParams.amplitude);
        this.shaderMaterial.setFloat('frequency', this.waveParams.frequency * 0.08);
        this.shaderMaterial.setFloat('windDirection', this.waveParams.windDirection);
        this.shaderMaterial.setFloat('windSpeed', this.waveParams.windSpeed);
        this.shaderMaterial.setFloat('foamIntensity', this.waveParams.foamIntensity);
        this.shaderMaterial.setFloat('causticIntensity', this.waveParams.causticIntensity);
        this.shaderMaterial.setFloat('causticScale', this.waveParams.causticScale);
        this.shaderMaterial.setFloat('foamDistanceScale', this.waveParams.foamDistanceScale);
          this.shaderMaterial.setFloat('foamWidth', this.waveParams.foamWidth);
          this.shaderMaterial.setFloat('foamNoiseFactor', this.waveParams.foamNoiseFactor);
        this.shaderMaterial.setVector2('boatPos', this.boatMesh ? new Vector2(this.boatMesh.position.x, this.boatMesh.position.z) : this.boatContactPos);
        this.shaderMaterial.setVector2('islandCenter', this.islandCenter);
        this.shaderMaterial.setFloat('islandRadius', this.islandRadius);
        this.shaderMaterial.setFloat('cameraNear', this.camera?.minZ ?? 1.0);
        this.shaderMaterial.setFloat('cameraFar', this.camera?.maxZ ?? 10000.0);
        this.shaderMaterial.setFloat('boatFoamRadius', this.boatFoamRadius);
        this.shaderMaterial.setFloat('wakeWidth', this.wakeWidth);
        this.shaderMaterial.setFloat('depthFadeDistance', this.waveParams.depthFadeDistance);
        this.shaderMaterial.setFloat('depthFadeExponent', this.waveParams.depthFadeExponent);
        this.shaderMaterial.setFloat('collisionMode', this.collisionMode === 'spheres' ? 1 : 0);
        this.shaderMaterial.setFloat('showProxySpheres', this.showProxySpheres ? 1 : 0);
        this.shaderMaterial.setVector3('boatSphereCenter', boatSphereCenter);
        this.shaderMaterial.setFloat('boatSphereRadius', boatSphereRadius);
        this.shaderMaterial.setFloat('boatSphereCrossRadius', boatCrossRadius);
        this.shaderMaterial.setVector3('islandSphereCenter', islandSphereCenter);
        this.shaderMaterial.setFloat('islandSphereRadius', islandSphereRadius);
        this.shaderMaterial.setFloat('islandSphereCrossRadius', islandCrossRadius);
      }

      this.scene!.render();
    });

    console.log('✅ Render loop started');
  }

  private updateBoatPhysics(): void {
    if (!this.boatMesh) return;

    if (this.collisionMode === 'spheres') {
      this.boatMesh.position.y = this.waveParams.boatYOffset;
      if (!this.boatMesh.rotationQuaternion) {
        this.boatMesh.rotationQuaternion = Quaternion.Identity();
      }
      this.boatMesh.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
      return;
    }

    const bx = this.boatMesh.position.x;
    const bz = this.boatMesh.position.z;
    const t = this.waveParams.time;

    const halfLen = this.boatHalfLen;
    const halfWid = this.boatHalfWid;

    // Sample 5 hull points from the same wave function the shader uses.
    const hCenter    = this.sampleWaveAt(bx,           bz,           t);
    const hBow       = this.sampleWaveAt(bx,           bz + halfLen, t);
    const hStern     = this.sampleWaveAt(bx,           bz - halfLen, t);
    const hStarboard = this.sampleWaveAt(bx + halfWid, bz,           t);
    const hPort      = this.sampleWaveAt(bx - halfWid, bz,           t);

    // Heave: average water height + draft offset so waterline sits at roughly 40% hull height.
    const targetY = (hCenter + hBow + hStern + hStarboard + hPort) / 5 + this.boatDraft + (this.waveParams.boatYOffset - 0.4);
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

  private ensureCollisionProxies(): void {
    if (!this.scene) return;

    if (!this.boatProxySphere) {
      this.boatProxySphere = MeshBuilder.CreateSphere('boatCollisionSphere', { diameter: 1 }, this.scene);
      this.boatProxySphere.isPickable = false;
      this.boatProxySphere.alwaysSelectAsActiveMesh = true;
      this.boatProxySphere.renderingGroupId = 1;
    }

    if (!this.islandProxySphere) {
      this.islandProxySphere = MeshBuilder.CreateSphere('islandCollisionSphere', { diameter: 1 }, this.scene);
      this.islandProxySphere.isPickable = false;
      this.islandProxySphere.alwaysSelectAsActiveMesh = true;
      this.islandProxySphere.renderingGroupId = 1;
    }

    if (this.boatMesh && this.boatProxySphere) {
      this.boatProxySphere.parent = this.boatMesh.parent;
    }
    if (this.islandMesh && this.islandProxySphere) {
      this.islandProxySphere.parent = this.islandMesh.parent;
    }

    const makeMat = (name: string, color: Color3) => {
      const mat = new StandardMaterial(name, this.scene!);
      mat.disableLighting = true;
      mat.emissiveColor = color;
      mat.alpha = 1.0;
      return mat;
    };

    if (this.boatProxySphere && !this.boatProxySphere.material) {
      this.boatProxySphere.material = makeMat('debugBoatMat', new Color3(0.15, 1, 0.2));
    }
    if (this.islandProxySphere && !this.islandProxySphere.material) {
      this.islandProxySphere.material = makeMat('debugIslandMat', new Color3(0.2, 0.5, 1));
    }

    this.syncCollisionProxies();
    this.updateDepthRenderList();
  }

  private syncCollisionProxies(): void {
    if (this.boatProxySphere && this.boatMesh) {
      const p = this.boatMesh.getAbsolutePosition();
      this.boatProxySphere.position.copyFrom(p);
      this.boatProxySphere.scaling.setAll(Math.max(this.boatFoamRadius * 2, 0.5));
      this.boatProxySphere.isVisible = this.showProxySpheres;
      this.boatProxySphere.setEnabled(true);
    }

    if (this.islandProxySphere && this.islandMesh) {
      const p = this.islandMesh.getAbsolutePosition();
      this.islandProxySphere.position.copyFrom(p);
      this.islandProxySphere.scaling.setAll(Math.max(this.islandRadius * 2, 1));
      this.islandProxySphere.isVisible = this.showProxySpheres;
      this.islandProxySphere.setEnabled(true);
    }
  }

  private logSiblingOffsets(): void {
    const boatProxyPos = this.boatProxySphere?.getAbsolutePosition();
    const islandProxyPos = this.islandProxySphere?.getAbsolutePosition();
    const boatBounds = this.getCombinedWorldBounds(this.boatMeshes);
    const islandBounds = this.getCombinedWorldBounds(this.islandMeshes);

    if (boatProxyPos && boatBounds) {
      const boatOffset = boatBounds.center.subtract(boatProxyPos);
      console.log('[Offset] boat GLB center - boat sibling sphere:', boatOffset.toString());
    }

    if (islandProxyPos && islandBounds) {
      const islandOffset = islandBounds.center.subtract(islandProxyPos);
      console.log('[Offset] island GLB center - island sibling sphere:', islandOffset.toString());
    }
  }

  private updateDepthRenderList(): void {
    if (!this.depthRenderer) return;

    const depthMap = this.depthRenderer.getDepthMap();
    const proxyList: AbstractMesh[] = [];
    if (this.boatProxySphere) proxyList.push(this.boatProxySphere);
    if (this.islandProxySphere) proxyList.push(this.islandProxySphere);

    const renderList: AbstractMesh[] = this.collisionMode === 'spheres'
      ? proxyList
      : [...this.boatMeshes, ...this.islandMeshes];

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
      foamWidth: 'foamWidth',
      foamNoiseFactor: 'foamNoiseFactor',
      depthFadeDistance: 'depthFadeDistance',
      depthFadeExponent: 'depthFadeExponent',
      boatScale: 'boatScale',
      boatYOffset: 'boatYOffset',
      islandScale: 'islandScale',
      islandYOffset: 'islandYOffset',
      collisionMode: 'collisionMode',
      showProxySpheres: 'showProxySpheres',
      logSiblingOffsets: 'logSiblingOffsets',
    };

    const internalKey = keyMap[key] || key;
    if (internalKey in this.waveParams) {
      (this.waveParams as any)[internalKey] = value;
    }

    if (internalKey === 'collisionMode') {
      this.collisionMode = value >= 0.5 ? 'spheres' : 'glb';
      this.updateDepthRenderList();
    }

    if (internalKey === 'showProxySpheres') {
      this.showProxySpheres = value >= 0.5;
      this.syncCollisionProxies();
    }

    if (internalKey === 'logSiblingOffsets') {
      this.logSiblingOffsets();
    }

    if (internalKey === 'boatYOffset' && this.boatMesh) {
      this.boatMesh.position.y = this.waveParams.boatYOffset;
      this.syncCollisionProxies();
    }

    if (internalKey === 'boatScale' && this.boatMesh) {
      this.boatMesh.scaling.setAll(this.boatModelBaseScale * this.waveParams.boatScale);
      this.boatMesh.position.y = this.waveParams.boatYOffset;
      this.boatMeshes.forEach(m => (m as Mesh).refreshBoundingInfo?.());
      this.updateContactBoundaries();
      this.syncCollisionProxies();
    }

    if ((internalKey === 'islandScale' || internalKey === 'islandYOffset') && this.islandMesh) {
      this.islandMesh.scaling.setAll(this.islandModelBaseScale * this.waveParams.islandScale);
      this.islandMesh.position.y = this.waveParams.islandYOffset;
      this.islandMeshes.forEach(m => (m as Mesh).refreshBoundingInfo?.());
      this.updateContactBoundaries();
      this.syncCollisionProxies();
    }
  }

  private computeModelScaleToTarget(meshes: AbstractMesh[], targetSpan: number): number {
    const bounds = this.getCombinedWorldBounds(meshes);
    if (!bounds) return 1;

    const currentSpan = Math.max(bounds.extents.x * 2, bounds.extents.z * 2, 0.001);
    const scale = targetSpan / currentSpan;
    if (!Number.isFinite(scale) || scale <= 0) {
      return 1;
    }
    // Prevent bad imported bounds from producing invisible or gigantic meshes.
    return Scalar.Clamp(scale, 0.2, 20);
  }

  private getCombinedWorldBounds(meshes: AbstractMesh[]): { center: Vector3; extents: Vector3 } | null {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let hasBounds = false;

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo()?.boundingBox;
      if (!bounds) continue;

      const min = bounds.minimumWorld;
      const max = bounds.maximumWorld;
      minX = Math.min(minX, min.x);
      minY = Math.min(minY, min.y);
      minZ = Math.min(minZ, min.z);
      maxX = Math.max(maxX, max.x);
      maxY = Math.max(maxY, max.y);
      maxZ = Math.max(maxZ, max.z);
      hasBounds = true;
    }

    if (!hasBounds) return null;

    const center = new Vector3(
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5
    );
    const extents = new Vector3(
      Math.max((maxX - minX) * 0.5, 0.001),
      Math.max((maxY - minY) * 0.5, 0.001),
      Math.max((maxZ - minZ) * 0.5, 0.001)
    );

    return { center, extents };
  }

  private updateContactBoundaries(): void {
    if (this.boatMesh) {
      const p = this.boatMesh.getAbsolutePosition();
      this.boatContactPos.copyFromFloats(p.x, p.z);
    }

    // Deterministic world metrics prevent bad imported bounds from blowing up camera/object depth behavior.
    const boatScale = Math.max(this.waveParams.boatScale, 0.1);
    this.boatHalfLen = this.baseBoatHalfLen * boatScale;
    this.boatHalfWid = this.baseBoatHalfWid * boatScale;
    this.boatDraft = 0.8 * boatScale;
    this.boatFoamRadius = Math.max(this.boatHalfLen * 0.5, this.boatHalfWid * 1.2);
    this.wakeWidth = Math.max(this.boatHalfWid * 0.64, 0.35);

    if (this.islandMesh) {
      const p = this.islandMesh.getAbsolutePosition();
      this.islandCenter.copyFromFloats(p.x, p.z);
    } else {
      this.islandCenter.copyFromFloats(this.islandAnchor.x, this.islandAnchor.y);
    }
    this.islandRadius = this.baseIslandRadius * Math.max(this.waveParams.islandScale, 0.1);
  }

  public updateCamera(x: number, y: number, z: number): void {
    if (this.camera) {
      this.camera.position = new Vector3(x, y, z);
      this.camera.setTarget(new Vector3(this.islandCenter.x, 0, this.islandCenter.y));
    }
  }

  public setTopDownView(height: number = 260): void {
    if (!this.camera) return;

    this.updateContactBoundaries();

    const islandAbs = this.islandMesh
      ? this.islandMesh.getAbsolutePosition()
      : new Vector3(this.islandCenter.x, this.waveParams.islandYOffset, this.islandCenter.y);
    const boatAbs = this.boatMesh
      ? this.boatMesh.getAbsolutePosition()
      : new Vector3(this.boatContactPos.x, this.waveParams.boatYOffset, this.boatContactPos.y);

    const islandX = islandAbs.x;
    const islandY = islandAbs.y;
    const islandZ = islandAbs.z;
    const boatX = boatAbs.x;
    const boatY = boatAbs.y;
    const boatZ = boatAbs.z;

    const centerX = (islandX + boatX) * 0.5;
    const centerY = (islandY + boatY) * 0.5;
    const centerZ = (islandZ + boatZ) * 0.5;
    const separation = Math.hypot(islandX - boatX, islandZ - boatZ);
    // Keep framing bounded so bad bounds/radii can never push camera to unusable altitude.
    const topHeight = Math.max(80, Math.min(220, Math.max(height * 0.55, separation * 1.8 + 40)));
    const lookTarget = new Vector3(centerX, centerY, centerZ);
    // Offset in XZ avoids the camera up-vector singularity when looking straight down.
    const epsilon = Math.max(separation * 0.08, 2.0);

    this.camera.position = new Vector3(centerX + epsilon, centerY + topHeight, centerZ - epsilon);
    this.camera.setTarget(lookTarget);
    this.camera.speed = Math.max(this.camera.speed, 8);
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
