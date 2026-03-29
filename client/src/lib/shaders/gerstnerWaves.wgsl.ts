/**
 * Gerstner Waves Shader (Original)
 * High-performance wave simulation with dynamic foam
 */

export const gerstnerWavesVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float windDirection;
uniform float windSpeed;
uniform float foamIntensity;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;
varying float vFoam;

const float PI = 3.14159265359;

// Gerstner wave calculation
vec3 gerstnerWave(vec4 wave, vec3 p) {
    float steepness = wave.z;
    float wavelength = wave.w;
    float k = 2.0 * PI / wavelength;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(wave.xy);
    float f = k * (dot(d, p.xz) - c * time);
    float a = steepness / k;
    
    return vec3(
        d.x * (a * cos(f)),
        a * sin(f),
        d.y * (a * cos(f))
    );
}

void main(void) {
    vec3 pos = position;
    vec3 displacement = vec3(0.0);
    
    // Multiple wave octaves
    vec4 wave1 = vec4(sin(windDirection * PI / 180.0), cos(windDirection * PI / 180.0), 0.25, 60.0);
    vec4 wave2 = vec4(sin((windDirection + 30.0) * PI / 180.0), cos((windDirection + 30.0) * PI / 180.0), 0.15, 31.0);
    vec4 wave3 = vec4(sin((windDirection + 60.0) * PI / 180.0), cos((windDirection + 60.0) * PI / 180.0), 0.10, 18.0);
    
    displacement += gerstnerWave(wave1 * vec4(1.0, 1.0, waveAmplitude, waveFrequency), pos);
    displacement += gerstnerWave(wave2 * vec4(1.0, 1.0, waveAmplitude * 0.6, waveFrequency * 1.5), pos);
    displacement += gerstnerWave(wave3 * vec4(1.0, 1.0, waveAmplitude * 0.4, waveFrequency * 2.5), pos);
    
    pos += displacement;
    vWaveHeight = displacement.y;
    
    // Foam calculation
    vFoam = max(0.0, displacement.y - 0.3) * foamIntensity;
    
    vWorldPos = (world * vec4(pos, 1.0)).xyz;
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);
    vUv = uv;
    
    gl_Position = worldViewProjection * vec4(pos, 1.0);
}
`;

export const gerstnerWavesFragmentShader = `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;
varying float vFoam;

uniform vec3 cameraPosition;
uniform float time;
uniform float causticIntensity;
uniform float depthFadeDistance;
uniform float depthFadeExponent;

const vec3 waterColor = vec3(0.1, 0.3, 0.5);
const vec3 foamColor = vec3(0.9, 0.95, 1.0);
const vec3 deepColor = vec3(0.02, 0.08, 0.15);

// Caustics pattern
float caustics(vec3 p) {
    float pattern = sin(p.x * 3.0 + time) * cos(p.z * 3.0 + time * 0.7);
    pattern += sin((p.x + p.z) * 2.0 + time * 0.5) * 0.5;
    return abs(pattern) * 0.5;
}

void main(void) {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    
    // Fresnel effect
    float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
    
    // Base water color with depth fade
    float depth = length(vWorldPos - cameraPosition);
    float depthFade = pow(1.0 - min(depth / depthFadeDistance, 1.0), depthFadeExponent);
    
    vec3 color = mix(deepColor, waterColor, depthFade);
    
    // Add caustics
    float causticsPattern = caustics(vWorldPos);
    color += causticsPattern * causticIntensity * vec3(0.3, 0.4, 0.2);
    
    // Foam
    color = mix(color, foamColor, vFoam);
    
    // Reflection/Refraction approximation
    color = mix(color, vec3(0.8, 0.9, 1.0), fresnel * 0.3);
    
    gl_FragColor = vec4(color, 1.0);
}
`;
