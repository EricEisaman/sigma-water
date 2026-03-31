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

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

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

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.3, 0.9, 0.3));

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.01 + 0.3 * pow(1.0 - ndv, 4.2);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.8, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let depthDistance = max(uniforms.depthFadeDistance, 0.2);
  let depthExp = max(uniforms.depthFadeExponent, 0.25);
  let depthLerp = pow(clamp((1.0 - heightBand) + slope * 0.3 + amp / depthDistance * 0.2, 0.0, 1.0), depthExp * 0.72);

  let deepColor = vec3<f32>(0.005, 0.03, 0.08);
  let bodyColor = vec3<f32>(0.01, 0.11, 0.2);
  let crestColor = vec3<f32>(0.05, 0.27, 0.42);
  let baseColor = mix(crestColor, deepColor, depthLerp);
  let colorBody = mix(baseColor, bodyColor, clamp(ndl * 0.36 + 0.24, 0.0, 1.0));

  let halfVec = normalize(lightDir + viewDir);
  let specularStrength = max(uniforms.specularIntensity, 0.0);
  let gloss = clamp(0.34 + specularStrength * 0.18 - slope * 0.1, 0.14, 0.8);
  let specularRaw = pow(max(dot(normal, halfVec), 0.0), mix(24.0, 170.0, gloss)) * (0.05 + specularStrength * 0.22);
  let specular = min(specularRaw, 0.16);

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
  let boatRing = collisionRingMask(
    input.vWorldPos,
    uniforms.boatCollisionCenter,
    max(uniforms.boatCollisionRadius, 0.0),
    max(uniforms.intersectionFoamWidth, 0.1),
    max(uniforms.intersectionFoamVerticalRange, 0.1)
  );
  let islandRing = collisionRingMask(
    input.vWorldPos,
    uniforms.islandCollisionCenter,
    max(uniforms.islandCollisionRadius, 0.0),
    max(uniforms.intersectionFoamWidth, 0.1),
    max(uniforms.intersectionFoamVerticalRange, 0.1)
  );
  let intersectionFoam = intersectionEnabled
    * max(uniforms.intersectionFoamIntensity, 0.0)
    * max(uniforms.foamIntensity, 0.0)
    * intersectionNoise
    * (
      boatRing * pow(max(uniforms.boatIntersectionFactor, 0.0), intersectionFalloff)
      + islandRing * pow(max(uniforms.islandIntersectionFactor, 0.0), intersectionFalloff)
    );

  let scatter = vec3<f32>(0.0, 0.045, 0.07) * pow(1.0 - ndv, 1.9) * (0.75 + amp * 0.3);
  let reflected = vec3<f32>(0.74, 0.85, 0.97) * fresnel * 0.1;
  let lighting = colorBody * (0.14 + ndl * 0.86);
  let foamScale = max(uniforms.foamIntensity, 0.0);
  let foamColor = vec3<f32>(0.73, 0.84, 0.92) * (whitecaps * (0.3 + windSpd * 0.48) * foamScale + intersectionFoam * 0.65);

  let horizonGlow = vec3<f32>(0.04, 0.07, 0.11) * pow(1.0 - ndv, 2.4);
  let colorRaw = lighting + scatter + reflected + vec3<f32>(specular) + foamColor + horizonGlow;
  let colorMapped = colorRaw / (vec3<f32>(1.0) + colorRaw * 1.8);
  let luma = dot(colorMapped, vec3<f32>(0.2126, 0.7152, 0.0722));
  let lumaClamp = min(1.0, 0.74 / max(luma, 0.0001));
  let color = colorMapped * lumaClamp;
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
