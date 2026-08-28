/**
 * 帧时钟：由 Application 在每帧 update 前写入。
 */
export interface Clock {
    /** 自启动以来的累计秒数 */
    readonly elapsed: number;
    /** 上一帧间隔（秒） */
    readonly delta: number;
    /** 高性能时间戳（ms） */
    now(): number;
}
/**
 * 可变时钟实现（仅 runtime 内部使用）。
 */
export declare class RuntimeClock implements Clock {
    elapsed: number;
    delta: number;
    now(): number;
    /**
     * 推进一帧。
     *
     * @param deltaSeconds - 帧间隔（秒）
     */
    tick(deltaSeconds: number): void;
}
