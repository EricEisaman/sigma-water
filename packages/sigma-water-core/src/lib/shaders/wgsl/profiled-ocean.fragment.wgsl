#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
uniform crestFoamEnabled: f32;
uniform crestFoamThreshold: f32;
uniform foamIntensity: f32;
uniform foamWidth: f32;
uniform foamNoiseFactor: f32;
uniform intersectionFoamEnabled: f32;
uniform intersectionFoamIntensity: f32;
uniform intersectionFoamWidth: f32;
uniform intersectionFoamFalloff: f32;
uniform intersectionFoamNoise: f32;
uniform intersectionFoamVerticalRange: f32;
uniform boatCollisionCenter: vec3<f32>;
uniform islandCollisionCenter: vec3<f32>;
uniform boatCollisionRadius: f32;
uniform islandCollisionRadius: f32;
uniform boatIntersectionFoamFieldBounds: vec4<f32>;
uniform islandIntersectionFoamFieldBounds: vec4<f32>;
uniform boatIntersectionFoamFieldMaxDistance: f32;
uniform islandIntersectionFoamFieldMaxDistance: f32;
uniform boatIntersectionFoamFieldValid: f32;
uniform islandIntersectionFoamFieldValid: f32;
uniform boatIntersectionFactor: f32;
uniform islandIntersectionFactor: f32;
uniform specularIntensity: f32;
uniform depthFadeDistance: f32;
uniform depthFadeExponent: f32;
uniform underwaterEnabled: f32;
uniform underwaterTransitionDepth: f32;
uniform underwaterFogDensity: f32;
uniform underwaterHorizonMix: f32;
uniform underwaterColorR: f32;
uniform underwaterColorG: f32;
uniform underwaterColorB: f32;
uniform underwaterFactor: f32;
uniform profileShallowColor: vec3<f32>;
uniform profileMidColor: vec3<f32>;
uniform profileDeepColor: vec3<f32>;
uniform profileFoamColor: vec3<f32>;
uniform profileScatterColor: vec3<f32>;
uniform profileReflectionColor: vec3<f32>;
uniform profileHorizonGlow: vec3<f32>;
uniform profileFresnelBase: f32;
uniform profileFresnelStrength: f32;
uniform profileFresnelPower: f32;
uniform profileDepthViewScale: f32;
uniform profileToneGamma: f32;
uniform profileSpecularClamp: f32;

var boatIntersectionFoamField: texture_2d<f32>;
var boatIntersectionFoamFieldSampler: sampler;
var islandIntersectionFoamField: texture_2d<f32>;
var islandIntersectionFoamFieldSampler: sampler;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

fn getSkyColor(eIn: vec3<f32>) -> vec3<f32> {
  var e = eIn;
  e.y = (max(e.y, 0.0) * 0.78 + 0.22) * 0.82;
  return vec3<f32>(pow(1.0 - e.y, 2.0), 1.0 - e.y, 0.6 + (1.0 - e.y) * 0.4) * 1.08;
}

fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn valueNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (vec2<f32>(3.0, 3.0) - 2.0 * f);

  let a = hash21(i + vec2<f32>(0.0, 0.0));
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));

  let x1 = mix(a, b, u.x);
  let x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

fn collisionRingMask(worldPos: vec3<f32>, center: vec3<f32>, radius: f32, width: f32, verticalRange: f32) -> f32 {
  let horizontal = distance(worldPos.xz, center.xz);
  let innerCore = max(radius - width * 0.62, 0.0);
  let innerFeather = max(radius - width * 1.1, 0.0);
  let outerFeather = radius + width * 0.92;
  let outerCore = radius + width * 0.48;

  let enter = smoothstep(innerFeather, innerCore, horizontal);
  let exit = 1.0 - smoothstep(outerCore, outerFeather, horizontal);
  let ring = enter * exit;
  let heightFalloff = smoothstep(verticalRange, 0.0, abs(center.y - worldPos.y));
  return ring * heightFalloff;
}

fn sampleFoamFieldDistance(
  tex: texture_2d<f32>,
  texSampler: sampler,
  bounds: vec4<f32>,
  maxDistance: f32,
  worldPos: vec3<f32>
) -> vec2<f32> {
  let size = max(bounds.zw, vec2<f32>(0.001, 0.001));
  let uv = (worldPos.xz - bounds.xy) / size;
  let inRange = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
  let sampled = textureSample(tex, texSampler, clamp(uv, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0))).r;
  let signedDistance = (sampled * 2.0 - 1.0) * max(maxDistance, 0.001);
  return vec2<f32>(signedDistance, inRange);
}

fn foamFieldMask(
  worldPos: vec3<f32>,
  center: vec3<f32>,
  bounds: vec4<f32>,
  maxDistance: f32,
  width: f32,
  verticalRange: f32,
  tex: texture_2d<f32>,
  texSampler: sampler
) -> f32 {
  let sampled = sampleFoamFieldDistance(tex, texSampler, bounds, maxDistance, worldPos);
  let signedDistance = sampled.x;
  let inRange = sampled.y;
  let waterSideDistance = max(signedDistance, 0.0);
  let ring = 1.0 - smoothstep(0.0, max(width, 0.05), waterSideDistance);
  let heightFalloff = smoothstep(verticalRange, 0.0, abs(center.y - worldPos.y));
  return ring * heightFalloff * inRange;
}

fn foamWebPattern(
  worldPosXZ: vec2<f32>,
  windDir: vec2<f32>,
  crossDir: vec2<f32>,
  freq: f32,
  windSpd: f32,
  time: f32,
  noiseMix: f32
) -> f32 {
  let t = time * (0.08 + windSpd * 0.2);
  let advect = windDir * t + crossDir * (sin(time * 0.17) * 0.35);
  let uvBase = worldPosXZ * (freq * 0.95) + advect;
  let uvMid = worldPosXZ * (freq * 2.6) + windDir * (time * 0.22) - crossDir * (time * 0.11);
  let uvMicro = worldPosXZ * (freq * 8.6) + windDir * (time * 0.56) + crossDir * (time * 0.34);

  let macroCell = valueNoise(uvBase);
  let midCell = valueNoise(uvMid);
  let microCell = valueNoise(uvMicro);

  let macroVoid = smoothstep(0.44, 0.86, macroCell);
  let midVoid = smoothstep(0.5, 0.9, midCell);
  let lace = (1.0 - macroVoid * 0.84) * (1.0 - midVoid * 0.64);

  let microBubbles = smoothstep(0.58, 0.98, microCell);
  let bubbleFilm = mix(0.76, 1.26, microBubbles);

  let shearBand = valueNoise(worldPosXZ * (freq * 1.55) + windDir * (time * 0.3));
  let shearMask = smoothstep(0.34, 0.78, shearBand);
  let shearGain = mix(0.86, 1.18, shearMask);

  let noiseBlend = clamp(noiseMix, 0.0, 1.0);
  return clamp(mix(1.0, lace * bubbleFilm * shearGain, noiseBlend), 0.0, 1.35);
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.28, 0.92, 0.3));

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = max(uniforms.profileFresnelBase, 0.0)
    + max(uniforms.profileFresnelStrength, 0.0) * pow(1.0 - ndv, max(uniforms.profileFresnelPower, 0.5));
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.8, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  let cameraDist = max(length(scene.vEyePosition.xyz - input.vWorldPos), 0.001);

  let depthDistance = max(uniforms.depthFadeDistance, 0.2);
  let depthExp = max(uniforms.depthFadeExponent, 0.25);
  let baseDepthSpan = depthDistance * max(uniforms.profileDepthViewScale, 60.0);
  let adaptiveDepthSpan = max(baseDepthSpan, cameraDist * 0.72 + 180.0);
  let viewDepth = clamp(cameraDist / adaptiveDepthSpan, 0.0, 0.93);
  let troughDepth = clamp((1.0 - heightBand) * 0.78 + slope * 0.46, 0.0, 1.0);
  let crestLift = clamp(heightBand * (1.0 - slope) * 1.15, 0.0, 1.0);
  let pseudoDepth = clamp(troughDepth + viewDepth * 0.55 - crestLift * 0.35, 0.0, 1.0);
  let depthLerp = pow(pseudoDepth, depthExp * 0.92);

  let baseColor = mix(uniforms.profileShallowColor, uniforms.profileMidColor, smoothstep(0.08, 0.62, depthLerp));
  let bodyColor = mix(baseColor, uniforms.profileDeepColor, smoothstep(0.38, 1.0, depthLerp));
  let colorBody = mix(baseColor, bodyColor, clamp(ndl * 0.36 + 0.24, 0.0, 1.0));

  let halfVec = normalize(lightDir + viewDir);
  let specularStrength = max(uniforms.specularIntensity, 0.0);
  let gloss = clamp(0.34 + specularStrength * 0.18 - slope * 0.1, 0.14, 0.8);
  let specularRaw = pow(max(dot(normal, halfVec), 0.0), mix(24.0, 170.0, gloss)) * (0.07 + specularStrength * 0.34);
  let specularWide = pow(max(dot(normal, halfVec), 0.0), mix(16.0, 52.0, gloss)) * (0.015 + specularStrength * 0.07);
  let specular = min(specularRaw + specularWide, max(uniforms.profileSpecularClamp, 0.05));

  let wavePattern = sin(dot(input.vWorldPos.xz, windDir) * freq * 1.6 + uniforms.time * (0.3 + windSpd * 0.55));
  let crossPattern = sin(dot(input.vWorldPos.xz, crossDir) * freq * 2.1 - uniforms.time * (0.52 + windSpd * 0.72));
  let crestNoise = valueNoise(input.vWorldPos.xz * (freq * 2.8) + vec2<f32>(uniforms.time * 0.22, -uniforms.time * 0.18));
  let whitecapSeed = wavePattern * 0.65 + crossPattern * 0.35;
  let crestEnabled = step(0.5, uniforms.crestFoamEnabled);
  let crestThreshold = clamp(uniforms.crestFoamThreshold, 0.0, 0.98);
  let whitecaps = crestEnabled * smoothstep(
    crestThreshold,
    clamp(crestThreshold + uniforms.foamWidth * 0.2, crestThreshold + 0.08, 0.99),
    slope * 1.08 + whitecapSeed * 0.18 + heightBand * 0.34 + crestNoise * 0.24 + windSpd * 0.08
  );

  let collisionUv = input.vWorldPos.xz * (freq * 1.9) + vec2<f32>(uniforms.time * 0.45, -uniforms.time * 0.3);
  let collisionNoise = valueNoise(collisionUv);
  let intersectionNoise = mix(1.0, collisionNoise, clamp(uniforms.intersectionFoamNoise, 0.0, 1.0));
  let intersectionEnabled = step(0.5, uniforms.intersectionFoamEnabled);
  let intersectionFalloff = max(uniforms.intersectionFoamFalloff, 0.1);
  let boatFieldMask = foamFieldMask(
    input.vWorldPos,
    uniforms.boatCollisionCenter,
    uniforms.boatIntersectionFoamFieldBounds,
    uniforms.boatIntersectionFoamFieldMaxDistance,
    max(uniforms.intersectionFoamWidth, 0.1),
    max(uniforms.intersectionFoamVerticalRange, 0.1),
    boatIntersectionFoamField,
    boatIntersectionFoamFieldSampler
  );
  let islandFieldMask = foamFieldMask(
    input.vWorldPos,
    uniforms.islandCollisionCenter,
    uniforms.islandIntersectionFoamFieldBounds,
    uniforms.islandIntersectionFoamFieldMaxDistance,
    max(uniforms.intersectionFoamWidth, 0.1),
    max(uniforms.intersectionFoamVerticalRange, 0.1),
    islandIntersectionFoamField,
    islandIntersectionFoamFieldSampler
  );
  let boatFieldValid = step(0.5, uniforms.boatIntersectionFoamFieldValid);
  let islandFieldValid = step(0.5, uniforms.islandIntersectionFoamFieldValid);
  let boatRing = boatFieldMask * boatFieldValid;
  let islandRing = islandFieldMask * islandFieldValid;
  let shorelineContact = (
    boatRing * pow(max(uniforms.boatIntersectionFactor, 0.0), intersectionFalloff)
    + islandRing * pow(max(uniforms.islandIntersectionFactor, 0.0), intersectionFalloff)
  );

  let webPattern = foamWebPattern(
    input.vWorldPos.xz,
    windDir,
    crossDir,
    freq,
    windSpd,
    uniforms.time,
    uniforms.intersectionFoamNoise
  );
  let laceThickness = smoothstep(0.0, 1.0, shorelineContact);
  let shorelineLaceGain = mix(0.62, 1.2, pow(laceThickness, 0.65));
  let intersectionFoam = intersectionEnabled
    * max(uniforms.intersectionFoamIntensity, 0.0)
    * max(uniforms.foamIntensity, 0.0)
    * intersectionNoise
    * shorelineContact
    * shorelineLaceGain
    * webPattern;

  let scatter = uniforms.profileScatterColor * pow(1.0 - ndv, 1.9) * (0.75 + amp * 0.3);
  let reflectionDir = reflect(-viewDir, normal);
  let skyColor = getSkyColor(reflectionDir);
  let reflectionTint = mix(uniforms.profileReflectionColor, skyColor, 0.75);
  let reflected = min(reflectionTint * fresnel * (0.14 + ndl * 0.08), vec3<f32>(0.5, 0.56, 0.6));
  let lighting = colorBody * (0.14 + ndl * 0.86);
  let foamScale = max(uniforms.foamIntensity, 0.0);
  let foamColor = uniforms.profileFoamColor * (whitecaps * (0.3 + windSpd * 0.48) * foamScale + intersectionFoam * 0.65);

  let horizonGlow = uniforms.profileHorizonGlow * pow(1.0 - ndv, 2.4);
  let colorRaw = lighting + scatter + reflected + vec3<f32>(specular) + foamColor + horizonGlow;
  let colorMapped = colorRaw / (vec3<f32>(1.0) + colorRaw * 0.95);
  let color = pow(colorMapped, vec3<f32>(max(uniforms.profileToneGamma, 0.7)));
  let underwaterEnabled = step(0.5, uniforms.underwaterEnabled);
  let underwaterAmount = underwaterEnabled * clamp(uniforms.underwaterFactor, 0.0, 1.0);
  let underwaterTint = vec3<f32>(uniforms.underwaterColorR, uniforms.underwaterColorG, uniforms.underwaterColorB);
  let underwaterFog = clamp(uniforms.underwaterFogDensity, 0.0, 1.0) * (0.3 + (1.0 - ndv) * 0.7);
  let horizonBlend = clamp(uniforms.underwaterHorizonMix, 0.0, 1.0) * pow(1.0 - ndv, 2.0);
  let underwaterColor = mix(color, underwaterTint, underwaterFog) + underwaterTint * horizonBlend * 0.12;
  let finalColor = mix(color, underwaterColor, underwaterAmount);

  fragmentOutputs.color = vec4<f32>(finalColor, 1.0);
  return fragmentOutputs;
}
