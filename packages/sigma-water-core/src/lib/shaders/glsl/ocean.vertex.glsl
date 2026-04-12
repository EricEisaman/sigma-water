#version 300 es
precision highp float;

in vec3 position;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform float time;
uniform float waveAmplitude;

out vec3 vPositionW;

const float SEA_HEIGHT = 0.6;
const float SEA_CHOPPY = 4.0;
const float SEA_SPEED = 0.8;
const float SEA_FREQ = 0.16;
const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

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

float getHeight(vec3 p) {
  float freq = SEA_FREQ;
  float amp = SEA_HEIGHT * max(waveAmplitude, 0.05);
  float choppy = SEA_CHOPPY;
  vec2 uv = p.xz;
  uv.x *= 0.75;
  float seaTime = 1.0 + time * SEA_SPEED;
  float h = 0.0;

  for (int i = 0; i < 3; i++) {
    float d = sea_octave((uv + seaTime) * freq, choppy);
    d += sea_octave((uv - seaTime) * freq, choppy);
    h += d * amp;
    uv = OCTAVE_M * uv;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return h;
}

void main(void) {
  vec3 displaced = position;
  displaced.y = getHeight(displaced);
  vec4 worldPos = world * vec4(displaced, 1.0);
  vPositionW = worldPos.xyz;
  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
