import * as BABYLON from "@babylonjs/core";

export interface WaterParameters {
  waveAmplitude: number;
  waveFrequency: number;
  windDirection: number;
  waterColor: BABYLON.Color3;
  deepColor: BABYLON.Color3;
  foamIntensity: number;
  causticsIntensity: number;
  sunIntensity: number;
  cameraSpeed: number;
  foamQuality: "high" | "medium" | "low";
}

export class WaterScene {
  private engine: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.UniversalCamera;
  private waterMesh!: BABYLON.Mesh;
  private waterMaterial!: BABYLON.ShaderMaterial;
  private parameters: WaterParameters;
  private time: number = 0;
  private boat!: BABYLON.TransformNode;
  private boatOriginalY: number = 5;
  private isUnderwater: boolean = false;

  constructor(engine: BABYLON.Engine) {
    this.engine = engine;
    this.parameters = {
      waveAmplitude: 1.5,
      waveFrequency: 1.0,
      windDirection: 45,
      waterColor: new BABYLON.Color3(0.1, 0.5, 0.9),
      deepColor: new BABYLON.Color3(0.0, 0.1, 0.3),
      foamIntensity: 0.6,
      causticsIntensity: 0.5,
      sunIntensity: 1.0,
      cameraSpeed: 1.0,
      foamQuality: "high",
    };

    this.setupScene();
    this.setupCamera();
    this.setupLighting();
    this.setupEnvironment();
    this.setupWater();
    this.setupBoat();
  }

  private setupScene(): void {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.collisionsEnabled = true;
    this.scene.clearColor = new BABYLON.Color4(0.5, 0.8, 1.0, 1.0);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 100;
    this.scene.fogEnd = 5000;
    this.scene.fogColor = new BABYLON.Color3(0.5, 0.8, 1.0);
  }

  private setupCamera(): void {
    this.camera = new BABYLON.UniversalCamera(
      "camera",
      new BABYLON.Vector3(0, 50, 100)
    );
    this.camera.attachControl(this.engine.getRenderingCanvas(), true);
    this.camera.speed = 50;
    this.camera.angularSensibility = 1000;
    this.camera.inertia = 0.7;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 100000;
  }

  private setupLighting(): void {
    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = 0.9;
    ambientLight.groundColor = new BABYLON.Color3(0.3, 0.5, 0.7);

    const sunLight = new BABYLON.DirectionalLight(
      "sunLight",
      new BABYLON.Vector3(0.3, 1, 0.3).normalize(),
      this.scene
    );
    sunLight.intensity = 2.0;
    sunLight.position = new BABYLON.Vector3(80, 80, 80);
  }

  private setupEnvironment(): void {
    // Sky
    const skybox = BABYLON.MeshBuilder.CreateBox(
      "skybox",
      { size: 5000 },
      this.scene
    );
    const skyMaterial = new BABYLON.StandardMaterial("skyMaterial", this.scene);
    skyMaterial.emissiveColor = new BABYLON.Color3(0.7, 0.9, 1.0);
    skyMaterial.backFaceCulling = false;
    skybox.material = skyMaterial;

    // Island
    const island = BABYLON.MeshBuilder.CreateBox(
      "island",
      { width: 100, height: 60, depth: 100 },
      this.scene
    );
    island.position.set(0, 30, -300);
    const islandMaterial = new BABYLON.StandardMaterial(
      "islandMaterial",
      this.scene
    );
    islandMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.65, 0.4);
    island.material = islandMaterial;

    // Boulders
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 150;
      const boulder = BABYLON.MeshBuilder.CreateSphere(
        `boulder_${i}`,
        { segments: 16, diameter: 15 + Math.random() * 20 },
        this.scene
      );
      boulder.position.set(
        Math.cos(angle) * radius,
        5 + Math.random() * 5,
        -200 + Math.sin(angle) * radius
      );
      const boulderMat = new BABYLON.StandardMaterial(
        `boulderMat_${i}`,
        this.scene
      );
      boulderMat.emissiveColor = new BABYLON.Color3(0.55, 0.5, 0.45);
      boulder.material = boulderMat;
    }
  }

  private setupWater(): void {
    this.waterMesh = BABYLON.MeshBuilder.CreateGround(
      "water",
      { width: 1000, height: 1000, subdivisions: 256 },
      this.scene
    );
    this.waterMesh.position.y = 0;

    // Register GLSL shaders
    BABYLON.ShaderStore.ShadersStore["waterVertexShader"] = this.getVertexShader();
    BABYLON.ShaderStore.ShadersStore["waterFragmentShader"] = this.getFragmentShader();

    // Create shader material
    this.waterMaterial = new BABYLON.ShaderMaterial(
      "waterMaterial",
      this.scene,
      "water",
      {
        attributes: ["position", "normal", "uv"],
        uniforms: [
          "worldViewProjection",
          "world",
          "time",
          "waveAmplitude",
          "waveFrequency",
          "windDirection",
          "waterColor",
          "deepColor",
          "foamIntensity",
          "causticsIntensity",
          "sunIntensity",
          "cameraPosition",
          "sunPosition",
          "foamQuality",
        ],
      }
    );

    this.waterMaterial.setFloat("time", 0);
    this.waterMaterial.setFloat("waveAmplitude", this.parameters.waveAmplitude);
    this.waterMaterial.setFloat("waveFrequency", this.parameters.waveFrequency);
    this.waterMaterial.setFloat("windDirection", this.parameters.windDirection);
    this.waterMaterial.setColor3("waterColor", this.parameters.waterColor);
    this.waterMaterial.setColor3("deepColor", this.parameters.deepColor);
    this.waterMaterial.setFloat("foamIntensity", this.parameters.foamIntensity);
    this.waterMaterial.setFloat(
      "causticsIntensity",
      this.parameters.causticsIntensity
    );
    this.waterMaterial.setFloat("sunIntensity", this.parameters.sunIntensity);
    this.waterMaterial.setInt("foamQuality", 2);
    this.waterMaterial.backFaceCulling = false;

    this.waterMesh.material = this.waterMaterial;
  }

  private getVertexShader(): string {
    return `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float windDirection;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;

vec3 gerstnerWave(vec4 wave, vec3 p, float t) {
  float steepness = wave.z;
  float wavelength = wave.w;
  float k = 6.28318 / wavelength;
  float c = sqrt(9.81 / k);
  float d = k * (p.x * wave.x + p.z * wave.y - c * t);
  float a = steepness / k;
  
  return vec3(
    wave.x * a * cos(d),
    a * sin(d),
    wave.y * a * cos(d)
  );
}

void main() {
  vec3 pos = position;
  float windRad = windDirection * 3.14159 / 180.0;
  
  vec4 wave1 = vec4(cos(windRad), sin(windRad), waveAmplitude * 0.35, 120.0 / waveFrequency);
  vec4 wave2 = vec4(cos(windRad + 1.57), sin(windRad + 1.57), waveAmplitude * 0.2, 60.0 / waveFrequency);
  vec4 wave3 = vec4(cos(windRad + 0.785), sin(windRad + 0.785), waveAmplitude * 0.15, 30.0 / waveFrequency);
  
  pos += gerstnerWave(wave1, position, time);
  pos += gerstnerWave(wave2, position, time * 1.3);
  pos += gerstnerWave(wave3, position, time * 1.7);
  
  vWorldPosition = (world * vec4(pos, 1.0)).xyz;
  vNormal = normal;
  vUv = uv;
  vWaveHeight = pos.y - position.y;
  
  gl_Position = worldViewProjection * vec4(pos, 1.0);
}
    `;
  }

  private getFragmentShader(): string {
    return `
precision highp float;

uniform float time;
uniform vec3 waterColor;
uniform vec3 deepColor;
uniform float foamIntensity;
uniform float causticsIntensity;
uniform float sunIntensity;
uniform vec3 cameraPosition;
uniform vec3 sunPosition;
uniform int foamQuality;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float caustics(vec3 p) {
  float c = 0.0;
  c += sin(p.x * 0.02 + time * 0.2) * 0.5;
  c += sin(p.y * 0.02 + time * 0.15) * 0.5;
  c += sin((p.x + p.y) * 0.015 + time * 0.1) * 0.5;
  c += noise(p.xz * 0.05 + time * 0.1) * 0.5;
  return c * 0.5 + 0.5;
}

vec3 foamHigh(vec3 p, float height) {
  float crestThreshold = 0.2 * 1.5;
  float foam = 0.0;
  
  if (height > crestThreshold) {
    foam = smoothstep(crestThreshold, crestThreshold + 0.5, height);
    foam *= (1.0 + noise(p.xz * 0.5 + time) * 0.5);
  }
  
  foam *= foamIntensity;
  return vec3(foam);
}

vec3 foamMedium(vec3 p, float height) {
  float crestThreshold = 0.25 * 1.5;
  float foam = 0.0;
  
  if (height > crestThreshold) {
    foam = smoothstep(crestThreshold, crestThreshold + 0.6, height);
  }
  
  foam *= foamIntensity * 0.85;
  return vec3(foam);
}

vec3 foamLow(vec3 p, float height) {
  float crestThreshold = 0.3 * 1.5;
  float foam = 0.0;
  
  if (height > crestThreshold) {
    foam = smoothstep(crestThreshold, crestThreshold + 0.7, height);
  }
  
  foam *= foamIntensity * 0.7;
  return vec3(foam);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 normal = normalize(vNormal);
  
  float waveNoise = sin(vWorldPosition.x * 0.02 + time) * 0.15 + 
                    cos(vWorldPosition.z * 0.02 + time) * 0.15;
  normal = normalize(normal + vec3(waveNoise * 0.5, 0.0, waveNoise * 0.5));
  
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.5);
  
  float depth = max(0.0, -vWorldPosition.y) / 100.0;
  depth = clamp(depth, 0.0, 1.0);
  
  vec3 surfaceColor = mix(waterColor, vec3(0.9, 0.95, 1.0), fresnel);
  vec3 underwaterColor = mix(deepColor, waterColor, depth);
  vec3 baseColor = mix(underwaterColor, surfaceColor, fresnel);
  
  float causticPattern = caustics(vWorldPosition);
  vec3 causticColor = vec3(causticPattern * 0.3 * causticsIntensity);
  
  vec3 sunDir = normalize(sunPosition - vWorldPosition);
  float specular = pow(max(dot(reflect(-viewDir, normal), sunDir), 0.0), 64.0) * sunIntensity * 1.5;
  
  float distToShore = abs(vWorldPosition.z + 300.0);
  float shorelineFoam = 0.0;
  if (distToShore < 100.0) {
    shorelineFoam = (1.0 - distToShore / 100.0) * 0.7 * foamIntensity;
    shorelineFoam *= sin(time * 2.0 + vWorldPosition.x * 0.05) * 0.5 + 0.5;
  }
  
  float distToBoat = distance(vWorldPosition.xz, vec2(0.0, 0.0));
  float boatFoam = 0.0;
  if (distToBoat < 60.0 && distToBoat > 5.0) {
    boatFoam = (1.0 - distToBoat / 60.0) * 0.5 * foamIntensity;
    boatFoam *= sin(time * 3.0 + distToBoat) * 0.5 + 0.5;
  }
  
  vec3 foam = vec3(0.0);
  if (foamQuality == 2) {
    foam = foamHigh(vWorldPosition, vWaveHeight);
  } else if (foamQuality == 1) {
    foam = foamMedium(vWorldPosition, vWaveHeight);
  } else {
    foam = foamLow(vWorldPosition, vWaveHeight);
  }
  
  foam += vec3(shorelineFoam + boatFoam);
  foam = clamp(foam, 0.0, 1.0);
  
  vec3 finalColor = baseColor;
  finalColor += causticColor;
  finalColor += vec3(specular) * 0.8;
  finalColor = mix(finalColor, vec3(1.0), foam * 0.6);
  
  gl_FragColor = vec4(finalColor, 0.95);
}
    `;
  }

  private setupBoat(): void {
    const boatGroup = new BABYLON.TransformNode("boatGroup", this.scene);

    const hull = BABYLON.MeshBuilder.CreateBox(
      "hull",
      { width: 15, height: 8, depth: 40 },
      this.scene
    );
    hull.parent = boatGroup;
    hull.position.y = 2;
    const hullMaterial = new BABYLON.StandardMaterial("hullMaterial", this.scene);
    hullMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0.1);
    hull.material = hullMaterial;

    const cabin = BABYLON.MeshBuilder.CreateBox(
      "cabin",
      { width: 10, height: 6, depth: 15 },
      this.scene
    );
    cabin.parent = boatGroup;
    cabin.position.set(0, 8, -5);
    const cabinMaterial = new BABYLON.StandardMaterial(
      "cabinMaterial",
      this.scene
    );
    cabinMaterial.emissiveColor = new BABYLON.Color3(0.9, 0.9, 0.85);
    cabin.material = cabinMaterial;

    const mast = BABYLON.MeshBuilder.CreateCylinder(
      "mast",
      { height: 25, diameter: 0.5 },
      this.scene
    );
    mast.parent = boatGroup;
    mast.position.set(0, 15, -8);
    const mastMaterial = new BABYLON.StandardMaterial("mastMaterial", this.scene);
    mastMaterial.emissiveColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    mast.material = mastMaterial;

    const sail = BABYLON.MeshBuilder.CreateBox(
      "sail",
      { width: 0.2, height: 18, depth: 12 },
      this.scene
    );
    sail.parent = boatGroup;
    sail.position.set(0, 12, -5);
    const sailMaterial = new BABYLON.StandardMaterial("sailMaterial", this.scene);
    sailMaterial.emissiveColor = new BABYLON.Color3(1.0, 0.95, 0.9);
    sailMaterial.alpha = 0.9;
    sail.material = sailMaterial;

    boatGroup.position.set(0, this.boatOriginalY, 0);
    this.boat = boatGroup;
  }

  private getWaveHeightAtPosition(x: number, z: number, t: number): number {
    let height = 0;
    
    const windRad = (this.parameters.windDirection * Math.PI) / 180;
    const amp = this.parameters.waveAmplitude;
    const freq = this.parameters.waveFrequency;
    
    const wave1Dir = new BABYLON.Vector2(Math.cos(windRad), Math.sin(windRad));
    const wave1Len = 120 / freq;
    const wave1K = (2 * Math.PI) / wave1Len;
    const wave1C = Math.sqrt((9.81 / wave1K) * freq);
    const wave1Phase = wave1K * (wave1Dir.x * x + wave1Dir.y * z) - wave1C * t * freq;
    height += amp * 0.35 * Math.sin(wave1Phase);
    
    const wave2Dir = new BABYLON.Vector2(
      Math.cos(windRad + Math.PI / 2),
      Math.sin(windRad + Math.PI / 2)
    );
    const wave2Len = 60 / freq;
    const wave2K = (2 * Math.PI) / wave2Len;
    const wave2C = Math.sqrt((9.81 / wave2K) * freq);
    const wave2Phase = wave2K * (wave2Dir.x * x + wave2Dir.y * z) - wave2C * t * freq * 1.3;
    height += amp * 0.2 * Math.sin(wave2Phase);
    
    const wave3Dir = new BABYLON.Vector2(
      Math.cos(windRad + Math.PI / 4),
      Math.sin(windRad + Math.PI / 4)
    );
    const wave3Len = 30 / freq;
    const wave3K = (2 * Math.PI) / wave3Len;
    const wave3C = Math.sqrt((9.81 / wave3K) * freq);
    const wave3Phase = wave3K * (wave3Dir.x * x + wave3Dir.y * z) - wave3C * t * freq * 1.7;
    height += amp * 0.15 * Math.sin(wave3Phase);
    
    return height;
  }

  public updateParameter(key: keyof WaterParameters, value: any): void {
    (this.parameters as any)[key] = value;

    switch (key) {
      case "waveAmplitude":
      case "waveFrequency":
      case "windDirection":
        this.waterMaterial.setFloat(key, value as number);
        break;
      case "waterColor":
      case "deepColor":
        this.waterMaterial.setColor3(key, value as BABYLON.Color3);
        break;
      case "foamIntensity":
      case "causticsIntensity":
      case "sunIntensity":
        this.waterMaterial.setFloat(key, value as number);
        break;
      case "foamQuality":
        const qualityMap: { [key: string]: number } = {
          high: 2,
          medium: 1,
          low: 0,
        };
        this.waterMaterial.setInt("foamQuality", qualityMap[value as string]);
        break;
    }
  }

  public render(): void {
    this.time += this.engine.getDeltaTime() / 1000;

    this.waterMaterial.setFloat("time", this.time);
    this.waterMaterial.setVector3("cameraPosition", this.camera.position);
    this.waterMaterial.setVector3("sunPosition", new BABYLON.Vector3(80, 80, 80));

    // Update boat buoyancy
    if (this.boat) {
      const boatX = this.boat.position.x;
      const boatZ = this.boat.position.z;
      const waveHeight = this.getWaveHeightAtPosition(boatX, boatZ, this.time);
      this.boat.position.y = this.boatOriginalY + waveHeight;
      
      const waveHeightFront = this.getWaveHeightAtPosition(boatX, boatZ + 10, this.time);
      const waveHeightBack = this.getWaveHeightAtPosition(boatX, boatZ - 10, this.time);
      const pitchAngle = (waveHeightFront - waveHeightBack) * 0.1;
      
      const waveHeightRight = this.getWaveHeightAtPosition(boatX + 10, boatZ, this.time);
      const waveHeightLeft = this.getWaveHeightAtPosition(boatX - 10, boatZ, this.time);
      const rollAngle = (waveHeightRight - waveHeightLeft) * 0.1;
      
      this.boat.rotation.z = rollAngle;
      this.boat.rotation.x = pitchAngle;
    }

    // Check if underwater
    const cameraY = this.camera.position.y;
    const wasUnderwater = this.isUnderwater;
    this.isUnderwater = cameraY < 0;

    if (this.isUnderwater !== wasUnderwater) {
      if (this.isUnderwater) {
        this.scene.clearColor = new BABYLON.Color4(0.0, 0.1, 0.2, 1.0);
        this.scene.fogColor = new BABYLON.Color3(0.0, 0.1, 0.2);
      } else {
        this.scene.clearColor = new BABYLON.Color4(0.5, 0.8, 1.0, 1.0);
        this.scene.fogColor = new BABYLON.Color3(0.5, 0.8, 1.0);
      }
    }

    this.scene.render();
  }

  public dispose(): void {
    this.scene.dispose();
  }
}
