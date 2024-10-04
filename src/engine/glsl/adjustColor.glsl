#pragma glslify: luma = require(glsl-luma)

vec4 brightness(vec4 color, float value) {
  return vec4(color.rgb * (value + 1.0), color.a);
}

vec4 contrast(vec4 color, float value) {
    return vec4((color.rgb - 0.5) * (value + 1.0) + 0.5, color.a);
}

vec4 saturation(vec4 color, float value) {
    return mix(vec4(vec3(luma(color)), color.a), color, 1.0 + value);
}

vec4 adjustColor(vec4 color, float b, float c, float s, float intensity) {
    vec4 result = color;

    result = brightness(result, b);
    result = contrast  (result, c);
    result = saturation(result, s);

    return mix(color, result, intensity);
}

#pragma glslify: export(adjustColor)