struct Instance {
  transform: mat4x4<f32>,
}

@group(0) @binding(1) var<storage> instances: array<Instance>;

fn getInstanceTransform(instanceIndex: u32) -> mat4x4<f32> {
  return instances[instanceIndex].transform;
}