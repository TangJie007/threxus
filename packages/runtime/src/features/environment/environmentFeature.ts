/**
 * 环境 Feature：背景、环境光、主光、可选地面。
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type ColorRepresentation,
} from 'three';
import type { ThreeFeature } from '../../feature/ThreeFeature';

export interface EnvironmentFeatureOptions {
  readonly background?: ColorRepresentation;
  readonly ambientLight?: {
    readonly color?: ColorRepresentation;
    readonly intensity?: number;
  };
  readonly directionalLight?: {
    readonly color?: ColorRepresentation;
    readonly intensity?: number;
    readonly position?: readonly [number, number, number];
  };
  readonly ground?: {
    readonly size?: number;
    readonly color?: ColorRepresentation;
  };
}

export function environmentFeature(
  options: EnvironmentFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'environment',
    setup(context) {
      if (options.background !== undefined) {
        context.scene.background = new Color(options.background);
      }

      const ambient = new AmbientLight(
        options.ambientLight?.color ?? 0xffffff,
        options.ambientLight?.intensity ?? 0.5,
      );
      ambient.name = 'environment-ambient';
      context.scene.add(ambient);
      context.own(ambient);

      const dir = new DirectionalLight(
        options.directionalLight?.color ?? 0xffffff,
        options.directionalLight?.intensity ?? 1.2,
      );
      const position = options.directionalLight?.position ?? ([5, 8, 5] as const);
      dir.position.set(position[0], position[1], position[2]);
      dir.name = 'environment-key-light';
      context.scene.add(dir);
      context.own(dir);

      if (options.ground) {
        const size = options.ground.size ?? 20;
        const geometry = new PlaneGeometry(size, size);
        const material = new MeshStandardMaterial({
          color: options.ground.color ?? 0x334155,
        });
        const ground = new Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.name = 'environment-ground';
        context.scene.add(ground);
        context.own(ground);
        context.addCleanup(() => {
          geometry.dispose();
          material.dispose();
        });
      }
    },
  };
}
