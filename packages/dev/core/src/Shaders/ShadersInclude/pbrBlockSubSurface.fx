struct subSurfaceOutParams
{
    vec3 specularEnvironmentReflectance;
#ifdef SS_REFRACTION
    vec3 finalRefraction;
    vec3 surfaceAlbedo;
    #ifdef SS_LINKREFRACTIONTOTRANSPARENCY
        float alpha;
    #endif
    float refractionOpacity;
#endif
#ifdef SS_TRANSLUCENCY
    vec3 transmittance;
    float translucencyIntensity;
    #ifdef REFLECTION
        vec3 refractionIrradiance;
    #endif
#endif
#if DEBUGMODE > 0
    #ifdef SS_THICKNESSANDMASK_TEXTURE
        vec4 thicknessMap;
    #endif
    #ifdef SS_REFRACTION
        vec4 environmentRefraction;
        vec3 refractionTransmittance;
    #endif
#endif
};

#ifdef SUBSURFACE
    #ifdef SS_REFRACTION
        #define pbr_inline
        #define inline
        vec4 sampleEnvironmentRefraction(
            in float ior
            , in float thickness
            , in float refractionLOD
            , in vec3 normalW
            , in vec3 vPositionW
            , in vec3 viewDirectionW
            , in mat4 view
            , in vec4 vRefractionInfos
            , in mat4 refractionMatrix
            , in vec4 vRefractionMicrosurfaceInfos
            , in float alphaG
            #ifdef SS_REFRACTIONMAP_3D
                , in samplerCube refractionSampler
                #ifndef LODBASEDMICROSFURACE
                    , in samplerCube refractionSamplerLow
                    , in samplerCube refractionSamplerHigh
                #endif
            #else
                , in sampler2D refractionSampler
                #ifndef LODBASEDMICROSFURACE
                    , in sampler2D refractionSamplerLow
                    , in sampler2D refractionSamplerHigh
                #endif
            #endif
            #ifdef ANISOTROPIC
                , in anisotropicOutParams anisotropicOut
            #endif
            #ifdef REALTIME_FILTERING
                , in vec2 vRefractionFilteringInfo
            #endif
            #ifdef SS_USE_LOCAL_REFRACTIONMAP_CUBIC
                , in vec3 refractionPosition
                , in vec3 refractionSize
            #endif
        ) {
            vec4 environmentRefraction = vec4(0., 0., 0., 0.);
            #ifdef ANISOTROPIC
                vec3 refractionVector = refract(-viewDirectionW, anisotropicOut.anisotropicNormal, ior);
            #else
                vec3 refractionVector = refract(-viewDirectionW, normalW, ior);
            #endif

            #ifdef SS_REFRACTIONMAP_OPPOSITEZ
                refractionVector.z *= -1.0;
            #endif

            // _____________________________ 2D vs 3D Maps ________________________________
            #ifdef SS_REFRACTIONMAP_3D
                #ifdef SS_USE_LOCAL_REFRACTIONMAP_CUBIC
                    //>> VRNET
                    refractionVector = parallaxCorrectNormal(vPositionW, refractionVector, refractionSize, refractionPosition, vec3(0.), vec3(0.), vec3(0.), false);
                    //<< VRNET
                #endif
                refractionVector.y = refractionVector.y * vRefractionInfos.w;
                vec3 refractionCoords = refractionVector;
                refractionCoords = vec3(refractionMatrix * vec4(refractionCoords, 0));
            #else
                #ifdef SS_USE_THICKNESS_AS_DEPTH
                    vec3 vRefractionUVW = vec3(refractionMatrix * (view * vec4(vPositionW + refractionVector * thickness, 1.0)));
                #else
                    vec3 vRefractionUVW = vec3(refractionMatrix * (view * vec4(vPositionW + refractionVector * vRefractionInfos.z, 1.0)));
                #endif
                vec2 refractionCoords = vRefractionUVW.xy / vRefractionUVW.z;
                refractionCoords.y = 1.0 - refractionCoords.y;
            #endif
            
            #ifdef LODBASEDMICROSFURACE
                // Apply environment convolution scale/offset filter tuning parameters to the mipmap LOD selection
                refractionLOD = refractionLOD * vRefractionMicrosurfaceInfos.y + vRefractionMicrosurfaceInfos.z;

                #ifdef SS_LODINREFRACTIONALPHA
                    // Automatic LOD adjustment to ensure that the smoothness-based environment LOD selection
                    // is constrained to appropriate LOD levels in order to prevent aliasing.
                    // The environment map is first sampled without custom LOD selection to determine
                    // the hardware-selected LOD, and this is then used to constrain the final LOD selection
                    // so that excessive surface smoothness does not cause aliasing (e.g. on curved geometry
                    // where the normal is varying rapidly).

                    // Note: Shader Model 4.1 or higher can provide this directly via CalculateLevelOfDetail(), and
                    // manual calculation via derivatives is also possible, but for simplicity we use the 
                    // hardware LOD calculation with the alpha channel containing the LOD for each mipmap.
                    float automaticRefractionLOD = UNPACK_LOD(sampleRefraction(refractionSampler, refractionCoords).a);
                    float requestedRefractionLOD = max(automaticRefractionLOD, refractionLOD);
                #else
                    float requestedRefractionLOD = refractionLOD;
                #endif

                #if defined(REALTIME_FILTERING) && defined(SS_REFRACTIONMAP_3D)
                    environmentRefraction = vec4(radiance(alphaG, refractionSampler, refractionCoords, vRefractionFilteringInfo), 1.0);
                #else
                    environmentRefraction = sampleRefractionLod(refractionSampler, refractionCoords, requestedRefractionLOD);
                #endif
            #else
                float lodRefractionNormalized = saturate(refractionLOD / log2(vRefractionMicrosurfaceInfos.x));
                float lodRefractionNormalizedDoubled = lodRefractionNormalized * 2.0;

                vec4 environmentRefractionMid = sampleRefraction(refractionSampler, refractionCoords);
                if (lodRefractionNormalizedDoubled < 1.0){
                    environmentRefraction = mix(
                        sampleRefraction(refractionSamplerHigh, refractionCoords),
                        environmentRefractionMid,
                        lodRefractionNormalizedDoubled
                    );
                } else {
                    environmentRefraction = mix(
                        environmentRefractionMid,
                        sampleRefraction(refractionSamplerLow, refractionCoords),
                        lodRefractionNormalizedDoubled - 1.0
                    );
                }
            #endif
            #ifdef SS_RGBDREFRACTION
                environmentRefraction.rgb = fromRGBD(environmentRefraction);
            #endif

            #ifdef SS_GAMMAREFRACTION
                environmentRefraction.rgb = toLinearSpace(environmentRefraction.rgb);
            #endif
            return environmentRefraction;
        }
    #endif
    #define pbr_inline
    #define inline
    subSurfaceOutParams subSurfaceBlock(
        in vec3 vSubSurfaceIntensity
        , in vec2 vThicknessParam
        , in vec4 vTintColor
        , in vec3 normalW
        , in vec3 vSpecularEnvironmentReflectance
    #ifdef SS_THICKNESSANDMASK_TEXTURE
        , in vec4 thicknessMap
    #endif
    #ifdef SS_REFRACTIONINTENSITY_TEXTURE
        , in vec4 refractionIntensityMap
    #endif
    #ifdef SS_TRANSLUCENCYINTENSITY_TEXTURE
        , in vec4 translucencyIntensityMap
    #endif
    #ifdef REFLECTION
        #ifdef SS_TRANSLUCENCY
            , in mat4 reflectionMatrix
            #ifdef USESPHERICALFROMREFLECTIONMAP
                #if !defined(NORMAL) || !defined(USESPHERICALINVERTEX)
                    , in vec3 irradianceVector_
                #endif
                #if defined(REALTIME_FILTERING)
                    , in samplerCube reflectionSampler
                    , in vec2 vReflectionFilteringInfo
                    #ifdef IBL_CDF_FILTERING
                        , in sampler2D icdfSampler
                    #endif
                #endif
            #endif
            #ifdef USEIRRADIANCEMAP
                #ifdef REFLECTIONMAP_3D
                    , in samplerCube irradianceSampler
                #else
                    , in sampler2D irradianceSampler
                #endif
            #endif
        #endif
    #endif
    #if defined(SS_REFRACTION) || defined(SS_TRANSLUCENCY)
        , in vec3 surfaceAlbedo
    #endif
    #ifdef SS_REFRACTION
        , in vec3 vPositionW
        , in vec3 viewDirectionW
        , in mat4 view
        , in vec4 vRefractionInfos
        , in mat4 refractionMatrix
        , in vec4 vRefractionMicrosurfaceInfos
        , in vec4 vLightingIntensity
        #ifdef SS_LINKREFRACTIONTOTRANSPARENCY
            , in float alpha
        #endif
        #ifdef SS_LODINREFRACTIONALPHA
            , in float NdotVUnclamped
        #endif
        #ifdef SS_LINEARSPECULARREFRACTION
            , in float roughness
        #endif
        , in float alphaG
        #ifdef SS_REFRACTIONMAP_3D
            , in samplerCube refractionSampler
            #ifndef LODBASEDMICROSFURACE
                , in samplerCube refractionSamplerLow
                , in samplerCube refractionSamplerHigh
            #endif
        #else
            , in sampler2D refractionSampler
            #ifndef LODBASEDMICROSFURACE
                , in sampler2D refractionSamplerLow
                , in sampler2D refractionSamplerHigh
            #endif
        #endif
        #ifdef ANISOTROPIC
            , in anisotropicOutParams anisotropicOut
        #endif
        #ifdef REALTIME_FILTERING
            , in vec2 vRefractionFilteringInfo
        #endif
        #ifdef SS_USE_LOCAL_REFRACTIONMAP_CUBIC
            , in vec3 refractionPosition
            , in vec3 refractionSize
        #endif
        #ifdef SS_DISPERSION
            , in float dispersion
        #endif
    #endif
    #ifdef SS_TRANSLUCENCY
        , in vec3 vDiffusionDistance
        , in vec4 vTranslucencyColor
        #ifdef SS_TRANSLUCENCYCOLOR_TEXTURE
            , in vec4 translucencyColorMap
        #endif
    #endif
    )
    {
        subSurfaceOutParams outParams;
        outParams.specularEnvironmentReflectance = vSpecularEnvironmentReflectance;

    // ______________________________________________________________________________________
    // _____________________________ Intensities & thickness ________________________________
    // ______________________________________________________________________________________
    #ifdef SS_REFRACTION
        float refractionIntensity = vSubSurfaceIntensity.x;
        #ifdef SS_LINKREFRACTIONTOTRANSPARENCY
            refractionIntensity *= (1.0 - alpha);
            // Put alpha back to 1;
            outParams.alpha = 1.0;
        #endif
    #endif

    #ifdef SS_TRANSLUCENCY
        float translucencyIntensity = vSubSurfaceIntensity.y;
    #endif

    #ifdef SS_THICKNESSANDMASK_TEXTURE
        #ifdef SS_USE_GLTF_TEXTURES
            float thickness = thicknessMap.g * vThicknessParam.y + vThicknessParam.x;
        #else
            float thickness = thicknessMap.r * vThicknessParam.y + vThicknessParam.x;
        #endif

        #if DEBUGMODE > 0
            outParams.thicknessMap = thicknessMap;
        #endif

        #if defined(SS_REFRACTION) && defined(SS_REFRACTION_USE_INTENSITY_FROM_THICKNESS)
            #ifdef SS_USE_GLTF_TEXTURES
                refractionIntensity *= thicknessMap.r;
            #else
                refractionIntensity *= thicknessMap.g;
            #endif
        #endif

        #if defined(SS_TRANSLUCENCY) && defined(SS_TRANSLUCENCY_USE_INTENSITY_FROM_THICKNESS)
            #ifdef SS_USE_GLTF_TEXTURES
                translucencyIntensity *= thicknessMap.a;
            #else
                translucencyIntensity *= thicknessMap.b;
            #endif
        #endif
    #else
        float thickness = vThicknessParam.y;
    #endif

    #if defined(SS_REFRACTION) && defined(SS_REFRACTIONINTENSITY_TEXTURE)
        #ifdef SS_USE_GLTF_TEXTURES
            refractionIntensity *= refractionIntensityMap.r;
        #else
            refractionIntensity *= refractionIntensityMap.g;
        #endif
    #endif

    #if defined(SS_TRANSLUCENCY) && defined(SS_TRANSLUCENCYINTENSITY_TEXTURE)
        #ifdef SS_USE_GLTF_TEXTURES
            translucencyIntensity *= translucencyIntensityMap.a;
        #else
            translucencyIntensity *= translucencyIntensityMap.b;
        #endif
    #endif

    // _________________________________________________________________________________________
    // _____________________________ Translucency transmittance ________________________________
    // _________________________________________________________________________________________
    #ifdef SS_TRANSLUCENCY
        thickness = maxEps(thickness);
        vec4 translucencyColor = vTranslucencyColor;
        #ifdef SS_TRANSLUCENCYCOLOR_TEXTURE
            translucencyColor *= translucencyColorMap;
        #endif

        vec3 transmittance = transmittanceBRDF_Burley(translucencyColor.rgb, vDiffusionDistance, thickness);
        transmittance *= translucencyIntensity;
        outParams.transmittance = transmittance;
        outParams.translucencyIntensity = translucencyIntensity;
    #endif

    // _____________________________________________________________________________________
    // _____________________________ Refraction environment ________________________________
    // _____________________________________________________________________________________
    #ifdef SS_REFRACTION
        vec4 environmentRefraction = vec4(0., 0., 0., 0.);

        // vRefractionInfos.y is the IOR of the volume.
        // vRefractionMicrosurfaceInfos.w is the IOR of the surface.
        #ifdef SS_HAS_THICKNESS
            float ior = vRefractionInfos.y;
        #else
            float ior = vRefractionMicrosurfaceInfos.w;
        #endif
        // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
        // an IOR of 1.5 results in the default amount of microfacet refraction.
        #ifdef SS_LODINREFRACTIONALPHA
            float refractionAlphaG = alphaG;
            refractionAlphaG = mix(alphaG, 0.0, clamp(ior * 3.0 - 2.0, 0.0, 1.0));
            float refractionLOD = getLodFromAlphaG(vRefractionMicrosurfaceInfos.x, refractionAlphaG, NdotVUnclamped);
        #elif defined(SS_LINEARSPECULARREFRACTION)
            float refractionRoughness = alphaG;
            refractionRoughness = mix(alphaG, 0.0, clamp(ior * 3.0 - 2.0, 0.0, 1.0));
            float refractionLOD = getLinearLodFromRoughness(vRefractionMicrosurfaceInfos.x, refractionRoughness);
        #else
            float refractionAlphaG = alphaG;
            refractionAlphaG = mix(alphaG, 0.0, clamp(ior * 3.0 - 2.0, 0.0, 1.0));
            float refractionLOD = getLodFromAlphaG(vRefractionMicrosurfaceInfos.x, refractionAlphaG);
        #endif

        float refraction_ior = vRefractionInfos.y;
        #ifdef SS_DISPERSION
            float realIOR = 1.0 / refraction_ior;
            // The 0.04 value is completely empirical
            float iorDispersionSpread = 0.04 * dispersion * (realIOR - 1.0);
            vec3 iors = vec3(1.0/(realIOR - iorDispersionSpread), refraction_ior, 1.0/(realIOR + iorDispersionSpread));
            for (int i = 0; i < 3; i++) {
                refraction_ior = iors[i];
        #endif
                vec4 envSample = sampleEnvironmentRefraction(refraction_ior, thickness, refractionLOD, normalW, vPositionW, viewDirectionW, view, vRefractionInfos, refractionMatrix, vRefractionMicrosurfaceInfos, alphaG
                #ifdef SS_REFRACTIONMAP_3D
                    , refractionSampler
                    #ifndef LODBASEDMICROSFURACE
                        , refractionSamplerLow
                        , refractionSamplerHigh
                    #endif
                #else
                    , refractionSampler
                    #ifndef LODBASEDMICROSFURACE
                        , refractionSamplerLow
                        , refractionSamplerHigh
                    #endif
                #endif
                #ifdef ANISOTROPIC
                    , anisotropicOut
                #endif
                #ifdef REALTIME_FILTERING
                    , vRefractionFilteringInfo
                #endif
                #ifdef SS_USE_LOCAL_REFRACTIONMAP_CUBIC
                    , refractionPosition
                    , refractionSize
                #endif
                );
                
        #ifdef SS_DISPERSION
                environmentRefraction[i] = envSample[i];
            }
        #else
            environmentRefraction = envSample;
        #endif

        // _____________________________ Levels _____________________________________
        environmentRefraction.rgb *= vRefractionInfos.x;
    #endif

    // _______________________________________________________________________________
    // _____________________________ Final Refraction ________________________________
    // _______________________________________________________________________________
    #ifdef SS_REFRACTION
        vec3 refractionTransmittance = vec3(refractionIntensity);
        #ifdef SS_THICKNESSANDMASK_TEXTURE
            vec3 volumeAlbedo = computeColorAtDistanceInMedia(vTintColor.rgb, vTintColor.w);

            // // Simulate Flat Surface
            // thickness /=  dot(refractionVector, -normalW);

            // // Simulate Curved Surface
            // float NdotRefract = dot(normalW, refractionVector);
            // thickness *= -NdotRefract;

            refractionTransmittance *= cocaLambert(volumeAlbedo, thickness);
        #elif defined(SS_LINKREFRACTIONTOTRANSPARENCY)
            // Tint the material with albedo.
            float maxChannel = max(max(surfaceAlbedo.r, surfaceAlbedo.g), surfaceAlbedo.b);
            vec3 volumeAlbedo = saturate(maxChannel * surfaceAlbedo);

            // Tint reflectance
            environmentRefraction.rgb *= volumeAlbedo;
        #else
            // Compute tint from min distance only.
            vec3 volumeAlbedo = computeColorAtDistanceInMedia(vTintColor.rgb, vTintColor.w);
            refractionTransmittance *= cocaLambert(volumeAlbedo, vThicknessParam.y);
        #endif

        #ifdef SS_ALBEDOFORREFRACTIONTINT
            // Tint the transmission with albedo.
            environmentRefraction.rgb *= surfaceAlbedo.rgb;
        #endif

        #ifdef LEGACY_SPECULAR_ENERGY_CONSERVATION
            outParams.surfaceAlbedo = surfaceAlbedo * (1.-refractionIntensity);
            outParams.refractionOpacity = 1.0;
        #else
            outParams.surfaceAlbedo = surfaceAlbedo;
            outParams.refractionOpacity = (1. - refractionIntensity);
        #endif

        #ifdef UNUSED_MULTIPLEBOUNCES
            // Keeping track in case of back compat issue.
            // The following code is broken and has never worked cause the mix is reversed. Fixing it
            // Introduces more reflection at grazing angle than expected and we can not find it back in any
            // nomenclatures (probably coming from our V1)

            // Add Multiple internal bounces.
            vec3 bounceSpecularEnvironmentReflectance = (2.0 * vSpecularEnvironmentReflectance) / (1.0 + vSpecularEnvironmentReflectance);
            outParams.specularEnvironmentReflectance = mix(bounceSpecularEnvironmentReflectance, vSpecularEnvironmentReflectance, refractionIntensity);
        #endif

        #if DEBUGMODE > 0
            outParams.refractionTransmittance = refractionTransmittance;
        #endif

        outParams.finalRefraction = environmentRefraction.rgb * refractionTransmittance * vLightingIntensity.z;

        // Decrease the trasmitted light based on the specular environment reflectance.
        outParams.finalRefraction *= vec3(1.0) - vSpecularEnvironmentReflectance;

        #if DEBUGMODE > 0
            outParams.environmentRefraction = environmentRefraction;
        #endif
    #endif

    // __________________________________________________________________________________
    // _______________________________  IBL Translucency ________________________________
    // __________________________________________________________________________________
    #if defined(REFLECTION) && defined(SS_TRANSLUCENCY)
        #if defined(NORMAL) && defined(USESPHERICALINVERTEX) || !defined(USESPHERICALFROMREFLECTIONMAP)
            vec3 irradianceVector = vec3(reflectionMatrix * vec4(normalW, 0)).xyz;
            #ifdef REFLECTIONMAP_OPPOSITEZ
                irradianceVector.z *= -1.0;
            #endif
            #ifdef INVERTCUBICMAP
                irradianceVector.y *= -1.0;
            #endif
        #else
            vec3 irradianceVector = irradianceVector_;
        #endif

        #if defined(USESPHERICALFROMREFLECTIONMAP)
            #if defined(REALTIME_FILTERING)
                vec3 refractionIrradiance = irradiance(reflectionSampler, -irradianceVector, vReflectionFilteringInfo, 0.0, surfaceAlbedo, irradianceVector
                #ifdef IBL_CDF_FILTERING
                    , icdfSampler
                #endif
                );
            #else
                vec3 refractionIrradiance = computeEnvironmentIrradiance(-irradianceVector);
            #endif
        #elif defined(USEIRRADIANCEMAP)
            #ifdef REFLECTIONMAP_3D
                vec3 irradianceCoords = irradianceVector;
            #else
                vec2 irradianceCoords = irradianceVector.xy;
                #ifdef REFLECTIONMAP_PROJECTION
                    irradianceCoords /= irradianceVector.z;
                #endif
                irradianceCoords.y = 1.0 - irradianceCoords.y;
            #endif

            vec4 refractionIrradiance = sampleReflection(irradianceSampler, -irradianceCoords);
            #ifdef RGBDREFLECTION
                refractionIrradiance.rgb = fromRGBD(refractionIrradiance);
            #endif

            #ifdef GAMMAREFLECTION
                refractionIrradiance.rgb = toLinearSpace(refractionIrradiance.rgb);
            #endif
        #else
            vec4 refractionIrradiance = vec4(0.);
        #endif

        refractionIrradiance.rgb *= transmittance;

        #ifdef SS_ALBEDOFORTRANSLUCENCYTINT
            // Tint the transmission with albedo.
            refractionIrradiance.rgb *= surfaceAlbedo.rgb;
        #endif

        outParams.refractionIrradiance = refractionIrradiance.rgb;
    #endif
        return outParams;
    }
#endif

