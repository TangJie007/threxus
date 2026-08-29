/**
 * 工厂场景 Feature 占位：后续把 test 的 Environment、Factory、标签与遥测迁入此处。
 */

import { Injectable, type OnModuleInit } from '@threxus/core';
import { SceneObjectHost } from '@threxus/three';
import {
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';

@Injectable()
export class FactorySceneFeature
  extends SceneObjectHost<Group>
  implements OnModuleInit
{
  onModuleInit(): void {
    const root = new Group();
    root.name = 'factory-placeholder';

    const floor = new Mesh(
      new PlaneGeometry(100, 70),
      new MeshStandardMaterial({
        color: new Color('#1a2230'),
        roughness: 0.92,
        metalness: 0.05,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    const grid = new GridHelper(100, 50, 0x3a4a66, 0x243044);
    grid.position.y = 0.01;
    root.add(grid);

    this.spawn(root);
  }
}
