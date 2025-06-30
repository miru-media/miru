#version 300 es

precision mediump float;
precision mediump sampler3D;

in vec2 v_unitPosition;
in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_intensity;

uniform float angle;

uniform float brightness;
uniform float contrast;
uniform float saturation;

out vec4 fragColor;

#pragma glslify: hueRotate = require(./hue-rotate.glsl)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = mix(color, hueRotate(color, angle), u_intensity);
}
