export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

// 和更新优先级相关，只在 concurrent 模式下生效
// 当前 NoLane 就可以了
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

export const NoTimestamp = -1;
