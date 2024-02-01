import { FiberRoot } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';

export type Lanes = number;
export type LaneMap<T> = Array<T>;

// Lane values below should be kept in sync with getLabelForLane(), used by react-devtools-timeline.
// If those values are changed that package should be rebuilt and redeployed.

export const TotalLanes = 31;

export enum Lane {
  NoLane = /*                           */ 0b0000000000000000000000000000000,
  SyncLane = /*                         */ 0b0000000000000000000000000000001,
  InputContinuousHydrationLane = /*     */ 0b0000000000000000000000000000010,
  InputContinuousLane = /*              */ 0b0000000000000000000000000000100,
  DefaultHydrationLane = /*             */ 0b0000000000000000000000000001000,
  DefaultLane = /*                      */ 0b0000000000000000000000000010000,
  TransitionHydrationLane = /*          */ 0b0000000000000000000000000100000,
  TransitionLane1 = /*                  */ 0b0000000000000000000000001000000,
  TransitionLane2 = /*                  */ 0b0000000000000000000000010000000,
  TransitionLane3 = /*                  */ 0b0000000000000000000000100000000,
  TransitionLane4 = /*                  */ 0b0000000000000000000001000000000,
  TransitionLane5 = /*                  */ 0b0000000000000000000010000000000,
  TransitionLane6 = /*                  */ 0b0000000000000000000100000000000,
  TransitionLane7 = /*                  */ 0b0000000000000000001000000000000,
  TransitionLane8 = /*                  */ 0b0000000000000000010000000000000,
  TransitionLane9 = /*                  */ 0b0000000000000000100000000000000,
  TransitionLane10 = /*                 */ 0b0000000000000001000000000000000,
  TransitionLane11 = /*                 */ 0b0000000000000010000000000000000,
  TransitionLane12 = /*                 */ 0b0000000000000100000000000000000,
  TransitionLane13 = /*                 */ 0b0000000000001000000000000000000,
  TransitionLane14 = /*                 */ 0b0000000000010000000000000000000,
  TransitionLane15 = /*                 */ 0b0000000000100000000000000000000,
  TransitionLane16 = /*                 */ 0b0000000001000000000000000000000,
  RetryLanes = /*                       */ 0b0000111110000000000000000000000,
  RetryLane1 = /*                       */ 0b0000000010000000000000000000000,
  RetryLane2 = /*                       */ 0b0000000100000000000000000000000,
  RetryLane3 = /*                       */ 0b0000001000000000000000000000000,
  RetryLane4 = /*                       */ 0b0000010000000000000000000000000,
  RetryLane5 = /*                       */ 0b0000100000000000000000000000000,
  SelectiveHydrationLane = /*           */ 0b0001000000000000000000000000000,
  IdleHydrationLane = /*                */ 0b0010000000000000000000000000000,
  IdleLane = /*                         */ 0b0100000000000000000000000000000,
  OffscreenLane = /*                    */ 0b1000000000000000000000000000000,
}

export const NoLanes: Lanes = /*        */ 0b0000000000000000000000000000000;

export const SomeRetryLane = Lane.RetryLane1;
const TransitionLanes: Lanes = /*       */ 0b0000000001111111111111111000000;

const NonIdleLanes: Lanes = /*          */ 0b0001111111111111111111111111111;

export const NoTimestamp = -1;

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
  switch (getHighestPriorityLane(lanes)) {
    case Lane.SyncLane:
      return Lane.SyncLane;
    case Lane.InputContinuousHydrationLane:
      return Lane.InputContinuousHydrationLane;
    case Lane.InputContinuousLane:
      return Lane.InputContinuousLane;
    case Lane.DefaultHydrationLane:
      return Lane.DefaultHydrationLane;
    case Lane.DefaultLane:
      return Lane.DefaultLane;
    case Lane.TransitionHydrationLane:
      return Lane.TransitionHydrationLane;
    case Lane.TransitionLane1:
    case Lane.TransitionLane2:
    case Lane.TransitionLane3:
    case Lane.TransitionLane4:
    case Lane.TransitionLane5:
    case Lane.TransitionLane6:
    case Lane.TransitionLane7:
    case Lane.TransitionLane8:
    case Lane.TransitionLane9:
    case Lane.TransitionLane10:
    case Lane.TransitionLane11:
    case Lane.TransitionLane12:
    case Lane.TransitionLane13:
    case Lane.TransitionLane14:
    case Lane.TransitionLane15:
    case Lane.TransitionLane16:
      return lanes & TransitionLanes;
    case Lane.RetryLane1:
    case Lane.RetryLane2:
    case Lane.RetryLane3:
    case Lane.RetryLane4:
    case Lane.RetryLane5:
      return lanes & Lane.RetryLanes;
    case Lane.SelectiveHydrationLane:
      return Lane.SelectiveHydrationLane;
    case Lane.IdleHydrationLane:
      return Lane.IdleHydrationLane;
    case Lane.IdleLane:
      return Lane.IdleLane;
    case Lane.OffscreenLane:
      return Lane.OffscreenLane;
    default:
      // This shouldn't be reachable, but as a fallback, return the entire bitmask.
      return lanes;
  }
}

export function createLaneMap<T>(initial: T): LaneMap<T> {
  // Intentionally pushing one by one.
  // https://v8.dev/blog/elements-kinds#avoid-creating-holes
  const laneMap = [];
  for (let i = 0; i < TotalLanes; i++) {
    laneMap.push(initial);
  }
  return laneMap;
}

function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - Math.clz32(lanes);
}

export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane) {
  return (a & b) !== NoLanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane) {
  return (set & subset) === subset;
}

function laneToIndex(lane: Lane) {
  return pickArbitraryLaneIndex(lane);
}

export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}

export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b;
}

export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
}

export function includesExpiredLane(root: FiberRoot, lanes: Lanes) {
  // This is a separate check from includesBlockingLane because a lane can
  // expire after a render has already started.
  return (lanes & root.expiredLanes) !== NoLanes;
}

export function includesSyncLane(lanes: Lanes) {
  return (lanes & Lane.SyncLane) !== NoLanes;
}

export function includesNonIdleWork(lanes: Lanes) {
  return (lanes & NonIdleLanes) !== NoLanes;
}
export function includesOnlyRetries(lanes: Lanes) {
  return (lanes & Lane.RetryLanes) === lanes;
}
export function includesOnlyNonUrgentLanes(lanes: Lanes) {
  const UrgentLanes = Lane.SyncLane | Lane.InputContinuousLane | Lane.DefaultLane;
  return (lanes & UrgentLanes) === NoLanes;
}
export function includesOnlyTransitions(lanes: Lanes) {
  return (lanes & TransitionLanes) === lanes;
}

export function includesBlockingLane(root: FiberRoot, lanes: Lanes) {
  const SyncDefaultLanes =
    Lane.InputContinuousHydrationLane |
    Lane.InputContinuousLane |
    Lane.DefaultHydrationLane |
    Lane.DefaultLane;
  return (lanes & SyncDefaultLanes) !== NoLanes;
}

export function getLanesToRetrySynchronouslyOnError(root: FiberRoot): Lanes {
  const everythingButOffscreen = root.pendingLanes & ~Lane.OffscreenLane;
  if (everythingButOffscreen !== NoLanes) {
    return everythingButOffscreen;
  }
  if (everythingButOffscreen & Lane.OffscreenLane) {
    return Lane.OffscreenLane;
  }
  return NoLanes;
}

export function isTransitionLane(lane: Lane) {
  return (lane & TransitionLanes) !== NoLanes;
}

export function markRootEntangled(root: FiberRoot, entangledLanes: Lanes) {
  // In addition to entangling each of the given lanes with each other, we also
  // have to consider _transitive_ entanglements. For each lane that is already
  // entangled with *any* of the given lanes, that lane is now transitively
  // entangled with *all* the given lanes.
  //
  // Translated: If C is entangled with A, then entangling A with B also
  // entangles C with B.
  //
  // If this is hard to grasp, it might help to intentionally break this
  // function and look at the tests that fail in ReactTransition-test.js. Try
  // commenting out one of the conditions below.

  const rootEntangledLanes = (root.entangledLanes |= entangledLanes);
  const entanglements = root.entanglements;
  let lanes = rootEntangledLanes;
  while (lanes) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    if (
      // Is this one of the newly entangled lanes?
      (lane & entangledLanes) |
      // Is this lane transitively entangled with the newly entangled lanes?
      (entanglements[index] & entangledLanes)
    ) {
      entanglements[index] |= entangledLanes;
    }
    lanes &= ~lane;
  }
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function pickArbitraryLane(lanes: Lanes): Lane {
  // This wrapper function gets inlined. Only exists so to communicate that it
  // doesn't matter which bit is selected; you can pick any bit without
  // affecting the algorithms where its used. Here I'm using
  // getHighestPriorityLane because it requires the fewest operations.
  return getHighestPriorityLane(lanes);
}
// read: 这里需要多看看，还没理解透彻
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
  if (updateLane !== Lane.IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }

  const eventTimes = root.eventTimes;
  const index = laneToIndex(updateLane);
  // We can always overwrite an existing timestamp because we prefer the most
  // recent event, and we assume time is monotonically increasing.
  eventTimes[index] = eventTime;
}

function computeExpirationTime(lane: Lane, currentTime: number) {
  switch (lane) {
    case Lane.SyncLane:
    case Lane.InputContinuousHydrationLane:
    case Lane.InputContinuousLane:
      // User interactions should expire slightly more quickly.
      //
      // NOTE: This is set to the corresponding constant as in Scheduler.js.
      // When we made it larger, a product metric in www regressed, suggesting
      // there's a user interaction that's being starved by a series of
      // synchronous updates. If that theory is correct, the proper solution is
      // to fix the starvation. However, this scenario supports the idea that
      // expiration times are an important safeguard when starvation
      // does happen.
      return currentTime + 250;
    case Lane.DefaultHydrationLane:
    case Lane.DefaultLane:
    case Lane.TransitionHydrationLane:
    case Lane.TransitionLane1:
    case Lane.TransitionLane2:
    case Lane.TransitionLane3:
    case Lane.TransitionLane4:
    case Lane.TransitionLane5:
    case Lane.TransitionLane6:
    case Lane.TransitionLane7:
    case Lane.TransitionLane8:
    case Lane.TransitionLane9:
    case Lane.TransitionLane10:
    case Lane.TransitionLane11:
    case Lane.TransitionLane12:
    case Lane.TransitionLane13:
    case Lane.TransitionLane14:
    case Lane.TransitionLane15:
    case Lane.TransitionLane16:
      return currentTime + 5000;
    case Lane.RetryLane1:
    case Lane.RetryLane2:
    case Lane.RetryLane3:
    case Lane.RetryLane4:
    case Lane.RetryLane5:
      // TODO: Retries should be allowed to expire if they are CPU bound for
      // too long, but when I made this change it caused a spike in browser
      // crashes. There must be some other underlying bug; not super urgent but
      // ideally should figure out why and fix it. Unfortunately we don't have
      // a repro for the crashes, only detected via production metrics.
      return NoTimestamp;
    case Lane.SelectiveHydrationLane:
    case Lane.IdleHydrationLane:
    case Lane.IdleLane:
    case Lane.OffscreenLane:
      // Anything idle priority or lower should never expire.
      return NoTimestamp;
    default:
      return NoTimestamp;
  }
}

export function markStarvedLanesAsExpired(root: FiberRoot, currentTime: number): void {
  // TODO: This gets called every time we yield. We can optimize by storing
  // the earliest expiration time on the root. Then use that to quickly bail out
  // of this function.

  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  const expirationTimes = root.expirationTimes;

  // Iterate through the pending lanes and check if we've reached their
  // expiration time. If so, we'll assume the update is being starved and mark
  // it as expired to force it to finish.
  let lanes = pendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    const expirationTime = expirationTimes[index];
    if (expirationTime === NoTimestamp) {
      // Found a pending lane with no expiration time. If it's not suspended, or
      // if it's pinged, assume it's CPU-bound. Compute a new expiration time
      // using the current time.
      if ((lane & suspendedLanes) === NoLanes || (lane & pingedLanes) !== NoLanes) {
        // Assumes timestamps are monotonically increasing.
        expirationTimes[index] = computeExpirationTime(lane, currentTime);
      }
    } else if (expirationTime <= currentTime) {
      // This lane expired
      root.expiredLanes |= lane;
    }

    lanes &= ~lane;
  }
}

export function markRootFinished(root: FiberRoot, remainingLanes: Lanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;

  root.pendingLanes = remainingLanes;

  // Let's try everything again
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;

  root.expiredLanes &= remainingLanes;
  root.mutableReadLanes &= remainingLanes;

  root.entangledLanes &= remainingLanes;

  const entanglements = root.entanglements;
  const eventTimes = root.eventTimes;
  const expirationTimes = root.expirationTimes;

  // Clear the lanes that no longer have pending work
  let lanes = noLongerPendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    entanglements[index] = NoLanes;
    eventTimes[index] = NoTimestamp;
    expirationTimes[index] = NoTimestamp;

    lanes &= ~lane;
  }
}

export function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes) {
  root.suspendedLanes |= suspendedLanes;
  root.pingedLanes &= ~suspendedLanes;

  // The suspended lanes are no longer CPU-bound. Clear their expiration times.
  const expirationTimes = root.expirationTimes;
  let lanes = suspendedLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    expirationTimes[index] = NoTimestamp;

    lanes &= ~lane;
  }
}

export function getMostRecentEventTime(root: FiberRoot, lanes: Lanes): number {
  const eventTimes = root.eventTimes;

  let mostRecentEventTime = NoTimestamp;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    const eventTime = eventTimes[index];
    if (eventTime > mostRecentEventTime) {
      mostRecentEventTime = eventTime;
    }

    lanes &= ~lane;
  }

  return mostRecentEventTime;
}

export function markRootPinged(root: FiberRoot, pingedLanes: Lanes, eventTime: number) {
  root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
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
      (nextLane === Lane.DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      // Keep working on the existing in-progress tree. Do not interrupt.
      return wipLanes;
    }
  }

  if ((nextLanes & Lane.InputContinuousLane) !== NoLanes) {
    // When updates are sync by default, we entangle continuous priority updates
    // and default updates, so they render in the same batch. The only reason
    // they use separate lanes is because continuous updates should interrupt
    // transitions, but default updates should not.
    nextLanes |= pendingLanes & Lane.DefaultLane;
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

export function getTransitionsForLanes(root: FiberRoot, lanes: Lane | Lanes): null {
  return null;
}
