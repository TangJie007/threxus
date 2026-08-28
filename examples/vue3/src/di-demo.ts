import {
  createContainer,
  createToken,
  Inject,
  Injectable,
} from '@threxus/core';

const CLOCK = createToken<{ now: () => number }>('clock');
const LABEL = createToken<string>('label');

@Injectable({ inject: [CLOCK] })
class TickerService {
  @Inject(LABEL)
  label!: string;

  constructor(readonly clock: { now: () => number }) {}

  describe(): string {
    return `${this.label} @ ${this.clock.now()}`;
  }
}

export function createDemoMessage(): string {
  const container = createContainer()
    .set(CLOCK, { now: () => 42 })
    .set(LABEL, 'scheme-C')
    .register(TickerService);

  return container.resolve(TickerService).describe();
}
