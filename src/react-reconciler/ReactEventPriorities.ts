import { Lane, Lanes, getHighestPriorityLane, includesNonIdleWork } from './ReactFiberLane';

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
export function higherEventPriority(a: Lane, b: Lane): Lane {
  return a !== 0 && a < b ? a : b;
}

export function lowerEventPriority(a: Lane, b: Lane): Lane {
  return a === 0 || a > b ? a : b;
}

export function isHigherEventPriority(a: Lane, b: Lane): boolean {
  return a !== 0 && a < b;
}
export function lanesToEventPriority(lanes: Lanes): Lane {
  const lane = getHighestPriorityLane(lanes);
  if (!isHigherEventPriority(EventPriority.DiscreteEventPriority, lane)) {
    return EventPriority.DiscreteEventPriority;
  }
  if (!isHigherEventPriority(EventPriority.ContinuousEventPriority, lane)) {
    return EventPriority.ContinuousEventPriority;
  }
  if (includesNonIdleWork(lane)) {
    return EventPriority.DefaultEventPriority;
  }
  return EventPriority.IdleEventPriority;
}
