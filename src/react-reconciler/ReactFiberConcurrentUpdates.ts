import { Lane } from './ReactFiberLane';

export type ConcurrentUpdate = {
  next: ConcurrentUpdate;
  lane: Lane;
};
