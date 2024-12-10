import type { Nullable } from "../../../types";
import { SphericalPolynomial } from "../../../Maths/sphericalPolynomial";
import type { InternalTexture } from "../../../Materials/Textures/internalTexture";
import { DDSTools } from "../../../Misc/dds";
import type { IAsyncInternalTextureLoader } from "./asyncInternalTextureLoader";
import { Deferred } from "core/Misc/deferred";

/**
 * Implementation of the DDS Texture Loader.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class _AsyncDDSTextureLoader implements IAsyncInternalTextureLoader {
    /**
     * Defines whether the loader supports cascade loading the different faces.
     */
    public readonly supportCascades = true;

    /**
     * Uploads the cube texture data to the WebGL texture. It has already been bound.
     * @param imgs contains the cube maps
     * @param texture defines the BabylonJS internal texture
     * @param createPolynomials will be true if polynomials have been requested
     * @param bytesInBlock defines the number of bytes in a block to be loaded in one sync call
     * @param onLoad defines the callback to trigger once the texture is ready
     */
    public async loadCubeData(
        imgs: ArrayBufferView,
        texture: InternalTexture,
        createPolynomials: boolean,
        bytesInBlock: number,
        onLoad: Nullable<(data?: any) => void>
    ): Promise<void> {
        const engine = texture.getEngine();
        const data = imgs;
        const info = DDSTools.GetDDSInfo(data);
        let loadMipmap: boolean = false;
        let maxLevel: number = 1000;

        texture.width = info.width;
        texture.height = info.height;
        texture.baseWidth = info.width;
        texture.baseHeight = info.height;

        if (createPolynomials) {
            info.sphericalPolynomial = new SphericalPolynomial();
        }

        loadMipmap = (info.isRGB || info.isLuminance || info.mipmapCount > 1) && texture.generateMipMaps;
        engine._unpackFlipY(info.isCompressed);

        await DDSTools.UploadDDSLevelsAsync(engine, texture, data, info, bytesInBlock, loadMipmap, 6);

        if (!info.isFourCC && info.mipmapCount === 1) {
            // Do not unbind as we still need to set the parameters.
            engine.generateMipMapsForCubemap(texture, false);
        } else {
            maxLevel = info.mipmapCount - 1;
        }

        engine._setCubeMapTextureParams(texture, loadMipmap, maxLevel);
        texture.isReady = true;
        texture.onLoadedObservable.notifyObservers(texture);
        texture.onLoadedObservable.clear();

        if (onLoad) {
            onLoad({ isDDS: true, width: texture.width, info, data: imgs, texture });
        }
    }

    /**
     * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
     * @param data contains the texture data
     * @param texture defines the BabylonJS internal texture
     * @param bytesInBlock defines the number of bytes in a block to be loaded in one sync call
     * @param callback defines the method to call once ready to upload
     * @returns A promise that resolves when the texture is ready.
     */
    public async loadData(
        data: ArrayBufferView,
        texture: InternalTexture,
        bytesInBlock: number,
        callback: (width: number, height: number, loadMipmap: boolean, isCompressed: boolean, done: () => Promise<void>) => Promise<void>
    ): Promise<void> {
        const deferred = new Deferred<void>();
        const info = DDSTools.GetDDSInfo(data);

        const loadMipmap = (info.isRGB || info.isLuminance || info.mipmapCount > 1) && texture.generateMipMaps && Math.max(info.width, info.height) >> (info.mipmapCount - 1) === 1;
        callback(info.width, info.height, loadMipmap, info.isFourCC, async () => {
            await DDSTools.UploadDDSLevelsAsync(texture.getEngine(), texture, data, info, bytesInBlock, loadMipmap, 1);

            texture.width = info.width;
            texture.height = info.height;
            texture.baseWidth = info.width;
            texture.baseHeight = info.height;

            texture.isReady = true;
            texture.onLoadedObservable.notifyObservers(texture);
            texture.onLoadedObservable.clear();

            deferred.resolve();
        });
        return deferred.promise;
    }
}
