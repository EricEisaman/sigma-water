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

const OCTAVE_M: mat2x2<f32> = mat2x2<f32>(1.6, 1.2, -1.2, 1.6);

fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn valueNoiseSigned(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (vec2<f32>(3.0, 3.0) - 2.0 * f);

  let a = hash21(i + vec2<f32>(0.0, 0.0));
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));

  let x1 = mix(a, b, u.x);
  let x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y) * 2.0 - 1.0;
}

fn seaOctave(uvIn: vec2<f32>, choppy: f32) -> f32 {
  let uv = uvIn + vec2<f32>(valueNoiseSigned(uvIn), valueNoiseSigned(uvIn + vec2<f32>(19.1, 7.3)));
  let wv = vec2<f32>(1.0, 1.0) - abs(sin(uv));
  let swv = abs(cos(uv));
  let mixedWv = mix(wv, swv, wv);
  return pow(1.0 - pow(mixedWv.x * mixedWv.y, 0.65), choppy);
}

fn octaveDisplacement(xzIn: vec2<f32>, time: f32, freqBase: f32, ampBase: f32, windSpd: f32) -> f32 {
  var uv = xzIn;
  var freq = freqBase;
  var amp = ampBase;
  var choppy = 4.0;
  var h = 0.0;

  for (var i = 0; i < 3; i = i + 1) {
    let d1 = seaOctave((uv + vec2<f32>(time, time * 0.92)) * freq, choppy);
    let d2 = seaOctave((uv - vec2<f32>(time * 1.06, time)) * freq, choppy);
    h += (d1 + d2) * amp;
    uv = OCTAVE_M * uv;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return h * (0.38 + windSpd * 0.08);
}

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
  let timeFlow = 1.0 + uniforms.time * (0.8 + windSpd * 0.2);
  let octaveWave = octaveDisplacement(vec2<f32>(xz.x * 0.75, xz.y), timeFlow, freq * 0.92, amp * 0.68, windSpd);
  let height = swell + mediumWave + ripples + octaveWave;

  let chop = amp * (0.06 + windSpd * 0.08);
  let chopOffset = windDir * cos(swellPhase) * chop + crossDir * cos(mediumPhase) * (chop * 0.55);
  let displaced = vec3<f32>(input.position.x + chopOffset.x, input.position.y + height, input.position.z + chopOffset.y);

  let dHdSwell = cos(swellPhase) * amp * freq;
  let dHdMedium = cos(mediumPhase) * amp * (0.42 + windSpd * 0.1) * freq * 1.65;
  let dHdRipple = cos(ripplePhase) * amp * (0.16 + windSpd * 0.06) * freq * 2.5;
  let octaveDelta = max(freq * 0.55, 0.04);
  let octaveDx = octaveDisplacement(vec2<f32>((xz.x + octaveDelta) * 0.75, xz.y), timeFlow, freq * 0.92, amp * 0.68, windSpd) - octaveWave;
  let octaveDz = octaveDisplacement(vec2<f32>(xz.x * 0.75, xz.y + octaveDelta), timeFlow, freq * 0.92, amp * 0.68, windSpd) - octaveWave;
  let octaveSlope = vec2<f32>(octaveDx / octaveDelta, octaveDz / octaveDelta);
  let slope = windDir * dHdSwell + crossDir * dHdMedium + rippleDir * dHdRipple + octaveSlope;
  let localNormal = normalize(vec3<f32>(-slope.x, 1.0, -slope.y));

  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(displaced, 1.0);
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(displaced, 1.0)).xyz;
  vertexOutputs.vNormal = normalize((mesh.world * vec4<f32>(localNormal, 0.0)).xyz);
  vertexOutputs.vUv = input.uv;
}
