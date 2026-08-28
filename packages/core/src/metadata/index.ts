import type { ClassMetadata, FieldInjection, InjectionToken } from '../types';

/** Well-known key stored on decorator `context.metadata` / `Class[Symbol.metadata]`. */
export const THREXUS_METADATA = Symbol.for('threxus.di');

export interface ThrexusMetadata {
  inject?: InjectionToken[];
  fields?: FieldInjection[];
}

type MetadataBag = Record<string | symbol, unknown>;

const METADATA_SYMBOL: symbol = (() => {
  const runtime = Symbol as typeof Symbol & { metadata?: symbol };
  // Tiny runtime shim — no third-party polyfill package.
  if (!runtime.metadata) {
    Object.defineProperty(runtime, 'metadata', {
      value: Symbol.for('Symbol.metadata'),
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
  return runtime.metadata!;
})();

function getMetadataRecord(target: object): ThrexusMetadata | undefined {
  const bag = (target as Record<symbol, MetadataBag | undefined>)[
    METADATA_SYMBOL
  ];
  if (!bag) {
    return undefined;
  }

  return bag[THREXUS_METADATA] as ThrexusMetadata | undefined;
}

function ensureMetadataRecord(context: {
  metadata?: DecoratorMetadata | null;
}): ThrexusMetadata {
  const bag = (context.metadata ??= {}) as MetadataBag;
  const existing = bag[THREXUS_METADATA] as ThrexusMetadata | undefined;
  if (existing) {
    return existing;
  }

  const created: ThrexusMetadata = {};
  bag[THREXUS_METADATA] = created;
  return created;
}

export function writeInjectableMetadata(
  context: ClassDecoratorContext,
  inject: InjectionToken[],
): void {
  const meta = ensureMetadataRecord(context);
  meta.inject = inject;
}

export function writeFieldInjectMetadata(
  context: ClassFieldDecoratorContext,
  token: InjectionToken,
): void {
  const meta = ensureMetadataRecord(context);
  meta.fields ??= [];
  meta.fields.push({ name: context.name, token });
}

export function readClassMetadata(target: object): ClassMetadata {
  const meta = getMetadataRecord(target);
  return {
    inject: meta?.inject ? [...meta.inject] : [],
    fields: meta?.fields ? [...meta.fields] : [],
  };
}
