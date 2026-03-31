#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
uniform foamIntensity: f32;
uniform foamWidth: f32;
uniform causticIntensity: f32;
uniform specularIntensity: f32;
uniform depthFadeDistance: f32;
uniform depthFadeExponent: f32;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);
  let lightDir = normalize(vec3<f32>(0.32, 0.91, 0.26));

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.6, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let depthDistance = max(uniforms.depthFadeDistance, 0.2);
  let depthExp = max(uniforms.depthFadeExponent, 0.25);
  let depthLerp = pow(clamp((1.0 - heightBand) + slope * 0.28 + amp / depthDistance * 0.18, 0.0, 1.0), depthExp * 0.7);

  let troughColor = vec3<f32>(0.01, 0.05, 0.11);
  let bodyColor = vec3<f32>(0.03, 0.19, 0.31);
  let crestColor = vec3<f32>(0.12, 0.42, 0.56);
  var waterColor = mix(crestColor, troughColor, depthLerp);
  waterColor = mix(waterColor, bodyColor, clamp(ndl * 0.45 + 0.2, 0.0, 1.0));

  let halfVec = normalize(lightDir + viewDir);
  let specularStrength = max(uniforms.specularIntensity, 0.0);
  let gloss = clamp(0.42 + specularStrength * 0.24 - slope * 0.18, 0.18, 0.92);
  let specular = pow(max(dot(normal, halfVec), 0.0), mix(42.0, 260.0, gloss)) * (0.18 + specularStrength * 1.1);

  let crestMask = smoothstep(0.42, clamp(0.72 + uniforms.foamWidth * 0.12, 0.55, 0.96), heightBand + slope * 0.78);
  let foamFlow = sin(dot(input.vWorldPos.xz, windDir) * freq * 3.6 + uniforms.time * (0.75 + windSpd * 1.25));
  let foamCross = sin(dot(input.vWorldPos.xz, crossDir) * freq * 4.4 - uniforms.time * (0.45 + windSpd * 0.8));
  let foamNoise = foamFlow * 0.55 + foamCross * 0.45;
  let foam = crestMask * (foamNoise * 0.5 + 0.5) * max(uniforms.foamIntensity, 0.0) * (0.28 + slope * 0.95);

  let causticWave = sin(dot(input.vWorldPos.xz, windDir) * (freq * 1.1) - uniforms.time * 0.35) * 0.5 + 0.5;
  let caustic = (1.0 - depthLerp) * causticWave * max(uniforms.causticIntensity, 0.0) * 0.08;
  waterColor += vec3<f32>(0.04, 0.09, 0.08) * caustic;

  let scatter = vec3<f32>(0.0, 0.09, 0.12) * pow(1.0 - ndv, 1.7) * (0.45 + amp * 0.55);
  let reflectionTint = vec3<f32>(0.72, 0.84, 0.95);
  let lit = waterColor * (0.18 + ndl * 0.82) + scatter;
  let reflected = reflectionTint * fresnel;
  let foamColor = vec3<f32>(0.87, 0.93, 0.97) * foam;

  let horizonGlow = vec3<f32>(0.04, 0.08, 0.12) * pow(1.0 - ndv, 2.2);
  let color = lit + reflected + vec3<f32>(specular) + foamColor + horizonGlow;
  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
