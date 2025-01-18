#define BLEND_ADD 1;
#define BLEND_AVERAGE 2
#define BLEND_COLOR_BURN 3
#define BLEND_COLOR_DODGE 4
#define BLEND_DARKEN 5
#define BLEND_DIFFERENCE 6
#define BLEND_EXCLUSION 7
#define BLEND_GLOW 8
#define BLEND_HARD_LIGHT 9
#define BLEND_HARD_MIX 10
#define BLEND_LIGHTEN 11
#define BLEND_LINEAR_BURN 12
#define BLEND_LINEAR_DODGE 13
#define BLEND_LINEAR_LIGHT 14
#define BLEND_MULTIPLY 15
#define BLEND_NEGATION 16
#define BLEND_NORMAL 17
#define BLEND_OVERLAY 18
#define BLEND_PHOENIX 19
#define BLEND_PIN_LIGHT 20
#define BLEND_REFLECT 21
#define BLEND_SCREEN 22
#define BLEND_SOFT_LIGHT 23
#define BLEND_SUBTRACT 24
#define BLEND_VIVID_LIGHT 25

#pragma glslify: blendMode_ = require(glsl-blend/all)

vec3 blendMode( int mode, vec3 base, vec3 blend, float opacity ) {
    return blendMode_(mode, base, blend, opacity);
}

vec3 blendMode( int mode, vec3 base, vec3 blend) {
    return blendMode_(mode, base, blend);
}

#pragma glslify: export(blendMode)