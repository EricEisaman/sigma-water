#version 300 es
precision highp float;

in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vUV;
in float vRipple;

uniform vec3 cameraPosition;
uniform sampler2D rippleHeightTexture;
uniform vec4 rippleFieldBounds;
uniform vec2 rippleTexelSize;
uniform float specularIntensity;
uniform float skyReflectionMix;
uniform float depthFadeDistance;
uniform float depthFadeExponent;
uniform float underwaterEnabled;
uniform float underwaterFogDensity;
uniform float underwaterHorizonMix;
uniform float underwaterColorR;
uniform float underwaterColorG;
uniform float underwaterColorB;
uniform float underwaterFactor;

out vec4 outColor;

float sampleRipple(vec3 worldPos) {
  vec2 uv = (worldPos.xz - rippleFieldBounds.xy) / max(rippleFieldBounds.zw, vec2(0.0001));
  vec2 clampedUv = clamp(uv, 0.0, 1.0);
  return texture(rippleHeightTexture, clampedUv).r * 2.0 - 1.0;
}

void main(void) {
  float center = sampleRipple(vPositionW);
  float hx = sampleRipple(vPositionW + vec3(rippleFieldBounds.z * rippleTexelSize.x, 0.0, 0.0));
  float hz = sampleRipple(vPositionW + vec3(0.0, 0.0, rippleFieldBounds.w * rippleTexelSize.y));
  vec3 rippleN = normalize(vec3(-(hx - center), 1.0, -(hz - center)));
  vec3 N = normalize(mix(vNormalW, rippleN, 0.75));
  vec3 V = normalize(cameraPosition - vPositionW);
  vec3 L = normalize(vec3(0.4, 1.0, 0.2));
  vec3 H = normalize(L + V);

  float ndotv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndotv, 4.0);
  float spec = pow(max(dot(N, H), 0.0), 84.0) * (0.08 + specularIntensity * 0.35);

  float depth = clamp(length(vPositionW - cameraPosition) / max(depthFadeDistance * 160.0, 1.0), 0.0, 1.0);
  depth = pow(depth, max(depthFadeExponent, 0.01));
  vec3 shallow = vec3(0.06, 0.28, 0.45);
  vec3 deep = vec3(0.01, 0.05, 0.15);
  vec3 color = mix(shallow, deep, depth);

  float ndotl = max(dot(N, L), 0.0);
  color *= (0.22 + ndotl * 0.78);
  color = mix(color, vec3(0.75, 0.86, 0.95), clamp(fresnel * skyReflectionMix, 0.0, 1.0));
  color += vec3(spec);

  float rippleFoam = smoothstep(0.24, 0.84, abs(center));
  color = mix(color, vec3(0.86, 0.92, 0.98), rippleFoam * 0.42);

  float viewDist = length(vPositionW - cameraPosition);
  float fog = clamp(1.0 - exp(-underwaterFogDensity * viewDist * 0.02), 0.0, 1.0);
  vec3 underwaterColor = vec3(underwaterColorR, underwaterColorG, underwaterColorB);
  float underwaterMix = underwaterEnabled > 0.5 ? clamp(underwaterFactor + underwaterHorizonMix * fog, 0.0, 1.0) : 0.0;
  color = mix(color, underwaterColor, underwaterMix);

  outColor = vec4(color, 1.0);
}
