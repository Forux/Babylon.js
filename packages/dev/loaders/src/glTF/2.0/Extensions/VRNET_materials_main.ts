import type { Nullable } from "core/types";
import { PBRMaterial } from "core/Materials/PBR/pbrMaterial";
import type { Material } from "core/Materials/material";
import { CubeTexture } from "core/Materials/Textures/cubeTexture";
import { Vector3 } from "core/Maths/math.vector";

import { Color3 } from "core/Maths/math.color";
import type { IMaterial } from "../glTFLoaderInterfaces";
import type { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import { GLTFLoader } from "../glTFLoader";
import type { IMaterialExtension, ITextureInfo as ITextureInfoBase } from "babylonjs-gltf2interface";
import { BaseTexture } from "core/Materials/Textures/baseTexture";

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
    public order = 100;

    private _loader: GLTFLoader;

    /**
     * @internal
     */
    private static _ReflectionCache: {
        [key: string]: {
            texture: CubeTexture;
            loader: GLTFLoader;
        }
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
        return GLTFLoader.LoadExtraAsync<VRNETMaterialsBase>(context, material, this.name, (extraContext, extra) => {
            const promises = new Array<Promise<any>>();
            promises.push(this._loadLightmapPropertiesPropertiesAsync(extraContext, material, extra, babylonMaterial));
            Promise.all(promises).then(() => {});
            return null;
        });
    }

    private _loadLightmapPropertiesPropertiesAsync(context: string, material: IMaterial, properties: VRNETMaterialsBase, babylonMaterial: Material): Promise<void> {
        if (!(babylonMaterial instanceof PBRMaterial)) {
            throw new Error(`${context}: Material type not supported`);
        }

        const promises = new Array<Promise<any>>();

        if (properties.lightmapTexture) {
            properties.lightmapTexture.nonColorData = true;
            promises.push(
                this._loader.loadTextureInfoAsync(`${context}/lightmapTexture`, properties.lightmapTexture, (texture:BaseTexture) => {
                    const callBack = () => {
                        // this will be called once for all materials, once per real texture
                        texture.name = `${babylonMaterial.name} (Lightmap)`;
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
                    const probI = properties.reflectionProbeInfo;
                    cubeT = {
                        loader: this._loader,
                        texture: new CubeTexture(
                            this._loader["_rootUrl"] + probI.reflectionMapTexture,
                            this._loader.babylonScene,
                            null,
                            false,
                            null,
                            null,
                            null,
                            undefined,
                            probI.prefiltered
                        )
                    };
                    cubeT.texture.name = probI.reflectionMapTexture;
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
                    VRNET_materials_main._ReflectionCache[properties.reflectionProbeInfo.reflectionMapTexture] = cubeT;
                }

                babylonMaterial.reflectionTexture = cubeT.texture;
            }
        }

        return Promise.all(promises).then(() => {});
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new VRNET_materials_main(loader));
