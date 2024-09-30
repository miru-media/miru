vec4 sepia(vec4 texColor, float amount) {
  mat4 matrix = mat4(
    (0.393 + 0.607 * (1.0 - amount)), (0.769 - 0.769 * (1.0 - amount)), (0.189 - 0.189 * (1.0 - amount)), 0,
    (0.349 - 0.349 * (1.0 - amount)), (0.686 + 0.314 * (1.0 - amount)), (0.168 - 0.168 * (1.0 - amount)), 0,
    (0.272 - 0.272 * (1.0 - amount)), (0.534 - 0.534 * (1.0 - amount)), (0.131 + 0.869 * (1.0 - amount)), 0,
    0,0,0,1
  );

  return texColor * matrix;
}

#pragma glslify: export(sepia)
