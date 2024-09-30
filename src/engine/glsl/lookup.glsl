vec4 lookup(vec4 texColor, sampler3D lut, float intensity) {
  vec3 cubeSize = vec3(textureSize(lut, 0));
  
  vec4 transformedColor = texture(lut, (texColor.rgb * (cubeSize - 1.0) + 0.5) / cubeSize);

  vec4 result = mix(texColor, transformedColor, intensity);
  return result;
}

#pragma glslify: export(lookup)