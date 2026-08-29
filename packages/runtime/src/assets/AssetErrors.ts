/**
 * 资产模块错误码扩展与专用错误类型。
 */

import { ThrexusError } from '../errors';

/** 访问已释放的 AssetHandle.value 时抛出。 */
export class ReleasedAssetHandleError extends ThrexusError {
  constructor(message = 'Cannot access value of a released AssetHandle.') {
    super('RELEASED_ASSET_HANDLE', message);
    this.name = 'ReleasedAssetHandleError';
  }
}
