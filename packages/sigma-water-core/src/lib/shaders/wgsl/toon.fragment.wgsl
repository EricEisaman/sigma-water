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
  let lightDir = normalize(vec3<f32>(0.28, 0.92, 0.27));
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let diffuse = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.25 * pow(1.0 - ndv, 4.2);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.6, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let litValue = clamp(diffuse * 0.82 + heightBand * 0.18 - slope * 0.08, 0.0, 1.0);
  let band0 = step(0.16, litValue);
  let band1 = step(0.4, litValue);
  let band2 = step(0.7, litValue);
  let bandMix = band0 * 0.28 + band1 * 0.32 + band2 * 0.4;

  let shadowColor = vec3<f32>(0.02, 0.11, 0.17);
  let midColor = vec3<f32>(0.07, 0.28, 0.4);
  let lightColor = vec3<f32>(0.24, 0.62, 0.76);
  let bandColor = mix(shadowColor, midColor, bandMix);
  let toonBase = mix(bandColor, lightColor, band2 * 0.8);

  let rim = pow(1.0 - ndv, 2.7);
  let rimLight = rim * (0.16 + amp * 0.1);

  let crestFlow = sin(dot(input.vWorldPos.xz, windDir) * (freq * 2.4) + uniforms.time * (0.6 + windSpd));
  let crossFlow = sin(dot(input.vWorldPos.xz, crossDir) * (freq * 3.8) - uniforms.time * (0.45 + windSpd * 0.7));
  let crestNoise = valueNoise(input.vWorldPos.xz * (freq * 3.1) + vec2<f32>(uniforms.time * 0.25, -uniforms.time * 0.2));
  let crestEnabled = step(0.5, uniforms.crestFoamEnabled);
  let crestThreshold = clamp(uniforms.crestFoamThreshold, 0.0, 0.98);
  let crestLine = crestEnabled * smoothstep(
    crestThreshold,
    clamp(crestThreshold + uniforms.foamWidth * 0.2, crestThreshold + 0.1, 0.99),
    heightBand * 0.95 + slope * 0.86 + crestFlow * 0.11 + crossFlow * 0.07 + crestNoise * 0.18
  );
  let foam = crestLine * (0.14 + amp * 0.12) * max(uniforms.foamIntensity, 0.0);

  let collisionUv = input.vWorldPos.xz * (freq * 2.1) + vec2<f32>(uniforms.time * 0.4, -uniforms.time * 0.28);
  let collisionNoise = valueNoise(collisionUv);
  let intersectionNoise = mix(1.0, collisionNoise, clamp(uniforms.foamNoiseFactor + uniforms.intersectionFoamNoise * 0.5, 0.0, 1.0));
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

  let reflectionBand = step(0.82, fresnel) * 0.025;
  let glintRaw = pow(max(dot(normalize(lightDir + viewDir), normal), 0.0), mix(52.0, 180.0, clamp(max(uniforms.specularIntensity, 0.0) * 0.42 + 0.18, 0.0, 1.0))) * (0.03 + max(uniforms.specularIntensity, 0.0) * 0.1);
  let glint = min(glintRaw, 0.1);

  var color = toonBase + vec3<f32>(rimLight + foam + intersectionFoam * 0.55 + reflectionBand + glint);
  let fog = clamp(1.0 - ndv, 0.0, 1.0) * 0.1;
  color = mix(color, vec3<f32>(0.1, 0.3, 0.41), fog);
  let colorMapped = color / (vec3<f32>(1.0) + color * 1.8);
  let luma = dot(colorMapped, vec3<f32>(0.2126, 0.7152, 0.0722));
  let lumaClamp = min(1.0, 0.74 / max(luma, 0.0001));
  color = colorMapped * lumaClamp;

  let underwaterEnabled = step(0.5, uniforms.underwaterEnabled);
  let underwaterAmount = underwaterEnabled * clamp(uniforms.underwaterFactor, 0.0, 1.0);
  let underwaterTint = vec3<f32>(uniforms.underwaterColorR, uniforms.underwaterColorG, uniforms.underwaterColorB);
  let underwaterFog = clamp(uniforms.underwaterFogDensity, 0.0, 1.0) * (0.25 + (1.0 - ndv) * 0.75);
  let horizonBlend = clamp(uniforms.underwaterHorizonMix, 0.0, 1.0) * pow(1.0 - ndv, 2.0);
  let underwaterColor = mix(color, underwaterTint, underwaterFog) + underwaterTint * horizonBlend * 0.1;
  let finalColor = mix(color, underwaterColor, underwaterAmount);

  fragmentOutputs.color = vec4<f32>(finalColor, 1.0);
  return fragmentOutputs;
}
