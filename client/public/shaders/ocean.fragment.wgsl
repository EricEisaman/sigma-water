struct FragmentInputs {
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

@fragment
fn main(input: FragmentInputs) -> @location(0) vec4f {
  var finalColor = input.vColor.rgb;
  
  // Fresnel reflection
  let viewDir = normalize(vec3f(0.0, 1.0, 0.5));
  let n = normalize(input.vNormal);
  let fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);
  
  // Specular highlights
  let sunDir = normalize(vec3f(1.0, 1.0, 0.5));
  let reflection = reflect(-viewDir, n);
  let specular = pow(max(dot(reflection, sunDir), 0.0), 32.0);
  
  // Caustics (underwater light patterns)
  let causticPattern = sin(input.vWorldPos.x * 3.0) * 0.5 + 0.5;
  let causticColor = vec3f(0.8, 0.9, 1.0) * causticPattern * 0.5;
  
  // Foam on wave crests
  let foam = smoothstep(0.2, 0.8, input.vWorldPos.y) * 0.3;
  let foamColor = vec3f(1.0, 1.0, 1.0) * foam;
  
  // Combine effects
  finalColor = mix(finalColor, vec3f(0.5, 0.7, 1.0), fresnel * 0.3);
  finalColor += causticColor + foamColor + vec3f(1.0, 0.95, 0.8) * specular * 0.8;
  
  return vec4f(finalColor, input.vColor.a);
}
