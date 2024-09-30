#version 300 es

#define MAX_EFFECT_OPS 10
#define MAX_EFFECT_TEXTURES 7

#define OP_NOOP 0
#define OP_LUT 1
#define OP_VIGNETTE 2
#define OP_ADJUST_COLOR 3
#define OP_FILM_GRAIN 4
#define OP_SEPIA 5
#define OP_HUE_ROTATE 6

precision mediump float;
precision mediump sampler3D;

in vec2 v_texcoord;

uniform sampler2D u_source;
uniform vec2 u_size;
uniform float u_intensity;

uniform sampler2D u_images[MAX_EFFECT_TEXTURES];
uniform sampler3D u_luts[MAX_EFFECT_TEXTURES];

struct Adjustments {
  float brightness;
  float contrast;
  float saturation;
};
uniform Adjustments u_adjustments;

struct EffectOp {
  int type;
  int image;
  int lut;
  float args[4];
  float intensity[2];
};
uniform EffectOp u_operations[MAX_EFFECT_OPS];

out vec4 fragColor;

#pragma glslify: lookup = require(./lookup)
#pragma glslify: vignette = require(glsl-vignette)
#pragma glslify: adjustColor = require(./adjustColor)
#pragma glslify: filmGrain = require(./filmGrain)
#pragma glslify: sepia = require(./sepia)
#pragma glslify: hueRotate = require(./hueRotate)

vec4 lookupWithIndex(vec4 color, int lutIndex, float intensity) {
  switch(lutIndex) {
    case 0: return lookup(color, u_luts[0], intensity);
    case 1: return lookup(color, u_luts[1], intensity);
    case 2: return lookup(color, u_luts[2], intensity);
    case 3: return lookup(color, u_luts[3], intensity);
    case 4: return lookup(color, u_luts[4], intensity);
    case 5: return lookup(color, u_luts[5], intensity);
    default: return lookup(color, u_luts[6], intensity);
  }
}

vec4 applyOperation(EffectOp op, vec4 color, vec2 coord, float effectIntensity) {
  float intensity = mix(op.intensity[0], op.intensity[1], effectIntensity);

  switch (op.type) {
    case OP_LUT: return lookupWithIndex(color, op.lut, intensity);
    case OP_VIGNETTE: return color * vignette(v_texcoord, 1.0 - intensity, 0.25);
    case OP_ADJUST_COLOR: return adjustColor(color, op.args[0], op.args[1], op.args[2], intensity);
    case OP_FILM_GRAIN: return vec4(filmGrain(color.rgb, v_texcoord, vec2(textureSize(u_source, 0)), intensity), 1.0);
    case OP_SEPIA: return sepia(color, intensity);
    case OP_HUE_ROTATE: return mix(color, hueRotate(color, op.args[0]), intensity);
    default: return color;
  }
}

vec4 applyAdjustments(Adjustments values, vec4 color) {
  return adjustColor(color, values.brightness, values.contrast, values.saturation, 1.0);
}

void main() {
  vec4 color = texture(u_source, v_texcoord);

  color = applyAdjustments(u_adjustments, color);

  for (int i = 0; i < MAX_EFFECT_OPS; i++) {
    color = applyOperation(u_operations[i], color, v_texcoord, u_intensity);
  }

  fragColor = color;
}
