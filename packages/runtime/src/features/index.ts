/**
 * 内置通用 Feature 导出（M11+）。
 */

export {
  environmentFeature,
  type EnvironmentFeatureOptions,
} from './environment/environmentFeature';

export {
  CameraControlService,
  type CameraControlService as CameraControlServiceType,
} from './orbit-controls/CameraControlService';
export {
  orbitControlsFeature,
  type OrbitControlsFeatureOptions,
} from './orbit-controls/orbitControlsFeature';

export {
  CameraRigService,
  cameraRigFeature,
  type CameraRigFeatureOptions,
  type CameraRigMode,
  type CameraRigService as CameraRigServiceType,
} from './camera-rig/cameraRigFeature';

export {
  SelectionService,
  type SelectionChangeListener,
  type SelectionService as SelectionServiceType,
} from './selection/SelectionService';
export {
  selectionFeature,
  type SelectionFeatureOptions,
} from './selection/selectionFeature';
export {
  selectionOutlineFeature,
  type SelectionOutlineFeatureOptions,
} from './selection/selectionOutlineFeature';

export {
  highlightFeature,
  type HighlightFeatureOptions,
} from './highlight/highlightFeature';

export {
  StatsService,
  statsFeature,
  type RuntimeStats,
  type StatsFeatureOptions,
  type StatsService as StatsServiceType,
} from './stats/statsFeature';

export {
  PostprocessingService,
  createPassRegistry,
  sortPasses,
  type PostPass,
  type PostprocessingService as PostprocessingServiceType,
} from './postprocessing/PostprocessingService';
export {
  postprocessingFeature,
  type PostprocessingFeatureOptions,
} from './postprocessing/postprocessingFeature';
export {
  EffectComposerService,
  effectComposerFeature,
  type EffectComposerFeatureOptions,
  type EffectComposerPassId,
  type EffectComposerService as EffectComposerServiceType,
} from './postprocessing/effectComposerFeature';

export {
  QualityService,
  qualityFeature,
  type QualityFeatureOptions,
  type QualityService as QualityServiceType,
  type QualityTier,
} from './quality/qualityFeature';

export {
  LabelsService,
  labelsFeature,
  type LabelDescriptor,
  type LabelsFeatureOptions,
  type LabelsService as LabelsServiceType,
} from './labels/labelsFeature';
