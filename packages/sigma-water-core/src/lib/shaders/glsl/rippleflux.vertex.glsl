#version 300 es
precision highp float;
precision highp sampler2D;

in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform sampler2D rippleHeightTexture;
uniform vec4 rippleFieldBounds;
uniform float waveAmplitude;

out vec3 vPositionW;
out vec3 vNormalW;
out vec2 vUV;
out float vRipple;

void main(void) {
  vec3 local = position;
  vec3 worldPosNoDisp = (world * vec4(local, 1.0)).xyz;
  vec2 fieldUV = (worldPosNoDisp.xz - rippleFieldBounds.xy) / max(rippleFieldBounds.zw, vec2(0.0001));
  vec2 clampedUV = clamp(fieldUV, 0.0, 1.0);
  float ripple = texture(rippleHeightTexture, clampedUV).r * 2.0 - 1.0;

  vec3 displaced = vec3(local.x, local.y + ripple * max(waveAmplitude, 0.0), local.z);
  vec4 worldPos = world * vec4(displaced, 1.0);

  vPositionW = worldPos.xyz;
  vNormalW = normalize(mat3(world) * normal);
  vUV = uv;
  vRipple = ripple;

  gl_Position = worldViewProjection * vec4(displaced, 1.0);
}
