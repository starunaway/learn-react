import { FiberRoot } from './ReactInternalTypes';

export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

// 和更新优先级相关，只在 concurrent 模式下生效
// 当前 NoLane 就可以了
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000100;

export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000001000;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000010000;
export const NoTimestamp = -1;

const NonIdleLanes: Lanes = /*                          */ 0b0001111111111111111111111111111;

export const IdleHydrationLane: Lane = /*               */ 0b0010000000000000000000000000000;
export const IdleLane: Lane = /*                        */ 0b0100000000000000000000000000000;

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}
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

export function includesNonIdleWork(lanes: Lanes) {
  return (lanes & NonIdleLanes) !== NoLanes;
}

export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  // todo 暂时不看和优先级有关的逻辑
  return NoLanes;
  /** 
   * 
  {
    // Early bailout if there's no pending work left.
    const pendingLanes = root.pendingLanes;
    if (pendingLanes === NoLanes) {
      return NoLanes;
    }

    let nextLanes = NoLanes;

    const suspendedLanes = root.suspendedLanes;
    const pingedLanes = root.pingedLanes;

    // Do not work on any idle work until all the non-idle work has finished,
    // even if the work is suspended.
    const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
    if (nonIdlePendingLanes !== NoLanes) {
      const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
      if (nonIdleUnblockedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
      } else {
        const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
        if (nonIdlePingedLanes !== NoLanes) {
          nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
        }
      }
    } else {
      // The only remaining work is Idle.
      const unblockedLanes = pendingLanes & ~suspendedLanes;
      if (unblockedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(unblockedLanes);
      } else {
        if (pingedLanes !== NoLanes) {
          nextLanes = getHighestPriorityLanes(pingedLanes);
        }
      }
    }

    if (nextLanes === NoLanes) {
      // This should only be reachable if we're suspended
      // TODO: Consider warning in this path if a fallback timer is not scheduled.
      return NoLanes;
    }

    // If we're already in the middle of a render, switching lanes will interrupt
    // it and we'll lose our progress. We should only do this if the new lanes are
    // higher priority.
    if (
      wipLanes !== NoLanes &&
      wipLanes !== nextLanes &&
      // If we already suspended with a delay, then interrupting is fine. Don't
      // bother waiting until the root is complete.
      (wipLanes & suspendedLanes) === NoLanes
    ) {
      const nextLane = getHighestPriorityLane(nextLanes);
      const wipLane = getHighestPriorityLane(wipLanes);
      if (
        // Tests whether the next lane is equal or lower priority than the wip
        // one. This works because the bits decrease in priority as you go left.
        nextLane >= wipLane ||
        // Default priority updates should not interrupt transition updates. The
        // only difference between default updates and transition updates is that
        // default updates do not support refresh transitions.
        (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
      ) {
        // Keep working on the existing in-progress tree. Do not interrupt.
        return wipLanes;
      }
    }

    if (
      allowConcurrentByDefault &&
      (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode
    ) {
      // Do nothing, use the lanes as they were assigned.
    } else if ((nextLanes & InputContinuousLane) !== NoLanes) {
      // When updates are sync by default, we entangle continuous priority updates
      // and default updates, so they render in the same batch. The only reason
      // they use separate lanes is because continuous updates should interrupt
      // transitions, but default updates should not.
      nextLanes |= pendingLanes & DefaultLane;
    }

    // Check for entangled lanes and add them to the batch.
    //
    // A lane is said to be entangled with another when it's not allowed to render
    // in a batch that does not also include the other lane. Typically we do this
    // when multiple updates have the same source, and we only want to respond to
    // the most recent event from that source.
    //
    // Note that we apply entanglements *after* checking for partial work above.
    // This means that if a lane is entangled during an interleaved event while
    // it's already rendering, we won't interrupt it. This is intentional, since
    // entanglement is usually "best effort": we'll try our best to render the
    // lanes in the same batch, but it's not worth throwing out partially
    // completed work in order to do it.
    // TODO: Reconsider this. The counter-argument is that the partial work
    // represents an intermediate state, which we don't want to show to the user.
    // And by spending extra time finishing it, we're increasing the amount of
    // time it takes to show the final state, which is what they are actually
    // waiting for.
    //
    // For those exceptions where entanglement is semantically important, like
    // useMutableSource, we should ensure that there is no partial work at the
    // time we apply the entanglement.
    const entangledLanes = root.entangledLanes;
    if (entangledLanes !== NoLanes) {
      const entanglements = root.entanglements;
      let lanes = nextLanes & entangledLanes;
      while (lanes > 0) {
        const index = pickArbitraryLaneIndex(lanes);
        const lane = 1 << index;

        nextLanes |= entanglements[index];

        lanes &= ~lane;
      }
    }

    return nextLanes;
  }

  */
}

export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane) {
  return (a & b) !== NoLanes;
}
