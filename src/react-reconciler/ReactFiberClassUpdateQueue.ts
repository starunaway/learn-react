import { Fiber } from './ReactInternalTypes';

export function initializeUpdateQueue(fiber: Fiber): void {
  // const queue: UpdateQueue<State> = {
  //   baseState: fiber.memoizedState,
  //   firstBaseUpdate: null,
  //   lastBaseUpdate: null,
  //   shared: {
  // 	pending: null,
  // 	lanes: NoLanes,
  // 	hiddenCallbacks: null,
  //   },
  //   callbacks: null,
  // };
  fiber.updateQueue = {
    shared: {
      pending: null,
    },
  };
}
