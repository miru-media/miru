#pragma glslify: grain = require(glsl-film-grain)
#pragma glslify: luma = require(glsl-luma)

// #pragma glslify: blend = require(./blend)
#pragma glslify: blendSoftLight = require(glsl-blend/soft-light)

// https://github.com/mattdesl/glsl-film-grain?tab=readme-ov-file#blending-tips
vec3 filmGrain(vec3 backgroundColor, vec2 texCoord, vec2 resolution, float intensity) {
    vec3 grainColor = vec3(grain(texCoord, resolution / vec2(2)));
  
    //blend the noise over the background, 
    //i.e. overlay, soft light, additive
    vec3 color = blendSoftLight(backgroundColor, grainColor);
    
    //get the luminance of the background
    float luminance = luma(backgroundColor);
    
    //reduce the noise based on some 
    //threshold of the background luminance
    float response = smoothstep(0.05, 0.5, luminance);
    color = mix(color, backgroundColor, pow(response, 2.0));
    
    return mix(backgroundColor, color, intensity);
}

#pragma glslify: export(filmGrain)