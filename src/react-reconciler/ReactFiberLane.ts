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

const NonIdleLanes: Lanes = /*          */ 0b0001111111111111111111111111111;
