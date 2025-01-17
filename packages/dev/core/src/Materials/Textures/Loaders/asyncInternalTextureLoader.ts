import type { Nullable } from "../../../types";
import type { InternalTexture } from "../internalTexture";

/**
 * This represents the required contract to create a new type of texture loader.
 */
export interface IAsyncInternalTextureLoader {
    /**
     * Defines whether the loader supports cascade loading the different faces.
     */
    supportCascades: boolean;

    /**
     * Uploads the cube texture data to the WebGL texture. It has already been bound.
     * @param data contains the texture data
     * @param texture defines the BabylonJS internal texture
     * @param hardwareTexture defines the hardware texture wrapper to replace the underlying texture
     * @param createPolynomials will be true if polynomials have been requested
     * @param bytesInBlock defines the number of bytes in a block to be loaded in one sync call
     * @param onLoad defines the callback to trigger once the texture is ready
     * @param onError defines the callback to trigger in case of error
     * @param options options to be passed to the loader
     */
    loadCubeData(
        data: ArrayBufferView | ArrayBufferView[],
        texture: InternalTexture,
        createPolynomials: boolean,
        bytesInBlock: number,
        onLoad: Nullable<(data?: any) => void>,
        onError: Nullable<(message?: string, exception?: any) => void>,
        options?: any
    ): Promise<void>;

    /**
     * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
     * @param data contains the texture data
     * @param texture defines the BabylonJS internal texture
     * @param hardwareTexture defines the hardware texture wrapper to replace the underlying texture
     * @param bytesInBlock defines the number of bytes in a block to be loaded in one sync call
     * @param callback defines the method to call once ready to upload
     * @param options options to be passed to the loader
     */
    loadData(
        data: ArrayBufferView,
        texture: InternalTexture,
        bytesInBlock: number,
        callback: (width: number, height: number, loadMipmap: boolean, isCompressed: boolean, done: () => Promise<void>, loadFailed?: boolean) => Promise<void>,
        options?: any
    ): Promise<void>;
}
