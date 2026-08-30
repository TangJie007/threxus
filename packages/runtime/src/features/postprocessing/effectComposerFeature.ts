/**
 * EffectComposer 后处理 Feature：GTAO / Bloom / Outline / FXAA / OutputPass。
 *
 * Context restore 时重建 Composer（WebGLRenderTarget 在 context lost 后失效）。
 */

import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { Disposable } from '../../lifecycle/Disposable';
import { RenderPipelineService } from '../../rendering/RenderPipelineService';
import type { RenderPipeline } from '../../rendering/RenderPipeline';
import type { RenderContext, RenderSize } from '../../rendering/types';
import { createServiceKey } from '../../services/ServiceKey';
import {
  PostprocessingService,
  createPassRegistry,
  type PostPass,
} from './PostprocessingService';

export type EffectComposerPassId = 'gtao' | 'bloom' | 'outline' | 'fxaa';

export interface EffectComposerFeatureOptions {
  readonly pipelineName?: string;
  readonly gtao?: boolean | {
    readonly blendIntensity?: number;
  };
  readonly bloom?: boolean | {
    readonly strength?: number;
    readonly radius?: number;
    readonly threshold?: number;
  };
  readonly outline?: boolean | {
    readonly edgeStrength?: number;
    readonly edgeGlow?: number;
    readonly edgeThickness?: number;
    readonly visibleEdgeColor?: number;
    readonly hiddenEdgeColor?: number;
  };
  readonly fxaa?: boolean;
  /** 默认 true：tone mapping + sRGB。 */
  readonly output?: boolean;
}

export interface EffectComposerService {
  readonly composer: EffectComposer;
  readonly outlinePass: OutlinePass | null;
  readonly bloomPass: UnrealBloomPass | null;
  readonly gtaoPass: GTAOPass | null;
  setOutlineSelected(objects: readonly Object3D[]): void;
  setPassEnabled(id: EffectComposerPassId, enabled: boolean): void;
  isPassEnabled(id: EffectComposerPassId): boolean;
  addPass(pass: PostPass): Disposable;
  readonly passes: readonly PostPass[];
}

export const EffectComposerService =
  createServiceKey<EffectComposerService>('effect-composer');

export function effectComposerFeature(
  options: EffectComposerFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'effect-composer',
    provides: [
      EffectComposerService,
      PostprocessingService,
      RenderPipelineService,
    ],
    setup(context) {
      const registry = createPassRegistry();
      let lastSize: RenderSize = {
        width: context.canvas.clientWidth || 1,
        height: context.canvas.clientHeight || 1,
        pixelRatio: context.renderer.getPixelRatio(),
      };

      const enabled: Record<EffectComposerPassId, boolean> = {
        gtao: options.gtao === true || typeof options.gtao === 'object',
        bloom: options.bloom !== false,
        outline: options.outline !== false,
        fxaa: options.fxaa !== false,
      };

      let selectedOutline: Object3D[] = [];
      let session = createComposerSession(
        context.renderer,
        context.scene,
        context.camera,
        lastSize,
        options,
        enabled,
      );
      session.outlinePass && (session.outlinePass.selectedObjects = selectedOutline);

      const applyEnabled = (): void => {
        if (session.gtaoPass) {
          session.gtaoPass.enabled = enabled.gtao;
        }
        if (session.bloomPass) {
          session.bloomPass.enabled = enabled.bloom;
        }
        if (session.outlinePass) {
          session.outlinePass.enabled = enabled.outline;
        }
        if (session.fxaaPass) {
          session.fxaaPass.enabled = enabled.fxaa;
        }
      };
      applyEnabled();

      const service: EffectComposerService = {
        get composer() {
          return session.composer;
        },
        get outlinePass() {
          return session.outlinePass;
        },
        get bloomPass() {
          return session.bloomPass;
        },
        get gtaoPass() {
          return session.gtaoPass;
        },
        setOutlineSelected(objects) {
          selectedOutline = [...objects];
          if (session.outlinePass) {
            session.outlinePass.selectedObjects = selectedOutline;
          }
        },
        setPassEnabled(id, value) {
          enabled[id] = value;
          applyEnabled();
          context.invalidate();
        },
        isPassEnabled(id) {
          return enabled[id];
        },
        addPass(pass) {
          return registry.addPass(pass);
        },
        get passes() {
          return registry.passes;
        },
      };

      context.provide(EffectComposerService, service);
      context.provide(PostprocessingService, {
        get passes() {
          return registry.passes;
        },
        addPass(pass) {
          return registry.addPass(pass);
        },
      });

      const pipeline: RenderPipeline = {
        name: options.pipelineName ?? 'effect-composer',
        setSize(size) {
          lastSize = size;
          session.setSize(size);
          for (const pass of registry.passes) {
            pass.setSize?.(size);
          }
        },
        render(renderContext: RenderContext) {
          session.composer.render();
          for (const pass of registry.passes) {
            pass.render(renderContext);
          }
        },
        async restore() {
          session.dispose();
          session = createComposerSession(
            context.renderer,
            context.scene,
            context.camera,
            lastSize,
            options,
            enabled,
          );
          if (session.outlinePass) {
            session.outlinePass.selectedObjects = selectedOutline;
          }
          applyEnabled();
          for (const pass of registry.passes) {
            await pass.restore?.();
            pass.setSize?.(lastSize);
          }
        },
        dispose() {
          for (const pass of [...registry.passes]) {
            registry.removePass(pass.id);
          }
          session.dispose();
        },
      };

      context.provide(RenderPipelineService, pipeline, { dispose: 'manual' });
      context.rendering.setPipeline(pipeline);

      context.onCameraChanged(({ current }) => {
        session.setCamera(current);
      });
    },
  };
}

interface ComposerSession {
  readonly composer: EffectComposer;
  readonly outlinePass: OutlinePass | null;
  readonly bloomPass: UnrealBloomPass | null;
  readonly gtaoPass: GTAOPass | null;
  readonly fxaaPass: FXAAPass | null;
  setSize(size: RenderSize): void;
  setCamera(camera: Camera): void;
  dispose(): void;
}

function createComposerSession(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  size: RenderSize,
  options: EffectComposerFeatureOptions,
  enabled: Record<EffectComposerPassId, boolean>,
): ComposerSession {
  const width = Math.max(1, Math.floor(size.width));
  const height = Math.max(1, Math.floor(size.height));

  const rt = new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(size.pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let gtaoPass: GTAOPass | null = null;
  if (options.gtao !== false && options.gtao !== undefined) {
    const gtaoOpts = typeof options.gtao === 'object' ? options.gtao : {};
    gtaoPass = new GTAOPass(scene, camera, width, height);
    if (gtaoOpts.blendIntensity !== undefined) {
      gtaoPass.blendIntensity = gtaoOpts.blendIntensity;
    }
    gtaoPass.enabled = enabled.gtao;
    composer.addPass(gtaoPass);
  }

  let bloomPass: UnrealBloomPass | null = null;
  if (options.bloom !== false) {
    const bloomOpts = typeof options.bloom === 'object' ? options.bloom : {};
    bloomPass = new UnrealBloomPass(
      new Vector2(width, height),
      bloomOpts.strength ?? 0.35,
      bloomOpts.radius ?? 0.4,
      bloomOpts.threshold ?? 0.85,
    );
    bloomPass.enabled = enabled.bloom;
    composer.addPass(bloomPass);
  }

  let outlinePass: OutlinePass | null = null;
  if (options.outline !== false) {
    const outlineOpts =
      typeof options.outline === 'object' ? options.outline : {};
    outlinePass = new OutlinePass(
      new Vector2(width, height),
      scene,
      camera as PerspectiveCamera,
    );
    outlinePass.edgeStrength = outlineOpts.edgeStrength ?? 3;
    outlinePass.edgeGlow = outlineOpts.edgeGlow ?? 0.5;
    outlinePass.edgeThickness = outlineOpts.edgeThickness ?? 1;
    outlinePass.visibleEdgeColor.setHex(
      outlineOpts.visibleEdgeColor ?? 0x4cc9f0,
    );
    outlinePass.hiddenEdgeColor.setHex(
      outlineOpts.hiddenEdgeColor ?? 0x1b3a4b,
    );
    outlinePass.enabled = enabled.outline;
    composer.addPass(outlinePass);
  }

  let fxaaPass: FXAAPass | null = null;
  if (options.fxaa !== false) {
    fxaaPass = new FXAAPass();
    fxaaPass.enabled = enabled.fxaa;
    composer.addPass(fxaaPass);
  }

  if (options.output !== false) {
    composer.addPass(new OutputPass());
  }

  return {
    composer,
    outlinePass,
    bloomPass,
    gtaoPass,
    fxaaPass,
    setSize(next) {
      const w = Math.max(1, Math.floor(next.width));
      const h = Math.max(1, Math.floor(next.height));
      composer.setPixelRatio(next.pixelRatio);
      composer.setSize(w, h);
      bloomPass?.resolution.set(w, h);
      if (outlinePass) {
        outlinePass.resolution.set(w, h);
      }
      gtaoPass?.setSize(w, h);
    },
    setCamera(next) {
      renderPass.camera = next;
      if (outlinePass) {
        outlinePass.renderCamera = next;
      }
      if (gtaoPass) {
        gtaoPass.camera = next;
      }
    },
    dispose() {
      composer.dispose();
      rt.dispose();
    },
  };
}
