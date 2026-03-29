precision highp float;

uniform mat4 world;
uniform mat4 viewProjection;
uniform float time;
uniform float amplitude;
uniform float frequency;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

varying vec4 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    float waveAmp = 0.8;
    float waveFreq = 0.5;
    
    // Three-layer Gerstner wave displacement
    float wave1 = waveAmp * sin(position.x * waveFreq + time) * cos(position.z * waveFreq + time * 0.7);
    float wave2 = waveAmp * 0.6 * sin(position.x * waveFreq * 1.3 + time * 1.3) * cos(position.z * waveFreq * 1.3 + time * 0.9);
    float wave3 = waveAmp * 0.4 * sin(position.x * waveFreq * 2.0 + time * 0.8) * cos(position.z * waveFreq * 2.0 + time * 1.1);
    float totalWave = wave1 + wave2 + wave3;
    
    vec3 displacedPos = position;
    displacedPos.y += totalWave;
    
    vec4 worldPos = world * vec4(displacedPos, 1.0);
    gl_Position = viewProjection * worldPos;
    
    // Blue water color with depth gradient
    float depthFactor = clamp(displacedPos.y * 0.1 + 0.5, 0.0, 1.0);
    vColor = vec4(0.0, 0.3 + depthFactor * 0.2, 0.6 + depthFactor * 0.2, 0.95);
    
    vNormal = normalize(normal);
    vWorldPos = worldPos.xyz;
    vUv = uv;
}
