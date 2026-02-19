#version 300 es

precision mediump float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec4 u_resolution;
uniform float u_intensity;

out vec4 fragColor;

#pragma glslify: filmGrain = require(./film-grain.glsl)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = vec4(filmGrain(color.rgb, v_texCoord, u_resolution.xy, u_intensity), color.a);
}

#pragma glslify: export(main)