import { FiberRoot } from './ReactInternalTypes';

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
  RetryLaness = /*                      */ 0b0000111110000000000000000000000,
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
