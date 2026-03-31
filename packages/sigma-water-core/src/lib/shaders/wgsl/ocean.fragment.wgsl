uniform time: f32;
uniform cameraPosition: vec3<f32>;

// Runtime compatibility uniforms (intentionally unused here).
uniform boatCollisionCenter: vec3<f32>;
uniform islandCollisionCenter: vec3<f32>;
uniform boatCollisionRadius: f32;
uniform islandCollisionRadius: f32;
uniform boatIntersectionFactor: f32;
uniform islandIntersectionFactor: f32;
uniform underwaterEnabled: f32;
uniform underwaterTransitionDepth: f32;
uniform underwaterFogDensity: f32;
uniform underwaterHorizonMix: f32;
uniform underwaterColorR: f32;
uniform underwaterColorG: f32;
uniform underwaterColorB: f32;
uniform underwaterFactor: f32;

varying vWorldPos: vec3<f32>;

const PI: f32 = 3.141592;
const SEA_HEIGHT: f32 = 0.6;
const SEA_CHOPPY: f32 = 4.0;
const SEA_SPEED: f32 = 0.8;
const SEA_FREQ: f32 = 0.16;
const OCTAVE_M: mat2x2<f32> = mat2x2<f32>(1.6, 1.2, -1.2, 1.6);
const SEA_BASE: vec3<f32> = vec3<f32>(0.0, 0.09, 0.18);
const SEA_WATER_COLOR: vec3<f32> = vec3<f32>(0.8, 0.9, 0.6) * 0.6;

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

fn map_detailed(p: vec3<f32>) -> f32 {
  var freq = SEA_FREQ;
  var amp = SEA_HEIGHT;
  var choppy = SEA_CHOPPY;
  var uv = p.xz;
  uv.x = uv.x * 0.75;
  let seaTime = 1.0 + uniforms.time * SEA_SPEED;
  var h: f32 = 0.0;
  for (var i: i32 = 0; i < 5; i = i + 1) {
    var d = sea_octave((uv + seaTime) * freq, choppy);
    d = d + sea_octave((uv - seaTime) * freq, choppy);
    h = h + d * amp;
    uv = OCTAVE_M * uv;
    freq = freq * 1.9;
    amp = amp * 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }
  return p.y - h;
}

fn getNormal(p: vec3<f32>, eps: f32) -> vec3<f32> {
  var n: vec3<f32>;
  n.y = map_detailed(p);
  n.x = map_detailed(vec3<f32>(p.x + eps, p.y, p.z)) - n.y;
  n.z = map_detailed(vec3<f32>(p.x, p.y, p.z + eps)) - n.y;
  n.y = eps;
  return normalize(n);
}

fn diffuse(n: vec3<f32>, l: vec3<f32>, p: f32) -> f32 {
  return pow(dot(n, l) * 0.4 + 0.6, p);
}

fn specular(n: vec3<f32>, l: vec3<f32>, e: vec3<f32>, s: f32) -> f32 {
  let nrm = (s + 8.0) / (PI * 8.0);
  return pow(max(dot(reflect(e, n), l), 0.0), s) * nrm;
}

fn getSkyColor(e_in: vec3<f32>) -> vec3<f32> {
  var e = e_in;
  e.y = (max(e.y, 0.0) * 0.8 + 0.2) * 0.8;
  return vec3<f32>(pow(1.0 - e.y, 2.0), 1.0 - e.y, 0.6 + (1.0 - e.y) * 0.4) * 1.1;
}

fn getSeaColor(p: vec3<f32>, n: vec3<f32>, l: vec3<f32>, eye: vec3<f32>, dist: vec3<f32>) -> vec3<f32> {
  var fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
  fresnel = min(fresnel * fresnel * fresnel, 0.5);
  let reflected = getSkyColor(reflect(eye, n));
  let refracted = SEA_BASE + diffuse(n, l, 80.0) * SEA_WATER_COLOR * 0.12;
  var color = mix(refracted, reflected, fresnel);
  let atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
  color = color + SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;
  color = color + specular(n, l, eye, 600.0 * inverseSqrt(dot(dist, dist)));
  return color;
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let p = input.vWorldPos;
  let dist = p - uniforms.cameraPosition;
  let eye = normalize(dist);

  let eps = dot(dist, dist) * 0.0002;
  let n = getNormal(p, eps);
  let light_dir = normalize(vec3<f32>(0.0, 1.0, 0.8));

  var color = getSeaColor(p, n, light_dir, eye, dist);
  color = pow(color, vec3<f32>(0.65));

  fragmentOutputs.color = vec4<f32>(color, 1.0);
  return fragmentOutputs;
}
