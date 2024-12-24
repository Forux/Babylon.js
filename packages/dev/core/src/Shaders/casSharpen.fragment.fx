varying vec2 vUV;

uniform sampler2D textureSampler;

uniform float intensity;

void main() {
    ivec2 icoordXY = ivec2(gl_FragCoord.xy);

    vec4 col4 = texelFetch(textureSampler, icoordXY, 0);
    vec3 col = col4.rgb;
    float A = col4.a;

    // CAS algorithm
    float max_g = col.y;
    float min_g = col.y;
    vec4 uvoff = vec4(1,0,1,-1);
    vec3 colw;
    vec3 col1 = texelFetch(textureSampler, icoordXY + ivec2(0, 1), 0).xyz;
    max_g = max(max_g, col1.y);
    min_g = min(min_g, col1.y);
    colw = col1;
    col1 = texelFetch(textureSampler, icoordXY + ivec2(0, -1), 0).xyz;
    max_g = max(max_g, col1.y);
    min_g = min(min_g, col1.y);
    colw += col1;
    col1 = texelFetch(textureSampler, icoordXY + ivec2(1, 0), 0).xyz;
    max_g = max(max_g, col1.y);
    min_g = min(min_g, col1.y);
    colw += col1;
    col1 = texelFetch(textureSampler, icoordXY + ivec2(-1, 0), 0).xyz;
    max_g = max(max_g, col1.y);
    min_g = min(min_g, col1.y);
    colw += col1;
    float d_min_g = min_g;
    float d_max_g = 1. - max_g;
    float n;
    if (d_max_g < d_min_g) {
        n = d_max_g / max_g;
    } else {
        n = d_min_g / max_g;
    }
    n = sqrt(max(0.0, n)) * (0.125 + 0.075 * intensity);

    gl_FragColor = vec4((col - colw * n) / (1.0 - 4.0 * n), A);
}
//< VRNET