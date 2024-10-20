vec4 lookup(vec4 texColor, sampler3D lut, float intensity) {
  vec3 cubeSize = vec3(textureSize(lut, 0));
  
  vec3 transformedColor = texture(lut, (texColor.rgb * (cubeSize - 1.0) + 0.5) / cubeSize).rgb;

  vec4 result = mix(texColor, vec4(transformedColor, texColor.a), intensity);
  return result;
}

#pragma glslify: export(lookup)