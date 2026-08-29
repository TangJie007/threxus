import type { ThreeFeature } from '@threxus/runtime';
import { Color } from 'three';
import { cubeSceneConfig } from '../config';

export function createSceneFeature(): ThreeFeature {
  return {
    name: 'scene',
    setup(context) {
      context.scene.background = new Color(cubeSceneConfig.background);
    },
  };
}