#version 300 es

precision mediump float;

layout(location = 0) in vec4 a_position;
layout(location = 1) in vec4 a_texCoord;

uniform int u_flipY;
uniform vec4 u_resolution;
uniform vec4 u_size;

uniform mat4 u_matrix;
uniform mat4 u_textureMatrix;

out vec2 v_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = (u_textureMatrix * vec4(a_texCoord.x, u_flipY == 1 ? 1.0 - a_texCoord.y : a_texCoord.y, a_texCoord.z, a_texCoord.w)).xy;
  v_position = a_position.xy;
  gl_Position = u_matrix * a_position;
}
