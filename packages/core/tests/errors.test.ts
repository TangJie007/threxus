/**
 * 错误码与消息格式约定。
 */

import { describe, expect, it } from 'vitest';
import {
  ThrexusError,
  ThrexusErrorCode,
  providerNotFoundError,
  createToken,
} from '../src/index';

describe('ThrexusError', () => {
  it('message 形如 [CODE] 详情，且 code 可单独读取', () => {
    const token = createToken<string>('demo-token');
    const error = providerNotFoundError(token);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ThrexusError);
    expect(error.name).toBe('ThrexusError');
    expect(error.code).toBe(ThrexusErrorCode.PROVIDER_NOT_FOUND);
    expect(error.message).toBe(
      `[${ThrexusErrorCode.PROVIDER_NOT_FOUND}] 未找到令牌 "demo-token" 的 Provider。请确认已 register / set，或已通过 @Module providers 注册。`,
    );
  });
});
