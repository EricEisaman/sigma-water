/**
 * Ocean Waves Shader (Ported from GLSL to WGSL)
 * Multi-octave procedural ocean with advanced normal calculation
 * 
 * Properly ported WGSL implementation matching Babylon.js patterns
 * - Uses Babylon includes for scene/mesh uniforms
 * - Perlin noise for procedural wave generation
 * - 5-octave multi-scale wave simulation
 * - Advanced normal calculation via finite differences
 * - Fresnel-based reflection/refraction blending
 */

export const oceanWavesVertexShader = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;

const SEA_HEIGHT: f32 = 0.6;
const SEA_CHOPPY: f32 = 4.0;
const SEA_SPEED: f32 = 0.8;
const SEA_FREQ: f32 = 0.16;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    let a = hash(i + vec2<f32>(0.0, 0.0));
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    
    return -1.0 + 2.0 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn sea_octave(uv: vec2<f32>, choppy: f32) -> f32 {
    var uv_mut = uv + noise(uv);
    let wv = 1.0 - abs(sin(uv_mut));
    let swv = abs(cos(uv_mut));
    let wv_final = mix(wv, swv, wv);
    return pow(1.0 - pow(wv_final.x * wv_final.y, 0.65), choppy);
}

fn getHeight(p: vec3<f32>) -> f32 {
    var freq = SEA_FREQ;
    var amp = SEA_HEIGHT;
    var choppy = SEA_CHOPPY;
    var uv = p.xz;
    uv.x *= 0.75;
    
    let seaTime = 1.0 + uniforms.time * SEA_SPEED;
    var h = 0.0;
    
    for (var i: i32 = 0; i < 3; i = i + 1) {
        let d = sea_octave((uv + seaTime) * freq, choppy) + 
                sea_octave((uv - seaTime) * freq, choppy);
        h += d * amp;
        uv = uv * mat2x2<f32>(1.6, -1.2, 1.2, 1.6);
        freq *= 1.9;
        amp *= 0.22;
        choppy = mix(choppy, 1.0, 0.2);
    }
    
    return h;
}

@vertex
fn main(input: VertexInputs) -> VertexOutput {
    var pos = input.position;
    pos.y = getHeight(pos);
    
    let worldPos = (sceneUniforms.world * vec4<f32>(pos, 1.0)).xyz;
    let worldNormal = normalize((sceneUniforms.world * vec4<f32>(input.normal, 0.0)).xyz);
    
    var output: VertexOutput;
    output.position = sceneUniforms.worldViewProjection * vec4<f32>(pos, 1.0);
    output.vWorldPos = worldPos;
    output.vNormal = worldNormal;
    output.vUv = input.uv;
    return output;
}
`;

export const oceanWavesFragmentShader = `
uniform time : f32;
uniform cameraPosition : vec3<f32>;

const PI: f32 = 3.141592;
const SEA_BASE: vec3<f32> = vec3<f32>(0.0, 0.09, 0.18);
const SEA_WATER_COLOR: vec3<f32> = vec3<f32>(0.8, 0.9, 0.6) * 0.6;

const SEA_HEIGHT: f32 = 0.6;
const SEA_CHOPPY: f32 = 4.0;
const SEA_SPEED: f32 = 0.8;
const SEA_FREQ: f32 = 0.16;

fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    let a = hash(i + vec2<f32>(0.0, 0.0));
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    
    return -1.0 + 2.0 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn sea_octave(uv: vec2<f32>, choppy: f32) -> f32 {
    var uv_mut = uv + noise(uv);
    let wv = 1.0 - abs(sin(uv_mut));
    let swv = abs(cos(uv_mut));
    let wv_final = mix(wv, swv, wv);
    return pow(1.0 - pow(wv_final.x * wv_final.y, 0.65), choppy);
}

fn map_detailed(p: vec3<f32>) -> f32 {
    var freq = SEA_FREQ;
    var amp = SEA_HEIGHT;
    var choppy = SEA_CHOPPY;
    var uv = p.xz;
    uv.x *= 0.75;
    
    let seaTime = 1.0 + uniforms.time * SEA_SPEED;
    var h = 0.0;
    
    for (var i: i32 = 0; i < 5; i = i + 1) {
        let d = sea_octave((uv + seaTime) * freq, choppy) + 
                sea_octave((uv - seaTime) * freq, choppy);
        h += d * amp;
        uv = uv * mat2x2<f32>(1.6, -1.2, 1.2, 1.6);
        freq *= 1.9;
        amp *= 0.22;
        choppy = mix(choppy, 1.0, 0.2);
    }
    
    return p.y - h;
}

fn getNormal(p: vec3<f32>, eps: f32) -> vec3<f32> {
    let n_y = map_detailed(p);
    let n_x = map_detailed(vec3<f32>(p.x + eps, p.y, p.z)) - n_y;
    let n_z = map_detailed(vec3<f32>(p.x, p.y, p.z + eps)) - n_y;
    
    return normalize(vec3<f32>(n_x, eps, n_z));
}

fn diffuse(n: vec3<f32>, l: vec3<f32>, p: f32) -> f32 {
    return pow(dot(n, l) * 0.4 + 0.6, p);
}

fn specular(n: vec3<f32>, l: vec3<f32>, e: vec3<f32>, s: f32) -> f32 {
    let nrm = (s + 8.0) / (PI * 8.0);
    return pow(max(dot(reflect(e, n), l), 0.0), s) * nrm;
}

fn getSkyColor(e: vec3<f32>) -> vec3<f32> {
    var e_mut = e;
    e_mut.y = (max(e_mut.y, 0.0) * 0.8 + 0.2) * 0.8;
    return vec3<f32>(pow(1.0 - e_mut.y, 2.0), 1.0 - e_mut.y, 0.6 + (1.0 - e_mut.y) * 0.4) * 1.1;
}

fn getSeaColor(p: vec3<f32>, n: vec3<f32>, l: vec3<f32>, eye: vec3<f32>, dist: vec3<f32>) -> vec3<f32> {
    let fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
    let fresnel_final = min(fresnel * fresnel * fresnel, 0.5);
    
    let reflected = getSkyColor(reflect(eye, n));
    let refracted = SEA_BASE + diffuse(n, l, 80.0) * SEA_WATER_COLOR * 0.12;
    var color = mix(refracted, reflected, fresnel_final);
    
    let atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
    color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;
    color += specular(n, l, eye, 600.0 / sqrt(dot(dist, dist)));
    
    return color;
}

@fragment
fn main(@location(0) vWorldPos: vec3<f32>,
        @location(1) vNormal: vec3<f32>,
        @location(2) vUv: vec2<f32>) -> @location(0) vec4<f32> {
    let p = vWorldPos;
    let dist = p - uniforms.cameraPosition;
    let eye = normalize(dist);
    
    let eps = dot(dist, dist) * 0.0002;
    let n = getNormal(p, eps);
    let light = normalize(vec3<f32>(0.0, 1.0, 0.8));
    
    var color = getSeaColor(p, n, light, eye, dist);
    color = pow(color, vec3<f32>(0.65));
    
    return vec4<f32>(color, 1.0);
}
`;
