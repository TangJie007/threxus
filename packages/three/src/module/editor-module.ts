/**
 * 可选模块：编辑器骨架 + GPU 实例化（占位能力，按需引入）。
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
