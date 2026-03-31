#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time: f32;
uniform waveAmplitude: f32;

attribute position : vec3<f32>;

varying vWorldPos: vec3<f32>;

const SEA_HEIGHT: f32 = 0.6;
const SEA_CHOPPY: f32 = 4.0;
const SEA_SPEED: f32 = 0.8;
const SEA_FREQ: f32 = 0.16;
const OCTAVE_M: mat2x2<f32> = mat2x2<f32>(1.6, 1.2, -1.2, 1.6);

fn hash(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(
    mix(hash(i + vec2<f32>(0.0, 0.0)), hash(i + vec2<f32>(1.0, 0.0)), u.x),
    mix(hash(i + vec2<f32>(0.0, 1.0)), hash(i + vec2<f32>(1.0, 1.0)), u.x),
    u.y
  );
}

fn sea_octave(uv_in: vec2<f32>, choppy: f32) -> f32 {
  var uv = uv_in;
  uv = uv + noise(uv);
  let wv = 1.0 - abs(sin(uv));
  let swv = abs(cos(uv));
  let wv_final = mix(wv, swv, wv);
  return pow(1.0 - pow(wv_final.x * wv_final.y, 0.65), choppy);
}

fn getHeight(p: vec3<f32>) -> f32 {
  var freq = SEA_FREQ;
  var amp = SEA_HEIGHT;
  var choppy = SEA_CHOPPY;
  var uv = p.xz;
  uv.x = uv.x * 0.75;
  let seaTime = 1.0 + uniforms.time * SEA_SPEED;
  var h: f32 = 0.0;
  for (var i: i32 = 0; i < 3; i = i + 1) {
    var d = sea_octave((uv + seaTime) * freq, choppy);
    d = d + sea_octave((uv - seaTime) * freq, choppy);
    h = h + d * amp;
    uv = OCTAVE_M * uv;
    freq = freq * 1.9;
    amp = amp * 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }
  return h;
}

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  var pos = input.position;
  pos.y = getHeight(pos);
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(pos, 1.0)).xyz;
  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(pos, 1.0);
}