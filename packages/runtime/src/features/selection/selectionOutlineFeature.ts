/**
 * Selection → OutlinePass 胶水：选中对象自动写入 EffectComposer Outline。
 */

import type { ThreeFeature } from '../../feature/ThreeFeature';
import { ThrexusError } from '../../errors';
import { SelectionService } from '../selection/SelectionService';
import { EffectComposerService } from '../postprocessing/effectComposerFeature';

export interface SelectionOutlineFeatureOptions {
  /** 是否在无 OutlinePass 时静默跳过，默认 false（抛错）。 */
  readonly optionalOutline?: boolean;
}

/**
 * 依赖 SelectionService + EffectComposerService（需启用 outline）。
 */
export function selectionOutlineFeature(
  options: SelectionOutlineFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'selection-outline',
    dependencies: [SelectionService, EffectComposerService],
    setup(context) {
      const selection = context.inject(SelectionService);
      const composer = context.inject(EffectComposerService);

      if (!composer.outlinePass && !options.optionalOutline) {
        throw new ThrexusError(
          'FEATURE_SETUP',
          'selectionOutlineFeature requires effectComposerFeature({ outline: true }).',
          {
            context: {
              feature: 'selection-outline',
              operation: 'setup',
            },
          },
        );
      }

      const apply = (): void => {
        composer.setOutlineSelected(selection.selected);
        context.invalidate();
      };

      apply();
      context.addCleanup(selection.onChange(apply));
      context.addCleanup(() => {
        composer.setOutlineSelected([]);
      });
    },
  };
}
