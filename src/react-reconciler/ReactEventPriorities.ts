import { Lane } from './ReactFiberLane';

export enum EventPriority {
  DiscreteEventPriority = Lane.SyncLane,
  ContinuousEventPriority = Lane.InputContinuousLane,
  DefaultEventPriority = Lane.DefaultLane,
  IdleEventPriority = Lane.IdleLane,
  NoLane = Lane.NoLane,
}

let currentUpdatePriority: EventPriority = EventPriority.NoLane;

export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority;
}

export function setCurrentUpdatePriority(newPriority: EventPriority) {
  currentUpdatePriority = newPriority;
}

export function runWithPriority<T>(priority: EventPriority, fn: () => T): T {
  const previousPriority = currentUpdatePriority;
  try {
    currentUpdatePriority = priority;
    return fn();
  } finally {
    currentUpdatePriority = previousPriority;
  }
}
