import { Lane } from './ReactFiberLane';

// export enum EventPriority {
//   DiscreteEventPriority = Lane.SyncLane,
//   ContinuousEventPriority = Lane.InputContinuousLane,
//   DefaultEventPriority = Lane.DefaultLane,
//   IdleEventPriority = Lane.IdleLane,
//   NoLane = Lane.NoLane,
// }

export const EventPriority: { [key: string]: Lane } = {
  DiscreteEventPriority: Lane.SyncLane,
  ContinuousEventPriority: Lane.InputContinuousLane,
  DefaultEventPriority: Lane.DefaultLane,
  IdleEventPriority: Lane.IdleLane,
  NoLane: Lane.NoLane,
} as const;

let currentUpdatePriority = EventPriority.NoLane;

export function getCurrentUpdatePriority(): Lane {
  return currentUpdatePriority;
}

export function setCurrentUpdatePriority(newPriority: Lane) {
  currentUpdatePriority = newPriority;
}

export function runWithPriority<T>(priority: Lane, fn: () => T): T {
  const previousPriority = currentUpdatePriority;
  try {
    currentUpdatePriority = priority;
    return fn();
  } finally {
    currentUpdatePriority = previousPriority;
  }
}
