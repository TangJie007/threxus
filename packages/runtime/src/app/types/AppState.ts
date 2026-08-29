/**
 * App 生命周期状态。
 *
 * ```text
 * created → starting → running ⇄ paused
 *              ↓           ↓
 *           failed    disposing → disposed
 * ```
 */

export type AppState =
  /** 已创建，可 use / start / dispose。 */
  | 'created'
  /** 正在启动：解析依赖图、按序 setup Feature。 */
  | 'starting'
  /** 启动成功，所有 Feature 已 activate。 */
  | 'running'
  /** 已暂停；取消 RAF，resume 后恢复调度。 */
  | 'paused'
  /** 正在销毁：abort → 逆序 dispose Scope → 清空服务。 */
  | 'disposing'
  /** 已完全销毁（终态）。 */
  | 'disposed'
  /** 启动失败且已回滚（终态，不可 restart，需 dispose 或重建 App）。 */
  | 'failed';
