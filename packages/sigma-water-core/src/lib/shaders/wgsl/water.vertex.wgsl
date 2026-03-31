#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;
uniform waveFrequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let amp = max(uniforms.waveAmplitude, 0.05) * 0.42;
  let freq = max(uniforms.waveFrequency, 0.12) * 0.78;
  let windSpd = max(uniforms.windSpeed, 0.05);

  let angle = uniforms.windDirection * 0.017453292519943295;
  let windDir = normalize(vec2<f32>(cos(angle), sin(angle)));
  let crossDir = vec2<f32>(-windDir.y, windDir.x);

  let xz = input.position.xz;
  let swellPhase = dot(xz, windDir) * freq + uniforms.time * (0.22 + windSpd * 0.34);
  let mediumPhase = dot(xz, crossDir) * (freq * 1.65) - uniforms.time * (0.44 + windSpd * 0.58);
  let rippleDir = normalize(windDir + crossDir * 0.35);
  let ripplePhase = dot(xz, rippleDir) * (freq * 2.5) + uniforms.time * (0.95 + windSpd * 1.05);

  // Multi-cascade displacement: large swell + medium chop + fine ripples.
  let swell = sin(swellPhase) * amp;
  let mediumWave = sin(mediumPhase) * amp * (0.42 + windSpd * 0.1);
  let ripples = sin(ripplePhase) * amp * (0.16 + windSpd * 0.06);
  let height = swell + mediumWave + ripples;

  let chop = amp * (0.06 + windSpd * 0.08);
  let chopOffset = windDir * cos(swellPhase) * chop + crossDir * cos(mediumPhase) * (chop * 0.55);
  let displaced = vec3<f32>(input.position.x + chopOffset.x, input.position.y + height, input.position.z + chopOffset.y);

  let dHdSwell = cos(swellPhase) * amp * freq;
  let dHdMedium = cos(mediumPhase) * amp * (0.42 + windSpd * 0.1) * freq * 1.65;
  let dHdRipple = cos(ripplePhase) * amp * (0.16 + windSpd * 0.06) * freq * 2.5;
  let slope = windDir * dHdSwell + crossDir * dHdMedium + rippleDir * dHdRipple;
  let localNormal = normalize(vec3<f32>(-slope.x, 1.0, -slope.y));

  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(displaced, 1.0);
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(displaced, 1.0)).xyz;
  vertexOutputs.vNormal = normalize((mesh.world * vec4<f32>(localNormal, 0.0)).xyz);
  vertexOutputs.vUv = input.uv;
}
