//> VRNET
#if defined(WEBGL2) || defined(WEBGPU) || defined(NATIVE)
	#define TEXTUREFUNC(s, c, l) texture2DLodEXT(s, c, l)
#else
	#define TEXTUREFUNC(s, c, b) texture2D(s, c, b)
#endif

varying vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D historySampler;
#ifdef TAA_REPROJECT_HISTORY
uniform sampler2D velocitySampler;
#endif
uniform float factor;
uniform float errorFactor; // 1.0
uniform bool cameraMoved; // 1 - moved, 0 - not moved

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

    bool debug_clipToAABB(vec3 cOld, vec3 cNew, vec3 centre, vec3 halfSize) { //За мотивами https://www.dropbox.com/sh/dmye840y307lbpx/AAAnSryCBMKowISJPoGWiz5Fa/msalvi_temporal_supersampling.pptx?dl=0
        if (all(lessThanEqual(abs(cOld - centre), halfSize))) return false;
        return true;
    }

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

// Reprojection and clamping are based off this article:
// https://www.elopezr.com/temporal-aa-and-the-quest-for-the-holy-trail/

void main() {
    ivec2 pos = ivec2(gl_FragCoord.xy);
    vec4 c = texelFetch(textureSampler, pos, 0);

#ifdef TAA_REPROJECT_HISTORY
    vec4 v = texelFetch(velocitySampler, pos, 0);
    vec4 h = texture2D(historySampler, vUV + v.xy);
#else
    vec4 h = texelFetch(historySampler, pos, 0);
#endif

#ifdef TAA_CLAMP_HISTORY
    vec4 cmin = vec4(1);
    vec4 cmax = vec4(0);
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            vec4 c = texelFetch(textureSampler, pos + ivec2(x, y), 0);
            cmin = min(cmin, c);
            cmax = max(cmax, c);
        }
    }
    h = clamp(h, cmin, cmax);
#endif

    gl_FragColor = mix(h, c, factor);
}
