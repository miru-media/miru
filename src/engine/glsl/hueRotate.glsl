vec4 hueRotate(vec4 texColor, float angleDeg) {
  float rads = radians(angleDeg);

  mat4 a = mat4(vec4( .213, .715, .072, 0 ),
                vec4( .213, .715, .072, 0 ),
                vec4( .213, .715, .072, 0 ),
                vec4( 0, 0, 0, 1 ));
  mat4 b = mat4(vec4( .787, -.715, -.072, 0 ),
                vec4( -.213, .285, -.072, 0 ),
                vec4( -.213, -.715, .928, 0 ),
                vec4( 0, 0, 0, 1 ));
  mat4 c = mat4(vec4( -.213, -.715, .928, 0 ),
                vec4( .143, .140, -.283, 0 ),
                vec4( -.787, .715, .072, 0 ),
                vec4( 0, 0, 0, 1 ));

  mat4 matrix = a + (b * cos(rads)) + (c * sin(rads));

  return texColor * matrix;
}

#pragma glslify: export(hueRotate)
