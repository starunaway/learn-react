import { Lane } from './ReactFiberLane';

export type ConcurrentUpdate = {
  next: ConcurrentUpdate;
  lane: Lane;
};


enqueueConcurrentClassUpdate,
unsafe_markUpdateLaneFromFiberToRoot,