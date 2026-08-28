/**
 * 编辑器扩展服务骨架（Gizmo / Snapshot / Hotkey / Clipboard / AgentBridge）。
 *
 * 本阶段提供可注入单例与最小 API，后续按编辑器需求填充实现。
 */

import { Injectable } from '@threxus/core';
import type { Object3D, WebGLRenderer } from 'three';

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

@Injectable()
export class SnapshotService {
  /**
   * 从 renderer 读取像素为 data URL（需在渲染后调用）。
   */
  captureDataUrl(
    renderer: WebGLRenderer,
    type = 'image/png',
  ): string {
    return renderer.domElement.toDataURL(type);
  }
}

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
