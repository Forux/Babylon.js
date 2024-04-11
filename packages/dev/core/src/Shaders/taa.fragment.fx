//> VRNET
#if defined(WEBGL2) || defined(WEBGPU) || defined(NATIVE)
	#define TEXTUREFUNC(s, c, l) texture2DLodEXT(s, c, l)
#else
	#define TEXTUREFUNC(s, c, b) texture2D(s, c, b)
#endif

varying vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D historySampler;
uniform sampler2D velocitySampler;
uniform float factor;
#ifdef CLIP_TO_AABB
    vec3 rgb2ycocg(vec3 rgb) {
        float co = rgb.r - rgb.b;
        float t = rgb.b + co * 0.5;
        float cg = rgb.g - t;
        float y = t + cg * 0.5;
        return vec3(y, co, cg); // y = b/4 + r/4 + g/2; co = r - b; cg = g - b/2 - r/2
    }

    vec3 ycocg2rgb(vec3 ycocg) {
        float t = ycocg.r - ycocg.b * 0.5;
        float g = ycocg.b + t;
        float b = t - ycocg.g * 0.5;
        float r = ycocg.g + b;
        return vec3(r, g, b); // r = y + co/2 - cg/2, g = cg/2 + y, b = y - cg/2 - co/2
    }

    // vec3 rgb2ycocg(vec3 rgb) {
    //     return rgb; // y = b/4 + r/4 + g/2; co = r - b; cg = g - b/2 - r/2
    // }

    // vec3 ycocg2rgb(vec3 ycocg) {
    //     return ycocg; // r = y + co/2 - cg/2, g = cg/2 + y, b = y - cg/2 - co/2
    // }

    vec3 clipToAABB(vec3 cOld, vec3 cNew, vec3 centre, vec3 halfSize) { //За мотивами https://www.dropbox.com/sh/dmye840y307lbpx/AAAnSryCBMKowISJPoGWiz5Fa/msalvi_temporal_supersampling.pptx?dl=0
        //Якщо cOld попадає в рамки похибки - залишаємо його таким як він був
        if (all(lessThanEqual(abs(cOld - centre), halfSize))) return cOld;
        //мінімальна та максимальна границі похибки
        vec3 mi = centre - halfSize, ma = centre + halfSize;
        //приводимо cNew до границь похибки, якщо він випадково звідти вилетів
        cNew = clamp(cNew, mi, ma);
        //Знаходимо на скільки треба зсунути cOld до cNew щоб потрапити в рамки похибки
        float t = 0.0;
        if(cOld.x < mi.x) t = max(t, (mi.x - cOld.x) / (cNew.x - cOld.x)); else if(cOld.x > ma.x) t = max(t, (ma.x - cOld.x) / (cNew.x - cOld.x));
        if(cOld.y < mi.y) t = max(t, (mi.y - cOld.y) / (cNew.y - cOld.y)); else if(cOld.y > ma.y) t = max(t, (ma.y - cOld.y) / (cNew.y - cOld.y));
        if(cOld.z < mi.z) t = max(t, (mi.z - cOld.z) / (cNew.z - cOld.z)); else if(cOld.z > ma.z) t = max(t, (ma.z - cOld.z) / (cNew.z - cOld.z));
        //Зсовуємо cOld до cNew на потрібну величину
        return mix(cOld, cNew, t);
    }
#endif

void main() {
    ivec2 icoordXY = ivec2(gl_FragCoord.xy);

    vec4 newColor = texelFetch(textureSampler, icoordXY, 0);

    vec4 velocityColor = texelFetch(velocitySampler, icoordXY, 0);
    velocityColor.rg = velocityColor.rg * 2.0 - vec2(1.0);
    vec2 velocity = vec2(pow(velocityColor.r, 3.0), pow(velocityColor.g, 3.0)) * velocityColor.a;

    #ifdef INT_BASED_HISTORY_SAMPLING
        velocity = velocity * vec2(textureSize(historySampler, 0));
        vec4 historyColor = texelFetch(historySampler, ivec2(gl_FragCoord.xy - velocity), 0);
    #else
        vec4 historyColor = TEXTUREFUNC(historySampler, vUV - velocity, 0.0);
    #endif

    #ifdef CLIP_TO_AABB
        vec3 mean = rgb2ycocg(newColor.rgb);
        vec3 stddev = mean * mean;
        { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 0,  1), 0).rgb); mean += c; stddev += c * c; }
        { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 0, -1), 0).rgb); mean += c; stddev += c * c; }
        { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 1,  0), 0).rgb); mean += c; stddev += c * c; }
        { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2(-1,  0), 0).rgb); mean += c; stddev += c * c; }
        mean *= 0.2;
        stddev = sqrt(max(vec3(0.0), stddev * 0.2 - mean * mean));
        historyColor = vec4(ycocg2rgb(clipToAABB(rgb2ycocg(historyColor.rgb), rgb2ycocg(newColor.rgb), mean, stddev)), historyColor.a);
    #endif

    gl_FragColor = mix(historyColor, newColor, factor);
}
//< VRNET