struct Scene {
  viewProjection : mat4x4f,
  view : mat4x4f,
  projection : mat4x4f,
  vEyePosition : vec4f,
};

struct Mesh {
  world : mat4x4f,
  visibility : f32,
};

struct VertexInputs {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) uv : vec2f,
};

struct VertexOutputs {
  @builtin(position) position : vec4f,
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

@group(0) @binding(0) var<uniform> scene : Scene;
@group(1) @binding(1) var<uniform> mesh : Mesh;

@vertex
fn main(input: VertexInputs) -> VertexOutputs {
  var output: VertexOutputs;
  
  // Three-layer Gerstner wave displacement
  let time = f32(0.0);
  let waveAmp = 0.8;
  let waveFreq = 0.5;
  
  let wave1 = waveAmp * sin(input.position.x * waveFreq + time) * cos(input.position.z * waveFreq + time * 0.7);
  let wave2 = waveAmp * 0.6 * sin(input.position.x * waveFreq * 1.3 + time * 1.3) * cos(input.position.z * waveFreq * 1.3 + time * 0.9);
  let wave3 = waveAmp * 0.4 * sin(input.position.x * waveFreq * 2.0 + time * 0.8) * cos(input.position.z * waveFreq * 2.0 + time * 1.1);
  let totalWave = wave1 + wave2 + wave3;
  
  var displaced = input.position;
  displaced.y += totalWave;
  
  let worldPos = mesh.world * vec4f(displaced, 1.0);
  output.position = scene.viewProjection * worldPos;
  
  let depthFactor = clamp(displaced.y * 0.1 + 0.5, 0.0, 1.0);
  output.vColor = vec4f(0.0, 0.3 + depthFactor * 0.2, 0.6 + depthFactor * 0.2, 0.95);
  output.vNormal = input.normal;
  output.vWorldPos = worldPos.xyz;
  output.vUv = input.uv;
  
  return output;
}
