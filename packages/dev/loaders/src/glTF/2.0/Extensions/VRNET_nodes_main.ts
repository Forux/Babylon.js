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

/**
 * @internal
 */
interface ISkyboxInfo {
    texture: string;
    sphericalPolynomial: number[][];
    exposure: number;
    tintColor: number[];
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
    public loadNodeAsync(context: string, node: INode, assign: (babylonMesh: TransformNode) => void): Nullable<Promise<TransformNode>> {
        return GLTFLoader.LoadExtensionAsync<VRNETNodesExtension, TransformNode>(context, node, this.name, (extensionContext, extension) => {
            const promises = new Array<Promise<any>>();
            return this._loader.loadNodeAsync(context, node, (babylonMesh) => {
                return Promise.all(promises).then(() => {
                    const skyboxInfo = extension.skyboxes[0]; // Assuming only one skybox per node

                    if (skyboxInfo) {
                        const skybox = this._createSkybox(skyboxInfo, true);
                        assign(skybox);
                    }

                    return null;
                });
            });
        });
    }

    private _createSkybox(skyboxInfo: ISkyboxInfo, isEnvironmentTexture: boolean): TransformNode {
        const skybox = new TransformNode("skybox", this._loader.babylonScene);

        // Create a cube texture from the skybox texture URL
        const texture = CubeTexture.CreateFromPrefilteredData(this._loader["_rootUrl"] + skyboxInfo.texture, this._loader.babylonScene);
        texture.coordinatesMode = Texture.SKYBOX_MODE;

        if (isEnvironmentTexture) {
            this._loader.babylonScene.environmentTexture = texture;
        }

        // Create a PBR material for the skybox
        const material = new BackgroundMaterial("skyboxMaterial", this._loader.babylonScene);
        material.backFaceCulling = false;
        material.reflectionTexture = texture;

        material.useRGBColor = false;
        material.primaryColor = skyboxInfo.tintColor ? Color3.FromArray(skyboxInfo.tintColor) : Color3.White();
        material.enableNoise = true;

        // Set the spherical polynomial coefficients if available
        if (skyboxInfo.sphericalPolynomial) {
            material.reflectionTexture.sphericalPolynomial = SphericalPolynomial.FromArray(skyboxInfo.sphericalPolynomial);
        }

        // Set the exposure and tint color if available
        if (skyboxInfo.exposure !== undefined) {
            material.reflectionTexture.level = skyboxInfo.exposure;
        }

        // Create a box mesh with a large size to imitate a skybox
        const skyboxSize = 1000;
        const box = this._loader.babylonScene.getMeshByName("skybox");
        if (!box) {
            const skyboxMesh = CreateBox("skybox", { size: skyboxSize }, skybox.getScene());
            skyboxMesh.material = material;
            skyboxMesh.infiniteDistance = true;
            skyboxMesh.parent = skybox;
        }

        return skybox;
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new VRNET_nodes_main(loader));
