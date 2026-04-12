#version 300 es
precision highp float;

in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vUV;
in float vWaveHeight;

uniform vec3 cameraPosition;
uniform float time;
uniform float specularIntensity;
uniform float depthFadeDistance;
uniform float depthFadeExponent;
uniform float skyReflectionMix;
uniform float foamIntensity;
uniform float foamWidth;
uniform float foamNoiseFactor;
uniform float foamCellScale;
uniform float foamShredSlope;
uniform float foamFizzWeight;
uniform float crestFoamEnabled;
uniform float crestFoamThreshold;
uniform float boatIntersectionFactor;
uniform float islandIntersectionFactor;
uniform float intersectionFoamEnabled;
uniform float intersectionFoamIntensity;
uniform float intersectionFoamWidth;
uniform float intersectionFoamFalloff;
uniform float intersectionFoamNoise;
uniform float intersectionFoamVerticalRange;
uniform float islandShorelineBandWidth;
uniform float islandShorelineFoamGain;
uniform float underwaterEnabled;
uniform float underwaterFogDensity;
uniform float underwaterHorizonMix;
uniform float underwaterColorR;
uniform float underwaterColorG;
uniform float underwaterColorB;
uniform float underwaterFactor;
uniform vec3 profileShallowColor;
uniform vec3 profileMidColor;
uniform vec3 profileDeepColor;
uniform vec3 profileFoamColor;
uniform vec3 profileReflectionColor;
uniform float profileFresnelBase;
uniform float profileFresnelStrength;
uniform float profileFresnelPower;
uniform float profileDepthViewScale;
uniform float profileToneGamma;
uniform float profileSpecularClamp;
uniform float normalDetailStrength;
uniform float normalDistanceFalloff;
uniform sampler2D boatIntersectionFoamField;
uniform sampler2D islandIntersectionFoamField;
uniform vec4 boatIntersectionFoamFieldBounds;
uniform vec4 islandIntersectionFoamFieldBounds;
uniform float boatIntersectionFoamFieldMaxDistance;
uniform float islandIntersectionFoamFieldMaxDistance;
uniform float boatIntersectionFoamFieldValid;
uniform float islandIntersectionFoamFieldValid;

out vec4 outColor;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
   -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  vec2 samplePos = p;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);

  for (int i = 0; i < 3; i++) {
    value += snoise(samplePos) * amplitude;
    samplePos = rot * samplePos * 1.87 + vec2(13.7, 7.9);
    amplitude *= 0.5;
  }

  return value * 0.5 + 0.5;
}

float swissCheeseFoam(vec2 uv, float noiseBlend, float shred, float fizz) {
  vec2 domain = uv + vec2(time * 0.08, -time * 0.05);
  float islands = fbm(domain * 0.72 + vec2(1.3, -6.8));
  float holes = fbm(domain * 1.34 + vec2(-9.4, 4.7));
  float crumbs = fbm(domain * 2.1 + vec2(13.1, -1.6));

  float islandMask = smoothstep(0.48 - shred * 0.06, 0.76 + shred * 0.06, islands);
  float holeMask = smoothstep(0.46, 0.72, holes);
  float crumbMask = smoothstep(0.52, 0.88, crumbs);
  float fizzPulse = sin((domain.x + domain.y) * 1.9 + time * (1.0 + fizz * 0.7)) * 0.5 + 0.5;

  float swiss = islandMask * (1.0 - holeMask * (0.58 + fizz * 0.2));
  swiss *= mix(0.76, 1.0, crumbMask);
  swiss *= mix(0.9, 1.06, fizzPulse * fizz);
  return clamp(mix(swiss, islandMask, 1.0 - noiseBlend * 0.6), 0.0, 1.0);
}

float decodeSignedDistance(float encoded, float maxDistance) {
  return (encoded * 2.0 - 1.0) * max(maxDistance, 0.0001);
}

float sampleFieldFoamEdge(
  vec3 worldPos,
  sampler2D field,
  vec4 bounds,
  float maxDistance,
  float valid,
  float widthScale,
  float noiseMix,
  float contactBoost
) {
  if (valid < 0.5 || bounds.z <= 0.0 || bounds.w <= 0.0) {
    return 0.0;
  }
  vec2 uv = (worldPos.xz - bounds.xy) / bounds.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    return 0.0;
  }

  float encoded = texture(field, uv).r;
  float signedDist = decodeSignedDistance(encoded, maxDistance);
  float band = max(widthScale, 0.04) * (1.0 + contactBoost * 0.4);
  float contactBias = band * (0.42 + contactBoost * 0.34);
  float outsideDist = max(signedDist - contactBias, 0.0);
  float edgeMask = 1.0 - smoothstep(0.0, band, outsideDist);
  float coreMask = 1.0 - smoothstep(-band * 0.45, band * 0.35, signedDist);
  edgeMask = max(edgeMask, coreMask);

  vec2 fieldUv = uv * 11.0 + vec2(time * 0.08, -time * 0.05);
  float nA = fbm(fieldUv * 0.75 + vec2(5.1, -3.7));
  float nB = fbm(fieldUv * 1.35 + vec2(-2.4, 9.3));
  float n = mix(nA, nB, clamp(noiseMix, 0.0, 1.0));
  float swiss = swissCheeseFoam(fieldUv, noiseMix, 0.55, 0.25);
  return edgeMask * (0.55 + 0.45 * n) * (0.72 + 0.48 * swiss);
}

void main(void) {
  vec3 baseN = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPositionW);
  vec3 L = normalize(vec3(0.4, 1.0, 0.2));

  float cameraDist = max(length(vPositionW - cameraPosition), 0.001);
  float eps = max(cameraDist * 0.00025, 0.02);
  float detailStrengthControl = clamp(normalDetailStrength, 0.0, 1.0);
  float detailFalloffControl = max(normalDistanceFalloff, 0.01);
  float detailScale = mix(0.55, 2.2, detailStrengthControl) / (0.65 + detailFalloffControl * 12.0);
  mat2 rotA = mat2(0.8660254, -0.5, 0.5, 0.8660254);
  vec2 detailUv = (rotA * vPositionW.xz) * detailScale;
  float d0 = fbm(detailUv);
  float dx = fbm(detailUv + vec2(eps, 0.0));
  float dz = fbm(detailUv + vec2(0.0, eps));
  vec3 detailN = normalize(vec3(-(dx - d0) / eps, 1.0, -(dz - d0) / eps));

  float detailWeight = clamp(exp(-cameraDist * (0.0032 + detailFalloffControl * 0.045)), 0.0, 1.0) * detailStrengthControl * 0.55;
  vec3 N = normalize(mix(baseN, detailN, detailWeight));
  vec3 H = normalize(L + V);

  float depth = clamp(length(vPositionW - cameraPosition) / max(profileDepthViewScale, 1.0), 0.0, 1.0);
  depth = pow(depth, max(depthFadeExponent, 0.01));
  vec3 baseColor = mix(profileShallowColor, profileMidColor, depth);
  baseColor = mix(baseColor, profileDeepColor, depth * depth);
  float macroVariation = fbm(vPositionW.xz * 0.018 + vec2(4.7, -3.1));
  baseColor *= mix(0.9, 1.08, macroVariation);

  float ndv = max(dot(N, V), 0.0);
  float ndl = max(dot(N, L), 0.0);
  float fresnel = profileFresnelBase + profileFresnelStrength * pow(1.0 - ndv, max(profileFresnelPower, 0.01));
  float ndoth = max(dot(N, H), 0.0);
  float specPower = mix(42.0, 220.0, clamp(specularIntensity * 0.6 + 0.2, 0.0, 1.0));
  float spec = pow(ndoth, specPower) * (0.08 + specularIntensity * 0.35);
  spec = min(spec, max(profileSpecularClamp, 0.02));

  float crestFoam = 0.0;
  if (crestFoamEnabled > 0.5) {
    float slope = clamp(1.0 - N.y, 0.0, 1.0);
    float noiseBlend = clamp(foamNoiseFactor, 0.0, 1.0);
    float cellScale = max(foamCellScale, 0.02);
    float shred = clamp(foamShredSlope, 0.0, 1.0);
    float fizz = clamp(foamFizzWeight, 0.0, 1.0);
    float foamFreq = (0.8 + 1.6 * noiseBlend) * (1.0 / cellScale) * 0.085;
    mat2 rotB = mat2(0.7071068, -0.7071068, 0.7071068, 0.7071068);
    vec2 foamUv = (rotB * vPositionW.xz) * foamFreq;
    float swiss = swissCheeseFoam(foamUv, noiseBlend, shred, fizz);
    float crestSeed = max(vWaveHeight, 0.0) * (0.82 + shred * 0.22) + slope * (0.07 + shred * 0.10) + (swiss - 0.5) * (0.09 + noiseBlend * 0.05);
    float width = clamp(foamWidth * 0.06, 0.018, 0.095);
    float crestMask = smoothstep(
      crestFoamThreshold,
      crestFoamThreshold + width,
      crestSeed
    );
    crestFoam = crestMask * foamIntensity * (0.18 + 0.26 * swiss);
  }

  float collisionFoam = 0.0;
  if (intersectionFoamEnabled > 0.5) {
    float edgeWidth = mix(0.04, 0.46, clamp(intersectionFoamWidth / 3.0, 0.0, 1.0));
    float edgeFalloff = max(intersectionFoamFalloff, 0.15);
    float edgeNoise = clamp(intersectionFoamNoise, 0.0, 1.0);
    float contactBoost = clamp(intersectionFoamVerticalRange, 0.0, 4.0) * 0.33;
    float islandBand = clamp(islandShorelineBandWidth, 0.08, 0.8);
    float islandGain = max(islandShorelineFoamGain, 0.0);

    float boatEdgeWidth = edgeWidth * 0.95;
    float islandEdgeWidth = edgeWidth * mix(0.75, 2.4, islandBand);
    float boatField = sampleFieldFoamEdge(
      vPositionW,
      boatIntersectionFoamField,
      boatIntersectionFoamFieldBounds,
      boatIntersectionFoamFieldMaxDistance,
      boatIntersectionFoamFieldValid,
      boatEdgeWidth,
      edgeNoise,
      contactBoost
    );
    float islandField = sampleFieldFoamEdge(
      vPositionW,
      islandIntersectionFoamField,
      islandIntersectionFoamFieldBounds,
      islandIntersectionFoamFieldMaxDistance,
      islandIntersectionFoamFieldValid,
      islandEdgeWidth,
      edgeNoise,
      contactBoost * mix(1.0, 1.45, islandBand)
    );
    float boatGain = pow(max(boatIntersectionFactor, 0.0), edgeFalloff);
    float islandGainFactor = pow(max(islandIntersectionFactor, 0.0), edgeFalloff) * islandGain;
    float contactPresence = clamp(max(boatField, islandField), 0.0, 1.0);
    float gain = max(max(boatGain, islandGainFactor), contactPresence * 0.85);
    float fieldFoam = boatField * boatGain + islandField * islandGainFactor;
    collisionFoam = max(fieldFoam, contactPresence * 0.45) * intersectionFoamIntensity * gain;
  }

  float foamMask = clamp(max(crestFoam, collisionFoam), 0.0, 0.52);
  vec3 reflected = mix(baseColor, profileReflectionColor, clamp(fresnel * skyReflectionMix, 0.0, 1.0));
  vec3 lit = reflected * (0.18 + 0.82 * ndl);
  vec3 scatter = profileMidColor * pow(1.0 - ndv, 1.8) * 0.38;
  vec3 foamColor = profileFoamColor * foamMask;
  vec3 color = lit + scatter + foamColor + vec3(spec);

  float fog = clamp(1.0 - exp(-underwaterFogDensity * length(vPositionW - cameraPosition) * 0.02), 0.0, 1.0);
  vec3 underwaterColor = vec3(underwaterColorR, underwaterColorG, underwaterColorB);
  float underwaterMix = underwaterEnabled > 0.5 ? clamp(underwaterFactor + underwaterHorizonMix * fog, 0.0, 1.0) : 0.0;
  color = mix(color, underwaterColor, underwaterMix);
  color = pow(max(color, 0.0), vec3(profileToneGamma));

  outColor = vec4(color, 1.0);
}
