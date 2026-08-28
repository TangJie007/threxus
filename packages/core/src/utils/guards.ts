/**
 * 共享的轻量运行时判断。
 *
 * 一律从 `es-toolkit` **具名导入**，便于消费方 / 打包器 tree-shake。
 * 禁止：`import * as _ from 'es-toolkit'` 或默认导入整个包。
 */

export { isFunction, isNil, isSymbol } from 'es-toolkit';
