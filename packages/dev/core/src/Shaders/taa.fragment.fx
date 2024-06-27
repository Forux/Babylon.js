//> VRNET
#if defined(WEBGL2) || defined(WEBGPU) || defined(NATIVE)
	#define TEXTUREFUNC(s, c, l) texture2DLodEXT(s, c, l)
#else
	#define TEXTUREFUNC(s, c, b) texture2D(s, c, b)
#endif

varying vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D historySampler;

#ifdef OBJECT_BASED
    uniform sampler2D velocitySampler;
#else
    uniform sampler2D depthSampler;
    uniform mat4 inverseViewProjection;
    uniform mat4 prevViewProjection;
    uniform mat4 projection;
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

    // vec3 rgb2ycocg(vec3 rgb) {
    //     return rgb; // y = b/4 + r/4 + g/2; co = r - b; cg = g - b/2 - r/2
    // }

    // vec3 ycocg2rgb(vec3 ycocg) {
    //     return ycocg; // r = y + co/2 - cg/2, g = cg/2 + y, b = y - cg/2 - co/2
    // }

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

void main() {
    if (!cameraMoved) {
        vec4 c = texelFetch(textureSampler, ivec2(gl_FragCoord.xy), 0);
        vec4 h = texelFetch(historySampler, ivec2(gl_FragCoord.xy), 0);
        gl_FragColor = mix(h, c, factor);
    } else {
        ivec2 icoordXY = ivec2(gl_FragCoord.xy);

        #ifdef OBJECT_BASED
            #ifdef INT_BASED_HISTORY_SAMPLING
                vec4 velocityColor = texelFetch(velocitySampler, icoordXY, 0);
            #else
                vec4 velocityColor = TEXTUREFUNC(velocitySampler, vUV, 0.0);
            #endif

            velocityColor.rg = velocityColor.rg * 2.0 - vec2(1.0);
            vec2 velocity = vec2(pow(velocityColor.r, 3.0), pow(velocityColor.g, 3.0)) * velocityColor.a;

            vec2 previousCoords = vUV - velocity;
        #else
            vec2 previousCoords;
            #ifdef INT_BASED_HISTORY_SAMPLING
                float depth = texelFetch(depthSampler, icoordXY, 0).r;
            #else
                vec4 depthVec = TEXTUREFUNC(depthSampler, vUV, 0.0);
                float depth = depthVec.r;
            #endif
            if (depth == 0.0) {
                previousCoords = vUV;
            } else {
                depth = projection[2].z + projection[3].z / depth; // convert from view linear z to NDC z

                vec4 cpos = vec4(vUV * 2.0 - 1.0, depth, 1.0);
                cpos = inverseViewProjection * cpos;
                if (cpos.w == 0.0) {
                    previousCoords = vUV;
                } else {
                    cpos /= cpos.w;

                    vec4 encodedCoords = prevViewProjection * cpos;
                    if (encodedCoords.w == 0.0) {
                        previousCoords = vUV;
                    } else {
                        encodedCoords /= encodedCoords.w;
                        previousCoords = encodedCoords.xy * 0.5 + 0.5;
                    }
                }
            }
        #endif

        #ifdef INT_BASED_HISTORY_SAMPLING
            vec4 newColor = texelFetch(textureSampler, icoordXY, 0);
            vec4 historyColor = texelFetch(historySampler, ivec2(previousCoords * vec2(textureSize(historySampler, 0))), 0);
        #else
            vec4 newColor = TEXTUREFUNC(textureSampler, vUV, 0.0);
            vec4 historyColor = TEXTUREFUNC(historySampler, previousCoords, 0.0);
        #endif

        #ifdef DEBUG_UV
            if (previousCoords.x > 1.0 || previousCoords.x < 0.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.5, 1.0);
            } else if (previousCoords.y < 0.0 || previousCoords.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
            } else {
                gl_FragColor = vec4(previousCoords, 0.0, 1.0);
            }
        #elif defined( DEBUG_UV_CHANGE )
            vec2 uvChange = abs(vUV - previousCoords);
            if (uvChange.x == 0.0 && uvChange.y == 0.0) {
                gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
            } else if (uvChange.x == 0.0 || uvChange.y == 0.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.5, 1.0);
            } else {
                uvChange = vec2(pow(uvChange.x, 1.0 / 3.0), pow(uvChange.y, 1.0 / 3.0));
                gl_FragColor = vec4(uvChange, 0.0, 1.0);
            }
        #elif defined( DEBUG_VELOCITY )
            vec2 fractCheck = fract(gl_FragCoord.xy / 35.0);
            if (fractCheck.x < 0.1 && fractCheck.y < 0.1) {
                newColor = vec4(1.0, 1.0, 1.0, newColor.a);
            } else {
                newColor = vec4(newColor.x, newColor.y, 0.0, newColor.a);
            }
            gl_FragColor = mix(historyColor, newColor, factor);
        #else
            #ifdef CLIP_TO_AABB
                #ifdef DEBUG_CLIP_TO_AABB
                    if (debug_clipToAABB(rgb2ycocg(historyColor.rgb), rgb2ycocg(newColor.rgb), mean, stddev)) {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    } else {
                        gl_FragColor = newColor;
                    }
                    return;
                #else
                    vec3 mean = rgb2ycocg(newColor.rgb);
                    vec3 stddev = mean * mean;
                    { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 0,  1), 0).rgb); mean += c; stddev += c * c; }
                    { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 0, -1), 0).rgb); mean += c; stddev += c * c; }
                    { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2( 1,  0), 0).rgb); mean += c; stddev += c * c; }
                    { vec3 c = rgb2ycocg(texelFetch(textureSampler, icoordXY + ivec2(-1,  0), 0).rgb); mean += c; stddev += c * c; }
                    mean *= 0.2;
                    stddev = sqrt(max(vec3(0.0), (stddev * 0.2 - mean * mean) * errorFactor));
                    historyColor = vec4(ycocg2rgb(clipToAABB(rgb2ycocg(historyColor.rgb), rgb2ycocg(newColor.rgb), mean, stddev)), historyColor.a);
                #endif
            #endif
            gl_FragColor = mix(historyColor, newColor, factor);
        #endif
    }
}
//< VRNET