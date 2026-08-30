/**
 * 质量档 Feature：手动/自动调节 pixelRatio 与 EffectComposer Pass。
 */

import type { ThreeFeature } from '../../feature/ThreeFeature';
import { ThrexusError } from '../../errors';
import { createServiceKey } from '../../services/ServiceKey';
import {
  EffectComposerService,
  type EffectComposerPassId,
} from '../postprocessing/effectComposerFeature';

export interface QualityTier {
  readonly id: string;
  /** 绝对像素比，或相对 device（clamp）。 */
  readonly pixelRatio?: number;
  readonly passes?: Partial<Record<EffectComposerPassId, boolean>>;
}

export interface QualityService {
  readonly tierId: string;
  readonly tiers: readonly QualityTier[];
  setTier(id: string): void;
  /** 启用后按 FPS 自动升/降档。 */
  setAuto(enabled: boolean): void;
  readonly auto: boolean;
}

export const QualityService = createServiceKey<QualityService>('quality');

export interface QualityFeatureOptions {
  readonly tiers?: readonly QualityTier[];
  readonly initialTierId?: string;
  readonly auto?: {
    readonly enabled?: boolean;
    readonly targetFps?: number;
    readonly sampleSeconds?: number;
  };
}

const DEFAULT_TIERS: readonly QualityTier[] = [
  {
    id: 'high',
    pixelRatio: 2,
    passes: { gtao: true, bloom: true, outline: true, fxaa: true },
  },
  {
    id: 'medium',
    pixelRatio: 1.25,
    passes: { gtao: false, bloom: true, outline: true, fxaa: true },
  },
  {
    id: 'low',
    pixelRatio: 1,
    passes: { gtao: false, bloom: false, outline: true, fxaa: true },
  },
];

export function qualityFeature(
  options: QualityFeatureOptions = {},
): ThreeFeature {
  const tiers = options.tiers ?? DEFAULT_TIERS;
  if (tiers.length === 0) {
    throw new ThrexusError(
      'FEATURE_SETUP',
      'qualityFeature requires at least one tier.',
      { context: { feature: 'quality', operation: 'define' } },
    );
  }

  return {
    name: 'quality',
    optionalDependencies: [EffectComposerService],
    provides: [QualityService],
    setup(context) {
      const composer = context.injectOptional(EffectComposerService);
      let tierId =
        options.initialTierId &&
        tiers.some((tier) => tier.id === options.initialTierId)
          ? options.initialTierId
          : tiers[0]!.id;
      let auto = options.auto?.enabled ?? false;
      const targetFps = options.auto?.targetFps ?? 45;
      const sampleSeconds = options.auto?.sampleSeconds ?? 1.5;

      let sampleTime = 0;
      let sampleFrames = 0;

      const applyTier = (id: string): void => {
        const tier = tiers.find((item) => item.id === id);
        if (!tier) {
          throw new ThrexusError(
            'APP_STATE',
            `Unknown quality tier "${id}".`,
            { context: { feature: 'quality', operation: 'set-tier' } },
          );
        }
        tierId = id;
        if (tier.pixelRatio !== undefined) {
          context.rendering.setPixelRatioOverride(tier.pixelRatio);
        }
        if (composer && tier.passes) {
          for (const [passId, enabled] of Object.entries(tier.passes) as Array<
            [EffectComposerPassId, boolean]
          >) {
            composer.setPassEnabled(passId, enabled);
          }
        }
        context.invalidate();
      };

      applyTier(tierId);

      const service: QualityService = {
        get tierId() {
          return tierId;
        },
        get tiers() {
          return tiers;
        },
        setTier(id) {
          applyTier(id);
        },
        setAuto(enabled) {
          auto = enabled;
          sampleTime = 0;
          sampleFrames = 0;
        },
        get auto() {
          return auto;
        },
      };

      context.provide(QualityService, service);
      context.addCleanup(() => {
        context.rendering.setPixelRatioOverride(undefined);
      });

      context.onUpdate(({ delta }) => {
        if (!auto) {
          return;
        }
        sampleTime += delta;
        sampleFrames += 1;
        if (sampleTime < sampleSeconds) {
          return;
        }
        const fps = sampleFrames / sampleTime;
        sampleTime = 0;
        sampleFrames = 0;
        const index = tiers.findIndex((tier) => tier.id === tierId);
        if (index < 0) {
          return;
        }
        if (fps < targetFps - 5 && index < tiers.length - 1) {
          applyTier(tiers[index + 1]!.id);
        } else if (fps > targetFps + 10 && index > 0) {
          applyTier(tiers[index - 1]!.id);
        }
      });
    },
  };
}
