/* eslint-disable @typescript-eslint/naming-convention */
import { Clamp } from "../Maths/math.scalar.functions";
import type { SphericalPolynomial } from "../Maths/sphericalPolynomial";
import { Constants } from "../Engines/constants";
import type { InternalTexture } from "../Materials/Textures/internalTexture";
import type { Nullable } from "../types";
import { Logger } from "../Misc/logger";
import { CubeMapToSphericalPolynomialTools } from "../Misc/HighDynamicRange/cubemapToSphericalPolynomial";
import type { AbstractEngine } from "../Engines/abstractEngine";
import { FromHalfFloat, ToHalfFloat } from "./textureTools";

import "../Engines/AbstractEngine/abstractEngine.cubeTexture";
import type { HardwareTextureWrapper } from "core/Materials/Textures/hardwareTextureWrapper";

// Based on demo done by Brandon Jones - http://media.tojicode.com/webgl-samples/dds.html
// All values and structures referenced from:
// http://msdn.microsoft.com/en-us/library/bb943991.aspx/
const DDS_MAGIC = 0x20534444;

const //DDSD_CAPS = 0x1,
    //DDSD_HEIGHT = 0x2,
    //DDSD_WIDTH = 0x4,
    //DDSD_PITCH = 0x8,
    //DDSD_PIXELFORMAT = 0x1000,
    DDSD_MIPMAPCOUNT = 0x20000;
//DDSD_LINEARSIZE = 0x80000,
//DDSD_DEPTH = 0x800000;

// var DDSCAPS_COMPLEX = 0x8,
//     DDSCAPS_MIPMAP = 0x400000,
//     DDSCAPS_TEXTURE = 0x1000;

const DDSCAPS2_CUBEMAP = 0x200;
// DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
// DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
// DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
// DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
// DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
// DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
// DDSCAPS2_VOLUME = 0x200000;

const //DDPF_ALPHAPIXELS = 0x1,
    //DDPF_ALPHA = 0x2,
    DDPF_FOURCC = 0x4,
    DDPF_RGB = 0x40,
    //DDPF_YUV = 0x200,
    DDPF_LUMINANCE = 0x20000;

function FourCCToInt32(value: string) {
    return value.charCodeAt(0) + (value.charCodeAt(1) << 8) + (value.charCodeAt(2) << 16) + (value.charCodeAt(3) << 24);
}

function Int32ToFourCC(value: number) {
    return String.fromCharCode(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

const FOURCC_DXT1 = FourCCToInt32("DXT1");
const FOURCC_DXT3 = FourCCToInt32("DXT3");
const FOURCC_DXT5 = FourCCToInt32("DXT5");
const FOURCC_DX10 = FourCCToInt32("DX10");
const FOURCC_D3DFMT_R16G16B16A16F = 113;
const FOURCC_D3DFMT_R32G32B32A32F = 116;

const DXGI_FORMAT_R32G32B32A32_FLOAT = 2;
const DXGI_FORMAT_R16G16B16A16_FLOAT = 10;
const DXGI_FORMAT_B8G8R8X8_UNORM = 88;

//> VRNET
// from https://github.com/g-truc/gli/blob/master/gli/dx.hpp
const DXGI_FORMAT_BC6H_UF16 = 95;
const DXGI_FORMAT_BC6H_SF16 = 96;
const DXGI_FORMAT_BC7_UNORM = 98;
const DXGI_FORMAT_BC7_UNORM_SRGB = 99;
const DXGI_FORMAT_ASTC_4X4_TYPELESS = 133;
const DXGI_FORMAT_ASTC_4X4_UNORM = 134;
const DXGI_FORMAT_ASTC_4X4_UNORM_SRGB = 135;
const DXGI_FORMAT_ASTC_5X4_TYPELESS = 137;
const DXGI_FORMAT_ASTC_5X4_UNORM = 138;
const DXGI_FORMAT_ASTC_5X4_UNORM_SRGB = 139;
const DXGI_FORMAT_ASTC_5X5_TYPELESS = 141;
const DXGI_FORMAT_ASTC_5X5_UNORM = 142;
const DXGI_FORMAT_ASTC_5X5_UNORM_SRGB = 143;
const DXGI_FORMAT_ASTC_6X5_TYPELESS = 145;
const DXGI_FORMAT_ASTC_6X5_UNORM = 146;
const DXGI_FORMAT_ASTC_6X5_UNORM_SRGB = 147;
const DXGI_FORMAT_ASTC_6X6_TYPELESS = 149;
const DXGI_FORMAT_ASTC_6X6_UNORM = 150;
const DXGI_FORMAT_ASTC_6X6_UNORM_SRGB = 151;
const DXGI_FORMAT_ASTC_8X5_TYPELESS = 153;
const DXGI_FORMAT_ASTC_8X5_UNORM = 154;
const DXGI_FORMAT_ASTC_8X5_UNORM_SRGB = 155;
const DXGI_FORMAT_ASTC_8X6_TYPELESS = 157;
const DXGI_FORMAT_ASTC_8X6_UNORM = 158;
const DXGI_FORMAT_ASTC_8X6_UNORM_SRGB = 159;
const DXGI_FORMAT_ASTC_8X8_TYPELESS = 161;
const DXGI_FORMAT_ASTC_8X8_UNORM = 162;
const DXGI_FORMAT_ASTC_8X8_UNORM_SRGB = 163;
const DXGI_FORMAT_ASTC_10X5_TYPELESS = 165;
const DXGI_FORMAT_ASTC_10X5_UNORM = 166;
const DXGI_FORMAT_ASTC_10X5_UNORM_SRGB = 167;
const DXGI_FORMAT_ASTC_10X6_TYPELESS = 169;
const DXGI_FORMAT_ASTC_10X6_UNORM = 170;
const DXGI_FORMAT_ASTC_10X6_UNORM_SRGB = 171;
const DXGI_FORMAT_ASTC_10X8_TYPELESS = 173;
const DXGI_FORMAT_ASTC_10X8_UNORM = 174;
const DXGI_FORMAT_ASTC_10X8_UNORM_SRGB = 175;
const DXGI_FORMAT_ASTC_10X10_TYPELESS = 177;
const DXGI_FORMAT_ASTC_10X10_UNORM = 178;
const DXGI_FORMAT_ASTC_10X10_UNORM_SRGB = 179;
const DXGI_FORMAT_ASTC_12X10_TYPELESS = 181;
const DXGI_FORMAT_ASTC_12X10_UNORM = 182;
const DXGI_FORMAT_ASTC_12X10_UNORM_SRGB = 183;
const DXGI_FORMAT_ASTC_12X12_TYPELESS = 185;
const DXGI_FORMAT_ASTC_12X12_UNORM = 186;
const DXGI_FORMAT_ASTC_12X12_UNORM_SRGB = 187;
//< VRNET

const headerLengthInt = 31; // The header length in 32 bit ints

// Offsets into the header array
const off_magic = 0;

const off_size = 1;
const off_flags = 2;
const off_height = 3;
const off_width = 4;

const off_mipmapCount = 7;

const off_pfFlags = 20;
const off_pfFourCC = 21;
const off_RGBbpp = 22;
const off_RMask = 23;
const off_GMask = 24;
const off_BMask = 25;
const off_AMask = 26;
// var off_caps1 = 27;
const off_caps2 = 28;
// var off_caps3 = 29;
// var off_caps4 = 30;
const off_dxgiFormat = 32;

/**
 * Direct draw surface info
 * @see https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dx-graphics-dds-pguide
 */
export interface DDSInfo {
    /**
     * Width of the texture
     */
    width: number;
    /**
     * Width of the texture
     */
    height: number;
    /**
     * Number of Mipmaps for the texture
     * @see https://en.wikipedia.org/wiki/Mipmap
     */
    mipmapCount: number;
    /**
     * If the textures format is a known fourCC format
     * @see https://www.fourcc.org/
     */
    isFourCC: boolean;
    /**
     * If the texture is an RGB format eg. DXGI_FORMAT_B8G8R8X8_UNORM format
     */
    isRGB: boolean;
    /**
     * If the texture is a lumincance format
     */
    isLuminance: boolean;
    /**
     * If this is a cube texture
     * @see https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-file-layout-for-cubic-environment-maps
     */
    isCube: boolean;
    /**
     * If the texture is a compressed format eg. FOURCC_DXT1
     */
    isCompressed: boolean;
    /**
     * The dxgiFormat of the texture
     * @see https://docs.microsoft.com/en-us/windows/desktop/api/dxgiformat/ne-dxgiformat-dxgi_format
     */
    dxgiFormat: number;
    /**
     * Texture type eg. Engine.TEXTURETYPE_UNSIGNED_BYTE, Engine.TEXTURETYPE_FLOAT
     */
    textureType: number;
    /**
     * Sphericle polynomial created for the dds texture
     */
    sphericalPolynomial?: SphericalPolynomial;
}

/**
 * Class used to provide DDS decompression tools
 */
export class DDSTools {
    /**
     * Gets or sets a boolean indicating that LOD info is stored in alpha channel (false by default)
     */
    public static StoreLODInAlphaChannel = false;

    /**
     * Gets DDS information from an array buffer
     * @param data defines the array buffer view to read data from
     * @returns the DDS information
     */
    public static GetDDSInfo(data: ArrayBufferView): DDSInfo {
        const header = new Int32Array(data.buffer, data.byteOffset, headerLengthInt);
        const extendedHeader = new Int32Array(data.buffer, data.byteOffset, headerLengthInt + 4);

        let mipmapCount = 1;
        if (header[off_flags] & DDSD_MIPMAPCOUNT) {
            mipmapCount = Math.max(1, header[off_mipmapCount]);
        }

        const fourCC = header[off_pfFourCC];
        const dxgiFormat = fourCC === FOURCC_DX10 ? extendedHeader[off_dxgiFormat] : 0;
        let textureType = Constants.TEXTURETYPE_UNSIGNED_BYTE;

        switch (fourCC) {
            case FOURCC_D3DFMT_R16G16B16A16F:
                textureType = Constants.TEXTURETYPE_HALF_FLOAT;
                break;
            case FOURCC_D3DFMT_R32G32B32A32F:
                textureType = Constants.TEXTURETYPE_FLOAT;
                break;
            case FOURCC_DX10:
                if (dxgiFormat === DXGI_FORMAT_R16G16B16A16_FLOAT) {
                    textureType = Constants.TEXTURETYPE_HALF_FLOAT;
                    break;
                }
                if (dxgiFormat === DXGI_FORMAT_R32G32B32A32_FLOAT) {
                    textureType = Constants.TEXTURETYPE_FLOAT;
                    break;
                }

                //> VRNET
                if (
                    dxgiFormat === DXGI_FORMAT_BC7_UNORM ||
                    dxgiFormat === DXGI_FORMAT_BC7_UNORM_SRGB ||
                    DXGI_FORMAT_ASTC_4X4_TYPELESS ||
                    dxgiFormat === DXGI_FORMAT_ASTC_4X4_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_4X4_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_5X4_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_5X4_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_5X5_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_5X5_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_6X5_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_6X5_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_6X6_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_6X6_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X5_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X5_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X6_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X6_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X8_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_8X8_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X5_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X5_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X6_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X6_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X8_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X8_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X10_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_10X10_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_12X10_UNORM ||
                    dxgiFormat === DXGI_FORMAT_ASTC_12X10_UNORM_SRGB ||
                    dxgiFormat === DXGI_FORMAT_ASTC_12X12_UNORM
                ) {
                    textureType = Constants.TEXTURETYPE_UNSIGNED_INT;
                    break;
                } else if (
                    dxgiFormat === DXGI_FORMAT_BC6H_UF16 ||
                    dxgiFormat === DXGI_FORMAT_BC6H_SF16 ||
                    DXGI_FORMAT_ASTC_4X4_TYPELESS ||
                    DXGI_FORMAT_ASTC_5X4_TYPELESS ||
                    DXGI_FORMAT_ASTC_5X5_TYPELESS ||
                    DXGI_FORMAT_ASTC_6X5_TYPELESS ||
                    DXGI_FORMAT_ASTC_6X6_TYPELESS ||
                    DXGI_FORMAT_ASTC_8X5_TYPELESS ||
                    DXGI_FORMAT_ASTC_8X6_TYPELESS ||
                    DXGI_FORMAT_ASTC_8X8_TYPELESS ||
                    DXGI_FORMAT_ASTC_10X5_TYPELESS ||
                    DXGI_FORMAT_ASTC_10X6_TYPELESS ||
                    DXGI_FORMAT_ASTC_10X8_TYPELESS ||
                    DXGI_FORMAT_ASTC_10X10_TYPELESS ||
                    DXGI_FORMAT_ASTC_12X10_TYPELESS ||
                    DXGI_FORMAT_ASTC_12X12_TYPELESS
                ) {
                    textureType = Constants.TEXTURETYPE_FLOAT;
                    break;
                }
            //< VRNET
        }

        return {
            width: header[off_width],
            height: header[off_height],
            mipmapCount: mipmapCount,
            isFourCC: (header[off_pfFlags] & DDPF_FOURCC) === DDPF_FOURCC,
            isRGB: (header[off_pfFlags] & DDPF_RGB) === DDPF_RGB,
            isLuminance: (header[off_pfFlags] & DDPF_LUMINANCE) === DDPF_LUMINANCE,
            isCube: (header[off_caps2] & DDSCAPS2_CUBEMAP) === DDSCAPS2_CUBEMAP,
            isCompressed:
                fourCC === FOURCC_DXT1 ||
                fourCC === FOURCC_DXT3 ||
                fourCC === FOURCC_DXT5 ||
                //> VRNET
                (fourCC === FOURCC_DX10 && dxgiFormat >= DXGI_FORMAT_BC6H_UF16 && dxgiFormat <= DXGI_FORMAT_ASTC_12X12_UNORM_SRGB),
            //< VRNET
            dxgiFormat: dxgiFormat,
            textureType: textureType,
        };
    }

    private static _GetHalfFloatAsFloatRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Float32Array {
        const destArray = new Float32Array(dataLength);
        const srcData = new Uint16Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (x + y * width) * 4;
                destArray[index] = FromHalfFloat(srcData[srcPos]);
                destArray[index + 1] = FromHalfFloat(srcData[srcPos + 1]);
                destArray[index + 2] = FromHalfFloat(srcData[srcPos + 2]);
                if (DDSTools.StoreLODInAlphaChannel) {
                    destArray[index + 3] = lod;
                } else {
                    destArray[index + 3] = FromHalfFloat(srcData[srcPos + 3]);
                }
                index += 4;
            }
        }

        return destArray;
    }

    private static _GetHalfFloatRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Uint16Array {
        if (DDSTools.StoreLODInAlphaChannel) {
            const destArray = new Uint16Array(dataLength);
            const srcData = new Uint16Array(arrayBuffer, dataOffset);
            let index = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcPos = (x + y * width) * 4;
                    destArray[index] = srcData[srcPos];
                    destArray[index + 1] = srcData[srcPos + 1];
                    destArray[index + 2] = srcData[srcPos + 2];
                    destArray[index + 3] = ToHalfFloat(lod);
                    index += 4;
                }
            }

            return destArray;
        }

        return new Uint16Array(arrayBuffer, dataOffset, dataLength);
    }

    private static _GetFloatRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Float32Array {
        if (DDSTools.StoreLODInAlphaChannel) {
            const destArray = new Float32Array(dataLength);
            const srcData = new Float32Array(arrayBuffer, dataOffset);
            let index = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcPos = (x + y * width) * 4;
                    destArray[index] = srcData[srcPos];
                    destArray[index + 1] = srcData[srcPos + 1];
                    destArray[index + 2] = srcData[srcPos + 2];
                    destArray[index + 3] = lod;
                    index += 4;
                }
            }

            return destArray;
        }
        return new Float32Array(arrayBuffer, dataOffset, dataLength);
    }

    private static _GetFloatAsHalfFloatRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Uint16Array {
        const destArray = new Uint16Array(dataLength);
        const srcData = new Float32Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                destArray[index] = ToHalfFloat(srcData[index]);
                destArray[index + 1] = ToHalfFloat(srcData[index + 1]);
                destArray[index + 2] = ToHalfFloat(srcData[index + 2]);
                if (DDSTools.StoreLODInAlphaChannel) {
                    destArray[index + 3] = ToHalfFloat(lod);
                } else {
                    destArray[index + 3] = ToHalfFloat(srcData[index + 3]);
                }
                index += 4;
            }
        }

        return destArray;
    }

    private static _GetFloatAsUIntRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Uint8Array {
        const destArray = new Uint8Array(dataLength);
        const srcData = new Float32Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (x + y * width) * 4;
                destArray[index] = Clamp(srcData[srcPos]) * 255;
                destArray[index + 1] = Clamp(srcData[srcPos + 1]) * 255;
                destArray[index + 2] = Clamp(srcData[srcPos + 2]) * 255;
                if (DDSTools.StoreLODInAlphaChannel) {
                    destArray[index + 3] = lod;
                } else {
                    destArray[index + 3] = Clamp(srcData[srcPos + 3]) * 255;
                }
                index += 4;
            }
        }

        return destArray;
    }

    private static _GetHalfFloatAsUIntRGBAArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number): Uint8Array {
        const destArray = new Uint8Array(dataLength);
        const srcData = new Uint16Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (x + y * width) * 4;
                destArray[index] = Clamp(FromHalfFloat(srcData[srcPos])) * 255;
                destArray[index + 1] = Clamp(FromHalfFloat(srcData[srcPos + 1])) * 255;
                destArray[index + 2] = Clamp(FromHalfFloat(srcData[srcPos + 2])) * 255;
                if (DDSTools.StoreLODInAlphaChannel) {
                    destArray[index + 3] = lod;
                } else {
                    destArray[index + 3] = Clamp(FromHalfFloat(srcData[srcPos + 3])) * 255;
                }
                index += 4;
            }
        }

        return destArray;
    }

    private static _GetRGBAArrayBuffer(
        width: number,
        height: number,
        dataOffset: number,
        dataLength: number,
        arrayBuffer: ArrayBuffer,
        rOffset: number,
        gOffset: number,
        bOffset: number,
        aOffset: number
    ): Uint8Array {
        const byteArray = new Uint8Array(dataLength);
        const srcData = new Uint8Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (x + y * width) * 4;

                byteArray[index] = srcData[srcPos + rOffset];
                byteArray[index + 1] = srcData[srcPos + gOffset];
                byteArray[index + 2] = srcData[srcPos + bOffset];
                byteArray[index + 3] = srcData[srcPos + aOffset];
                index += 4;
            }
        }

        return byteArray;
    }

    private static _ExtractLongWordOrder(value: number): number {
        if (value === 0 || value === 255 || value === -16777216) {
            return 0;
        }

        return 1 + DDSTools._ExtractLongWordOrder(value >> 8);
    }

    private static _GetRGBArrayBuffer(
        width: number,
        height: number,
        dataOffset: number,
        dataLength: number,
        arrayBuffer: ArrayBuffer,
        rOffset: number,
        gOffset: number,
        bOffset: number
    ): Uint8Array {
        const byteArray = new Uint8Array(dataLength);
        const srcData = new Uint8Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (x + y * width) * 3;

                byteArray[index] = srcData[srcPos + rOffset];
                byteArray[index + 1] = srcData[srcPos + gOffset];
                byteArray[index + 2] = srcData[srcPos + bOffset];
                index += 3;
            }
        }

        return byteArray;
    }

    private static _GetLuminanceArrayBuffer(width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer): Uint8Array {
        const byteArray = new Uint8Array(dataLength);
        const srcData = new Uint8Array(arrayBuffer, dataOffset);
        let index = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = x + y * width;
                byteArray[index] = srcData[srcPos];
                index++;
            }
        }

        return byteArray;
    }

    public static async UploadDDSLevelsAsync(
        engine: AbstractEngine,
        texture: InternalTexture,
        hardwareTexture: HardwareTextureWrapper,
        data: ArrayBufferView,
        info: DDSInfo,
        bytesInBlock: number,
        loadMipmaps: boolean,
        faces: number,
        lodIndex = -1,
        currentFace?: number,
        destTypeMustBeFilterable = true
    ): Promise<void> {
        let sphericalPolynomialFaces: Nullable<Array<ArrayBufferView>> = null;
        if (info.sphericalPolynomial) {
            sphericalPolynomialFaces = [] as ArrayBufferView[];
        }
        // ensure support for all formats
        const ext = !!engine.getCaps().s3tc || !!engine.getCaps().astc || !!engine.getCaps().bptc;

        // TODO WEBGPU Once generateMipMaps is split into generateMipMaps + hasMipMaps in InternalTexture this line can be removed
        texture.generateMipMaps = loadMipmaps;

        const header = new Int32Array(data.buffer, data.byteOffset, headerLengthInt);
        let fourCC: number,
            width: number,
            height: number,
            dataLength: number = 0,
            dataOffset: number;
        let byteArray: Uint8Array, mipmapCount: number, mip: number;
        let internalCompressedFormat = 0;
        let blockBytes = 1;

        if (header[off_magic] !== DDS_MAGIC) {
            Logger.Error("Invalid magic number in DDS header");
            return;
        }

        if (!info.isFourCC && !info.isRGB && !info.isLuminance) {
            Logger.Error("Unsupported format, must contain a FourCC, RGB or LUMINANCE code");
            return;
        }

        if (info.isCompressed && !ext) {
            Logger.Error("Compressed textures are not supported on this platform.");
            return;
        }

        let wBlockSize = 4;
        let hBlockSize = 4;
        let bpp = header[off_RGBbpp];
        dataOffset = header[off_size] + 4;

        let computeFormats = false;

        if (info.isFourCC) {
            fourCC = header[off_pfFourCC];
            switch (fourCC) {
                case FOURCC_DXT1:
                    blockBytes = 8;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT1;
                    break;
                case FOURCC_DXT3:
                    blockBytes = 16;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT3;
                    break;
                case FOURCC_DXT5:
                    blockBytes = 16;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT5;
                    break;
                case FOURCC_D3DFMT_R16G16B16A16F:
                    computeFormats = true;
                    bpp = 64;
                    break;
                case FOURCC_D3DFMT_R32G32B32A32F:
                    computeFormats = true;
                    bpp = 128;
                    break;
                case FOURCC_DX10: {
                    // There is an additionnal header so dataOffset need to be changed
                    dataOffset += 5 * 4; // 5 uints

                    let supported = false;
                    switch (info.dxgiFormat) {
                        case DXGI_FORMAT_R16G16B16A16_FLOAT:
                            computeFormats = true;
                            bpp = 64;
                            supported = true;
                            break;
                        case DXGI_FORMAT_R32G32B32A32_FLOAT:
                            computeFormats = true;
                            bpp = 128;
                            supported = true;
                            break;
                        case DXGI_FORMAT_B8G8R8X8_UNORM:
                            info.isRGB = true;
                            info.isFourCC = false;
                            bpp = 32;
                            supported = true;
                            break;

                        //> VRNET
                        /*
public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x10_KHR = 37819;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x5_KHR = 37816;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x6_KHR = 37817;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x8_KHR = 37818;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x10_KHR = 37820;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x12_KHR = 37821;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_4x4_KHR = 37808;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x4_KHR = 37809;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x5_KHR = 37810;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x5_KHR = 37811;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x6_KHR = 37812;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x5_KHR = 37813;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x6_KHR = 37814;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x8_KHR = 37815;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR = 37851;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR = 37848;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR = 37849;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR = 37850;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR = 37852;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR = 37853;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 37840;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR = 37841;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR = 37842;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR = 37843;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR = 37844;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR = 37845;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR = 37846;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR = 37847;

    
const DXGI_FORMAT_ASTC_4X4_TYPELESS    = 133;
const DXGI_FORMAT_ASTC_4X4_UNORM     = 134;
const DXGI_FORMAT_ASTC_4X4_UNORM_SRGB    = 135;
const DXGI_FORMAT_ASTC_5X4_TYPELESS    = 137;
const DXGI_FORMAT_ASTC_5X4_UNORM     = 138;
const DXGI_FORMAT_ASTC_5X4_UNORM_SRGB    = 139;
const DXGI_FORMAT_ASTC_5X5_TYPELESS    = 141;
const DXGI_FORMAT_ASTC_5X5_UNORM     = 142;
const DXGI_FORMAT_ASTC_5X5_UNORM_SRGB    = 143;
const DXGI_FORMAT_ASTC_6X5_TYPELESS    = 145;
const DXGI_FORMAT_ASTC_6X5_UNORM     = 146;
const DXGI_FORMAT_ASTC_6X5_UNORM_SRGB    = 147;
const DXGI_FORMAT_ASTC_6X6_TYPELESS    = 149;
const DXGI_FORMAT_ASTC_6X6_UNORM     = 150;
const DXGI_FORMAT_ASTC_6X6_UNORM_SRGB    = 151;
const DXGI_FORMAT_ASTC_8X5_TYPELESS    = 153;
const DXGI_FORMAT_ASTC_8X5_UNORM     = 154;
const DXGI_FORMAT_ASTC_8X5_UNORM_SRGB    = 155;
const DXGI_FORMAT_ASTC_8X6_TYPELESS    = 157;
const DXGI_FORMAT_ASTC_8X6_UNORM    = 158;
const DXGI_FORMAT_ASTC_8X6_UNORM_SRGB   = 159;
const DXGI_FORMAT_ASTC_8X8_TYPELESS    = 161;
const DXGI_FORMAT_ASTC_8X8_UNORM    = 162;
const DXGI_FORMAT_ASTC_8X8_UNORM_SRGB   = 163;
const DXGI_FORMAT_ASTC_10X5_TYPELESS   = 165;
const DXGI_FORMAT_ASTC_10X5_UNORM    = 166;
const DXGI_FORMAT_ASTC_10X5_UNORM_SRGB   = 167;
const DXGI_FORMAT_ASTC_10X6_TYPELESS   = 169;
const DXGI_FORMAT_ASTC_10X6_UNORM    = 170;
const DXGI_FORMAT_ASTC_10X6_UNORM_SRGB   = 171;
const DXGI_FORMAT_ASTC_10X8_TYPELESS   = 173;
const DXGI_FORMAT_ASTC_10X8_UNORM    = 174;
const DXGI_FORMAT_ASTC_10X8_UNORM_SRGB   = 175;
const DXGI_FORMAT_ASTC_10X10_TYPELESS   = 177;
const DXGI_FORMAT_ASTC_10X10_UNORM    = 178;
const DXGI_FORMAT_ASTC_10X10_UNORM_SRGB   = 179;
const DXGI_FORMAT_ASTC_12X10_TYPELESS   = 181;
const DXGI_FORMAT_ASTC_12X10_UNORM    = 182;
const DXGI_FORMAT_ASTC_12X10_UNORM_SRGB   = 183;
const DXGI_FORMAT_ASTC_12X12_TYPELESS   = 185;
const DXGI_FORMAT_ASTC_12X12_UNORM    = 186;
const DXGI_FORMAT_ASTC_12X12_UNORM_SRGB   = 187;
*/
                        case DXGI_FORMAT_ASTC_6X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_6X6_UNORM:
                            wBlockSize = 6;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_4X4_TYPELESS:
                        case DXGI_FORMAT_ASTC_4X4_UNORM:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_4x4_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_5X4_TYPELESS:
                        case DXGI_FORMAT_ASTC_5X4_UNORM:
                            wBlockSize = 5;
                            hBlockSize = 4;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x4_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_5X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_5X5_UNORM:
                            wBlockSize = 5;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_6X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_6X5_UNORM:
                            wBlockSize = 6;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X5_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X6_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X8_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X8_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 8;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x8_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X5_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X6_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X8_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X8_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 8;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x8_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X10_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X10_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 10;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x10_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_12X10_TYPELESS:
                        case DXGI_FORMAT_ASTC_12X10_UNORM:
                            wBlockSize = 12;
                            hBlockSize = 10;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x10_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_12X12_TYPELESS:
                        case DXGI_FORMAT_ASTC_12X12_UNORM:
                            wBlockSize = 12;
                            hBlockSize = 12;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x12_KHR;
                            break;
                        case DXGI_FORMAT_BC7_UNORM:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_BPTC_UNORM_EXT;
                            break;
                        case DXGI_FORMAT_BC7_UNORM_SRGB:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT;
                            break;
                        case DXGI_FORMAT_BC6H_UF16:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
                            break;
                        case DXGI_FORMAT_BC6H_SF16:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
                            break;
                        //< VRNET
                    }

                    if (supported) {
                        break;
                    }
                }
                // eslint-disable-next-line no-fallthrough
                default:
                    Logger.Error(["Unsupported FourCC code:", Int32ToFourCC(fourCC)]);
                    return;
            }
        }

        const rOffset = DDSTools._ExtractLongWordOrder(header[off_RMask]);
        const gOffset = DDSTools._ExtractLongWordOrder(header[off_GMask]);
        const bOffset = DDSTools._ExtractLongWordOrder(header[off_BMask]);
        const aOffset = DDSTools._ExtractLongWordOrder(header[off_AMask]);

        if (computeFormats) {
            internalCompressedFormat = engine._getRGBABufferInternalSizedFormat(info.textureType);
        }

        mipmapCount = 1;
        if (header[off_flags] & DDSD_MIPMAPCOUNT && loadMipmaps !== false) {
            mipmapCount = Math.max(1, header[off_mipmapCount]);
        }

        const startFace = currentFace || 0;
        const caps = engine.getCaps();
        const unpackAlignment = engine._getUnpackAlignement();

        const blockedLoading = { bytesInBlock, bytesLeft: bytesInBlock };

        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let face = startFace; face < faces; face++) {
            width = header[off_width];
            height = header[off_height];

            for (mip = 0; mip < mipmapCount; ++mip) {
                if (lodIndex === -1 || lodIndex === mip) {
                    // In case of fixed LOD, if the lod has just been uploaded, early exit.
                    const i = lodIndex === -1 ? mip : 0;

                    if (!info.isCompressed && info.isFourCC) {
                        texture.format = Constants.TEXTUREFORMAT_RGBA;
                        dataLength = width * height * 4;
                        let floatArray: Nullable<ArrayBufferView> = null;

                        if (engine._badOS || engine._badDesktopOS || (!caps.textureHalfFloat && !caps.textureFloat)) {
                            // Required because iOS has many issues with float and half float generation
                            if (bpp === 128) {
                                floatArray = DDSTools._GetFloatAsUIntRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);
                                if (sphericalPolynomialFaces && i == 0) {
                                    sphericalPolynomialFaces.push(DDSTools._GetFloatRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i));
                                }
                            } else if (bpp === 64) {
                                floatArray = DDSTools._GetHalfFloatAsUIntRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);
                                if (sphericalPolynomialFaces && i == 0) {
                                    sphericalPolynomialFaces.push(
                                        DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i)
                                    );
                                }
                            }

                            texture.type = Constants.TEXTURETYPE_UNSIGNED_INT;
                        } else {
                            const floatAvailable = caps.textureFloat && ((destTypeMustBeFilterable && caps.textureFloatLinearFiltering) || !destTypeMustBeFilterable);
                            const halfFloatAvailable = caps.textureHalfFloat && ((destTypeMustBeFilterable && caps.textureHalfFloatLinearFiltering) || !destTypeMustBeFilterable);

                            const destType =
                                (bpp === 128 || (bpp === 64 && !halfFloatAvailable)) && floatAvailable
                                    ? Constants.TEXTURETYPE_FLOAT
                                    : (bpp === 64 || (bpp === 128 && !floatAvailable)) && halfFloatAvailable
                                      ? Constants.TEXTURETYPE_HALF_FLOAT
                                      : Constants.TEXTURETYPE_UNSIGNED_BYTE;

                            let dataGetter: (width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number) => ArrayBufferView;
                            let dataGetterPolynomial: Nullable<
                                (width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number) => ArrayBufferView
                            > = null;

                            switch (bpp) {
                                case 128: {
                                    switch (destType) {
                                        case Constants.TEXTURETYPE_FLOAT:
                                            dataGetter = DDSTools._GetFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = null;
                                            break;
                                        case Constants.TEXTURETYPE_HALF_FLOAT:
                                            dataGetter = DDSTools._GetFloatAsHalfFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetFloatRGBAArrayBuffer;
                                            break;
                                        case Constants.TEXTURETYPE_UNSIGNED_BYTE:
                                            dataGetter = DDSTools._GetFloatAsUIntRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetFloatRGBAArrayBuffer;
                                            break;
                                    }
                                    break;
                                }
                                default: {
                                    // 64 bpp
                                    switch (destType) {
                                        case Constants.TEXTURETYPE_FLOAT:
                                            dataGetter = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = null;
                                            break;
                                        case Constants.TEXTURETYPE_HALF_FLOAT:
                                            dataGetter = DDSTools._GetHalfFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            break;
                                        case Constants.TEXTURETYPE_UNSIGNED_BYTE:
                                            dataGetter = DDSTools._GetHalfFloatAsUIntRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            break;
                                    }
                                    break;
                                }
                            }

                            texture.type = destType;

                            floatArray = dataGetter(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);

                            if (sphericalPolynomialFaces && i == 0) {
                                sphericalPolynomialFaces.push(
                                    dataGetterPolynomial ? dataGetterPolynomial(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i) : floatArray
                                );
                            }
                        }

                        if (floatArray) {
                            engine._uploadDataToTextureDirectly(texture, floatArray, face, i);
                        }
                    } else if (info.isRGB) {
                        texture.type = Constants.TEXTURETYPE_UNSIGNED_INT;
                        if (bpp === 24) {
                            texture.format = Constants.TEXTUREFORMAT_RGB;
                            dataLength = width * height * 3;
                            byteArray = DDSTools._GetRGBArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, rOffset, gOffset, bOffset);
                            engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                        } else {
                            // 32
                            texture.format = Constants.TEXTUREFORMAT_RGBA;
                            dataLength = width * height * 4;
                            byteArray = DDSTools._GetRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, rOffset, gOffset, bOffset, aOffset);
                            engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                        }
                    } else if (info.isLuminance) {
                        const unpaddedRowSize = width;
                        const paddedRowSize = Math.floor((width + unpackAlignment - 1) / unpackAlignment) * unpackAlignment;
                        dataLength = paddedRowSize * (height - 1) + unpaddedRowSize;

                        byteArray = DDSTools._GetLuminanceArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer);
                        texture.format = Constants.TEXTUREFORMAT_LUMINANCE;
                        texture.type = Constants.TEXTURETYPE_UNSIGNED_INT;

                        engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                    } else {
                        const blocksCountX = Math.ceil(width / wBlockSize);
                        const blocksCountY = Math.ceil(height / hBlockSize);
                        const bytesInBlockLine = blockBytes * blocksCountX;

                        dataLength = blocksCountX * blocksCountY * blockBytes;

                        if (blockedLoading.bytesLeft <= 0) {
                            await delay(0);
                            blockedLoading.bytesLeft = blockedLoading.bytesInBlock;
                        }

                        byteArray = new Uint8Array(data.buffer, data.byteOffset + dataOffset, dataLength);

                        texture.type = Constants.TEXTURETYPE_UNSIGNED_INT;

                        if (dataLength < blockedLoading.bytesLeft + blockedLoading.bytesInBlock * 0.3) {
                            // If texture meets the quota - loading without block splitting
                            await delay(0);
                            engine._uploadCompressedBlockToTextureDirectly(texture, hardwareTexture, internalCompressedFormat, false, width, height, 0, 0, byteArray, face, i);
                            blockedLoading.bytesLeft -= dataLength;
                        } else {
                            // Otherwise - loading with block splitting
                            engine._uploadCompressedBlockToTextureDirectly(
                                texture,
                                hardwareTexture,
                                internalCompressedFormat,
                                false,
                                width,
                                height,
                                0,
                                0,
                                new Uint8Array(dataLength),
                                face,
                                i
                            );
                            for (let loadedBlockLines = 0; ; ) {
                                const canLoadBlockLines = Math.min(Math.max(Math.floor(blockedLoading.bytesLeft / bytesInBlockLine), 1), blocksCountY - loadedBlockLines);
                                const newLoadedBlockLines = loadedBlockLines + canLoadBlockLines;
                                const loadedLines = Math.min(newLoadedBlockLines * hBlockSize, height) - loadedBlockLines * hBlockSize;
                                engine._uploadCompressedBlockToTextureDirectly(
                                    texture,
                                    hardwareTexture,
                                    internalCompressedFormat,
                                    true,
                                    width,
                                    loadedLines,
                                    0,
                                    loadedBlockLines * hBlockSize,
                                    new DataView(
                                        byteArray.buffer.slice(
                                            byteArray.byteOffset + loadedBlockLines * bytesInBlockLine,
                                            byteArray.byteOffset + newLoadedBlockLines * bytesInBlockLine
                                        )
                                    ),
                                    face,
                                    i
                                );

                                loadedBlockLines = newLoadedBlockLines;
                                blockedLoading.bytesLeft -= canLoadBlockLines * bytesInBlockLine;
                                if (loadedBlockLines < blocksCountY) {
                                    // Switching to frame rendering if not all blocks are loaded
                                    await delay(0);
                                    blockedLoading.bytesLeft = blockedLoading.bytesInBlock;
                                } else {
                                    // Stop loading when everything is loaded
                                    break;
                                }
                            }
                        }
                    }
                }
                dataOffset += bpp ? width * height * (bpp / 8) : dataLength;
                width *= 0.5;
                height *= 0.5;

                width = Math.max(1.0, width);
                height = Math.max(1.0, height);
            }

            if (currentFace !== undefined) {
                // Loading a single face
                break;
            }
        }
        if (sphericalPolynomialFaces && sphericalPolynomialFaces.length > 0) {
            info.sphericalPolynomial = CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial({
                size: header[off_width],
                right: sphericalPolynomialFaces[0],
                left: sphericalPolynomialFaces[1],
                up: sphericalPolynomialFaces[2],
                down: sphericalPolynomialFaces[3],
                front: sphericalPolynomialFaces[4],
                back: sphericalPolynomialFaces[5],
                format: Constants.TEXTUREFORMAT_RGBA,
                type: Constants.TEXTURETYPE_FLOAT,
                gammaSpace: false,
            });
        } else {
            info.sphericalPolynomial = undefined;
        }
    }

    /**
     * Uploads DDS Levels to a Babylon Texture
     * @internal
     */
    public static UploadDDSLevels(
        engine: AbstractEngine,
        texture: InternalTexture,
        data: ArrayBufferView,
        info: DDSInfo,
        loadMipmaps: boolean,
        faces: number,
        lodIndex = -1,
        currentFace?: number,
        destTypeMustBeFilterable = true
    ) {
        let sphericalPolynomialFaces: Nullable<Array<ArrayBufferView>> = null;
        if (info.sphericalPolynomial) {
            sphericalPolynomialFaces = [] as ArrayBufferView[];
        }
        // ensure support for all formats
        const ext = !!engine.getCaps().s3tc || !!engine.getCaps().astc || !!engine.getCaps().bptc;

        // TODO WEBGPU Once generateMipMaps is split into generateMipMaps + hasMipMaps in InternalTexture this line can be removed
        texture.generateMipMaps = loadMipmaps;

        const header = new Int32Array(data.buffer, data.byteOffset, headerLengthInt);
        let fourCC: number,
            width: number,
            height: number,
            dataLength: number = 0,
            dataOffset: number;
        let byteArray: Uint8Array, mipmapCount: number, mip: number;
        let internalCompressedFormat = 0;
        let blockBytes = 1;

        if (header[off_magic] !== DDS_MAGIC) {
            Logger.Error("Invalid magic number in DDS header");
            return;
        }

        if (!info.isFourCC && !info.isRGB && !info.isLuminance) {
            Logger.Error("Unsupported format, must contain a FourCC, RGB or LUMINANCE code");
            return;
        }

        if (info.isCompressed && !ext) {
            Logger.Error("Compressed textures are not supported on this platform.");
            return;
        }

        let wBlockSize = 4;
        let hBlockSize = 4;
        let bpp = header[off_RGBbpp];
        dataOffset = header[off_size] + 4;

        let computeFormats = false;

        if (info.isFourCC) {
            fourCC = header[off_pfFourCC];
            switch (fourCC) {
                case FOURCC_DXT1:
                    blockBytes = 8;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT1;
                    break;
                case FOURCC_DXT3:
                    blockBytes = 16;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT3;
                    break;
                case FOURCC_DXT5:
                    blockBytes = 16;
                    internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT5;
                    break;
                case FOURCC_D3DFMT_R16G16B16A16F:
                    computeFormats = true;
                    bpp = 64;
                    break;
                case FOURCC_D3DFMT_R32G32B32A32F:
                    computeFormats = true;
                    bpp = 128;
                    break;
                case FOURCC_DX10: {
                    // There is an additionnal header so dataOffset need to be changed
                    dataOffset += 5 * 4; // 5 uints

                    let supported = false;
                    switch (info.dxgiFormat) {
                        case DXGI_FORMAT_R16G16B16A16_FLOAT:
                            computeFormats = true;
                            bpp = 64;
                            supported = true;
                            break;
                        case DXGI_FORMAT_R32G32B32A32_FLOAT:
                            computeFormats = true;
                            bpp = 128;
                            supported = true;
                            break;
                        case DXGI_FORMAT_B8G8R8X8_UNORM:
                            info.isRGB = true;
                            info.isFourCC = false;
                            bpp = 32;
                            supported = true;
                            break;

                        //> VRNET
                        /*
public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x10_KHR = 37819;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x5_KHR = 37816;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x6_KHR = 37817;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x8_KHR = 37818;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x10_KHR = 37820;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x12_KHR = 37821;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_4x4_KHR = 37808;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x4_KHR = 37809;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x5_KHR = 37810;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x5_KHR = 37811;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x6_KHR = 37812;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x5_KHR = 37813;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x6_KHR = 37814;
    public static readonly TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x8_KHR = 37815;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR = 37851;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR = 37848;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR = 37849;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR = 37850;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR = 37852;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR = 37853;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR = 37840;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR = 37841;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR = 37842;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR = 37843;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR = 37844;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR = 37845;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR = 37846;
    public static readonly TEXTUREFORMAT_COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR = 37847;

    
const DXGI_FORMAT_ASTC_4X4_TYPELESS    = 133;
const DXGI_FORMAT_ASTC_4X4_UNORM     = 134;
const DXGI_FORMAT_ASTC_4X4_UNORM_SRGB    = 135;
const DXGI_FORMAT_ASTC_5X4_TYPELESS    = 137;
const DXGI_FORMAT_ASTC_5X4_UNORM     = 138;
const DXGI_FORMAT_ASTC_5X4_UNORM_SRGB    = 139;
const DXGI_FORMAT_ASTC_5X5_TYPELESS    = 141;
const DXGI_FORMAT_ASTC_5X5_UNORM     = 142;
const DXGI_FORMAT_ASTC_5X5_UNORM_SRGB    = 143;
const DXGI_FORMAT_ASTC_6X5_TYPELESS    = 145;
const DXGI_FORMAT_ASTC_6X5_UNORM     = 146;
const DXGI_FORMAT_ASTC_6X5_UNORM_SRGB    = 147;
const DXGI_FORMAT_ASTC_6X6_TYPELESS    = 149;
const DXGI_FORMAT_ASTC_6X6_UNORM     = 150;
const DXGI_FORMAT_ASTC_6X6_UNORM_SRGB    = 151;
const DXGI_FORMAT_ASTC_8X5_TYPELESS    = 153;
const DXGI_FORMAT_ASTC_8X5_UNORM     = 154;
const DXGI_FORMAT_ASTC_8X5_UNORM_SRGB    = 155;
const DXGI_FORMAT_ASTC_8X6_TYPELESS    = 157;
const DXGI_FORMAT_ASTC_8X6_UNORM    = 158;
const DXGI_FORMAT_ASTC_8X6_UNORM_SRGB   = 159;
const DXGI_FORMAT_ASTC_8X8_TYPELESS    = 161;
const DXGI_FORMAT_ASTC_8X8_UNORM    = 162;
const DXGI_FORMAT_ASTC_8X8_UNORM_SRGB   = 163;
const DXGI_FORMAT_ASTC_10X5_TYPELESS   = 165;
const DXGI_FORMAT_ASTC_10X5_UNORM    = 166;
const DXGI_FORMAT_ASTC_10X5_UNORM_SRGB   = 167;
const DXGI_FORMAT_ASTC_10X6_TYPELESS   = 169;
const DXGI_FORMAT_ASTC_10X6_UNORM    = 170;
const DXGI_FORMAT_ASTC_10X6_UNORM_SRGB   = 171;
const DXGI_FORMAT_ASTC_10X8_TYPELESS   = 173;
const DXGI_FORMAT_ASTC_10X8_UNORM    = 174;
const DXGI_FORMAT_ASTC_10X8_UNORM_SRGB   = 175;
const DXGI_FORMAT_ASTC_10X10_TYPELESS   = 177;
const DXGI_FORMAT_ASTC_10X10_UNORM    = 178;
const DXGI_FORMAT_ASTC_10X10_UNORM_SRGB   = 179;
const DXGI_FORMAT_ASTC_12X10_TYPELESS   = 181;
const DXGI_FORMAT_ASTC_12X10_UNORM    = 182;
const DXGI_FORMAT_ASTC_12X10_UNORM_SRGB   = 183;
const DXGI_FORMAT_ASTC_12X12_TYPELESS   = 185;
const DXGI_FORMAT_ASTC_12X12_UNORM    = 186;
const DXGI_FORMAT_ASTC_12X12_UNORM_SRGB   = 187;
*/
                        case DXGI_FORMAT_ASTC_6X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_6X6_UNORM:
                            wBlockSize = 6;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_4X4_TYPELESS:
                        case DXGI_FORMAT_ASTC_4X4_UNORM:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_4x4_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_5X4_TYPELESS:
                        case DXGI_FORMAT_ASTC_5X4_UNORM:
                            wBlockSize = 5;
                            hBlockSize = 4;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x4_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_5X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_5X5_UNORM:
                            wBlockSize = 5;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_5x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_6X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_6X5_UNORM:
                            wBlockSize = 6;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_6x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X5_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X6_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_8X8_TYPELESS:
                        case DXGI_FORMAT_ASTC_8X8_UNORM:
                            wBlockSize = 8;
                            hBlockSize = 8;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_8x8_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X5_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X5_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 5;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x5_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X6_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X6_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 6;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x6_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X8_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X8_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 8;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x8_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_10X10_TYPELESS:
                        case DXGI_FORMAT_ASTC_10X10_UNORM:
                            wBlockSize = 10;
                            hBlockSize = 10;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_10x10_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_12X10_TYPELESS:
                        case DXGI_FORMAT_ASTC_12X10_UNORM:
                            wBlockSize = 12;
                            hBlockSize = 10;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x10_KHR;
                            break;
                        case DXGI_FORMAT_ASTC_12X12_TYPELESS:
                        case DXGI_FORMAT_ASTC_12X12_UNORM:
                            wBlockSize = 12;
                            hBlockSize = 12;
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_ASTC_12x12_KHR;
                            break;
                        case DXGI_FORMAT_BC7_UNORM:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGBA_BPTC_UNORM_EXT;
                            break;
                        case DXGI_FORMAT_BC7_UNORM_SRGB:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT;
                            break;
                        case DXGI_FORMAT_BC6H_UF16:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
                            break;
                        case DXGI_FORMAT_BC6H_SF16:
                            supported = true;
                            blockBytes = 16;
                            internalCompressedFormat = Constants.TEXTUREFORMAT_COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
                            break;
                        //< VRNET
                    }

                    if (supported) {
                        break;
                    }
                }
                // eslint-disable-next-line no-fallthrough
                default:
                    Logger.Error(["Unsupported FourCC code:", Int32ToFourCC(fourCC)]);
                    return;
            }
        }

        const rOffset = DDSTools._ExtractLongWordOrder(header[off_RMask]);
        const gOffset = DDSTools._ExtractLongWordOrder(header[off_GMask]);
        const bOffset = DDSTools._ExtractLongWordOrder(header[off_BMask]);
        const aOffset = DDSTools._ExtractLongWordOrder(header[off_AMask]);

        if (computeFormats) {
            internalCompressedFormat = engine._getRGBABufferInternalSizedFormat(info.textureType);
        }

        mipmapCount = 1;
        if (header[off_flags] & DDSD_MIPMAPCOUNT && loadMipmaps !== false) {
            mipmapCount = Math.max(1, header[off_mipmapCount]);
        }

        const startFace = currentFace || 0;
        const caps = engine.getCaps();
        for (let face = startFace; face < faces; face++) {
            width = header[off_width];
            height = header[off_height];

            for (mip = 0; mip < mipmapCount; ++mip) {
                if (lodIndex === -1 || lodIndex === mip) {
                    // In case of fixed LOD, if the lod has just been uploaded, early exit.
                    const i = lodIndex === -1 ? mip : 0;

                    if (!info.isCompressed && info.isFourCC) {
                        texture.format = Constants.TEXTUREFORMAT_RGBA;
                        dataLength = width * height * 4;
                        let floatArray: Nullable<ArrayBufferView> = null;

                        if (engine._badOS || engine._badDesktopOS || (!caps.textureHalfFloat && !caps.textureFloat)) {
                            // Required because iOS has many issues with float and half float generation
                            if (bpp === 128) {
                                floatArray = DDSTools._GetFloatAsUIntRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);
                                if (sphericalPolynomialFaces && i == 0) {
                                    sphericalPolynomialFaces.push(DDSTools._GetFloatRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i));
                                }
                            } else if (bpp === 64) {
                                floatArray = DDSTools._GetHalfFloatAsUIntRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);
                                if (sphericalPolynomialFaces && i == 0) {
                                    sphericalPolynomialFaces.push(
                                        DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i)
                                    );
                                }
                            }

                            texture.type = Constants.TEXTURETYPE_UNSIGNED_BYTE;
                        } else {
                            const floatAvailable = caps.textureFloat && ((destTypeMustBeFilterable && caps.textureFloatLinearFiltering) || !destTypeMustBeFilterable);
                            const halfFloatAvailable = caps.textureHalfFloat && ((destTypeMustBeFilterable && caps.textureHalfFloatLinearFiltering) || !destTypeMustBeFilterable);

                            const destType =
                                (bpp === 128 || (bpp === 64 && !halfFloatAvailable)) && floatAvailable
                                    ? Constants.TEXTURETYPE_FLOAT
                                    : (bpp === 64 || (bpp === 128 && !floatAvailable)) && halfFloatAvailable
                                      ? Constants.TEXTURETYPE_HALF_FLOAT
                                      : Constants.TEXTURETYPE_UNSIGNED_BYTE;

                            let dataGetter: (width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number) => ArrayBufferView;
                            let dataGetterPolynomial: Nullable<
                                (width: number, height: number, dataOffset: number, dataLength: number, arrayBuffer: ArrayBuffer, lod: number) => ArrayBufferView
                            > = null;

                            switch (bpp) {
                                case 128: {
                                    switch (destType) {
                                        case Constants.TEXTURETYPE_FLOAT:
                                            dataGetter = DDSTools._GetFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = null;
                                            break;
                                        case Constants.TEXTURETYPE_HALF_FLOAT:
                                            dataGetter = DDSTools._GetFloatAsHalfFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetFloatRGBAArrayBuffer;
                                            break;
                                        case Constants.TEXTURETYPE_UNSIGNED_BYTE:
                                            dataGetter = DDSTools._GetFloatAsUIntRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetFloatRGBAArrayBuffer;
                                            break;
                                    }
                                    break;
                                }
                                default: {
                                    // 64 bpp
                                    switch (destType) {
                                        case Constants.TEXTURETYPE_FLOAT:
                                            dataGetter = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = null;
                                            break;
                                        case Constants.TEXTURETYPE_HALF_FLOAT:
                                            dataGetter = DDSTools._GetHalfFloatRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            break;
                                        case Constants.TEXTURETYPE_UNSIGNED_BYTE:
                                            dataGetter = DDSTools._GetHalfFloatAsUIntRGBAArrayBuffer;
                                            dataGetterPolynomial = DDSTools._GetHalfFloatAsFloatRGBAArrayBuffer;
                                            break;
                                    }
                                    break;
                                }
                            }

                            texture.type = destType;

                            floatArray = dataGetter(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i);

                            if (sphericalPolynomialFaces && i == 0) {
                                sphericalPolynomialFaces.push(
                                    dataGetterPolynomial ? dataGetterPolynomial(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, i) : floatArray
                                );
                            }
                        }

                        if (floatArray) {
                            engine._uploadDataToTextureDirectly(texture, floatArray, face, i);
                        }
                    } else if (info.isRGB) {
                        texture.type = Constants.TEXTURETYPE_UNSIGNED_BYTE;
                        if (bpp === 24) {
                            texture.format = Constants.TEXTUREFORMAT_RGB;
                            dataLength = width * height * 3;
                            byteArray = DDSTools._GetRGBArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, rOffset, gOffset, bOffset);
                            engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                        } else {
                            // 32
                            texture.format = Constants.TEXTUREFORMAT_RGBA;
                            dataLength = width * height * 4;
                            byteArray = DDSTools._GetRGBAArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer, rOffset, gOffset, bOffset, aOffset);
                            engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                        }
                    } else if (info.isLuminance) {
                        const unpackAlignment = engine._getUnpackAlignement();
                        const unpaddedRowSize = width;
                        const paddedRowSize = Math.floor((width + unpackAlignment - 1) / unpackAlignment) * unpackAlignment;
                        dataLength = paddedRowSize * (height - 1) + unpaddedRowSize;

                        byteArray = DDSTools._GetLuminanceArrayBuffer(width, height, data.byteOffset + dataOffset, dataLength, data.buffer);
                        texture.format = Constants.TEXTUREFORMAT_LUMINANCE;
                        texture.type = Constants.TEXTURETYPE_UNSIGNED_BYTE;

                        engine._uploadDataToTextureDirectly(texture, byteArray, face, i);
                    } else {
                        dataLength = Math.ceil(width / wBlockSize) * Math.ceil(height / hBlockSize) * blockBytes;
                        //dataLength = (((Math.max(4, width) / 4) * Math.max(4, height)) / 4) * blockBytes;
                        byteArray = new Uint8Array(data.buffer, data.byteOffset + dataOffset, dataLength);

                        texture.type = Constants.TEXTURETYPE_UNSIGNED_BYTE;
                        engine._uploadCompressedDataToTextureDirectly(texture, internalCompressedFormat, width, height, byteArray, face, i);
                    }
                }
                dataOffset += bpp ? width * height * (bpp / 8) : dataLength;
                width *= 0.5;
                height *= 0.5;

                width = Math.max(1.0, width);
                height = Math.max(1.0, height);
            }

            if (currentFace !== undefined) {
                // Loading a single face
                break;
            }
        }
        if (sphericalPolynomialFaces && sphericalPolynomialFaces.length > 0) {
            info.sphericalPolynomial = CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial({
                size: header[off_width],
                right: sphericalPolynomialFaces[0],
                left: sphericalPolynomialFaces[1],
                up: sphericalPolynomialFaces[2],
                down: sphericalPolynomialFaces[3],
                front: sphericalPolynomialFaces[4],
                back: sphericalPolynomialFaces[5],
                format: Constants.TEXTUREFORMAT_RGBA,
                type: Constants.TEXTURETYPE_FLOAT,
                gammaSpace: false,
            });
        } else {
            info.sphericalPolynomial = undefined;
        }
    }
}
