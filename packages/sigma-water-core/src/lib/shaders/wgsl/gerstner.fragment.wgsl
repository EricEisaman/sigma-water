#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
uniform foamIntensity: f32;
uniform foamWidth: f32;
uniform foamNoiseFactor: f32;
uniform foamCellScale: f32;
uniform foamShredSlope: f32;
uniform foamFizzWeight: f32;
uniform causticIntensity: f32;
uniform specularIntensity: f32;
uniform depthFadeDistance: f32;
uniform depthFadeExponent: f32;
uniform boatCollisionCenter: vec3<f32>;
uniform islandCollisionCenter: vec3<f32>;
uniform boatCollisionRadius: f32;
uniform islandCollisionRadius: f32;
uniform collisionFoamStrength: f32;

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

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var samplePos = p;

  for (var i = 0; i < 4; i = i + 1) {
    value += valueNoise(samplePos) * amplitude;
    samplePos = samplePos * 2.03 + vec2<f32>(13.7, 7.9);
    amplitude *= 0.5;
  }

  return value;
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

  let signedToRadius = abs(horizontal - radius);
  let ridge = 1.0 - smoothstep(width * 0.12, width * 0.58, signedToRadius);
  let heightFalloff = smoothstep(verticalRange, 0.0, abs(center.y - worldPos.y));

  return ring * mix(0.72, 1.0, ridge) * heightFalloff;
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.32, 0.91, 0.26));

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.6, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let depthDistance = max(uniforms.depthFadeDistance, 0.2);
  let depthExp = max(uniforms.depthFadeExponent, 0.25);
  let depthLerp = pow(clamp((1.0 - heightBand) + slope * 0.28 + amp / depthDistance * 0.18, 0.0, 1.0), depthExp * 0.7);

  let troughColor = vec3<f32>(0.01, 0.05, 0.11);
  let bodyColor = vec3<f32>(0.03, 0.19, 0.31);
  let crestColor = vec3<f32>(0.12, 0.42, 0.56);
  var waterColor = mix(crestColor, troughColor, depthLerp);
  waterColor = mix(waterColor, bodyColor, clamp(ndl * 0.45 + 0.2, 0.0, 1.0));

  let halfVec = normalize(lightDir + viewDir);
  let specularStrength = max(uniforms.specularIntensity, 0.0);
  let gloss = clamp(0.42 + specularStrength * 0.24 - slope * 0.18, 0.18, 0.92);
  let specular = pow(max(dot(normal, halfVec), 0.0), mix(42.0, 260.0, gloss)) * (0.18 + specularStrength * 1.1);

  let foamNoiseBlend = clamp(uniforms.foamNoiseFactor, 0.0, 1.0);
  let foamCellScale = max(uniforms.foamCellScale, 0.02);
  let foamShred = clamp(uniforms.foamShredSlope, 0.0, 1.0);
  let foamFizz = clamp(uniforms.foamFizzWeight, 0.0, 1.0);

  let crestSeed = heightBand + slope * mix(0.72, 1.38, foamShred) + windSpd * 0.08;
  let crestMask = smoothstep(0.36, clamp(0.66 + uniforms.foamWidth * 0.16, 0.5, 0.97), crestSeed);

  let flowUv = input.vWorldPos.xz * (freq * (2.0 / foamCellScale));
  let advect = windDir * uniforms.time * (0.55 + windSpd) + crossDir * uniforms.time * 0.18;
  let macroNoise = fbm(flowUv * 0.32 + advect);
  let microNoise = fbm(flowUv * 0.9 - advect * 1.8 + vec2<f32>(uniforms.time * 1.6, -uniforms.time * 1.1));
  let cellular = valueNoise(flowUv * 0.26 + vec2<f32>(17.0, 5.0));
  let detailedNoise = mix(macroNoise, microNoise, foamNoiseBlend);

  let shredMask = smoothstep(
    0.35,
    0.92,
    detailedNoise + slope * (0.38 + foamShred * 0.95) - (1.0 - heightBand) * 0.32
  );
  let fizzPulse = sin((flowUv.x + flowUv.y) * 6.0 + uniforms.time * (2.6 + windSpd * 2.0)) * 0.5 + 0.5;
  let fizzGrain = smoothstep(0.68, 0.94, microNoise + fizzPulse * 0.36);

  var foam = crestMask * shredMask * max(uniforms.foamIntensity, 0.0) * (0.3 + slope * 1.08);
  foam += crestMask * fizzGrain * foamFizz * 0.24 * (0.55 + windSpd);
  foam *= 0.72 + cellular * 0.56;

  let collisionStrength = max(uniforms.collisionFoamStrength, 0.0);
  let waveTightness = clamp(1.0 - amp * 0.42, 0.35, 1.0);
  let baseWidth = mix(0.18, 0.62, clamp(uniforms.foamWidth * 0.34, 0.0, 1.0));
  let boatWidth = max(baseWidth * waveTightness, 0.12) + uniforms.boatCollisionRadius * 0.045;
  let islandWidth = max(baseWidth * waveTightness, 0.14) + uniforms.islandCollisionRadius * 0.055;
  let boatRing = collisionRingMask(
    input.vWorldPos,
    uniforms.boatCollisionCenter,
    max(uniforms.boatCollisionRadius, 0.0),
    boatWidth,
    1.45 + amp * 0.55
  );
  let islandRing = collisionRingMask(
    input.vWorldPos,
    uniforms.islandCollisionCenter,
    max(uniforms.islandCollisionRadius, 0.0),
    islandWidth,
    2.0 + amp * 0.75
  );

  let collisionNoiseUv = input.vWorldPos.xz * (freq * 2.8) + vec2<f32>(uniforms.time * 0.6, -uniforms.time * 0.42);
  let collisionNoise = fbm(collisionNoiseUv * 0.55) * 0.6 + fbm(collisionNoiseUv * 1.35 + vec2<f32>(8.7, 1.4)) * 0.4;
  let collisionMicro = fbm(collisionNoiseUv * 2.15 + vec2<f32>(-3.4, 11.2));
  let collisionDetail = smoothstep(0.22, 0.86, collisionNoise * 0.7 + collisionMicro * 0.3);
  let collisionFoam = (boatRing * 1.35 + islandRing * 1.1) * collisionStrength * (0.48 + collisionDetail * 1.12);

  foam += collisionFoam;
  foam = clamp(foam, 0.0, 1.35);

  let causticWave = sin(dot(input.vWorldPos.xz, windDir) * (freq * 1.1) - uniforms.time * 0.35) * 0.5 + 0.5;
  let caustic = (1.0 - depthLerp) * causticWave * max(uniforms.causticIntensity, 0.0) * 0.08;
  waterColor += vec3<f32>(0.04, 0.09, 0.08) * caustic;

  let scatter = vec3<f32>(0.0, 0.09, 0.12) * pow(1.0 - ndv, 1.7) * (0.45 + amp * 0.55);
  let reflectionTint = vec3<f32>(0.72, 0.84, 0.95);
  let lit = waterColor * (0.18 + ndl * 0.82) + scatter;
  let reflected = reflectionTint * fresnel;
  let foamTone = smoothstep(0.2, 0.86, detailedNoise);
  let foamColor = mix(vec3<f32>(0.79, 0.86, 0.92), vec3<f32>(0.94, 0.97, 1.0), foamTone) * foam;

  let horizonGlow = vec3<f32>(0.04, 0.08, 0.12) * pow(1.0 - ndv, 2.2);
  let color = lit + reflected + vec3<f32>(specular) + foamColor + horizonGlow;
  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
