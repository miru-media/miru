#version 300 es

precision mediump float;

in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec4 u_size;
uniform float u_intensity;

uniform float red;
uniform float green;
uniform float blue;

out vec4 fragColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);
  vec4 r = texture(u_image, v_texCoord + (red / u_size.xy) * u_intensity);
  vec4 g = texture(u_image, v_texCoord + (green / u_size.xy) * u_intensity);
  vec4 b = texture(u_image, v_texCoord + (blue / u_size.xy) * u_intensity);

  fragColor = vec4(r.r, g.g, b.b, color.a);
}

#pragma glslify: export(main)