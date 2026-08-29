import type { RenderContext, RenderSize } from './types';
import type { RenderPipeline } from './RenderPipeline';

/** 默认渲染管线：单次 renderer.render(scene, camera)。 */
export class DirectRenderPipeline implements RenderPipeline {
  readonly name = 'direct';

  setSize(_size: RenderSize): void {
    // 尺寸由 ResizeController 直接写入 Renderer / Camera。
  }

  render(context: RenderContext): void {
    context.renderer.render(context.scene, context.camera);
  }

  dispose(): void {
    // 无额外 GPU 资源。
  }
}
