import { Lane, Lanes } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';

export type Update<State> = {
  // TODO: Temporary field. Will remove this by storing a map of
  // transition -> event time on the root.
  eventTime: number;
  lane: Lane;
  tag: 0 | 1 | 2 | 3;
  payload: any;
  callback: (() => any) | null;

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

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

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

export function createUpdate(eventTime: number, lane: Lane): Update<any> {
  const update: Update<any> = {
    eventTime,
    lane,

    tag: UpdateState,
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