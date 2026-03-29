// Babylon.js 9 WebGPU WGSL Ocean Fragment Shader - CORRECT SYNTAX
varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;

fn random(p : vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn caustics(pos : vec3<f32>, time : f32) -> f32 {
  let uv = pos.xz * 0.5 + time * 0.1;
  let c1 = sin(uv.x * 3.0 + time) * 0.5 + 0.5;
  let c2 = sin(uv.y * 3.0 + time * 0.7) * 0.5 + 0.5;
  let c3 = sin((uv.x + uv.y) * 2.0 + time * 0.5) * 0.5 + 0.5;
  return c1 * c2 * c3;
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  var finalColor = input.vColor.rgb;
  
  // Fresnel effect for water surface
  let viewDir = normalize(vec3<f32>(0.0, 1.0, 0.5));
  let normal = normalize(input.vNormal);
  let fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
  
  // Add specular highlight
  let sunDir = normalize(vec3<f32>(1.0, 1.0, 0.5));
  let reflection = reflect(-viewDir, normal);
  let specular = pow(max(dot(reflection, sunDir), 0.0), 32.0);
  
  // Caustics
  let causticPattern = caustics(input.vWorldPos, 0.0);
  let causticColor = vec3<f32>(0.8, 0.9, 1.0) * causticPattern * 0.5;
  
  // Foam on wave crests
  let foam = smoothstep(0.2, 0.8, input.vWorldPos.y) * 0.3;
  let foamColor = vec3<f32>(1.0, 1.0, 1.0) * foam;
  
  // Combine effects
  finalColor = mix(finalColor, vec3<f32>(0.5, 0.7, 1.0), fresnel * 0.3);
  finalColor += causticColor;
  finalColor += foamColor;
  finalColor += vec3<f32>(1.0, 0.95, 0.8) * specular * 0.8;
  
  // Depth fade
  let depth = length(input.vWorldPos);
  let depthFade = exp(-depth * 0.01);
  finalColor = mix(vec3<f32>(0.0, 0.0, 0.1), finalColor, depthFade);
  
  // Tone mapping + gamma correction
  finalColor = finalColor / (finalColor + vec3<f32>(1.0));
  finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));
  
  fragmentOutputs.color = vec4<f32>(finalColor, input.vColor.a);
  return fragmentOutputs;
}
