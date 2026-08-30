import { describe, expect, it } from 'vitest';
import {
  EffectComposerService,
  LabelsService,
  SelectionService,
  createThreeApp,
  effectComposerFeature,
  labelsFeature,
  selectionFeature,
  selectionOutlineFeature,
  type EffectComposerServiceType,
  type LabelsServiceType,
  type SelectionServiceType,
} from '../../src';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';

describe('high-priority browser features', () => {
  it('effectComposerFeature installs composer pipeline and restores', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    document.body.appendChild(canvas);

    const app = createThreeApp({
      canvas,
      resize: false,
    });
    app.use(
      effectComposerFeature({
        bloom: { strength: 0.2 },
        outline: true,
        fxaa: true,
      }),
    );

    let composer!: EffectComposerServiceType;
    app.use({
      name: 'probe',
      dependencies: [EffectComposerService],
      setup(context) {
        composer = context.inject(EffectComposerService);
      },
    });

    await app.start();
    expect(app.inspect().rendering?.pipeline).toBe('effect-composer');
    expect(composer.composer).toBeTruthy();
    expect(composer.outlinePass).toBeTruthy();
    composer.setOutlineSelected([]);

    app.simulateContextLost();
    await app.simulateContextRestored();
    expect(composer.composer).toBeTruthy();

    await app.dispose();
    canvas.remove();
  });

  it('labelsFeature mounts CSS2D host', async () => {
    const canvas = document.createElement('canvas');
    const host = document.createElement('div');
    host.style.position = 'relative';
    host.appendChild(canvas);
    document.body.appendChild(host);

    const app = createThreeApp({ canvas, resize: false });
    let labels!: LabelsServiceType;
    app.use(labelsFeature({ container: host }));
    app.use({
      name: 'probe',
      dependencies: [LabelsService],
      setup(context) {
        labels = context.inject(LabelsService);
      },
    });

    await app.start();
    const el = document.createElement('div');
    el.textContent = 'Pump-A';
    labels.add({
      id: 'pump',
      anchor: { x: 1, y: 2, z: 0 },
      element: el,
      offset: [0, 0.5, 0],
    });
    expect(labels.size).toBe(1);
    app.render();
    await app.dispose();
    host.remove();
  });

  it('selectionOutlineFeature mirrors SelectionService', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    document.body.appendChild(canvas);

    const app = createThreeApp({ canvas, resize: false });
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());

    let selection!: SelectionServiceType;
    let composer!: EffectComposerServiceType;

    app.use(effectComposerFeature({ bloom: false, fxaa: false }));
    app.use(selectionFeature({ roots: [mesh] }));
    app.use(selectionOutlineFeature());
    app.use({
      name: 'probe',
      dependencies: [SelectionService, EffectComposerService],
      setup(context) {
        selection = context.inject(SelectionService);
        composer = context.inject(EffectComposerService);
        context.scene.add(mesh);
      },
    });

    await app.start();
    selection.select(mesh);
    expect(composer.outlinePass?.selectedObjects).toEqual([mesh]);
    selection.clear();
    expect(composer.outlinePass?.selectedObjects).toEqual([]);
    await app.dispose();
    canvas.remove();
  });
});
