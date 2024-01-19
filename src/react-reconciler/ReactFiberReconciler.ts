import { Container } from '../react-dom/ReactFiberHostConfig';
import { ReactNodeList } from '../shared/ReactTypes';
import { Lane } from './ReactFiberLane';

import type {
  Fiber,
  FiberRoot,
  SuspenseHydrationCallbacks,
  TransitionTracingCallbacks,
} from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';
import { WorkTag } from './ReactWorkTags';

import {
  requestEventTime,
  requestUpdateLane,
  scheduleUpdateOnFiber,
  scheduleInitialHydrationOnRoot,
  flushRoot,
  batchedUpdates,
  flushSync,
  isAlreadyRendering,
  flushControlled,
  deferredUpdates,
  discreteUpdates,
  flushPassiveEffects,
} from './ReactFiberWorkLoop';

export {
  batchedUpdates,
  deferredUpdates,
  discreteUpdates,
  flushControlled,
  flushSync,
  isAlreadyRendering,
  flushPassiveEffects,
};
export function createContainer(
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onRecoverableError: (error: any) => void,
  transitionCallbacks: null | TransitionTracingCallbacks
): FiberRoot {
  const hydrate = false;
  const initialChildren = null;
  return createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
    identifierPrefix,
    onRecoverableError,
    transitionCallbacks
  );
}

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot,
  //   fixme: 18.2 版本都是 createRoot().render 和 FC，原来的 Legacy 和 ClassComponent 都不需要看，因此不需要在parentComponent参数
  parentComponent?: null,
  callback?: Function | null
): Lane {
  const current = container.current;
  const eventTime = requestEventTime();
  const lane = requestUpdateLane(current);

  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  const update = createUpdate(eventTime, lane);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element };

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    update.callback = callback;
  }

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    console.log('这里是入口,react 更新从此处开始');
    console.log(
      '如果是后续渲染,应该在其他地方，可以在合成事件 / setState/ useEffect 等事件内打断点'
    );
    scheduleUpdateOnFiber(root, current, lane, eventTime);
    entangleTransitions(root, current, lane);
  }

  return lane;
}

export function attemptHydrationAtCurrentPriority(fiber: Fiber): void {
  if (fiber.tag !== WorkTag.SuspenseComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority other than synchronously flush it.
    return;
  }
  const lane = requestUpdateLane(fiber);
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export function attemptSynchronousHydration(fiber: Fiber): void {
  switch (fiber.tag) {
    case WorkTag.HostRoot: {
      const root: FiberRoot = fiber.stateNode;
      if (isRootDehydrated(root)) {
        // Flush the first scheduled "update".
        const lanes = getHighestPriorityPendingLanes(root);
        flushRoot(root, lanes);
      }
      break;
    }
    case WorkTag.SuspenseComponent: {
      flushSync(() => {
        const root = enqueueConcurrentRenderForLane(fiber, Lane.SyncLane);
        if (root !== null) {
          const eventTime = requestEventTime();
          scheduleUpdateOnFiber(root, fiber, Lane.SyncLane, eventTime);
        }
      });
      // If we're still blocked after this, we need to increase
      // the priority of any promises resolving within this
      // boundary so that they next attempt also has higher pri.
      const retryLane = Lane.SyncLane;
      markRetryLaneIfNotHydrated(fiber, retryLane);
      break;
    }
  }
}

export function attemptContinuousHydration(fiber: Fiber): void {
  if (fiber.tag !== WorkTag.SuspenseComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority and they should not suspend on I/O,
    // since you have to wrap anything that might suspend in
    // Suspense.
    return;
  }
  const lane = Lane.SelectiveHydrationLane;
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export function attemptDiscreteHydration(fiber: Fiber): void {
  if (fiber.tag !== WorkTag.SuspenseComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority and they should not suspend on I/O,
    // since you have to wrap anything that might suspend in
    // Suspense.
    return;
  }
  const lane = Lane.SyncLane;
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}
