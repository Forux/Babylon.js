import type { Nullable } from "core/types";
import { PBRMaterial } from "core/Materials/PBR/pbrMaterial";
import type { Material } from "core/Materials/material";
import type { ICubeTextureCreationOptions } from "core/Materials/Textures/cubeTexture";
import { CubeTexture } from "core/Materials/Textures/cubeTexture";
import { Vector3 } from "core/Maths/math.vector";
import { Color3 } from "core/Maths/math.color";
import { SphericalPolynomial } from "core/Maths/sphericalPolynomial";
import type { IMaterial } from "../glTFLoaderInterfaces";
import type { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import { GLTFLoader } from "../glTFLoader";
import type { IMaterialExtension, ITextureInfo as ITextureInfoBase } from "babylonjs-gltf2interface";
import { BaseTexture } from "core/Materials/Textures/baseTexture";
import { Deferred } from "core/Misc/deferred";
import { Observable } from "core/Misc/observable";
import { registerGLTFExtension, unregisterGLTFExtension } from "../glTFLoaderExtensionRegistry";

/**
 * adding needed property
 */
interface ITextureInfo extends ITextureInfoBase {
    /** false or undefined if the texture holds color data (true if data are roughness, normal, ...) */
    nonColorData?: boolean;
    isRGBD?: boolean;
}

/**
 * VRNETMaterialsBase interface done based on KHR_materials_pbrSpecularGlossiness interface IKHRMaterialsPbrSpecularGlossiness
 */

/** @internal */
interface IRelfectionProbeInfo {
    reflectionMapTexture: string;
    isRGBD: boolean;
    reflectionSphericalPolynomial: number[][];
    prefiltered: boolean;
    boundingBoxSize: number[];
    boundingBoxOffset: number[];
    boundingBoxPosition: number[];
    level: number;
}

/** @internal */
interface VRNETMaterialsBase extends IMaterialExtension {
    diffuseFactor: number[];
    diffuseTexture: ITextureInfo;
    specularFactor: number[];
    glossinessFactor: number;
    specularGlossinessTexture: ITextureInfo;
    lightmapTexture: ITextureInfo;
    reflectionProbeInfo: IRelfectionProbeInfo;
    useLightmapAsShadowmap: boolean;
}

const NAME = "VRNET_materials_main";

/**
 * This class done based on KHR_materials_pbrSpecularGlossiness
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class VRNET_materials_main implements IGLTFLoaderExtension {
    /**
     * The name of this extension.
     */
    public readonly name = NAME;

    /**
     * Defines whether this extension is enabled.
     */
    public enabled: boolean;

    /**
     * Defines a number that determines the order the extensions are applied.
     */
    public order = 200;

    private _loader: GLTFLoader;

    /**
     * @internal
     */
    private static _ReflectionCache: {
        [key: string]: {
            texture?: CubeTexture;
            loader: GLTFLoader;
            loadObservable: Observable<CubeTexture>;
        };
    } = {};

    /**
     * @internal
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = this._loader.isExtensionUsed(NAME);
    }

    /** @internal */
    public dispose() {
        (this._loader as any) = null;
    }

    /**
     * @internal
     */
    public loadMaterialPropertiesAsync(context: string, material: IMaterial, babylonMaterial: Material): Nullable<Promise<void>> {
        return GLTFLoader.LoadExtensionAsync<VRNETMaterialsBase>(context, material, this.name, (extensionContext, extension) => {
            const promises = new Array<Promise<any>>();
            promises.push(this._loader.loadMaterialBasePropertiesAsync(context, material, babylonMaterial));
            if (material.pbrMetallicRoughness) {
                promises.push(this._loader._loadMaterialMetallicRoughnessPropertiesAsync(`${context}/pbrMetallicRoughness`, material.pbrMetallicRoughness, babylonMaterial));
            } else {
                promises.push(this._loadSpecularGlossinessPropertiesAsync(extensionContext, extension, babylonMaterial));
            }
            promises.push(this._loadLightmapPropertiesPropertiesAsync(extensionContext, extension, babylonMaterial));
            this._loader.loadMaterialAlphaProperties(context, material, babylonMaterial);
            return Promise.all(promises).then(() => {});
        });
    }

    private _loadLightmapPropertiesPropertiesAsync(context: string, properties: VRNETMaterialsBase, babylonMaterial: Material): Promise<void> {
        if (!(babylonMaterial instanceof PBRMaterial)) {
            throw new Error(`${context}: Material type not supported`);
        }

        const promises = new Array<Promise<any>>();

        if (properties.lightmapTexture) {
            properties.lightmapTexture.nonColorData = true;
            promises.push(
                this._loader.loadTextureInfoAsync(`${context}/lightmapTexture`, properties.lightmapTexture, (texture: BaseTexture) => {
                    const callBack = () => {
                        // this will be called once for all materials, once per real texture
                        texture.name += `|Lightmap|${babylonMaterial.name}`;
                        texture.isRGBD = properties.lightmapTexture.isRGBD ? true : false;
                        return true;
                    };
                    babylonMaterial.lightmapTexture = texture;
                    BaseTexture.WhenAllReady([texture], callBack);
                })
            );
            babylonMaterial.ambientColor = Color3.White();
            babylonMaterial.useLightmapAsShadowmap = !!properties.useLightmapAsShadowmap;
        }

        if (properties.reflectionProbeInfo && properties.reflectionProbeInfo.reflectionMapTexture) {
            if (null != babylonMaterial) {
                let cubeT = VRNET_materials_main._ReflectionCache[properties.reflectionProbeInfo.reflectionMapTexture];
                if (!cubeT || cubeT.loader !== this._loader) {
                    const deferred = new Deferred<void>();
                    const probI = properties.reflectionProbeInfo;
                    cubeT = { loader: this._loader, loadObservable: new Observable<CubeTexture>() };
                    VRNET_materials_main._ReflectionCache[properties.reflectionProbeInfo.reflectionMapTexture] = cubeT;
                    const textureUrl = this._loader["_rootUrl"] + probI.reflectionMapTexture;

                    this._loader.parent._loadFile(
                        this._loader.babylonScene,
                        textureUrl,
                        (data) => {
                            const cubeTextureOptions: ICubeTextureCreationOptions = {
                                noMipmap: false,
                                buffer: new Uint8Array(data as ArrayBuffer),
                                onLoad: () => deferred.resolve(),
                                onError: () => deferred.reject(),
                                prefiltered: false,
                            };
                            cubeT.texture = new CubeTexture(this._loader["_rootUrl"] + probI.reflectionMapTexture, this._loader.babylonScene, cubeTextureOptions);
                            cubeT.loadObservable.notifyObservers(cubeT.texture);
                            cubeT.texture.isRGBD = probI.isRGBD ? true : false;
                            cubeT.texture.name = (probI.reflectionMapTexture.split("/").pop() || probI.reflectionMapTexture) + `|ReflectionMap|${babylonMaterial.name}`;
                            if (probI.level) {
                                cubeT.texture.level = probI.level;
                            }
                            if (probI.boundingBoxSize) {
                                cubeT.texture.boundingBoxSize = Vector3.FromArray(probI.boundingBoxSize);
                            }
                            if (probI.boundingBoxPosition) {
                                cubeT.texture.boundingBoxPosition = Vector3.FromArray(probI.boundingBoxPosition);
                            }
                            if (probI.boundingBoxOffset) {
                                cubeT.texture.boundingBoxOffset = Vector3.FromArray(probI.boundingBoxOffset);
                            }
                            if (probI.reflectionSphericalPolynomial) {
                                cubeT.texture.sphericalPolynomial = SphericalPolynomial.FromArray(probI.reflectionSphericalPolynomial);
                            }
                            cubeT.texture.gammaSpace = probI.prefiltered ? false : true;
                            babylonMaterial.reflectionTexture = cubeT.texture;
                        },
                        true,
                        () => deferred.reject()
                    );

                    promises.push(deferred.promise);
                } else {
                    promises.push(
                        new Promise<void>((resolve) => {
                            if (cubeT.texture) {
                                babylonMaterial.reflectionTexture = cubeT.texture;
                                resolve();
                            } else {
                                cubeT.loadObservable.add((texture) => {
                                    babylonMaterial.reflectionTexture = texture;
                                    resolve();
                                });
                            }
                        })
                    );
                }

                babylonMaterial.enableSpecularAntiAliasing = false;
            }
        }

        return Promise.all(promises).then(() => {});
    }

    private _loadSpecularGlossinessPropertiesAsync(context: string, properties: VRNETMaterialsBase, babylonMaterial: Material): Promise<void> {
        if (!(babylonMaterial instanceof PBRMaterial)) {
            throw new Error(`${context}: Material type not supported`);
        }

        const promises = new Array<Promise<any>>();

        babylonMaterial.metallic = null;
        babylonMaterial.roughness = null;

        if (properties.diffuseFactor) {
            babylonMaterial.albedoColor = Color3.FromArray(properties.diffuseFactor);
            babylonMaterial.alpha = properties.diffuseFactor[3];
        } else {
            babylonMaterial.albedoColor = Color3.White();
        }

        babylonMaterial.reflectivityColor = properties.specularFactor ? Color3.FromArray(properties.specularFactor) : Color3.White();
        babylonMaterial.microSurface = properties.glossinessFactor == undefined ? 1 : properties.glossinessFactor;

        if (properties.diffuseTexture) {
            promises.push(
                this._loader.loadTextureInfoAsync(`${context}/diffuseTexture`, properties.diffuseTexture, (texture) => {
                    BaseTexture.WhenAllReady([texture], () => {
                        texture.name += `|Diffuse|${babylonMaterial.name}`;
                    });
                    babylonMaterial.albedoTexture = texture;
                })
            );
        }

        if (properties.specularGlossinessTexture) {
            promises.push(
                this._loader.loadTextureInfoAsync(`${context}/specularGlossinessTexture`, properties.specularGlossinessTexture, (texture) => {
                    BaseTexture.WhenAllReady([texture], () => {
                        texture.name += `|ReflectivityTexture|${babylonMaterial.name}`;
                    });
                    babylonMaterial.reflectivityTexture = texture;
                    babylonMaterial.reflectivityTexture.hasAlpha = true;
                })
            );

            babylonMaterial.useMicroSurfaceFromReflectivityMapAlpha = true;
        }

        return Promise.all(promises).then(() => {});
    }
}

unregisterGLTFExtension(NAME);
registerGLTFExtension(NAME, true, (loader) => new VRNET_materials_main(loader));
