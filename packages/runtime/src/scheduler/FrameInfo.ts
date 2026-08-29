/** 单帧回调共享的时间信息（delta 单位为秒）。 */
export interface FrameInfo {
  /** 距上一帧的时间差（秒），已应用 maxDelta 截断。 */
  readonly delta: number;
  /** 应用启动后的累计时间（秒）。 */
  readonly elapsed: number;
  /** 从 1 开始的帧序号。 */
  readonly frame: number;
  /** 当前帧的高精度时间戳（与 RAF time 一致）。 */
  readonly time: number;
}
