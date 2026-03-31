#include<sceneUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
uniform specularIntensity: f32;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let normal = normalize(input.vNormal);
  let lightDir = normalize(vec3<f32>(0.28, 0.92, 0.27));
  let viewDir = normalize(scene.vEyePosition.xyz - input.vWorldPos);

  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);
  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let diffuse = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let fresnel = pow(1.0 - ndv, 4.2);
  let slope = clamp(1.0 - normal.y, 0.0, 1.0);
  let heightBand = clamp(input.vWorldPos.y / max(amp * 2.6, 0.001) * 0.5 + 0.5, 0.0, 1.0);

  let litValue = clamp(diffuse * 0.82 + heightBand * 0.18 - slope * 0.08, 0.0, 1.0);
  let band0 = step(0.16, litValue);
  let band1 = step(0.4, litValue);
  let band2 = step(0.7, litValue);
  let bandMix = band0 * 0.28 + band1 * 0.32 + band2 * 0.4;

  let shadowColor = vec3<f32>(0.02, 0.11, 0.17);
  let midColor = vec3<f32>(0.07, 0.28, 0.4);
  let lightColor = vec3<f32>(0.24, 0.62, 0.76);
  let bandColor = mix(shadowColor, midColor, bandMix);
  let toonBase = mix(bandColor, lightColor, band2 * 0.8);

  let rim = pow(1.0 - ndv, 2.7);
  let rimLight = rim * (0.16 + amp * 0.1);

  let crestFlow = sin(dot(input.vWorldPos.xz, windDir) * (freq * 2.4) + uniforms.time * (0.6 + windSpd));
  let crossFlow = sin(dot(input.vWorldPos.xz, crossDir) * (freq * 3.8) - uniforms.time * (0.45 + windSpd * 0.7));
  let crestLine = smoothstep(0.46, 0.78, heightBand + slope * 0.62 + crestFlow * 0.08 + crossFlow * 0.05);
  let foam = crestLine * (0.08 + amp * 0.08);

  let reflectionBand = step(0.56, fresnel) * 0.18;
  let glint = pow(max(dot(normalize(lightDir + viewDir), normal), 0.0), mix(52.0, 180.0, clamp(max(uniforms.specularIntensity, 0.0) * 0.42 + 0.18, 0.0, 1.0))) * (0.18 + max(uniforms.specularIntensity, 0.0) * 0.34);

  var color = toonBase + vec3<f32>(rimLight + foam + reflectionBand + glint);
  let fog = clamp(1.0 - ndv, 0.0, 1.0) * 0.1;
  color = mix(color, vec3<f32>(0.1, 0.3, 0.41), fog);

  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
