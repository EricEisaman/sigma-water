struct GodRaysParams {
  sunScreenPos: vec2<f32>,
  sunIntensity: f32,
  rayDensity: f32,
  rayDecay: f32,
  rayExposure: f32,
  numSamples: u32,
  padding: vec2<u32>,
}

@group(0) @binding(2) var<uniform> godRaysParams: GodRaysParams;
@group(0) @binding(3) var screenTexture: texture_2d<f32>;
@group(0) @binding(4) var screenSampler: sampler;

fn sampleGodRays(uv: vec2<f32>) -> vec3<f32> {
  let sunPos = godRaysParams.sunScreenPos;
  let rayVector = sunPos - uv;
  let rayDirection = normalize(rayVector);

  var illuminationDecay = 1.0;
  var color = vec3<f32>(0.0);

  for (var i: u32 = 0u; i < godRaysParams.numSamples; i = i + 1u) {
    let samplePos = uv + rayDirection * f32(i) / f32(godRaysParams.numSamples);

    let sample = textureSample(screenTexture, screenSampler, samplePos);
    let brightness = dot(sample.rgb, vec3<f32>(0.299, 0.587, 0.114));

    color += brightness * illuminationDecay * godRaysParams.rayDensity;
    illuminationDecay *= godRaysParams.rayDecay;
  }

  color *= godRaysParams.sunIntensity * godRaysParams.rayExposure;

  return color;
}

fn applyGodRays(baseColor: vec3<f32>, uv: vec2<f32>) -> vec3<f32> {
  let rays = sampleGodRays(uv);
  return baseColor + rays;
}