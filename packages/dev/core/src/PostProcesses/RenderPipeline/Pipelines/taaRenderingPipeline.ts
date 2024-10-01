/* eslint-disable @typescript-eslint/naming-convention */
import { serialize } from "../../../Misc/decorators";
import { SerializationHelper } from "../../../Misc/decorators.serialization";
import { Camera } from "../../../Cameras/camera";
import type { Effect } from "../../../Materials/effect";
import { PostProcess } from "../../postProcess";
import { PostProcessRenderPipeline } from "../postProcessRenderPipeline";
import { PostProcessRenderEffect } from "../postProcessRenderEffect";
import type { Scene } from "../../../scene";
import { RegisterClass } from "../../../Misc/typeStore";
import { Constants } from "../../../Engines/constants";
import type { Nullable } from "../../../types";
import { PassPostProcess } from "core/PostProcesses/passPostProcess";
import type { RenderTargetWrapper } from "core/Engines/renderTargetWrapper";
import { Halton2DSequence } from "core/Maths/halton2DSequence";
//> VRNET
import type { PrePassRenderer } from "../../../Rendering/prePassRenderer";
import { Matrix, TmpVectors } from "core/Maths/math.vector";
import type { PrePassEffectConfiguration } from "../../../Rendering/prePassEffectConfiguration";
//< VRNET

import "../postProcessRenderPipelineManagerSceneComponent";

import "../../../Shaders/taa.fragment";
//> VRNET
class TAAConfiguration implements PrePassEffectConfiguration {
    /**
     * Is taa enabled
     */
    public enabled = false;

    /**
     * Name of the configuration
     */
    public name = "Taa";

    /**
     * Textures that should be present in the MRT for this effect to work
     */
    public readonly texturesRequired: number[] = [Constants.PREPASS_VELOCITY_TEXTURE_TYPE];
}
//< VRNET

/**
 * Simple implementation of Temporal Anti-Aliasing (TAA).
 * This can be used to improve image quality for still pictures (screenshots for e.g.).
 */
export class TAARenderingPipeline extends PostProcessRenderPipeline {
    /**
     * The TAA PostProcess effect id in the pipeline
     */
    public TAARenderEffect: string = "TAARenderEffect";
    /**
     * The pass PostProcess effect id in the pipeline
     */
    public TAAPassEffect: string = "TAAPassEffect";
    //> VRNET
    /**
     * Number of samples already done via post process, for example after camera stop moving
     */
    private _doneSamples = 0;

    private get _prePassRenderer(): Nullable<PrePassRenderer> {
        return this._scene.prePassRenderer;
    }

    /**
     * Fully redone TAA
     */
    public forceRedone() {
        this._forcedUpdate = true;
        this._doneSamples = 0;
    }

    /**
     * Number of samples already done via post process, for example after camera stop moving
     */
    public get doneSamples(): number {
        return this._doneSamples;
    }

    /**
     * Disable TAA jitter
     * You generally want to keep this disabled
     */
    public disableJitter = false;

    /**
     * Enables debug
     * mode == 0 - disabled
     * mode == 1 - coordinates mode showing UV on screen, blue means invalid UV point (< 0 or > 1)
     * mode == 2 - white points mode - showing velocity
     * mode == 3 - uvchange in rg and blue if uv unchanged
     * mode == 4 - clip to AABB, makes points that are close to previous point to be RED, other to be the same
     */
    private _debugMODE = 0;

    public set debugMODE(value: number) {
        this._debugMODE = value;
        this._updateEffectDefines();
    }

    public get debugMODE(): number {
        return this._debugMODE;
    }

    /**
     * Enables clipping chroma to make sure we use in TAA only close colors
     */
    private _clipToAABB = true;

    public set clipToAABB(clip: boolean) {
        this._clipToAABB = clip;
        this._updateEffectDefines();
    }

    public get clipToAABB(): boolean {
        return this._clipToAABB;
    }
    /**
     * Error factor for chroma in aabb clipping from 0 to 1
     */
    private _aabbErrorFactor = 1.0;

    public set aabbErrorFactor(value: number) {
        this._aabbErrorFactor = value;
    }
    public get aabbErrorFactor(): number {
        return this._aabbErrorFactor;
    }
    //< VRNET

    @serialize("samples")
    private _samples = 8;
    /**
     * Number of accumulated samples (default: 8)
     */
    public set samples(samples: number) {
        if (this._samples === samples) {
            return;
        }

        this._samples = samples;
        this._hs.regenerate(samples);
    }

    public get samples(): number {
        return this._samples;
    }
    @serialize("msaaSamples")
    private _msaaSamples = 1;
    /**
     * MSAA samples (default: 1)
     */
    public set msaaSamples(samples: number) {
        if (this._msaaSamples === samples) {
            return;
        }

        this._msaaSamples = samples;
        if (this._taaPostProcess) {
            this._taaPostProcess.samples = samples;
        }
    }

    public get msaaSamples(): number {
        return this._msaaSamples;
    }

    /**
     * The factor used to blend the history frame with current frame (default: 0.05)
     */
    @serialize()
    public factor = 0.05;

    /**
     * Disable TAA on camera move (default: true).
     * You generally want to keep this enabled, otherwise you will get a ghost effect when the camera moves (but if it's what you want, go for it!)
     */
    @serialize()
    public disableOnCameraMove = true;

    @serialize("isEnabled")
    private _isEnabled = true;
    /**
     * Gets or sets a boolean indicating if the render pipeline is enabled (default: true).
     */
    public get isEnabled(): boolean {
        return this._isEnabled;
    }

    public set isEnabled(value: boolean) {
        if (this._isEnabled === value) {
            return;
        }
        //> VRNET
        this._doneSamples = 0;
        //< VRNET
        this._isEnabled = value;

        if (!value) {
            if (this._cameras !== null) {
                this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
                this._cameras = this._camerasToBeAttached.slice();
            }
        } else if (value) {
            if (!this._isDirty) {
                if (this._cameras !== null) {
                    this._forcedUpdate = true;
                    this._scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(this._name, this._cameras);
                }
            } else {
                this._buildPipeline();
            }
        }
    }

    /**
     * Gets active scene
     */
    public get scene(): Scene {
        return this._scene;
    }

    private _scene: Scene;
    private _isDirty = false;
    private _camerasToBeAttached: Array<Camera> = [];
    private _textureType: number;
    private _taaPostProcess: Nullable<PostProcess>;
    private _passPostProcess: Nullable<PassPostProcess>;
    private _ping: RenderTargetWrapper;
    private _pong: RenderTargetWrapper;
    private _pingpong = 0;
    private _hs: Halton2DSequence;
    private _forcedUpdate = true;

    /**
     * Returns true if TAA is supported by the running hardware
     */
    public override get isSupported(): boolean {
        const caps = this._scene.getEngine().getCaps();

        return caps.texelFetch;
    }

    /**
     * Constructor of the TAA rendering pipeline
     * @param name The rendering pipeline name
     * @param scene The scene linked to this pipeline
     * @param cameras The array of cameras that the rendering pipeline will be attached to (default: scene.cameras)
     * @param textureType The type of texture where the scene will be rendered (default: Constants.TEXTURETYPE_UNSIGNED_BYTE)
     */
    constructor(name: string, scene: Scene, cameras?: Camera[], textureType = Constants.TEXTURETYPE_UNSIGNED_BYTE) {
        const engine = scene.getEngine();

        super(engine, name);

        this._cameras = cameras || scene.cameras;
        this._cameras = this._cameras.slice();
        this._camerasToBeAttached = this._cameras.slice();

        this._scene = scene;
        this._textureType = textureType;
        this._hs = new Halton2DSequence(this.samples);

        //> VRNET
        const prePassRenderer = scene.enablePrePassRenderer();
        if (prePassRenderer) {
            prePassRenderer.markAsDirty();
        }
        //< VRNET

        if (this.isSupported) {
            this._createPingPongTextures(engine.getRenderWidth(), engine.getRenderHeight());

            scene.postProcessRenderPipelineManager.addPipeline(this);

            this._buildPipeline();
        }
    }

    /**
     * Get the class name
     * @returns "TAARenderingPipeline"
     */
    public override getClassName(): string {
        return "TAARenderingPipeline";
    }

    /**
     * Adds a camera to the pipeline
     * @param camera the camera to be added
     */
    public addCamera(camera: Camera): void {
        this._camerasToBeAttached.push(camera);
        this._buildPipeline();
    }

    /**
     * Removes a camera from the pipeline
     * @param camera the camera to remove
     */
    public removeCamera(camera: Camera): void {
        const index = this._camerasToBeAttached.indexOf(camera);
        this._camerasToBeAttached.splice(index, 1);
        this._buildPipeline();
    }

    /**
     * Removes the internal pipeline assets and detaches the pipeline from the scene cameras
     */
    public override dispose(): void {
        this._disposePostProcesses();

        this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);

        this._ping.dispose();
        this._pong.dispose();

        super.dispose();
    }

    //> VRNET
    /**
     * Gets whether or not the TAA post-process is in object based mode.
     */
    @serialize()
    public get isObjectBased(): boolean {
        return this._isObjectBased;
    }

    /**
     * Sets whether or not the TAA post-process is in object based mode.
     */
    public set isObjectBased(value: boolean) {
        if (this._isObjectBased === value) {
            return;
        }

        this._isObjectBased = value;
        this._updateEffectDefines();
    }

    private _isObjectBased: boolean = true;

    private _invViewProjection: Nullable<Matrix> = null;
    private _previousViewProjection: Nullable<Matrix> = null;
    //< VRNET

    private _createPingPongTextures(width: number, height: number) {
        const engine = this._scene.getEngine();

        this._ping?.dispose();
        this._pong?.dispose();

        this._ping = engine.createRenderTargetTexture(
            { width, height },
            { generateMipMaps: false, generateDepthBuffer: false, type: Constants.TEXTURETYPE_HALF_FLOAT, samplingMode: Constants.TEXTURE_LINEAR_LINEAR }
        );

        this._pong = engine.createRenderTargetTexture(
            { width, height },
            { generateMipMaps: false, generateDepthBuffer: false, type: Constants.TEXTURETYPE_HALF_FLOAT, samplingMode: Constants.TEXTURE_LINEAR_LINEAR }
        );

        this._hs.setDimensions(width, height);
        this._hs.next();
        this._forcedUpdate = true;
    }

    private _updateEffectDefines(): void {
        //> VRNET

        this._invViewProjection = null;
        this._previousViewProjection = null;

        if (this._isObjectBased) {
            if (this._taaPostProcess) {
                this._taaPostProcess._prePassEffectConfiguration.texturesRequired[0] = Constants.PREPASS_VELOCITY_TEXTURE_TYPE;
            }
        } else {
            this._invViewProjection = Matrix.Identity();
            this._previousViewProjection = this._scene.getTransformMatrix().clone();

            if (this._taaPostProcess) {
                this._taaPostProcess._prePassEffectConfiguration.texturesRequired[0] = Constants.PREPASS_DEPTH_TEXTURE_TYPE;
            }
        }

        const defines: string[] = [
            this._isObjectBased ? "#define OBJECT_BASED" : "",
            this._clipToAABB ? "#define CLIP_TO_AABB" : "",
            this._debugMODE == 1
                ? "#define DEBUG_UV"
                : this._debugMODE == 2
                  ? "#define DEBUG_VELOCITY"
                  : this._debugMODE == 3
                    ? "#define DEBUG_UV_CHANGE"
                    : this._debugMODE == 4
                      ? "#define DEBUG_CLIP_TO_AABB"
                      : "",
        ];
        //< VRNET

        this._taaPostProcess?.updateEffect(defines.join("\n"));
    }

    private _buildPipeline() {
        if (!this.isSupported) {
            return;
        }

        if (!this._isEnabled) {
            this._isDirty = true;
            return;
        }

        this._isDirty = false;

        const engine = this._scene.getEngine();

        this._disposePostProcesses();
        if (this._cameras !== null) {
            this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
            // get back cameras to be used to reattach pipeline
            this._cameras = this._camerasToBeAttached.slice();
        }
        this._reset();

        this._createTAAPostProcess();
        this.addEffect(
            new PostProcessRenderEffect(
                engine,
                this.TAARenderEffect,
                () => {
                    return this._taaPostProcess;
                },
                true
            )
        );

        this._createPassPostProcess();
        this.addEffect(
            new PostProcessRenderEffect(
                engine,
                this.TAAPassEffect,
                () => {
                    return this._passPostProcess;
                },
                true
            )
        );

        if (this._cameras !== null) {
            this._scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(this._name, this._cameras);
        }
    }

    //> VRNET
    private isCameraMoved(): boolean {
        return this._forcedUpdate || (this._scene.activeCamera?.hasMoved ?? false);
    }
    //< VRNET

    private _disposePostProcesses(): void {
        for (let i = 0; i < this._cameras.length; i++) {
            const camera = this._cameras[i];

            this._taaPostProcess?.dispose(camera);
            this._passPostProcess?.dispose(camera);

            camera.getProjectionMatrix(true); // recompute the projection matrix
        }

        this._taaPostProcess = null;
        this._passPostProcess = null;
    }

    private _createTAAPostProcess(): void {
        this._taaPostProcess = new PostProcess("TAA", "taa", {
            uniforms: ["factor", "cameraMoved", "errorFactor", "inverseView", "projection"],
            //> VRNET
            samplers: ["textureSampler", "historySampler", "velocitySampler", "depthSampler"],
            //< VRNET
            size: 1.0,
            engine: this._scene.getEngine(),
            textureType: this._textureType,
        });
        //> VRNET
        this._taaPostProcess._prePassEffectConfiguration = new TAAConfiguration();
        //< VRNET

        this._taaPostProcess.samples = this._msaaSamples;

        this._updateEffectDefines();

        this._taaPostProcess.onActivateObservable.add(() => {
            const camera = this._scene.activeCamera;

            if (this._taaPostProcess?.width !== this._ping.width || this._taaPostProcess?.height !== this._ping.height) {
                const engine = this._scene.getEngine();
                this._createPingPongTextures(engine.getRenderWidth(), engine.getRenderHeight());
            }

            //> VRNET
            if (!this.disableJitter && camera && !(this.isCameraMoved() && this.disableOnCameraMove)) {
                //< VRNET
                if (camera.mode === Camera.PERSPECTIVE_CAMERA) {
                    const projMat = camera.getProjectionMatrix();
                    projMat.setRowFromFloats(2, this._hs.x * 2, this._hs.y * 2, projMat.m[10], projMat.m[11]);
                } else {
                    // We must force the update of the projection matrix so that m[12] and m[13] are recomputed, as we modified them the previous frame
                    const projMat = camera.getProjectionMatrix(true);
                    projMat.setRowFromFloats(3, this._hs.x * 2 + projMat.m[12], this._hs.y * 2 + projMat.m[13], projMat.m[14], projMat.m[15]);
                }
            }

            if (this._passPostProcess) {
                this._passPostProcess.inputTexture = this._pingpong ? this._ping : this._pong;
            }
            this._pingpong = this._pingpong ^ 1;
            this._hs.next();
        });

        this._taaPostProcess.onApplyObservable.add((effect: Effect) => {
            //> VRNET
            const prePassRenderer = this._prePassRenderer;
            if (this._isObjectBased) {
                if (prePassRenderer) {
                    const velocityIndex = prePassRenderer.getIndex(Constants.PREPASS_VELOCITY_TEXTURE_TYPE);
                    effect.setTexture("velocitySampler", prePassRenderer.getRenderTarget().textures[velocityIndex]);
                }
            } else {
                if (prePassRenderer) {
                    const depthIndex = prePassRenderer.getIndex(Constants.PREPASS_DEPTH_TEXTURE_TYPE);
                    effect.setTexture("depthSampler", prePassRenderer.getRenderTarget().textures[depthIndex]);
                }
                //reversing jitter
                const viewProjection = TmpVectors.Matrix[0];
                const tmpProjectionMatrix = TmpVectors.Matrix[1];
                tmpProjectionMatrix.copyFrom(this._scene.getProjectionMatrix());
                tmpProjectionMatrix.setRowFromFloats(2, 0, 0, tmpProjectionMatrix.m[10], tmpProjectionMatrix.m[11]);
                this._scene._viewMatrix.multiplyToRef(tmpProjectionMatrix, viewProjection);

                viewProjection.invertToRef(this._invViewProjection!);
                effect.setMatrix("inverseView", this._invViewProjection!.multiply(this._previousViewProjection!));
                this._previousViewProjection!.copyFrom(viewProjection);
                effect.setMatrix("projection", tmpProjectionMatrix);
            }
            this._doneSamples = this.isCameraMoved() ? 0 : this._doneSamples + 1;
            //< VRNET

            effect._bindTexture("historySampler", this._pingpong ? this._ping.texture : this._pong.texture);
            effect.setFloat("factor", this.factor);
            effect.setFloat("errorFactor", this._aabbErrorFactor);
            effect.setBool("cameraMoved", this.isCameraMoved());

            this._forcedUpdate = false;
        });
    }

    private _createPassPostProcess() {
        const engine = this._scene.getEngine();

        this._passPostProcess = new PassPostProcess("TAAPass", 1, null, Constants.TEXTURE_NEAREST_NEAREST, engine);
        this._passPostProcess.inputTexture = this._ping;
        this._passPostProcess.autoClear = false;
    }

    /**
     * Serializes the rendering pipeline (Used when exporting)
     * @returns the serialized object
     */
    public serialize(): any {
        const serializationObject = SerializationHelper.Serialize(this);
        serializationObject.customType = "TAARenderingPipeline";

        return serializationObject;
    }

    /**
     * Parse the serialized pipeline
     * @param source Source pipeline.
     * @param scene The scene to load the pipeline to.
     * @param rootUrl The URL of the serialized pipeline.
     * @returns An instantiated pipeline from the serialized object.
     */
    public static Parse(source: any, scene: Scene, rootUrl: string): TAARenderingPipeline {
        return SerializationHelper.Parse(() => new TAARenderingPipeline(source._name, scene, source._ratio), source, scene, rootUrl);
    }
}

RegisterClass("BABYLON.TAARenderingPipeline", TAARenderingPipeline);
