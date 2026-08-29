/**
 * 编辑器扩展服务骨架（experimental / 未完成）。
 *
 * 提供可注入单例与最小 API 占位，便于模块组装与后续填充。
 * **不保证**交互手柄、撤销联动、跨端 Agent 等生产行为；API 可能变更。
 */

import { Injectable } from '@threxus/core';
import type { Object3D, WebGLRenderer } from 'three';

/** @experimental 变换手柄占位 */
@Injectable()
export class GizmoService {
  private target: Object3D | null = null;

  attach(target: Object3D): void {
    this.target = target;
  }

  detach(): void {
    this.target = null;
  }

  getTarget(): Object3D | null {
    return this.target;
  }
}

/** @experimental 截图占位（需在渲染后调用） */
@Injectable()
export class SnapshotService {
  captureDataUrl(
    renderer: WebGLRenderer,
    type = 'image/png',
  ): string {
    return renderer.domElement.toDataURL(type);
  }
}

/** @experimental 快捷键占位 */
@Injectable()
export class HotkeyService {
  private readonly handlers = new Map<string, (event: KeyboardEvent) => void>();
  private bound = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const handler = this.handlers.get(event.key.toLowerCase());
    handler?.(event);
  };

  bind(key: string, handler: (event: KeyboardEvent) => void): void {
    this.handlers.set(key.toLowerCase(), handler);
    if (!this.bound && typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      this.bound = true;
    }
  }

  unbind(key: string): void {
    this.handlers.delete(key.toLowerCase());
  }

  dispose(): void {
    if (this.bound && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
    this.bound = false;
    this.handlers.clear();
  }
}

/** @experimental 剪贴板占位 */
@Injectable()
export class ClipboardService {
  async writeText(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }

  async readText(): Promise<string> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return navigator.clipboard.readText();
    }
    return '';
  }
}

/** @experimental Agent 桥接占位 */
@Injectable()
export class AgentBridgeService {
  private readonly listeners = new Set<(payload: unknown) => void>();

  emit(payload: unknown): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  subscribe(listener: (payload: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
