import { createServiceKey } from '@threxus/runtime';
import type { FlowPipe } from './FlowPipe';

export interface PipeRackApi {
  readonly pipes: readonly FlowPipe[];
  setFlowEnabled(enabled: boolean): void;
}

export const PipeRackService = createServiceKey<PipeRackApi>('pipe-rack');
