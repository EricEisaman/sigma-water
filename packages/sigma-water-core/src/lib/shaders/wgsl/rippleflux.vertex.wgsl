#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform rippleFieldBounds: vec4<f32>;
uniform rippleTexelSize: vec2<f32>;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;
varying vRippleUv : vec2<f32>;

var rippleHeightTexture: texture_2d<f32>;
var rippleHeightTextureSampler: sampler;

fn rippleUvForWorld(worldXZ: vec2<f32>) -> vec2<f32> {
  let size = max(uniforms.rippleFieldBounds.zw, vec2<f32>(0.001, 0.001));
  return (worldXZ - uniforms.rippleFieldBounds.xy) / size;
}

fn sampleRippleRaw(uvIn: vec2<f32>) -> f32 {
  let inside = step(0.0, uvIn.x) * step(0.0, uvIn.y) * step(uvIn.x, 1.0) * step(uvIn.y, 1.0);
  let clampedUv = clamp(uvIn, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
  return textureSampleLevel(rippleHeightTexture, rippleHeightTextureSampler, clampedUv, 0.0).r * inside;
}

fn sampleRippleHeight(uvIn: vec2<f32>) -> f32 {
  return sampleRippleRaw(uvIn) * uniforms.waveAmplitude;
}

fn sampleRippleHeightSmooth(uvIn: vec2<f32>) -> f32 {
  let dx = vec2<f32>(uniforms.rippleTexelSize.x, 0.0);
  let dy = vec2<f32>(0.0, uniforms.rippleTexelSize.y);
  let center = sampleRippleHeight(uvIn);
  let cross = sampleRippleHeight(uvIn - dx)
    + sampleRippleHeight(uvIn + dx)
    + sampleRippleHeight(uvIn - dy)
    + sampleRippleHeight(uvIn + dy);
  // Weighted 5-tap smoothing helps hide simulation-cell imprinting on coarse geometry.
  return center * 0.7 + cross * 0.075;
}

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let rippleUv = rippleUvForWorld(input.position.xz);
  let height = sampleRippleHeightSmooth(rippleUv);
  let displaced = vec3<f32>(input.position.x, input.position.y + height, input.position.z);

  let dx = vec2<f32>(uniforms.rippleTexelSize.x, 0.0);
  let dy = vec2<f32>(0.0, uniforms.rippleTexelSize.y);
  let left = sampleRippleHeightSmooth(rippleUv - dx);
  let right = sampleRippleHeightSmooth(rippleUv + dx);
  let down = sampleRippleHeightSmooth(rippleUv - dy);
  let up = sampleRippleHeightSmooth(rippleUv + dy);
  let worldCellX = max(uniforms.rippleFieldBounds.z * uniforms.rippleTexelSize.x, 0.001);
  let worldCellY = max(uniforms.rippleFieldBounds.w * uniforms.rippleTexelSize.y, 0.001);
  let slope = vec2<f32>((right - left) / (worldCellX * 2.0), (up - down) / (worldCellY * 2.0));
  let localNormal = normalize(vec3<f32>(-slope.x, 1.0, -slope.y));

  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(displaced, 1.0);
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(displaced, 1.0)).xyz;
  vertexOutputs.vNormal = normalize((mesh.world * vec4<f32>(localNormal, 0.0)).xyz);
  vertexOutputs.vUv = input.uv;
  vertexOutputs.vRippleUv = rippleUv;
}
