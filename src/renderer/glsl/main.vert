#version 300 es

precision mediump float;

layout(location = 0) in vec4 a_position;
layout(location = 1) in vec4 a_texCoord;

uniform vec2 u_resolution;
uniform vec2 u_size;

uniform mat4 u_matrix;
uniform mat4 u_textureMatrix;

out vec2 v_unitPosition;
out vec2 v_texCoord;

void main() {
  v_texCoord = (u_textureMatrix * a_texCoord).xy;
  v_unitPosition = a_position.xy;
  gl_Position = u_matrix * a_position;
}
