import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clientToNdc,
  createInputManager,
  createThreeApp,
  markPickable,
  type ThreePointerEvent,
} from '../../src';
import {
  createHeadlessThreeAppOptions,
  createPointerEventLike,
  createTestCanvas,
  type TestCanvas,
} from '../helpers/headless-three';

function createSceneWithMesh(z = -2) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.position.set(0, 0, z);
  mesh.name = 'target';
  scene.add(mesh);
  camera.updateMatrixWorld(true);
  mesh.updateMatrixWorld(true);

  return { scene, camera, mesh };
}

function centerClient(canvas: TestCanvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

describe('clientToNdc', () => {
  it('maps canvas center and respects page offset', () => {
    const ndc = clientToNdc(60, 70, {
      left: 10,
      top: 20,
      width: 100,
      height: 100,
    });
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });

  it('handles ordinary CSS scale via rect size', () => {
    const ndc = clientToNdc(10, 10, {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    });
    expect(ndc.x).toBeCloseTo(-0.9);
    expect(ndc.y).toBeCloseTo(0.9);
  });
});

describe('InputManager', () => {
  const disposables: Array<{ dispose: () => void | Promise<void> }> = [];

  afterEach(async () => {
    while (disposables.length > 0) {
      await disposables.pop()?.dispose();
    }
  });

  it('hits nearest mesh and bubbles to registered parents', () => {
    const canvas = createTestCanvas({
      left: 10,
      top: 20,
      width: 100,
      height: 100,
    });
    const { camera, mesh } = createSceneWithMesh();
    const group = new Group();
    group.name = 'parent';
    group.add(mesh);

    const order: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    input.on(mesh, 'click', () => {
      order.push('mesh');
    }, 'f1');
    input.on(group, 'click', (event) => {
      order.push(`group:${event.currentTarget.name}`);
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', {
        clientX,
        clientY,
        timeStamp: 0,
      }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', {
        clientX,
        clientY,
        timeStamp: 100,
      }),
    );

    expect(order).toEqual(['mesh', 'group:parent']);
  });

  it('emits dragstart/drag/dragend and suppresses click', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const events: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      clickMoveTolerance: 4,
      dragMoveTolerance: 4,
    });
    disposables.push(input);

    input.on(mesh, 'dragstart', () => events.push('dragstart'), 'f1');
    input.on(mesh, 'drag', () => events.push('drag'), 'f1');
    input.on(mesh, 'dragend', () => events.push('dragend'), 'f1');
    input.on(mesh, 'click', () => events.push('click'), 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointermove',
      createPointerEventLike('pointermove', {
        clientX: clientX + 20,
        clientY,
        timeStamp: 20,
      }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', {
        clientX: clientX + 20,
        clientY,
        timeStamp: 40,
      }),
    );

    expect(events[0]).toBe('dragstart');
    expect(events).toContain('drag');
    expect(events.at(-1)).toBe('dragend');
    expect(events).not.toContain('click');
  });

  it('respects stopPropagation during bubble', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const group = new Group();
    group.add(mesh);

    const order: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    input.on(
      mesh,
      'click',
      (event) => {
        order.push('mesh');
        event.stopPropagation();
      },
      'f1',
    );
    input.on(group, 'click', () => {
      order.push('group');
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', { clientX, clientY, timeStamp: 50 }),
    );

    expect(order).toEqual(['mesh']);
  });

  it('picks the nearest of two overlapping meshes', () => {
    const canvas = createTestCanvas();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    const near = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    near.position.set(0, 0, -2);
    near.name = 'near';
    const far = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    far.position.set(0, 0, -4);
    far.name = 'far';
    near.updateMatrixWorld(true);
    far.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const hits: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    input.on(near, 'pointerdown', (event) => {
      hits.push(event.object.name);
    }, 'f1');
    input.on(far, 'pointerdown', (event) => {
      hits.push(event.object.name);
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY }),
    );

    expect(hits).toEqual(['near']);
  });

  it('emits pointerenter / pointerleave on hover path changes', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const events: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    input.on(mesh, 'pointerenter', () => {
      events.push('enter');
    }, 'f1');
    input.on(mesh, 'pointerleave', () => {
      events.push('leave');
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointermove',
      createPointerEventLike('pointermove', { clientX, clientY }),
    );
    canvas.dispatchTestEvent(
      'pointerleave',
      createPointerEventLike('pointerleave', { clientX: -10, clientY: -10 }),
    );

    expect(events).toEqual(['enter', 'leave']);
  });

  it('supports pointer capture for move/up outside the object', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const types: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    input.on(
      mesh,
      'pointerdown',
      (event) => {
        types.push(event.type);
        event.setPointerCapture();
      },
      'f1',
    );
    input.on(mesh, 'pointermove', (event) => {
      types.push(event.type);
    }, 'f1');
    input.on(mesh, 'pointerup', (event) => {
      types.push(event.type);
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    // 移到画布外仍应送到 capture 目标
    canvas.dispatchTestEvent(
      'pointermove',
      createPointerEventLike('pointermove', {
        clientX: clientX + 500,
        clientY: clientY + 500,
        timeStamp: 10,
      }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', {
        clientX: clientX + 500,
        clientY: clientY + 500,
        timeStamp: 20,
      }),
    );

    expect(types).toEqual(['pointerdown', 'pointermove', 'pointerup']);
    expect(canvas.setPointerCapture).toHaveBeenCalled();
  });

  it('does not fire click when pointer moved beyond tolerance', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const clicks: ThreePointerEvent[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      clickMoveTolerance: 4,
      touchAction: false,
    });
    disposables.push(input);

    input.on(mesh, 'click', (event) => {
      clicks.push(event);
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', {
        clientX: clientX + 20,
        clientY,
        timeStamp: 50,
      }),
    );

    expect(clicks).toHaveLength(0);
  });

  it('clears listeners when disposable is disposed', () => {
    const canvas = createTestCanvas();
    const { camera, mesh } = createSceneWithMesh();
    const clicks: number[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });
    disposables.push(input);

    const listener = input.on(mesh, 'click', () => {
      clicks.push(1);
    }, 'f1');

    const { clientX, clientY } = centerClient(canvas);
    const down = () =>
      canvas.dispatchTestEvent(
        'pointerdown',
        createPointerEventLike('pointerdown', {
          clientX,
          clientY,
          timeStamp: 0,
        }),
      );
    const up = (t: number) =>
      canvas.dispatchTestEvent(
        'pointerup',
        createPointerEventLike('pointerup', {
          clientX,
          clientY,
          timeStamp: t,
        }),
      );

    down();
    up(10);
    expect(clicks).toHaveLength(1);

    listener.dispose();
    expect(input.inspect().listeners).toBe(0);

    down();
    up(20);
    expect(clicks).toHaveLength(1);
  });

  it('removes all DOM listeners on dispose', () => {
    const canvas = createTestCanvas();
    const { camera } = createSceneWithMesh();
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
      touchAction: false,
    });

    expect(canvas.__listeners.get('pointerdown')?.size).toBe(1);
    input.dispose();
    expect(canvas.__listeners.get('pointerdown')?.size ?? 0).toBe(0);
  });

  it('resolves pickId ancestor as logical hit target', () => {
    const canvas = createTestCanvas();
    const { scene, camera, mesh } = createSceneWithMesh();
    const root = markPickable(new Group(), 'cabinet-7');
    root.add(mesh);
    scene.add(root);
    camera.updateMatrixWorld(true);
    root.updateMatrixWorld(true);

    const hits: string[] = [];
    const input = createInputManager({
      canvas,
      getCamera: () => camera,
    });
    disposables.push(input);

    input.on(
      root,
      'click',
      (event: ThreePointerEvent) => {
        hits.push(String(event.object.userData.pickId ?? event.object.name));
      },
      'test',
    );

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', { clientX, clientY, timeStamp: 30 }),
    );
    expect(hits).toEqual(['cabinet-7']);
  });
});

describe('ctx.input scope cleanup', () => {
  it('unbinds listeners when Feature disposes', async () => {
    const canvas = createTestCanvas();
    const options = createHeadlessThreeAppOptions(canvas);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.position.set(0, 0, -2);
    options.scene.add(mesh);
    mesh.updateMatrixWorld(true);
    options.camera.position.set(0, 0, 0);
    options.camera.lookAt(0, 0, -1);
    options.camera.updateMatrixWorld(true);

    const clicks: number[] = [];
    const app = createThreeApp(options);

    app.use({
      name: 'interactive',
      setup(context) {
        context.scene.add(mesh);
        context.own(mesh);
        context.input.on(mesh, 'click', () => {
          clicks.push(1);
        });
      },
    });

    await app.start();
    expect(app.inspect().input?.listeners).toBe(1);

    const { clientX, clientY } = centerClient(canvas);
    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', { clientX, clientY, timeStamp: 40 }),
    );
    expect(clicks).toHaveLength(1);

    await app.dispose();
    expect(app.inspect().input).toBeNull();

    canvas.dispatchTestEvent(
      'pointerdown',
      createPointerEventLike('pointerdown', { clientX, clientY, timeStamp: 0 }),
    );
    canvas.dispatchTestEvent(
      'pointerup',
      createPointerEventLike('pointerup', { clientX, clientY, timeStamp: 40 }),
    );
    expect(clicks).toHaveLength(1);
  });
});
