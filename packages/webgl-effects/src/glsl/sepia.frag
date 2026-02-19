#version 300 es

precision mediump float;

in vec2 v_unitPosition;
in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_intensity;

out vec4 fragColor;

#pragma glslify: sepia = require(./sepia.glsl)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = sepia(color, u_intensity);
}

#pragma glslify: export(main)