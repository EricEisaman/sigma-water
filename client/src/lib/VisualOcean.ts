/**
 * Photorealistic Ocean Renderer - Babylon.js 9 + WebGPU + WGSL + Dynamic Foam
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export class VisualOcean {
  private canvas: HTMLCanvasElement;
  private engine: BABYLON.WebGPUEngine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.FreeCamera | null = null;
  private oceanMesh: BABYLON.Mesh | null = null;
  private boatMesh: BABYLON.Mesh | null = null;
  private islandMesh: BABYLON.Mesh | null = null;
  private shaderMaterial: BABYLON.ShaderMaterial | null = null;
  private light: BABYLON.DirectionalLight | null = null;
  private shadowGenerator: BABYLON.ShadowGenerator | null = null;
  private initialized = false;
  private islandCenter = new BABYLON.Vector2(22, 10);
  private islandRadius = 18;

  private waveParams = {
    amplitude: 2.6,
    frequency: 1.35,
    windDirection: 38,
    windSpeed: 0.72,
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
    
    this.camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(-17.3, 5, -9));
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

    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (!this.camera) return;
      switch (kbInfo.type) {
        case BABYLON.KeyboardEventTypes.KEYDOWN:
          if (kbInfo.event.key === 'Shift') {
            this.camera.speed = boostSpeed;
          }
          break;
        case BABYLON.KeyboardEventTypes.KEYUP:
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
    const meshSize = 3000;
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

fn waveHeight(xz: vec2<f32>, t: f32) -> f32 {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let baseDir = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  let crossDir = normalize(vec2<f32>(-baseDir.y, baseDir.x));
  let dir0 = baseDir;
  let dir1 = normalize(baseDir * 0.78 + crossDir * 0.62);
  let dir2 = normalize(baseDir * 0.4 - crossDir * 0.92);
  let dir3 = normalize(baseDir * 0.95 - crossDir * 0.3);

  let speed = 0.55 + uniforms.windSpeed * 1.75;
  let f0 = uniforms.frequency;
  let f1 = uniforms.frequency * 1.62;
  let f2 = uniforms.frequency * 2.64;
  let f3 = uniforms.frequency * 3.85;

  let a0 = uniforms.amplitude * 0.56;
  let a1 = uniforms.amplitude * 0.3;
  let a2 = uniforms.amplitude * 0.2;
  let a3 = uniforms.amplitude * 0.1;

  let p0 = dot(xz, dir0) * f0 + t * speed;
  let p1 = dot(xz, dir1) * f1 + t * speed * 1.17;
  let p2 = dot(xz, dir2) * f2 + t * speed * 0.87;
  let p3 = dot(xz, dir3) * f3 + t * speed * 1.53;

  let gerstner = sin(p0) * a0 + sin(p1) * a1 + sin(p2) * a2 + sin(p3) * a3;
  let lowNoise = fbm(xz * 0.012 + vec2<f32>(t * 0.07, -t * 0.05));
  let highNoise = fbm(xz * 0.04 + vec2<f32>(-t * 0.2, t * 0.15));
  let noiseTerm = (lowNoise - 0.5) * uniforms.amplitude * 0.38 + (highNoise - 0.5) * uniforms.amplitude * 0.18;

  return gerstner + noiseTerm;
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

  let rippleA = sin(input.vWorldPos.x * 0.16 + uniforms.time * 1.9) * sin(input.vWorldPos.z * 0.19 - uniforms.time * 1.7);
  let rippleB = sin((input.vWorldPos.x + input.vWorldPos.z) * 0.11 - uniforms.time * 2.3);
  let foamNoise = rippleA * 0.35 + rippleB * 0.25 + 0.55;
  let foamMask = clamp(input.vFoamMask * 1.45 + foamNoise * 0.26, 0.0, 1.0);

  // Distance-field foam around dynamic boat hull and static island shoreline.
  let worldXZ = input.vWorldPos.xz;
  let boatDist = sdfCircle(worldXZ, uniforms.boatPos, 5.2);
  let boatRim = smoothstep(3.0, 0.0, abs(boatDist));
  let wakeDir = normalize(vec2<f32>(0.0, 1.0));
  let rel = worldXZ - uniforms.boatPos;
  let wakeLong = max(dot(rel, -wakeDir), 0.0);
  let wakeLat = abs(dot(rel, vec2<f32>(wakeDir.y, -wakeDir.x)));
  let wakeSdf = wakeLat - (1.25 + wakeLong * 0.08);
  let wakeFoam = smoothstep(1.0, 0.0, wakeSdf) * exp(-wakeLong * 0.05);

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
      width: 7,
      height: 3.6,
      depth: 16,
    }, this.scene);

    this.boatMesh.position = new BABYLON.Vector3(-6, 1.8, -12);

    const boatMaterial = new BABYLON.PBRMaterial('boatMaterial', this.scene);
    boatMaterial.albedoColor = new BABYLON.Color3(0.88, 0.44, 0.24);
    boatMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.03, 0.01);
    boatMaterial.metallic = 0.08;
    boatMaterial.roughness = 0.52;

    this.boatMesh.material = boatMaterial;

    // Use quaternion mode from the start to avoid euler/quaternion conflicts in Babylon.
    this.boatMesh.rotationQuaternion = BABYLON.Quaternion.Identity();

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

    this.islandMesh.position = new BABYLON.Vector3(this.islandCenter.x, 9, this.islandCenter.y);
    this.islandMesh.receiveShadows = true;

    const islandMaterial = new BABYLON.PBRMaterial('islandMaterial', this.scene);
    islandMaterial.albedoColor = new BABYLON.Color3(0.47, 0.39, 0.3);
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

    const bx = this.boatMesh.position.x;
    const bz = this.boatMesh.position.z;
    const t = this.waveParams.time;

    // Hull half-extents — match mesh dimensions (depth=16, width=7)
    const halfLen = 6.8;
    const halfWid = 3.2;

    // Sample 5 hull points from the same wave function the shader uses.
    // This matches the article's ComputeBoatTransform() pattern exactly.
    const hCenter    = this.sampleWaveAt(bx,           bz,           t);
    const hBow       = this.sampleWaveAt(bx,           bz + halfLen, t);
    const hStern     = this.sampleWaveAt(bx,           bz - halfLen, t);
    const hStarboard = this.sampleWaveAt(bx + halfWid, bz,           t);
    const hPort      = this.sampleWaveAt(bx - halfWid, bz,           t);

    // Heave: average water height under hull + half-height of box mesh (3.6/2 = 1.8)
    const targetY = (hCenter + hBow + hStern + hStarboard + hPort) / 5 + 1.8;
    this.boatMesh.position.y = BABYLON.Scalar.Lerp(this.boatMesh.position.y, targetY, 0.12);

    // Derive orientation basis vectors from the water surface (article approach).
    // forward = bow point − stern point (in world space, xz span is fixed, y from wave)
    const forward = new BABYLON.Vector3(0, hBow - hStern, halfLen * 2).normalize();
    // right = starboard point − port point
    const right = new BABYLON.Vector3(halfWid * 2, hStarboard - hPort, 0).normalize();
    // up = surface normal derived from cross product
    const up = BABYLON.Vector3.Cross(forward, right).normalize();
    // Re-orthogonalize right so basis is truly orthonormal
    const rightOrtho = BABYLON.Vector3.Cross(up, forward).normalize();

    // Build a row-major rotation matrix from the three basis vectors.
    const rotMatrix = BABYLON.Matrix.FromValues(
      rightOrtho.x, rightOrtho.y, rightOrtho.z, 0,
      up.x,         up.y,         up.z,         0,
      forward.x,    forward.y,    forward.z,    0,
      0,            0,            0,             1
    );

    const targetQuat = BABYLON.Quaternion.FromRotationMatrix(rotMatrix);

    if (!this.boatMesh.rotationQuaternion) {
      this.boatMesh.rotationQuaternion = BABYLON.Quaternion.Identity();
    }
    // Slerp from current orientation to the wave-derived orientation each frame.
    BABYLON.Quaternion.SlerpToRef(
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
