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
