precision highp float;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vViewDir;
varying vec3 vTangent;
varying vec3 vBinormal;
varying float vWaveHeight;

// Uniforms
uniform vec3 waterColor;
uniform vec3 deepColor;
uniform float foamIntensity;
uniform float causticsIntensity;
uniform float sunIntensity;
uniform vec3 sunDirection;
uniform sampler2D reflectionTexture;
uniform sampler2D refractionTexture;
uniform sampler2D causticsTexture;
uniform sampler2D normalMap;

// Constants
const float PI = 3.14159265359;
const vec3 foam = vec3(1.0, 1.0, 1.0);

// Fresnel effect
float fresnel(vec3 viewDir, vec3 normal) {
  float cosAngle = max(dot(viewDir, normal), 0.0);
  return mix(0.2, 1.0, pow(1.0 - cosAngle, 5.0));
}

// Foam calculation based on wave height
float calculateFoam(float waveHeight) {
  float foam = smoothstep(0.0, 0.5, waveHeight) * 0.8;
  foam *= sin(waveHeight * 10.0) * 0.5 + 0.5;
  return foam * foamIntensity;
}

void main() {
  // Normalize vectors
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 sunDir = normalize(sunDirection);
  
  // Calculate Fresnel effect
  float fresnelEffect = fresnel(viewDir, normal);
  
  // Base water color
  vec3 waterBaseColor = mix(waterColor, deepColor, clamp(vWaveHeight * 0.5, 0.0, 1.0));
  
  // Specular highlight
  vec3 halfDir = normalize(sunDir + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), 32.0);
  vec3 specularColor = vec3(1.0) * specular * sunIntensity;
  
  // Foam effect
  float foamAmount = calculateFoam(vWaveHeight);
  
  // Caustics effect
  vec2 causticsUv = vUv + vWaveHeight * 0.1;
  vec3 caustics = texture2D(causticsTexture, causticsUv).rgb;
  caustics *= causticsIntensity;
  
  // Combine effects
  vec3 finalColor = waterBaseColor;
  finalColor += specularColor;
  finalColor = mix(finalColor, foam, foamAmount);
  finalColor += caustics * 0.3;
  
  // Apply Fresnel blending
  finalColor = mix(finalColor, vec3(0.5, 0.7, 1.0), fresnelEffect * 0.3);
  
  // Add depth-based transparency
  float alpha = mix(0.7, 0.95, fresnelEffect);
  
  gl_FragColor = vec4(finalColor, alpha);
}
