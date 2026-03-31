#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
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
  let lightDir = normalize(vec3<f32>(0.3, 0.9, 0.3));

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = 0.018 + 0.982 * pow(1.0 - ndv, 5.2);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.8, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let depthDistance = max(uniforms.depthFadeDistance, 0.2);
  let depthExp = max(uniforms.depthFadeExponent, 0.25);
  let depthLerp = pow(clamp((1.0 - heightBand) + slope * 0.3 + amp / depthDistance * 0.2, 0.0, 1.0), depthExp * 0.72);

  let deepColor = vec3<f32>(0.005, 0.03, 0.08);
  let bodyColor = vec3<f32>(0.01, 0.11, 0.2);
  let crestColor = vec3<f32>(0.05, 0.27, 0.42);
  let baseColor = mix(crestColor, deepColor, depthLerp);
  let colorBody = mix(baseColor, bodyColor, clamp(ndl * 0.36 + 0.24, 0.0, 1.0));

  let halfVec = normalize(lightDir + viewDir);
  let specularStrength = max(uniforms.specularIntensity, 0.0);
  let gloss = clamp(0.34 + specularStrength * 0.18 - slope * 0.1, 0.14, 0.8);
  let specular = pow(max(dot(normal, halfVec), 0.0), mix(24.0, 170.0, gloss)) * (0.15 + specularStrength * 0.95);

  let wavePattern = sin(dot(input.vWorldPos.xz, windDir) * freq * 1.6 + uniforms.time * (0.3 + windSpd * 0.55));
  let crossPattern = sin(dot(input.vWorldPos.xz, crossDir) * freq * 2.1 - uniforms.time * (0.52 + windSpd * 0.72));
  let whitecapSeed = wavePattern * 0.65 + crossPattern * 0.35;
  let whitecaps = smoothstep(0.6, 0.94, slope + whitecapSeed * 0.18 + heightBand * 0.3 + windSpd * 0.08);

  let scatter = vec3<f32>(0.0, 0.045, 0.07) * pow(1.0 - ndv, 1.9) * (0.75 + amp * 0.3);
  let reflected = vec3<f32>(0.74, 0.85, 0.97) * fresnel;
  let lighting = colorBody * (0.14 + ndl * 0.86);
  let foamColor = vec3<f32>(0.73, 0.84, 0.92) * whitecaps * (0.18 + windSpd * 0.38);

  let horizonGlow = vec3<f32>(0.04, 0.07, 0.11) * pow(1.0 - ndv, 2.4);
  let color = lighting + scatter + reflected + vec3<f32>(specular) + foamColor + horizonGlow;

  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
