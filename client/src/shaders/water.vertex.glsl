precision highp float;

// Attributes
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec3 tangent;
attribute vec3 binormal;

// Uniforms
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float windDirection;
uniform vec3 cameraPosition;

// Varyings
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vViewDir;
varying vec3 vTangent;
varying vec3 vBinormal;
varying float vWaveHeight;

// Gerstner wave function
vec3 gerstnerWave(vec4 wave, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float steepness = wave.z;
  float wavelength = wave.w;
  float k = 2.0 * 3.14159 / wavelength;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(vec2(cos(windDirection), sin(windDirection)));
  float f = k * (dot(d, p.xz) - c * time);
  float a = steepness / k;

  tangent += vec3(
    -d.x * d.x * (steepness * sin(f)),
    d.x * (steepness * cos(f)),
    -d.x * d.y * (steepness * sin(f))
  );

  binormal += vec3(
    -d.x * d.y * (steepness * sin(f)),
    d.y * (steepness * cos(f)),
    -d.y * d.y * (steepness * sin(f))
  );

  return vec3(
    d.x * (a * cos(f)),
    a * sin(f),
    d.y * (a * cos(f))
  );
}

void main() {
  vec3 worldPos = (world * vec4(position, 1.0)).xyz;
  vec3 p = worldPos;
  
  vec3 tangent = normalize(vec3(1.0, 0.0, 0.0));
  vec3 binormal = normalize(vec3(0.0, 0.0, 1.0));
  
  // Apply multiple Gerstner waves
  vec3 displacement = vec3(0.0);
  
  // Wave 1: Large swells
  vec4 wave1 = vec4(
    cos(windDirection),
    sin(windDirection),
    0.25 * waveAmplitude,
    200.0 / waveFrequency
  );
  displacement += gerstnerWave(wave1, p, tangent, binormal);
  
  // Wave 2: Medium waves
  vec4 wave2 = vec4(
    cos(windDirection + 0.5),
    sin(windDirection + 0.5),
    0.15 * waveAmplitude,
    100.0 / waveFrequency
  );
  displacement += gerstnerWave(wave2, p, tangent, binormal);
  
  // Wave 3: Ripples
  vec4 wave3 = vec4(
    cos(windDirection + 1.0),
    sin(windDirection + 1.0),
    0.1 * waveAmplitude,
    50.0 / waveFrequency
  );
  displacement += gerstnerWave(wave3, p, tangent, binormal);
  
  // Apply displacement
  vec3 displacedPos = position + displacement;
  vWaveHeight = displacement.y;
  
  // Calculate normal
  vNormal = normalize(cross(binormal, tangent));
  vTangent = tangent;
  vBinormal = binormal;
  
  // Transform to world space
  vPosition = (world * vec4(displacedPos, 1.0)).xyz;
  vViewDir = normalize(cameraPosition - vPosition);
  vUv = uv;
  
  // Project to screen
  gl_Position = projection * view * vec4(vPosition, 1.0);
}
