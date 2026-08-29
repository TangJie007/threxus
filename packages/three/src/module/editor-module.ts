/**
 * 可选模块：编辑器扩展 + GPU 实例化。
 *
 * ⚠️ 骨架未完成（experimental）：
 * - Gizmo / Hotkey / Clipboard / AgentBridge / Snapshot 仅为可注入占位 API
 * - InstancedFoliageService 可用作实例化起步，尚非完整编辑器能力
 * - 请勿当作生产级编辑器功能依赖；完善前可能 breaking 变更
 *
 * 按需 `imports: [ThreeEditorModule]`。
 */

import { Module } from '@threxus/core';
import {
  AgentBridgeService,
  ClipboardService,
  GizmoService,
  HotkeyService,
  InstancedFoliageService,
  SnapshotService,
} from '../services';
import { ThreeCoreModule } from './core-module';

@Module({
  imports: [ThreeCoreModule],
  providers: [
    InstancedFoliageService,
    GizmoService,
    SnapshotService,
    HotkeyService,
    ClipboardService,
    AgentBridgeService,
  ],
  exports: [
    InstancedFoliageService,
    GizmoService,
    SnapshotService,
    HotkeyService,
    ClipboardService,
    AgentBridgeService,
  ],
})
export class ThreeEditorModule {}
