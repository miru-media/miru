#version 300 es

precision mediump float;
precision mediump sampler3D;

in vec2 v_unitPosition;
in vec2 v_texCoord;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_intensity;

uniform float red;
uniform float green;
uniform float blue;

out vec4 fragColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);
  vec4 r = texture(u_image, v_texCoord + (red / u_resolution) * u_intensity);
  vec4 g = texture(u_image, v_texCoord + (green / u_resolution) * u_intensity);
  vec4 b = texture(u_image, v_texCoord + (blue / u_resolution) * u_intensity);

  fragColor = vec4(r.r, g.g, b.b, color.a);
}
