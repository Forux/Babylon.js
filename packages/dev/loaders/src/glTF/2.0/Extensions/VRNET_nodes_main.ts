import type { Nullable } from "core/types";
import { Color3 } from "core/Maths/math.color";
import { SphericalPolynomial } from "core/Maths/sphericalPolynomial";
import { BackgroundMaterial } from "core/Materials/Background/backgroundMaterial";
import { Texture } from "core/Materials/Textures/texture";
import { CubeTexture } from "core/Materials/Textures/cubeTexture";
import { CreateBox } from "core/Meshes/Builders/boxBuilder";
import { TransformNode } from "core/Meshes/transformNode";
import type { INode } from "../glTFLoaderInterfaces";
import type { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import { GLTFLoader } from "../glTFLoader";
import { Deferred } from "core/Misc/deferred";
import { Observable } from "core/Misc/observable";

/**
 * @internal
 */
interface ISkyboxInfo {
    texture: string;
    isRGBD: boolean;
    sphericalPolynomial: number[][];
    exposure: number;
    tintColor: number[];
    rotation: number;
}

/**
 * @internal
 */
interface VRNETNodesExtension {
    skyboxes: ISkyboxInfo[];
}

const NAME = "VRNET_nodes_main";

/**
 * This class done based on KHR_materials_pbrSpecularGlossiness
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class VRNET_nodes_main implements IGLTFLoaderExtension {
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
    private static _SkyboxCache: {
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
    public loadNodeAsync(context: string, node: INode, assign: (babylonNode: TransformNode) => void): Nullable<Promise<TransformNode>> {
        return GLTFLoader.LoadExtensionAsync<VRNETNodesExtension, TransformNode>(context, node, this.name, (extensionContext, extension) => {
            const promises = new Array<Promise<any>>();
            return this._loader.loadNodeAsync(context, node, (babylonNode) => {
                return Promise.all(promises).then(() => {
                    const promises = new Array<Promise<any>>();
                    for (let i = 0; i < extension.skyboxes.length; i++) {
                        if (extension.skyboxes[i]) {
                            const skyboxPromise = this._createSkybox(extension.skyboxes[i], `skybox_${i}`, i === 0);
                            promises.push(
                                skyboxPromise.then((skybox) => {
                                    skybox.parent = babylonNode;
                                })
                            );
                        }
                    }
                    return Promise.all(promises).then(() => {
                        babylonNode.name = "skyboxes";
                        assign(babylonNode);
                        return babylonNode;
                    });
                });
            });
        });
    }

    private _createSkybox(skyboxInfo: ISkyboxInfo, name: string, isEnvironmentTexture: boolean): Promise<TransformNode> {
        const skybox = new TransformNode(name, this._loader.babylonScene);

        const material = new BackgroundMaterial(`${name}_material`, this._loader.babylonScene);
        material.backFaceCulling = false;

        material.useRGBColor = false;
        material.primaryColor = skyboxInfo.tintColor ? Color3.FromArray(skyboxInfo.tintColor) : Color3.White();
        material.enableNoise = true;

        // Create a box mesh with a large size to imitate a skybox
        const skyboxSize = 1000;
        let box = this._loader.babylonScene.getMeshByName("skybox");
        if (!box) {
            box = CreateBox("skybox", { size: skyboxSize }, skybox.getScene());
            box.infiniteDistance = true;
            box.parent = skybox;

            if (skyboxInfo.rotation !== undefined) {
                box.rotation.y = skyboxInfo.rotation;
            }
        }
        if (isEnvironmentTexture) {
            box.material = material;
        }

        const textureUrl = this._loader["_rootUrl"] + skyboxInfo.texture;
        let skyboxT = VRNET_nodes_main._SkyboxCache[skyboxInfo.texture];
        if (!skyboxT || skyboxT.loader !== this._loader) {
            const deferred = new Deferred<void>();
            skyboxT = { loader: this._loader, loadObservable: new Observable<CubeTexture>() };
            VRNET_nodes_main._SkyboxCache[skyboxInfo.texture] = skyboxT;
            this._loader.babylonScene._loadFile(
                textureUrl,
                (data) => {
                    skyboxT.texture = new CubeTexture(textureUrl, this._loader.babylonScene, {
                        noMipmap: false,
                        buffer: new Uint8Array(data as ArrayBuffer),
                        onLoad: () => deferred.resolve(),
                        onError: () => deferred.reject(),
                        prefiltered: false,
                    });
                    if (skyboxInfo.isRGBD) {
                        skyboxT.texture.isRGBD = true;
                    }
                    skyboxT.texture.coordinatesMode = Texture.SKYBOX_MODE;
                    if (isEnvironmentTexture) {
                        this._loader.babylonScene.environmentTexture = skyboxT.texture;
                    }
                    if (skyboxInfo.sphericalPolynomial) {
                        skyboxT.texture.sphericalPolynomial = SphericalPolynomial.FromArray(skyboxInfo.sphericalPolynomial);
                    }
                    if (skyboxInfo.exposure !== undefined) {
                        skyboxT.texture.level = skyboxInfo.exposure;
                    }
                    skyboxT.texture.gammaSpace = true;
                    material.reflectionTexture = skyboxT.texture;
                },
                undefined,
                undefined,
                true,
                () => deferred.reject()
            );

            return deferred.promise.then(() => skybox);
        } else {
            return new Promise<void>((resolve) => {
                if (skyboxT.texture) {
                    material.reflectionTexture = skyboxT.texture;
                    resolve();
                } else {
                    skyboxT.loadObservable.add((texture) => {
                        material.reflectionTexture = texture;
                        resolve();
                    });
                }
            }).then(() => skybox);
        }
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new VRNET_nodes_main(loader));
