#version 300 es

precision mediump float;
precision mediump sampler3D;

in vec2 v_texCoord;

uniform sampler2D u_image;

out vec4 fragColor;

void main() {
  fragColor = texture(u_image, v_texCoord);
}
