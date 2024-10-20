#version 300 es

precision mediump float;

layout(location = 0) in vec4 a_position;
layout(location = 1) in vec4 a_texcoord;

uniform vec2 u_resolution;
uniform vec2 u_size;

uniform mat4 u_matrix;
uniform mat4 u_textureMatrix;

out vec2 v_unitPosition;
out vec2 v_texcoord;

void main() {
  v_texcoord = (u_textureMatrix * a_texcoord).xy;
  v_unitPosition = a_position.xy;
  gl_Position = u_matrix * a_position;
}
