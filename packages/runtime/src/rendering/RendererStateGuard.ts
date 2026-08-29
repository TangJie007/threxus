/**
 * Renderer 状态快照与恢复。
 *
 * 临时渲染（截图、离屏 RT）结束后必须恢复：
 * RenderTarget、viewport/scissor、clear、autoClear、XR enabled。
 */

import { Color, Vector4, type WebGLRenderer } from 'three';

export interface RendererStateSnapshot {
  readonly renderTarget: ReturnType<WebGLRenderer['getRenderTarget']>;
  readonly viewport: Vector4;
  readonly scissor: Vector4;
  readonly scissorTest: boolean;
  readonly clearColor: Color;
  readonly clearAlpha: number;
  readonly autoClear: boolean;
  readonly autoClearColor: boolean;
  readonly autoClearDepth: boolean;
  readonly autoClearStencil: boolean;
  readonly xrEnabled: boolean;
}

const scratchColor = new Color();

/** 捕获当前 Renderer 可恢复状态。 */
export function captureRendererState(
  renderer: WebGLRenderer,
): RendererStateSnapshot {
  const viewport = new Vector4();
  const scissor = new Vector4();
  renderer.getViewport(viewport);
  renderer.getScissor(scissor);

  const clearColor = new Color();
  renderer.getClearColor(clearColor);

  return {
    renderTarget: renderer.getRenderTarget(),
    viewport,
    scissor,
    scissorTest: renderer.getScissorTest(),
    clearColor,
    clearAlpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear,
    autoClearColor: renderer.autoClearColor,
    autoClearDepth: renderer.autoClearDepth,
    autoClearStencil: renderer.autoClearStencil,
    xrEnabled: renderer.xr?.enabled ?? false,
  };
}

/** 将快照写回 Renderer。 */
export function restoreRendererState(
  renderer: WebGLRenderer,
  snapshot: RendererStateSnapshot,
): void {
  renderer.setRenderTarget(snapshot.renderTarget);
  renderer.setViewport(snapshot.viewport);
  renderer.setScissor(snapshot.scissor);
  renderer.setScissorTest(snapshot.scissorTest);
  scratchColor.copy(snapshot.clearColor);
  renderer.setClearColor(scratchColor, snapshot.clearAlpha);
  renderer.autoClear = snapshot.autoClear;
  renderer.autoClearColor = snapshot.autoClearColor;
  renderer.autoClearDepth = snapshot.autoClearDepth;
  renderer.autoClearStencil = snapshot.autoClearStencil;

  if (renderer.xr) {
    renderer.xr.enabled = snapshot.xrEnabled;
  }
}

/**
 * 在受保护的 Renderer 状态下执行任务；无论成功失败都恢复快照。
 * Stage 异常后的状态恢复依赖此函数。
 */
export async function withRendererStateGuard<T>(
  renderer: WebGLRenderer,
  task: (renderer: WebGLRenderer) => T | Promise<T>,
): Promise<T> {
  const snapshot = captureRendererState(renderer);
  try {
    return await task(renderer);
  } finally {
    restoreRendererState(renderer, snapshot);
  }
}
