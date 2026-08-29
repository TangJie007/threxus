/**
 * 轻量分级日志。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface Logger {
  readonly level: LogLevel;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(scope: string): Logger;
}

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  readonly scope?: string;
  readonly sink?: (level: Exclude<LogLevel, 'silent'>, message: string, args: unknown[]) => void;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? 'warn';
  const scope = options.scope ?? 'threxus';
  const sink =
    options.sink ??
    ((lvl, message, args) => {
      const line = `[${scope}] ${message}`;
      if (lvl === 'error') {
        console.error(line, ...args);
      } else if (lvl === 'warn') {
        console.warn(line, ...args);
      } else if (lvl === 'info') {
        console.info(line, ...args);
      } else {
        console.debug(line, ...args);
      }
    });

  const log = (lvl: Exclude<LogLevel, 'silent'>, message: string, args: unknown[]) => {
    if (LEVEL_WEIGHT[lvl] < LEVEL_WEIGHT[level]) {
      return;
    }
    sink(lvl, message, args);
  };

  return {
    level,
    debug: (message, ...args) => log('debug', message, args),
    info: (message, ...args) => log('info', message, args),
    warn: (message, ...args) => log('warn', message, args),
    error: (message, ...args) => log('error', message, args),
    child: (childScope) =>
      createLogger({
        level,
        scope: `${scope}:${childScope}`,
        ...(options.sink !== undefined ? { sink: options.sink } : {}),
      }),
  };
}
