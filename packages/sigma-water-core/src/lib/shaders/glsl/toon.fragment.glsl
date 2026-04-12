#version 300 es
precision highp float;

in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vUV;
in float vWaveHeight;

uniform vec3 cameraPosition;
uniform float specularIntensity;
uniform float foamIntensity;
uniform float crestFoamEnabled;
uniform float crestFoamThreshold;
uniform float intersectionFoamEnabled;
uniform float intersectionFoamIntensity;
uniform float intersectionFoamWidth;
uniform float intersectionFoamFalloff;
uniform float intersectionFoamNoise;
uniform float islandShorelineBandWidth;
uniform float islandShorelineFoamGain;
uniform float boatIntersectionFactor;
uniform float islandIntersectionFactor;
uniform sampler2D boatIntersectionFoamField;
uniform sampler2D islandIntersectionFoamField;
uniform vec4 boatIntersectionFoamFieldBounds;
uniform vec4 islandIntersectionFoamFieldBounds;
uniform float boatIntersectionFoamFieldMaxDistance;
uniform float islandIntersectionFoamFieldMaxDistance;
uniform float boatIntersectionFoamFieldValid;
uniform float islandIntersectionFoamFieldValid;
uniform float underwaterEnabled;
uniform float underwaterFogDensity;
uniform float underwaterHorizonMix;
uniform float underwaterColorR;
uniform float underwaterColorG;
uniform float underwaterColorB;
uniform float underwaterFactor;
uniform float toonShadowColorR;
uniform float toonShadowColorG;
uniform float toonShadowColorB;
uniform float toonMidColorR;
uniform float toonMidColorG;
uniform float toonMidColorB;
uniform float toonLightColorR;
uniform float toonLightColorG;
uniform float toonLightColorB;

out vec4 outColor;

float decodeSignedDistance(float encoded, float maxDistance) {
  return (encoded * 2.0 - 1.0) * max(maxDistance, 0.0001);
}

float sampleFieldFoam(vec3 worldPos, sampler2D field, vec4 bounds, float maxDistance, float valid, float widthScale, float contactBoost) {
  if (valid < 0.5 || bounds.z <= 0.0 || bounds.w <= 0.0) {
    return 0.0;
  }
  vec2 uv = (worldPos.xz - bounds.xy) / bounds.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    return 0.0;
  }
  float encoded = texture(field, uv).r;
  float signedDist = decodeSignedDistance(encoded, maxDistance);
  float band = max(widthScale, 0.05) * (1.0 + max(contactBoost, 0.0) * 0.45);
  // Bias the edge toward geometry contact so foam reaches the true silhouette.
  float contactBias = band * (0.45 + max(contactBoost, 0.0) * 0.35);
  float outsideDist = max(signedDist - contactBias, 0.0);
  float edgeFoam = 1.0 - smoothstep(0.0, band, outsideDist);
  float coreFoam = 1.0 - smoothstep(-band * 0.45, band * 0.35, signedDist);
  return clamp(max(edgeFoam, coreFoam), 0.0, 1.0);
}

void main(void) {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(vec3(0.4, 1.0, 0.3));
  vec3 V = normalize(cameraPosition - vPositionW);
  vec3 H = normalize(L + V);

  float ndotl = max(dot(N, L), 0.0);
  float band = ndotl < 0.33 ? 0.0 : (ndotl < 0.66 ? 0.5 : 1.0);

  vec3 shadowColor = vec3(toonShadowColorR, toonShadowColorG, toonShadowColorB);
  vec3 midColor = vec3(toonMidColorR, toonMidColorG, toonMidColorB);
  vec3 lightColor = vec3(toonLightColorR, toonLightColorG, toonLightColorB);

  vec3 color = band < 0.25 ? shadowColor : (band < 0.75 ? midColor : lightColor);

  float spec = pow(max(dot(N, H), 0.0), 56.0) * specularIntensity;
  color += vec3(step(0.65, spec) * 0.25);

  float collisionFoam = 0.0;
  if (intersectionFoamEnabled > 0.5) {
    float widthScale = max(intersectionFoamWidth, 0.05);
    float edgeNoise = clamp(intersectionFoamNoise, 0.0, 1.0);
    float contactBoost = clamp(intersectionFoamVerticalRange, 0.0, 4.0) * 0.33;
    float islandBand = clamp(islandShorelineBandWidth, 0.08, 0.8);
    float islandGain = max(islandShorelineFoamGain, 0.0);
    float boatFoam = sampleFieldFoam(
      vPositionW,
      boatIntersectionFoamField,
      boatIntersectionFoamFieldBounds,
      boatIntersectionFoamFieldMaxDistance,
      boatIntersectionFoamFieldValid,
      widthScale * 0.95,
      contactBoost
    );
    float islandFoam = sampleFieldFoam(
      vPositionW,
      islandIntersectionFoamField,
      islandIntersectionFoamFieldBounds,
      islandIntersectionFoamFieldMaxDistance,
      islandIntersectionFoamFieldValid,
      widthScale * mix(0.9, 2.9, islandBand),
      contactBoost * mix(1.0, 1.45, islandBand)
    );
    float fieldFoam = mix(boatFoam + islandFoam, (boatFoam + islandFoam) * 0.82, edgeNoise);
    float boatGain = pow(max(boatIntersectionFactor, 0.0), max(intersectionFoamFalloff, 0.15));
    float islandGainFactor = pow(max(islandIntersectionFactor, 0.0), max(intersectionFoamFalloff, 0.15)) * islandGain;
    float contactPresence = clamp(max(boatFoam, islandFoam), 0.0, 1.0);
    float gain = max(max(boatGain, islandGainFactor), contactPresence * 0.85);
    collisionFoam = fieldFoam * intersectionFoamIntensity * gain;
  }

  if (crestFoamEnabled > 0.5) {
    float foam = smoothstep(crestFoamThreshold, crestFoamThreshold + 0.2, vWaveHeight) * foamIntensity;
    foam = max(foam, collisionFoam);
    color = mix(color, vec3(0.92, 0.96, 1.0), clamp(foam, 0.0, 1.0));
  } else if (collisionFoam > 0.0) {
    color = mix(color, vec3(0.92, 0.96, 1.0), clamp(collisionFoam, 0.0, 1.0));
  }

  float viewDist = length(vPositionW - cameraPosition);
  float fog = clamp(1.0 - exp(-underwaterFogDensity * viewDist * 0.02), 0.0, 1.0);
  vec3 underwaterColor = vec3(underwaterColorR, underwaterColorG, underwaterColorB);
  float underwaterMix = underwaterEnabled > 0.5 ? clamp(underwaterFactor + underwaterHorizonMix * fog, 0.0, 1.0) : 0.0;
  color = mix(color, underwaterColor, underwaterMix);

  outColor = vec4(color, 1.0);
}
