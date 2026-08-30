/**
 * Runtime Inspector：从 ThreeApp.inspect + Renderer.info 汇总诊断快照。
 */

import type { ThreeApp } from '../app/types/ThreeApp';
import type { RuntimeSnapshot } from '../app/types/ThreeAppOptions';

export interface RendererInfoSnapshot {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly points: number;
  readonly lines: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

export interface DiagnosticSnapshot {
  readonly app: RuntimeSnapshot;
  readonly renderer: RendererInfoSnapshot | null;
  readonly summary: {
    readonly healthy: boolean;
    readonly issues: readonly string[];
  };
}

/** 从运行中的 App 采集诊断信息。 */
export function inspectRuntime(app: ThreeApp): DiagnosticSnapshot {
  const snapshot = app.inspect();
  const issues: string[] = [];

  if (snapshot.state === 'failed') {
    issues.push('App is in failed state.');
  }
  if (snapshot.graphicsState === 'lost') {
    issues.push('WebGL context is lost.');
  }
  if (snapshot.graphicsState === 'unavailable') {
    issues.push('WebGL context restore failed (unavailable).');
  }
  if (snapshot.state === 'disposed') {
    issues.push('App is disposed.');
  }
  if (snapshot.scheduler.lastTaskError) {
    const taskError = snapshot.scheduler.lastTaskError;
    issues.push(
      `Last frame task error: owner="${taskError.owner}" phase="${taskError.phase}" message="${taskError.message}".`,
    );
  }
  for (const entity of snapshot.entities) {
    if (entity.state === 'failed') {
      issues.push(`Entity "${entity.id}" is in failed state.`);
    }
  }
  issues.push(...snapshot.leaks.issues);

  let renderer: RendererInfoSnapshot | null = null;
  if (snapshot.state === 'running' || snapshot.state === 'paused') {
    try {
      const info = app.renderer.info;
      renderer = {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
      };
    } catch {
      renderer = null;
    }
  }

  return {
    app: snapshot,
    renderer,
    summary: {
      healthy: issues.length === 0 && snapshot.state === 'running',
      issues,
    },
  };
}
