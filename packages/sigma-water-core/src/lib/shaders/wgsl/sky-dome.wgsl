struct SkyParams {
  sunPos: vec3<f32>,
  sunIntensity: f32,
  skyColor: vec3<f32>,
  horizonColor: vec3<f32>,
}

@group(0) @binding(0) var<uniform> skyParams: SkyParams;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
}

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
) -> VertexOutput {
  let uv = vec2<f32>(
    f32(vertexIndex & 1u),
    f32((vertexIndex >> 1u) & 1u)
  ) * 2.0 - 1.0;

  var output: VertexOutput;
  output.position = vec4<f32>(uv, 0.99, 1.0);
  output.worldPos = normalize(vec3<f32>(uv, 1.0));
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  let viewDir = normalize(input.worldPos);
  let sunDir = normalize(skyParams.sunPos);

  let sunGlow = pow(max(dot(viewDir, sunDir), 0.0), 8.0) * skyParams.sunIntensity;
  let skyGradient = mix(
    skyParams.horizonColor,
    skyParams.skyColor,
    max(viewDir.y, 0.0)
  );

  let color = skyGradient + vec3<f32>(1.0) * sunGlow * 0.5;

  return vec4<f32>(color, 1.0);
}