varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let lightDir = normalize(vec3<f32>(0.25, 1.0, 0.35));
  let diffuse = max(dot(normal, lightDir), 0.0);
  let ambient = 0.35;
  let lighting = ambient + (1.0 - ambient) * diffuse;
  let color = vec3<f32>(0.05, 0.15, 0.25) * lighting;
  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
