#version 300 es

precision mediump float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_intensity;

uniform float brightness;
uniform float contrast;
uniform float saturation;

out vec4 fragColor;

#pragma glslify: adjustColor = require(./adjust-color)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = adjustColor(color, brightness, contrast, saturation, u_intensity);
}

#pragma glslify: export(main)