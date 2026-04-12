#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float windDirection;
uniform float windSpeed;

out vec3 vPositionW;
out vec3 vNormalW;
out vec2 vUV;
out float vWaveHeight;

const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
   -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float seaOctave(vec2 uvIn, float choppy) {
  vec2 uv = uvIn;
  uv += vec2(
    snoise(uvIn * 0.85),
    snoise((uvIn + vec2(19.1, 7.3)) * 0.85)
  ) * 0.22;
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  vec2 mixedWv = mix(wv, swv, wv);
  return pow(1.0 - pow(mixedWv.x * mixedWv.y, 0.65), choppy);
}

float crestWave(float phase, float asymmetry) {
  float s = sin(phase);
  float crest = max(s, 0.0);
  float trough = min(s, 0.0);
  float sharpened = crest * (1.0 + crest * (0.65 + asymmetry * 0.55));
  return trough * (1.0 - asymmetry * 0.35) + sharpened;
}

float octaveDisplacement(
  vec2 xzIn,
  float t,
  float freqBase,
  float ampBase,
  float windSpd,
  vec2 windDir,
  vec2 crossDir
) {
  vec2 uv = vec2(dot(xzIn, windDir), dot(xzIn, crossDir));
  float freq = freqBase;
  float amp = ampBase;
  float choppy = 4.0;
  float h = 0.0;
  vec2 flowA = vec2(t * (0.82 + windSpd * 0.36), t * (0.34 + windSpd * 0.18));
  vec2 flowB = vec2(t * (0.56 + windSpd * 0.26) + 1.3, t * (0.91 + windSpd * 0.22) - 0.7);
  vec2 flowC = vec2(t * (1.03 + windSpd * 0.29) - 2.1, t * (0.62 + windSpd * 0.27) + 1.9);

  for (int i = 0; i < 3; i++) {
    float d1 = seaOctave((uv + flowA) * freq, choppy);
    float d2 = seaOctave((uv + flowB) * freq, choppy);
    float d3 = seaOctave((uv + flowC) * freq, choppy);
    h += (d1 * 0.45 + d2 * 0.33 + d3 * 0.22) * amp;

    uv = OCTAVE_M * uv;
    flowA = OCTAVE_M * flowA * 1.04 + vec2(0.7, -0.2);
    flowB = OCTAVE_M * flowB * 1.02 + vec2(-0.5, 0.4);
    flowC = OCTAVE_M * flowC * 1.03 + vec2(0.2, 0.6);

    freq *= 1.55;
    amp *= 0.28;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return h * (0.14 + windSpd * 0.035);
}

float travelingHeight(
  vec2 xz,
  float t,
  float freq,
  float amp,
  float windSpd,
  vec2 windDir,
  vec2 crossDir
) {
  float crestness = clamp(0.22 + windSpd * 0.58, 0.0, 1.0);
  float travel = 0.24 + windSpd * 0.36;

  vec2 dirA = windDir;
  vec2 dirB = normalize(windDir * 0.9 + crossDir * 0.42);
  vec2 dirC = normalize(windDir * 0.64 - crossDir * 0.78);
  vec2 dirD = normalize(crossDir * 0.98 + windDir * 0.18);
  vec2 dirE = normalize(crossDir * -0.82 + windDir * 0.42);
  vec2 dirF = normalize(windDir * -0.3 + crossDir * 0.95);

  float pA = dot(xz, dirA) * (freq * 0.86) - t * (travel * 0.88);
  float pB = dot(xz, dirB) * (freq * 1.12) - t * (travel * 1.16) + 1.7;
  float pC = dot(xz, dirC) * (freq * 1.44) - t * (travel * 1.36) + 4.2;
  float pD = dot(xz, dirD) * (freq * 1.82) - t * (travel * 1.72) + 2.3;
  float pE = dot(xz, dirE) * (freq * 2.08) - t * (travel * 2.04) + 5.1;
  float pF = dot(xz, dirF) * (freq * 2.42) - t * (travel * 2.36) + 0.9;

  float wA = crestWave(pA, crestness) * amp * 0.28;
  float wB = crestWave(pB, crestness) * amp * 0.22;
  float wC = crestWave(pC, crestness) * amp * 0.18;
  float wD = crestWave(pD, crestness) * amp * 0.14;
  float wE = crestWave(pE, crestness) * amp * 0.10;
  float wF = crestWave(pF, crestness) * amp * 0.08;

  return wA + wB + wC + wD + wE + wF;
}

void main(void) {
  float angle = radians(windDirection);
  vec2 windDir = normalize(vec2(cos(angle), sin(angle)));
  vec2 crossDir = vec2(-windDir.y, windDir.x);
  float amp = max(waveAmplitude, 0.0);
  float freq = max(waveFrequency, 0.05);
  float windSpd = max(windSpeed, 0.0);

  float longWave = travelingHeight(position.xz, time, freq, amp, windSpd, windDir, crossDir);
  float chop = octaveDisplacement(position.xz, time, freq * 0.55, amp * 0.22, windSpd, windDir, crossDir);
  float wave = longWave + chop;
  float normalizedWave = wave / max(amp * 1.8 + 0.08, 0.05);

  vec3 displaced = vec3(position.x, position.y + wave, position.z);
  vec4 worldPos = world * vec4(displaced, 1.0);

  vPositionW = worldPos.xyz;
  vNormalW = normalize(mat3(world) * normal);
  vUV = uv;
  vWaveHeight = normalizedWave;

  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
