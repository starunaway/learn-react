import type { Lane } from './ReactFiberLane';
import type { Fiber, FiberRoot } from './ReactInternalTypes';

import type { UpdateQueue as HookQueue, Update as HookUpdate } from './ReactFiberHooks';

import type {
  SharedQueue as ClassQueue,
  Update as ClassUpdate,
} from './ReactFiberClassUpdateQueue';
import { HostRoot } from './ReactWorkTags';

export type ConcurrentUpdate = {
  next: ConcurrentUpdate;
  lane: Lane;
};

// An array of all update queues that received updates during the current
// render. When this render exits, either because it finishes or because it is
// interrupted, the interleaved updates will be transferred onto the main part
// of the queue.
let concurrentQueues: Array<HookQueue<any, any> | ClassQueue<any>> | null = null;

export function pushConcurrentUpdateQueue(queue: HookQueue<any, any> | ClassQueue<any>) {
  if (concurrentQueues === null) {
    concurrentQueues = [queue];
  } else {
    concurrentQueues.push(queue);
  }
}

export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane
) {
  const interleaved = queue.interleaved;
  if (interleaved === null) {
    // This is the first update. Create a circular list.
    update.next = update;
    // At the end of the current render, this queue's interleaved updates will
    // be transferred to the pending queue.
    pushConcurrentUpdateQueue(queue);
  } else {
    update.next = interleaved.next;
    interleaved.next = update;
  }
  queue.interleaved = update;

  return markUpdateLaneFromFiberToRoot(fiber, lane);
}

// todo  lane 待实现
function markUpdateLaneFromFiberToRoot(sourceFiber: Fiber, lane: Lane): FiberRoot | null {
  // Update the source fiber's lanes
  //   sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  //   let alternate = sourceFiber.alternate;
  //   if (alternate !== null) {
  //     alternate.lanes = mergeLanes(alternate.lanes, lane);
  //   }

  // Walk the parent path to the root and update the child lanes.
  let node = sourceFiber;
  let parent = sourceFiber.return;
  //   while (parent !== null) {
  //     parent.childLanes = mergeLanes(parent.childLanes, lane);
  //     alternate = parent.alternate;
  //     if (alternate !== null) {
  //       alternate.childLanes = mergeLanes(alternate.childLanes, lane);
  //     }
  //     node = parent;
  //     parent = parent.return;
  //   }
  if (node.tag === HostRoot) {
    const root: FiberRoot = node.stateNode;
    return root;
  } else {
    return null;
  }
}
