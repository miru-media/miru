#version 300 es

precision mediump float;

in vec4 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

void main() {
  v_texcoord = a_texcoord;
  v_texcoord.y = 1.0 - v_texcoord.y;
  gl_Position = a_position;
}
