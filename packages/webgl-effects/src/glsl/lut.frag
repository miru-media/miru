#version 300 es

precision mediump float;
precision mediump sampler3D;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_intensity;

uniform sampler3D lut;

out vec4 fragColor;

#pragma glslify: lookup = require(./lookup.glsl)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = lookup(color, lut, u_intensity);
}
