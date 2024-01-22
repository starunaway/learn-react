import { mixed } from '../types';
import {
  Lane,
  Lanes,
  NoLanes,
  intersectLanes,
  isTransitionLane,
  markRootEntangled,
  mergeLanes,
} from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { isUnsafeClassRenderPhaseUpdate } from './ReactFiberWorkLoop';

import {
  enqueueConcurrentClassUpdate,
  unsafe_markUpdateLaneFromFiberToRoot,
} from './ReactFiberConcurrentUpdates';
export enum QueueUpdateState {
  UpdateState = 0,
  ReplaceState = 1,
  ForceUpdate = 2,
  CaptureUpdate = 3,
}

export type Update<State> = {
  // TODO: Temporary field. Will remove this by storing a map of
  // transition -> event time on the root.
  eventTime: number;
  lane: Lane;

  tag: QueueUpdateState;
  payload: any;
  callback: Function | null;

  next: Update<State> | null;
};

export type SharedQueue<State> = {
  pending: Update<State> | null;
  interleaved: Update<State> | null;
  lanes: Lanes;
};
export type UpdateQueue<State> = {
  baseState: State;
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;
  shared: SharedQueue<State>;
  effects: Array<Update<State>> | null;
};

// export const UpdateState = 0;
// export const ReplaceState = 1;
// export const ForceUpdate = 2;
// export const CaptureUpdate = 3;

export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      interleaved: null,
      lanes: NoLanes,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}

export function createUpdate(eventTime: number, lane: Lane): Update<any> {
  const update: Update<any> = {
    eventTime,
    lane,
    tag: QueueUpdateState.UpdateState,
    payload: null,
    callback: null,

    next: null,
  };
  return update;
}

export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  lane: Lane
): FiberRoot | null {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return null;
  }

  const sharedQueue: SharedQueue<State> = updateQueue.shared;

  if (isUnsafeClassRenderPhaseUpdate(fiber)) {
    // This is an unsafe render phase update. Add directly to the update
    // queue so we can process it immediately during the current render.
    const pending = sharedQueue.pending;
    if (pending === null) {
      // This is the first update. Create a circular list.
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    sharedQueue.pending = update;

    // Update the childLanes even though we're most likely already rendering
    // this fiber. This is for backwards compatibility in the case where you
    // update a different component during render phase than the one that is
    // currently renderings (a pattern that is accompanied by a warning).
    return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane);
  } else {
    return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
  }
}

export function entangleTransitions(root: FiberRoot, fiber: Fiber, lane: Lane) {
  console.log('entangleTransitions >1 这里是处理Transition的逻辑,可能不需要看？');
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    // Only occurs if the fiber has been unmounted.
    return;
  }

  const sharedQueue: SharedQueue<mixed> = updateQueue.shared;
  // read: 这里和 Transition 更新相关。如果被标记为Transition(比如 useTransition hook)，react 可以去更新其他的节点/执行后需要操作
  // read: v1:第一版理解：在 scheduleUpdateOnFiber 后调用entangleTransitions，其实是看 root 是不是还有更新，，
  //          如果有，更新 root 上的相关 lanes，在接下来的执行过程中会处理
  console.log('entangleTransitions >2 ,如果接下有 3,需要看');
  if (isTransitionLane(lane)) {
    console.log('entangleTransitions >3 这里是处理Transition的逻辑,需要看');

    let queueLanes = sharedQueue.lanes;

    // If any entangled lanes are no longer pending on the root, then they must
    // have finished. We can remove them from the shared queue, which represents
    // a superset of the actually pending lanes. In some cases we may entangle
    // more than we need to, but that's OK. In fact it's worse if we *don't*
    // entangle when we should.
    queueLanes = intersectLanes(queueLanes, root.pendingLanes);

    // Entangle the new transition lane with the other transition lanes.
    const newQueueLanes = mergeLanes(queueLanes, lane);
    sharedQueue.lanes = newQueueLanes;
    // Even if queue.lanes already include lane, we don't know for certain if
    // the lane finished since the last time we entangled it. So we need to
    // entangle it again, just to be sure.
    markRootEntangled(root, newQueueLanes);
  }
}
