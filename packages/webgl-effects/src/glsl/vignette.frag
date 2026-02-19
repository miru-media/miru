#version 300 es

precision mediump float;

in vec2 v_position;
in vec2 v_texCoord;

uniform sampler2D u_image;
uniform float u_intensity;

out vec4 fragColor;

#pragma glslify: vignette = require(glsl-vignette)

void main() {
  vec4 color = texture(u_image, v_texCoord);
  fragColor = vec4(
      color.rgb * vignette(v_position, 1.0 - u_intensity, 0.35), color.a);
}

#pragma glslify: export(main)