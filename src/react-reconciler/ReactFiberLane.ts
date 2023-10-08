import { FiberRoot } from './ReactInternalTypes';

export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

// 和更新优先级相关，只在 concurrent 模式下生效
// 当前 NoLane 就可以了
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

export const NoTimestamp = -1;

export const IdleLane: Lane = /*                        */ 0b0100000000000000000000000000000;

// todo lane 模型后续再看
function laneToIndex(lane: Lane) {
  return 31 - Math.clz32(lane);
}

export function markRootUpdated(root: FiberRoot, updateLane: Lane, eventTime: number) {
  root.pendingLanes |= updateLane;

  // If there are any suspended transitions, it's possible this new update
  // could unblock them. Clear the suspended lanes so that we can try rendering
  // them again.
  //
  // TODO: We really only need to unsuspend only lanes that are in the
  // `subtreeLanes` of the updated fiber, or the update lanes of the return
  // path. This would exclude suspended updates in an unrelated sibling tree,
  // since there's no way for this update to unblock it.
  //
  // We don't do this if the incoming update is idle, because we never process
  // idle updates until after all the regular updates have finished; there's no
  // way it could unblock a transition.
  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }

  // 这里和 react 事件的优先级有关
  const eventTimes = root.eventTimes;
  const index = laneToIndex(updateLane);
  // We can always overwrite an existing timestamp because we prefer the most
  // recent event, and we assume time is monotonically increasing.
  eventTimes[index] = eventTime;
}
