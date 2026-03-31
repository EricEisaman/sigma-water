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

fn crestWave(phase: f32, asymmetry: f32) -> f32 {
  let s = sin(phase);
  let crest = max(s, 0.0);
  let trough = min(s, 0.0);
  let sharpenedCrest = crest * (1.0 + crest * (0.65 + asymmetry * 0.55));
  return trough * (1.0 - asymmetry * 0.35) + sharpenedCrest;
}

fn octaveDisplacement(xzIn: vec2<f32>, time: f32, freqBase: f32, ampBase: f32, windSpd: f32, windDir: vec2<f32>, crossDir: vec2<f32>) -> f32 {
  var uv = vec2<f32>(dot(xzIn, windDir), dot(xzIn, crossDir));
  var freq = freqBase;
  var amp = ampBase;
  var choppy = 4.0;
  var h = 0.0;
  var flowA = vec2<f32>(time * (0.82 + windSpd * 0.36), time * (0.34 + windSpd * 0.18));
  var flowB = vec2<f32>(time * (0.56 + windSpd * 0.26) + 1.3, time * (0.91 + windSpd * 0.22) - 0.7);
  var flowC = vec2<f32>(time * (1.03 + windSpd * 0.29) - 2.1, time * (0.62 + windSpd * 0.27) + 1.9);

  for (var i = 0; i < 3; i = i + 1) {
    let d1 = seaOctave((uv + flowA) * freq, choppy);
    let d2 = seaOctave((uv + flowB) * freq, choppy);
    let d3 = seaOctave((uv + flowC) * freq, choppy);
    h += (d1 * 0.45 + d2 * 0.33 + d3 * 0.22) * amp;
    uv = OCTAVE_M * uv;
    flowA = OCTAVE_M * flowA * 1.04 + vec2<f32>(0.7, -0.2);
    flowB = OCTAVE_M * flowB * 1.02 + vec2<f32>(-0.5, 0.4);
    flowC = OCTAVE_M * flowC * 1.03 + vec2<f32>(0.2, 0.6);
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return h * (0.38 + windSpd * 0.08);
}

fn travelingHeight(xz: vec2<f32>, time: f32, freq: f32, amp: f32, windSpd: f32, windDir: vec2<f32>, crossDir: vec2<f32>) -> f32 {
  let crestness = clamp(0.22 + windSpd * 0.58, 0.0, 1.0);
  let travel = 0.24 + windSpd * 0.36;
  let dirA = windDir;
  let dirB = normalize(windDir * 0.9 + crossDir * 0.42);
  let dirC = normalize(windDir * 0.64 - crossDir * 0.78);
  let dirD = normalize(crossDir * 0.98 + windDir * 0.18);
  let dirE = normalize(crossDir * -0.82 + windDir * 0.42);
  let dirF = normalize(windDir * -0.3 + crossDir * 0.95);

  let pA = dot(xz, dirA) * (freq * 0.86) - time * (travel * 0.88);
  let pB = dot(xz, dirB) * (freq * 1.12) - time * (travel * 1.16) + 1.7;
  let pC = dot(xz, dirC) * (freq * 1.44) - time * (travel * 1.36) + 4.2;
  let pD = dot(xz, dirD) * (freq * 1.82) - time * (travel * 1.72) + 2.3;
  let pE = dot(xz, dirE) * (freq * 2.08) - time * (travel * 2.04) + 5.1;
  let pF = dot(xz, dirF) * (freq * 2.42) - time * (travel * 2.36) + 0.9;

  let wA = crestWave(pA, crestness) * amp * 0.28;
  let wB = crestWave(pB, crestness * 0.9) * amp * 0.22;
  let wC = crestWave(pC, crestness * 0.75) * amp * 0.18;
  let wD = crestWave(pD, crestness * 0.62) * amp * 0.14;
  let wE = sin(pE) * amp * 0.1;
  let wF = sin(pF) * amp * 0.08;
  let interference = (
    sin((pA - pC) * 0.63)
    + sin((pB - pD) * 0.57)
    + sin((pE - pF) * 0.71)
  ) * amp * 0.03;

  let macroWave = wA + wB + wC + wD + wE + wF + interference;
  let octaveTime = 1.0 + time * (0.86 + windSpd * 0.34);
  let octaveWave = octaveDisplacement(vec2<f32>(xz.x * 0.75, xz.y), octaveTime, freq * 0.94, amp * 0.66, windSpd, windDir, crossDir);

  return macroWave + octaveWave;
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
  let height = travelingHeight(xz, uniforms.time, freq, amp, windSpd, windDir, crossDir);

  let dirA = windDir;
  let dirB = normalize(windDir * 0.9 + crossDir * 0.42);
  let dirC = normalize(windDir * 0.64 - crossDir * 0.78);
  let dirD = normalize(crossDir * 0.98 + windDir * 0.18);
  let phaseA = dot(xz, dirA) * (freq * 0.86) - uniforms.time * ((0.24 + windSpd * 0.36) * 0.88);
  let phaseB = dot(xz, dirB) * (freq * 1.12) - uniforms.time * ((0.24 + windSpd * 0.36) * 1.16) + 1.7;
  let phaseC = dot(xz, dirC) * (freq * 1.44) - uniforms.time * ((0.24 + windSpd * 0.36) * 1.36) + 4.2;
  let phaseD = dot(xz, dirD) * (freq * 1.82) - uniforms.time * ((0.24 + windSpd * 0.36) * 1.72) + 2.3;

  let chop = amp * (0.06 + windSpd * 0.08);
  let chopOffset =
    dirA * cos(phaseA) * (chop * 0.36)
    + dirB * cos(phaseB) * (chop * 0.3)
    + dirC * cos(phaseC) * (chop * 0.24)
    + dirD * cos(phaseD) * (chop * 0.2);
  let displaced = vec3<f32>(input.position.x + chopOffset.x, input.position.y + height, input.position.z + chopOffset.y);

  let slopeDelta = max(freq * 0.45, 0.08);
  let heightDx = travelingHeight(xz + vec2<f32>(slopeDelta, 0.0), uniforms.time, freq, amp, windSpd, windDir, crossDir) - height;
  let heightDz = travelingHeight(xz + vec2<f32>(0.0, slopeDelta), uniforms.time, freq, amp, windSpd, windDir, crossDir) - height;
  let slope = vec2<f32>(heightDx / slopeDelta, heightDz / slopeDelta);
  let localNormal = normalize(vec3<f32>(-slope.x, 1.0, -slope.y));

  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(displaced, 1.0);
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(displaced, 1.0)).xyz;
  vertexOutputs.vNormal = normalize((mesh.world * vec4<f32>(localNormal, 0.0)).xyz);
  vertexOutputs.vUv = input.uv;
}
