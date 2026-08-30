/**
 * 环境 Feature：背景、灯光、可选地面 / HDRI / RoomEnvironment / 阴影。
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  type ColorRepresentation,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
    readonly castShadow?: boolean;
  };
  readonly ground?: {
    readonly size?: number;
    readonly color?: ColorRepresentation;
    readonly receiveShadow?: boolean;
  };
  /**
   * HDR（等距柱状）URL：经 AssetManager.acquireEnvironmentMap → scene.environment。
   * 需要默认 environment-map Loader（App start 后可用）。
   */
  readonly hdri?: string;
  /**
   * 使用 RoomEnvironment 烘焙环境贴图（无 HDR 文件时的程序化兜底）。
   * 与 hdri 同时存在时优先 hdri，失败可回退（见 fallbackRoomEnvironment）。
   */
  readonly roomEnvironment?: boolean | { readonly sigma?: number };
  /** hdri 加载失败时是否回退 RoomEnvironment，默认 true。 */
  readonly fallbackRoomEnvironment?: boolean;
  /** 阴影与平行光阴影相机范围。 */
  readonly shadows?: {
    readonly enabled?: boolean;
    readonly mapSize?: number;
    /** 按场景包围盒配置阴影相机正交范围。 */
    readonly fitBounds?: {
      readonly width: number;
      readonly depth: number;
      readonly height?: number;
    };
  };
}

export function environmentFeature(
  options: EnvironmentFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'environment',
    async setup(context) {
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
      const position =
        options.directionalLight?.position ?? ([5, 8, 5] as const);
      dir.position.set(position[0], position[1], position[2]);
      dir.name = 'environment-key-light';
      context.scene.add(dir);
      context.own(dir);

      const shadowsEnabled = options.shadows?.enabled ?? false;
      if (shadowsEnabled || options.directionalLight?.castShadow) {
        context.renderer.shadowMap.enabled = true;
        dir.castShadow = true;
        const mapSize = options.shadows?.mapSize ?? 2048;
        dir.shadow.mapSize.set(mapSize, mapSize);
        const bounds = options.shadows?.fitBounds;
        if (bounds) {
          const halfW = bounds.width / 2;
          const halfD = bounds.depth / 2;
          const height = bounds.height ?? Math.max(bounds.width, bounds.depth);
          dir.shadow.camera.left = -halfW;
          dir.shadow.camera.right = halfW;
          dir.shadow.camera.top = halfD;
          dir.shadow.camera.bottom = -halfD;
          dir.shadow.camera.near = 0.5;
          dir.shadow.camera.far = height * 2;
          dir.shadow.camera.updateProjectionMatrix();
        }
      }

      if (options.ground) {
        const size = options.ground.size ?? 20;
        const geometry = new PlaneGeometry(size, size);
        const material = new MeshStandardMaterial({
          color: options.ground.color ?? 0x334155,
        });
        const ground = new Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.name = 'environment-ground';
        ground.receiveShadow = options.ground.receiveShadow ?? shadowsEnabled;
        context.scene.add(ground);
        context.own(ground);
        context.addCleanup(() => {
          geometry.dispose();
          material.dispose();
        });
      }

      let envTexture: Texture | null = null;
      const wantRoom =
        options.roomEnvironment === true ||
        typeof options.roomEnvironment === 'object';
      const roomSigma =
        typeof options.roomEnvironment === 'object'
          ? (options.roomEnvironment.sigma ?? 0.04)
          : 0.04;
      const fallbackRoom = options.fallbackRoomEnvironment !== false;

      const applyEnv = (texture: Texture): void => {
        envTexture = texture;
        context.scene.environment = texture;
      };

      const bakeRoom = (): Texture => {
        const pmrem = new PMREMGenerator(context.renderer);
        pmrem.compileEquirectangularShader();
        const room = new RoomEnvironment();
        const texture = pmrem.fromScene(room, roomSigma).texture;
        room.dispose();
        context.addCleanup(() => {
          texture.dispose();
          pmrem.dispose();
        });
        return texture;
      };

      if (options.hdri) {
        try {
          const handle = await context.assets.acquireEnvironmentMap(
            options.hdri,
            { signal: context.signal },
          );
          context.retain(handle);
          applyEnv(handle.value);
        } catch {
          if (fallbackRoom || wantRoom) {
            applyEnv(bakeRoom());
          }
        }
      } else if (wantRoom) {
        applyEnv(bakeRoom());
      }

      context.addCleanup(() => {
        if (context.scene.environment === envTexture) {
          context.scene.environment = null;
        }
      });
    },
  };
}
