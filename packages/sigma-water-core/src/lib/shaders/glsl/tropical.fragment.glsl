#version 300 es
precision highp float;

in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vUV;

uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float windDirection;
uniform float windSpeed;
uniform float crestFoamEnabled;
uniform float crestFoamThreshold;
uniform float foamIntensity;
uniform float foamWidth;
uniform float foamNoiseFactor;
uniform float foamCellScale;
uniform float foamShredSlope;
uniform float foamFizzWeight;
uniform float intersectionFoamEnabled;
uniform float intersectionFoamIntensity;
uniform float intersectionFoamWidth;
uniform float intersectionFoamFalloff;
uniform float intersectionFoamNoise;
uniform float intersectionFoamVerticalRange;
uniform float boatIntersectionFactor;
uniform float islandIntersectionFactor;
uniform float specularIntensity;
uniform float depthFadeDistance;
uniform float depthFadeExponent;
uniform vec3 boatCollisionCenter;
uniform vec3 islandCollisionCenter;
uniform float boatCollisionRadius;
uniform float islandCollisionRadius;
uniform float collisionFoamStrength;
uniform float skyReflectionMix;
uniform float normalDetailStrength;
uniform float normalDistanceFalloff;
uniform float underwaterEnabled;
uniform float underwaterTransitionDepth;
uniform float underwaterFogDensity;
uniform float underwaterHorizonMix;
uniform float underwaterColorR;
uniform float underwaterColorG;
uniform float underwaterColorB;
uniform float underwaterFactor;
uniform vec3 cameraPosition;

out vec4 outColor;

const float PI = 3.141592653589793;

float hash21(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  vec2 samplePos = p;
  
  for (int i = 0; i < 4; i++) {
    value += valueNoise(samplePos) * amplitude;
    samplePos = samplePos * 2.03 + vec2(13.7, 7.9);
    amplitude *= 0.5;
  }
  
  return value;
}

float collisionRingMask(vec3 worldPos, vec3 center, float radius, float width, float verticalRange) {
  float horizontal = distance(worldPos.xz, center.xz);
  float innerCore = max(radius - width * 0.62, 0.0);
  float innerFeather = max(radius - width * 1.1, 0.0);
  float outerFeather = radius + width * 0.92;
  float outerCore = radius + width * 0.48;
  
  float enter = smoothstep(innerFeather, innerCore, horizontal);
  float exit = 1.0 - smoothstep(outerCore, outerFeather, horizontal);
  float ring = enter * exit;
  
  float signedToRadius = abs(horizontal - radius);
  float ridge = 1.0 - smoothstep(width * 0.12, width * 0.58, signedToRadius);
  float heightFalloff = smoothstep(verticalRange, 0.0, abs(center.y - worldPos.y));
  
  return ring * mix(0.72, 1.0, ridge) * heightFalloff;
}

void main(void) {
  vec3 viewDir = normalize(cameraPosition - vPositionW);
  vec3 lightDir = normalize(vec3(0.32, 0.91, 0.26));
  
  float amp = max(waveAmplitude, 0.05) * 0.42;
  float freq = max(waveFrequency, 0.12) * 0.78;
  float windSpd = max(windSpeed, 0.05);
  float angle = windDirection * 0.017453292519943295;
  vec2 windDir = normalize(vec2(cos(angle), sin(angle)));
  vec2 crossDir = vec2(-windDir.y, windDir.x);
  
  float cameraDist = max(length(cameraPosition - vPositionW), 0.001);
  float detailScale = 1.0 / max(normalDistanceFalloff, 0.01);
  float detailBlend = clamp(exp(-cameraDist * detailScale), 0.0, 1.0);
  float detailStrength = clamp(normalDetailStrength, 0.0, 1.0) * detailBlend;
  
  vec2 detailUv = vPositionW.xz * (freq * 2.6) + vec2(time * 0.35, -time * 0.28);
  float eps = max(cameraDist * 0.0002, 0.01);
  float detailH = fbm(detailUv * 0.35) * 0.62 + fbm(detailUv * 0.9) * 0.38;
  float detailHx = fbm((detailUv + vec2(eps, 0.0)) * 0.35) * 0.62 + fbm((detailUv + vec2(eps, 0.0)) * 0.9) * 0.38;
  float detailHz = fbm((detailUv + vec2(0.0, eps)) * 0.35) * 0.62 + fbm((detailUv + vec2(0.0, eps)) * 0.9) * 0.38;
  vec3 detailNormal = normalize(vec3(-(detailHx - detailH) / eps, 1.0, -(detailHz - detailH) / eps));
  
  vec3 normal = normalize(mix(vNormalW, detailNormal, detailStrength));
  float ndl = max(dot(normal, lightDir), 0.0);
  float ndv = max(dot(normal, viewDir), 0.0);
  float fresnel = 0.02 + 0.74 * pow(1.0 - ndv, 5.0);
  float slope = clamp(1.0 - normal.y, 0.0, 1.0);
  float heightBand = clamp(vPositionW.y / max(amp * 2.6, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  
  float depthDistance = max(depthFadeDistance, 0.2);
  float depthExp = max(depthFadeExponent, 0.25);
  float depthLerp = pow(clamp((1.0 - heightBand) + slope * 0.28 + amp / depthDistance * 0.18, 0.0, 1.0), depthExp * 0.7);
  
  // Tropical colors: bright turquoise
  vec3 shallowColor = vec3(0.15, 0.55, 0.68);
  vec3 deepColor = vec3(0.05, 0.22, 0.35);
  vec3 waterColor = mix(shallowColor, deepColor, depthLerp);
  waterColor = mix(waterColor, vec3(0.08, 0.32, 0.45), clamp(ndl * 0.45 + 0.2, 0.0, 1.0));
  
  vec3 halfVec = normalize(lightDir + viewDir);
  float specularStrength = max(specularIntensity, 0.0);
  float gloss = clamp(0.42 + specularStrength * 0.24 - slope * 0.18, 0.18, 0.92);
  float specPower = mix(42.0, 260.0, gloss);
  float specNorm = (specPower + 8.0) / (PI * 8.0);
  float specular = pow(max(dot(normal, halfVec), 0.0), specPower) * specNorm * (0.12 + specularStrength * 0.48);
  
  // FOAM GENERATION
  float foamNoiseBlend = clamp(foamNoiseFactor, 0.0, 1.0);
  float foamCellScaleVal = max(foamCellScale, 0.02);
  float foamShred = clamp(foamShredSlope, 0.0, 1.0);
  float foamFizz = clamp(foamFizzWeight, 0.0, 1.0);
  float foamMaster = max(foamIntensity, 0.0);
  
  float crestEnabled = step(0.5, crestFoamEnabled);
  float crestThreshold = clamp(crestFoamThreshold, 0.0, 0.98);
  float crestSeed = heightBand + slope * mix(0.72, 1.38, foamShred) + windSpd * 0.08;
  float crestMask = crestEnabled * smoothstep(crestThreshold, clamp(crestThreshold + foamWidth * 0.16, crestThreshold + 0.08, 0.99), crestSeed);
  
  vec2 flowUv = vPositionW.xz * (freq * (2.0 / foamCellScaleVal));
  vec2 advect = windDir * time * (0.55 + windSpd) + crossDir * time * 0.18;
  float macroNoise = fbm(flowUv * 0.32 + advect);
  float microNoise = fbm(flowUv * 0.9 - advect * 1.8 + vec2(time * 1.6, -time * 1.1));
  float cellular = valueNoise(flowUv * 0.26 + vec2(17.0, 5.0));
  float detailedNoise = mix(macroNoise, microNoise, foamNoiseBlend);
  
  float shredMask = smoothstep(0.35, 0.92, detailedNoise + slope * (0.38 + foamShred * 0.95) - (1.0 - heightBand) * 0.32);
  float fizzPulse = sin((flowUv.x + flowUv.y) * 6.0 + time * (2.6 + windSpd * 2.0)) * 0.5 + 0.5;
  float fizzGrain = smoothstep(0.68, 0.94, microNoise + fizzPulse * 0.36);
  
  float foam = crestMask * shredMask * foamMaster * (0.3 + slope * 1.08);
  foam += crestMask * fizzGrain * foamFizz * foamMaster * 0.24 * (0.55 + windSpd);
  foam *= 0.72 + cellular * 0.56;
  
  // COLLISION FOAM
  float collisionStrength = max(collisionFoamStrength, 0.0);
  float intersectionEnabled = step(0.5, intersectionFoamEnabled);
  float intersectionIntensity = max(intersectionFoamIntensity, 0.0);
  float intersectionNoiseMix = clamp(intersectionFoamNoise, 0.0, 1.0);
  float intersectionFalloff = max(intersectionFoamFalloff, 0.1);
  float verticalRange = max(intersectionFoamVerticalRange, 0.1);
  float waveTightness = clamp(1.0 - amp * 0.42, 0.35, 1.0);
  float baseWidth = mix(0.12, 0.72, clamp(intersectionFoamWidth * 0.36, 0.0, 1.0));
  float boatWidth = max(baseWidth * waveTightness, 0.12) + boatCollisionRadius * 0.045;
  float islandWidth = max(baseWidth * waveTightness, 0.14) + islandCollisionRadius * 0.055;
  
  float boatRing = collisionRingMask(vPositionW, boatCollisionCenter, max(boatCollisionRadius, 0.0), boatWidth, verticalRange + amp * 0.25);
  float islandRing = collisionRingMask(vPositionW, islandCollisionCenter, max(islandCollisionRadius, 0.0), islandWidth, verticalRange + amp * 0.45);
  
  vec2 collisionNoiseUv = vPositionW.xz * (freq * 2.8) + vec2(time * 0.6, -time * 0.42);
  float collisionNoise = fbm(collisionNoiseUv * 0.55) * 0.6 + fbm(collisionNoiseUv * 1.35 + vec2(8.7, 1.4)) * 0.4;
  float collisionMicro = fbm(collisionNoiseUv * 2.15 + vec2(-3.4, 11.2));
  float collisionDetail = smoothstep(0.22, 0.86, collisionNoise * 0.7 + collisionMicro * 0.3);
  float collisionNoiseVal = mix(collisionDetail, detailedNoise, intersectionNoiseMix);
  float boatIntersection = boatRing * pow(max(boatIntersectionFactor, 0.0), intersectionFalloff);
  float islandIntersection = islandRing * pow(max(islandIntersectionFactor, 0.0), intersectionFalloff);
  float collisionFoam = (boatIntersection * 1.35 + islandIntersection * 1.1) * collisionStrength * intersectionEnabled * intersectionIntensity * foamMaster * (0.48 + collisionNoiseVal * 1.12);
  
  foam += collisionFoam;
  foam = clamp(foam, 0.0, 1.35);
  
  // SKY REFLECTION & COMPOSITION
  vec3 scatter = vec3(0.02, 0.15, 0.18) * pow(1.0 - ndv, 1.7) * (0.45 + amp * 0.55);
  float skyMix = clamp(skyReflectionMix, 0.0, 0.9);
  vec3 lit = waterColor * (0.22 + ndl * 0.78) + scatter;
  vec3 reflected = vec3(0.72, 0.84, 0.95) * fresnel * (0.18 + ndl * 0.12);
  float foamTone = smoothstep(0.2, 0.86, detailedNoise);
  vec3 foamColor = mix(vec3(0.85, 0.92, 0.98), vec3(0.96, 0.99, 1.0), foamTone) * foam;
  
  vec3 horizonGlow = vec3(0.08, 0.15, 0.18) * pow(1.0 - ndv, 2.2);
  vec3 colorRaw = lit + reflected + vec3(specular) + foamColor + horizonGlow;
  vec3 colorMapped = colorRaw / (vec3(1.0) + colorRaw * 0.95);
  vec3 color = pow(colorMapped, vec3(0.95));
  
  // UNDERWATER
  float underwaterAmount = step(0.5, underwaterEnabled) * clamp(underwaterFactor, 0.0, 1.0);
  vec3 underwaterTint = vec3(underwaterColorR, underwaterColorG, underwaterColorB);
  float underwaterFog = clamp(underwaterFogDensity, 0.0, 1.0) * (0.35 + (1.0 - ndv) * 0.65);
  vec3 horizonBlend = underwaterTint * clamp(underwaterHorizonMix, 0.0, 1.0) * pow(1.0 - ndv, 2.0) * 0.15;
  vec3 underwaterColor = mix(color, underwaterTint, underwaterFog) + horizonBlend;
  vec3 finalColor = mix(color, underwaterColor, underwaterAmount);
  
  outColor = vec4(finalColor, 1.0);
}
