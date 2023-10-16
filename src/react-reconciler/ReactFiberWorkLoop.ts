import { now, cancelCallback as Scheduler_cancelCallback } from '@/scheduler/Scheduler';
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  NoTimestamp,
  SyncLane,
  getHighestPriorityLane,
  markRootUpdated,
} from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { LegacyRoot } from './ReactRootTags';
import { flushSyncCallbacks, scheduleLegacySyncCallback } from './ReactFiberSyncTaskQueue';
import { scheduleMicrotask, supportsMicrotasks } from './ReactFiberHostConfig';

type ExecutionContext = number;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

// Describes where we are in the React execution stack
let executionContext: ExecutionContext = NoContext;
// The root we're working on
let workInProgressRoot: FiberRoot | null = null;
// The fiber we're working on
let workInProgress: Fiber | null = null;
// The lanes we're rendering
let workInProgressRootRenderLanes: Lanes = NoLanes;

let workInProgressRootExitStatus: RootExitStatus = RootInProgress;

// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

// todo，当前可以暂时不关心优先级
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;

// todo，当前可以暂时不关心优先级
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;

export function requestUpdateLane(fiber: Fiber): Lane {
  // Special cases
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) {
    return SyncLane;
  }

  // todo 目前没有实现优先级
  return SyncLane;
  //   else if (
  //     !deferRenderPhaseUpdateToNextBatch &&
  //     (executionContext & RenderContext) !== NoContext &&
  //     workInProgressRootRenderLanes !== NoLanes
  //   ) {
  //     // This is a render phase update. These are not officially supported. The
  //     // old behavior is to give this the same "thread" (lanes) as
  //     // whatever is currently rendering. So if you call `setState` on a component
  //     // that happens later in the same render, it will flush. Ideally, we want to
  //     // remove the special case and treat them as if they came from an
  //     // interleaved event. Regardless, this pattern is not officially supported.
  //     // This behavior is only a fallback. The flag only exists until we can roll
  //     // out the setState warning, since existing code might accidentally rely on
  //     // the current behavior.
  //     return pickArbitraryLane(workInProgressRootRenderLanes);
  //   }

  //   const isTransition = requestCurrentTransition() !== NoTransition;
  //   if (isTransition) {
  //     // The algorithm for assigning an update to a lane should be stable for all
  //     // updates at the same priority within the same event. To do this, the
  //     // inputs to the algorithm must be the same.
  //     //
  //     // The trick we use is to cache the first of each of these inputs within an
  //     // event. Then reset the cached values once we can be sure the event is
  //     // over. Our heuristic for that is whenever we enter a concurrent work loop.
  //     if (currentEventTransitionLane === NoLane) {
  //       // All transitions within the same event are assigned the same lane.
  //       currentEventTransitionLane = claimNextTransitionLane();
  //     }
  //     return currentEventTransitionLane;
  //   }

  //   // Updates originating inside certain React methods, like flushSync, have
  //   // their priority set by tracking it with a context variable.
  //   //
  //   // The opaque type returned by the host config is internally a lane, so we can
  //   // use that directly.
  //   // TODO: Move this type conversion to the event priority module.
  //   const updateLane: Lane = getCurrentUpdatePriority();
  //   if (updateLane !== NoLane) {
  //     return updateLane;
  //   }

  //   // This update originated outside React. Ask the host environment for an
  //   // appropriate priority, based on the type of event.
  //   //
  //   // The opaque type returned by the host config is internally a lane, so we can
  //   // use that directly.
  //   // TODO: Move this type conversion to the event priority module.
  //   const eventLane: Lane = getCurrentEventPriority();
  //   return eventLane;
}

let currentEventTime: number = NoTimestamp;

export function requestEventTime() {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // We're inside React, so it's fine to read the actual time.
    return now();
  }
  // We're not inside React, so we may be in the middle of a browser event.
  if (currentEventTime !== NoTimestamp) {
    // Use the same start time for all updates until we enter React again.
    return currentEventTime;
  }
  // This is the first update since React yielded. Compute a new start time.
  currentEventTime = now();
  return currentEventTime;
}

export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane,
  eventTime: number
) {
  checkForNestedUpdates();

  // Mark that the root has a pending update.
  markRootUpdated(root, lane, eventTime);

  if ((executionContext & RenderContext) !== NoLanes && root === workInProgressRoot) {
    // Track lanes that were updated during the render phase
    // todo lane 模型后续再看，和更新优先级有关
    // workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
    //   workInProgressRootRenderPhaseUpdatedLanes,
    //   lane
    // );
  } else {
    // This is a normal update, scheduled from outside the render phase. For
    // example, during an input event.

    // 在开启某些特性下，会有新的功能
    // 目前只实现主流程，其他的先不关心
    // if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
    //   if (
    //     (executionContext & CommitContext) !== NoContext &&
    //     root === rootCommittingMutationOrLayoutEffects
    //   ) {
    //     if (fiber.mode & ProfileMode) {
    //       let current = fiber;
    //       while (current !== null) {
    //         if (current.tag === Profiler) {
    //           const { id, onNestedUpdateScheduled } = current.memoizedProps;
    //           if (typeof onNestedUpdateScheduled === 'function') {
    //             onNestedUpdateScheduled(id);
    //           }
    //         }
    //         current = current.return;
    //       }
    //     }
    //   }
    // }

    // 在开启某些特性下，会有新的功能
    // 目前只实现主流程，其他的先不关心
    // if (enableTransitionTracing) {
    //   const transition = ReactCurrentBatchConfig.transition;
    //   if (transition !== null) {
    //     if (transition.startTime === -1) {
    //       transition.startTime = now();
    //     }

    //     addTransitionToLanesMap(root, transition, lane);
    //   }
    // }

    if (root === workInProgressRoot) {
      // Received an update to a tree that's in the middle of rendering. Mark
      // that there was an interleaved update work on this root. Unless the
      // `deferRenderPhaseUpdateToNextBatch` flag is off and this is a render
      // phase update. In that case, we don't treat render phase updates as if
      // they were interleaved, for backwards compat reasons.
      // todo 和更新优先级有关，暂时先不看
      // if (deferRenderPhaseUpdateToNextBatch || (executionContext & RenderContext) === NoContext) {
      //   workInProgressRootInterleavedUpdatedLanes = mergeLanes(
      //     workInProgressRootInterleavedUpdatedLanes,
      //     lane
      //   );
      // }
      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // The root already suspended with a delay, which means this render
        // definitely won't finish. Since we have a new update, let's mark it as
        // suspended now, right before marking the incoming update. This has the
        // effect of interrupting the current render and switching to the update.
        // TODO: Make sure this doesn't override pings that happen while we've
        // already started rendering.
        // markRootSuspended(root, workInProgressRootRenderLanes);
      }
    }

    ensureRootIsScheduled(root, eventTime);
    if (
      lane === SyncLane &&
      executionContext === NoContext &&
      (fiber.mode & ConcurrentMode) === NoMode
    ) {
      // Flush the synchronous work now, unless we're already working or inside
      // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
      // scheduleCallbackForFiber to preserve the ability to schedule a callback
      // without immediately flushing it. We only do this for user-initiated
      // updates, to preserve historical behavior of legacy mode.
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

// 避免死循环
function checkForNestedUpdates() {
  if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
    nestedUpdateCount = 0;
    rootWithNestedUpdates = null;

    throw new Error(
      'Maximum update depth exceeded. This can happen when a component ' +
        'repeatedly calls setState inside componentWillUpdate or ' +
        'componentDidUpdate. React limits the number of nested updates to ' +
        'prevent infinite loops.'
    );
  }
}

function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  const existingCallbackNode = root.callbackNode;

  // Check if any lanes are being starved by other work. If so, mark them as
  // expired so we know to work on those next.
  // todo 首次渲染不需要检查过期，后续再补上
  // markStarvedLanesAsExpired(root, currentTime);

  // Determine the next lanes to work on, and their priority.
  // todo 暂时不使用 lane 的优先级, 先默认都是 NoLanes
  // const nextLanes = getNextLanes(
  //   root,
  //   root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  // );

  const nextLanes = NoLanes;

  if (nextLanes === NoLanes) {
    // Special case: There's nothing to work on.
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  // We use the highest priority lane to represent the priority of the callback.
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // Check if there's an existing task. We may be able to reuse it.
  // const existingCallbackPriority = root.callbackPriority;
  // if (
  //   existingCallbackPriority === newCallbackPriority &&
  //   // Special case related to `act`. If the currently scheduled task is a
  //   // Scheduler task, rather than an `act` task, cancel it and re-scheduled
  //   // on the `act` queue.
  //   !(
  //     __DEV__ &&
  //     ReactCurrentActQueue.current !== null &&
  //     existingCallbackNode !== fakeActCallbackNode
  //   )
  // ) {
  // The priority hasn't changed. We can reuse the existing task. Exit.
  // return;
  // }

  if (existingCallbackNode != null) {
    // Cancel the existing callback. We'll schedule a new one below.
    cancelCallback(existingCallbackNode);
  }

  // Schedule a new callback.
  let newCallbackNode;
  // todo 这里是 NoLane，会走到这里来吗？
  // 1. 要么走到下面的 else
  // 2. 要么上面逻辑里面, newCallbackPriority 被重新计算过
  if (newCallbackPriority === SyncLane) {
    // Special case: Sync React callbacks are scheduled on a special
    // internal queue
    if (root.tag === LegacyRoot) {
      // if (__DEV__ && ReactCurrentActQueue.isBatchingLegacy !== null) {
      //   ReactCurrentActQueue.didScheduleLegacyUpdate = true;
      // }
      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
    } else {
      // 现在走 ReactDOM.render, 都是 LegacyRoot
      // todo 下面的函数后面再关心
      // scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    }
    if (supportsMicrotasks) {
      // Flush the queue in a microtask.
      // if (__DEV__ && ReactCurrentActQueue.current !== null) {
      //   // Inside `act`, use our internal `act` queue so that these get flushed
      //   // at the end of the current scope even when using the sync version
      //   // of `act`.
      //   ReactCurrentActQueue.current.push(flushSyncCallbacks);
      // } else {
      scheduleMicrotask(() => {
        // In Safari, appending an iframe forces microtasks to run.
        // https://github.com/facebook/react/issues/22459
        // We don't support running callbacks in the middle of render
        // or commit so we need to check against that.
        if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
          // Note that this would still prematurely flush the callbacks
          // if this happens outside render or commit phase (e.g. in an event).
          flushSyncCallbacks();
        }
      });
      // }
    } else {
      // Flush the queue in an Immediate task.
      scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);
    }
    newCallbackNode = null;
  } else {
    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }
    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }

  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}

function cancelCallback(callbackNode: any) {
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_cancelCallback(callbackNode);
}

// This is the entry point for synchronous tasks that don't go
// through Scheduler
function performSyncWorkOnRoot(root: FiberRoot) {
  //
  // if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
  //   syncNestedUpdateFlag();
  // }

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  flushPassiveEffects();

  let lanes = getNextLanes(root, NoLanes);
  if (!includesSomeLane(lanes, SyncLane)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root, now());
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);
  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // If something threw an error, try rendering one more time. We'll render
    // synchronously to block concurrent data mutations, and we'll includes
    // all pending updates are included. If it still fails after the second
    // attempt, we'll give up and commit the resulting tree.
    const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
    if (errorRetryLanes !== NoLanes) {
      lanes = errorRetryLanes;
      exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
    }
  }

  if (exitStatus === RootFatalErrored) {
    const fatalError = workInProgressRootFatalError;
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, lanes);
    ensureRootIsScheduled(root, now());
    throw fatalError;
  }

  if (exitStatus === RootDidNotComplete) {
    throw new Error('Root did not complete. This is a bug in React.');
  }

  // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.
  const finishedWork: Fiber = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root, now());

  return null;
}

function scheduleCallback(priorityLevel, callback) {
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_scheduleCallback(priorityLevel, callback);
}
