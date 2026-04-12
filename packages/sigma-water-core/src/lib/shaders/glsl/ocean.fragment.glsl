#version 300 es
precision highp float;

in vec3 vPositionW;

uniform vec3 cameraPosition;
uniform float time;
uniform float waveAmplitude;

// Runtime compatibility uniforms (used by control panel and shared runtime paths).
uniform vec3 boatCollisionCenter;
uniform vec3 islandCollisionCenter;
uniform float boatCollisionRadius;
uniform float islandCollisionRadius;
uniform float boatIntersectionFactor;
uniform float islandIntersectionFactor;
uniform float underwaterEnabled;
uniform float underwaterTransitionDepth;
uniform float underwaterFogDensity;
uniform float underwaterHorizonMix;
uniform float underwaterColorR;
uniform float underwaterColorG;
uniform float underwaterColorB;
uniform float underwaterFactor;

out vec4 outColor;

const float PI = 3.141592;
const float SEA_HEIGHT = 0.6;
const float SEA_CHOPPY = 4.0;
const float SEA_SPEED = 0.8;
const float SEA_FREQ = 0.16;
const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);
const vec3 SEA_BASE = vec3(0.0, 0.09, 0.18);
const vec3 SEA_WATER_COLOR = vec3(0.8, 0.9, 0.6) * 0.6;

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float sea_octave(vec2 uvIn, float choppy) {
  vec2 uv = uvIn;
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float map_detailed(vec3 p) {
  float freq = SEA_FREQ;
  float amp = SEA_HEIGHT * max(waveAmplitude, 0.05);
  float choppy = SEA_CHOPPY;
  vec2 uv = p.xz;
  uv.x *= 0.75;
  float seaTime = 1.0 + time * SEA_SPEED;
  float h = 0.0;

  for (int i = 0; i < 5; i++) {
    float d = sea_octave((uv + seaTime) * freq, choppy);
    d += sea_octave((uv - seaTime) * freq, choppy);
    h += d * amp;
    uv = OCTAVE_M * uv;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return p.y - h;
}

vec3 getNormal(vec3 p, float eps) {
  vec3 n;
  n.y = map_detailed(p);
  n.x = map_detailed(vec3(p.x + eps, p.y, p.z)) - n.y;
  n.z = map_detailed(vec3(p.x, p.y, p.z + eps)) - n.y;
  n.y = eps;
  return normalize(n);
}

float diffuse(vec3 n, vec3 l, float p) {
  return pow(dot(n, l) * 0.4 + 0.6, p);
}

float specular(vec3 n, vec3 l, vec3 e, float s) {
  float nrm = (s + 8.0) / (PI * 8.0);
  return pow(max(dot(reflect(e, n), l), 0.0), s) * nrm;
}

vec3 getSkyColor(vec3 e) {
  e.y = (max(e.y, 0.0) * 0.8 + 0.2) * 0.8;
  return vec3(pow(1.0 - e.y, 2.0), 1.0 - e.y, 0.6 + (1.0 - e.y) * 0.4) * 1.1;
}

vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
  float fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
  fresnel = min(fresnel * fresnel * fresnel, 0.5);
  vec3 reflected = getSkyColor(reflect(eye, n));
  vec3 refracted = SEA_BASE + diffuse(n, l, 80.0) * SEA_WATER_COLOR * 0.12;
  vec3 color = mix(refracted, reflected, fresnel);
  float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
  color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;
  color += specular(n, l, eye, 600.0 * inversesqrt(max(dot(dist, dist), 0.0001)));
  return color;
}

void main(void) {
  vec3 p = vPositionW;
  vec3 dist = p - cameraPosition;
  vec3 eye = normalize(dist);

  float eps = max(dot(dist, dist) * 0.0002, 0.001);
  vec3 n = getNormal(p, eps);
  vec3 lightDir = normalize(vec3(0.0, 1.0, 0.8));

  vec3 color = getSeaColor(p, n, lightDir, eye, dist);
  color = pow(max(color, 0.0), vec3(0.65));

  float viewDist = length(dist);
  float fog = clamp(1.0 - exp(-underwaterFogDensity * viewDist * 0.02), 0.0, 1.0);
  vec3 underwaterColor = vec3(underwaterColorR, underwaterColorG, underwaterColorB);
  float underwaterMix = underwaterEnabled > 0.5 ? clamp(underwaterFactor + underwaterHorizonMix * fog, 0.0, 1.0) : 0.0;
  color = mix(color, underwaterColor, underwaterMix);

  outColor = vec4(color, 1.0);
}
