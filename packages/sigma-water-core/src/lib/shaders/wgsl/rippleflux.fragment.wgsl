#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform rippleFieldBounds: vec4<f32>;
uniform rippleTexelSize: vec2<f32>;
uniform specularIntensity: f32;
uniform skyReflectionMix: f32;
uniform depthFadeDistance: f32;
uniform depthFadeExponent: f32;
uniform underwaterEnabled: f32;
uniform underwaterTransitionDepth: f32;
uniform underwaterFogDensity: f32;
uniform underwaterHorizonMix: f32;
uniform underwaterColorR: f32;
uniform underwaterColorG: f32;
uniform underwaterColorB: f32;
uniform underwaterFactor: f32;

var rippleHeightTexture: texture_2d<f32>;
var rippleHeightTextureSampler: sampler;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;
varying vRippleUv : vec2<f32>;

fn getSkyColor(directionIn: vec3<f32>) -> vec3<f32> {
  var direction = directionIn;
  direction.y = (max(direction.y, 0.0) * 0.76 + 0.24) * 0.84;
  return vec3<f32>(
    pow(1.0 - direction.y, 2.0) * 0.85,
    0.76 - direction.y * 0.28,
    0.9 + (1.0 - direction.y) * 0.24
  );
}

fn rippleBand(uvIn: vec2<f32>) -> f32 {
  let sampled = textureSample(rippleHeightTexture, rippleHeightTextureSampler, clamp(uvIn, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0))).r;
  return sampled;
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.32, 0.9, 0.24));
  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.04 + max(uniforms.skyReflectionMix, 0.0) * pow(1.0 - ndv, 4.6);

  let rippleValue = rippleBand(input.vRippleUv);
  let nearby = abs(rippleBand(input.vRippleUv + vec2<f32>(uniforms.rippleTexelSize.x * 2.0, uniforms.rippleTexelSize.y * 2.0)) - rippleValue);
  let rippleEnergy = clamp(abs(rippleValue) * 5.0 + nearby * 8.0, 0.0, 1.0);

  let shallowColor = vec3<f32>(0.06, 0.26, 0.34);
  let midColor = vec3<f32>(0.02, 0.11, 0.19);
  let deepColor = vec3<f32>(0.006, 0.03, 0.08);
  let baseDepth = clamp(length(scene.vEyePosition.xyz - input.vWorldPos) / max(uniforms.depthFadeDistance * 220.0, 1.0), 0.0, 1.0);
  let depthMix = pow(baseDepth, max(uniforms.depthFadeExponent, 0.2));
  var bodyColor = mix(shallowColor, midColor, smoothstep(0.08, 0.55, depthMix));
  bodyColor = mix(bodyColor, deepColor, smoothstep(0.42, 1.0, depthMix));

  let reflected = getSkyColor(reflect(-viewDir, normal));
  let scatter = vec3<f32>(0.03, 0.08, 0.11) * (0.35 + rippleEnergy * 0.65);
  let halfVec = normalize(lightDir + viewDir);
  let specular = pow(max(dot(normal, halfVec), 0.0), mix(22.0, 130.0, clamp(uniforms.specularIntensity * 0.45, 0.0, 1.0)))
    * (0.06 + max(uniforms.specularIntensity, 0.0) * 0.24);

  var color = bodyColor * (0.28 + ndl * 0.52) + scatter;
  color = mix(color, reflected, clamp(fresnel, 0.0, 1.0));
  color += vec3<f32>(specular, specular, specular);
  color += vec3<f32>(0.16, 0.24, 0.28) * rippleEnergy * 0.25;

  let underwaterColor = vec3<f32>(uniforms.underwaterColorR, uniforms.underwaterColorG, uniforms.underwaterColorB);
  color = mix(color, underwaterColor, clamp(uniforms.underwaterFactor, 0.0, 1.0) * 0.75);

  fragmentOutputs.color = vec4<f32>(pow(max(color, vec3<f32>(0.0, 0.0, 0.0)), vec3<f32>(0.92, 0.92, 0.92)), 1.0);
}
