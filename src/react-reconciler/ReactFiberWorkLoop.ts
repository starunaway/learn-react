import { now, cancelCallback as Scheduler_cancelCallback } from '@/scheduler/Scheduler';
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  NoTimestamp,
  SyncLane,
  getHighestPriorityLane,
  getLanesToRetrySynchronouslyOnError,
  getNextLanes,
  includesBlockingLane,
  includesExpiredLane,
  includesSomeLane,
  markRootUpdated,
  mergeLanes,
  removeLanes,
  markRootSuspended as markRootSuspended_dontCallThisOneDirectly,
  getTransitionsForLanes,
} from './ReactFiberLane';
import { Dispatcher, Fiber, FiberRoot } from './ReactInternalTypes';
import { ConcurrentMode, NoMode, ProfileMode } from './ReactTypeOfMode';
import { LegacyRoot } from './ReactRootTags';
import {
  flushSyncCallbacks,
  flushSyncCallbacksOnlyInLegacyMode,
  scheduleLegacySyncCallback,
} from './ReactFiberSyncTaskQueue';
import {
  cancelTimeout,
  noTimeout,
  resetAfterCommit,
  scheduleMicrotask,
  supportsMicrotasks,
} from './ReactFiberHostConfig';
import { Transition } from './ReactFiberTracingMarkerComponent';
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  EventPriority,
  getCurrentUpdatePriority,
  IdleEventPriority,
  lanesToEventPriority,
  lowerEventPriority,
  setCurrentUpdatePriority,
} from './ReactEventPriorities';
import ReactSharedInternals from '@/shared/ReactSharedInternals';
import { ClassComponent, HostRoot } from './ReactWorkTags';
import { enqueueUpdate } from './ReactFiberClassUpdateQueue';
import {
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
} from './ReactFiberCommitWork';
import { isRootDehydrated } from './ReactFiberShellHydration';

import {
  scheduleCallback as Scheduler_scheduleCallback,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
  shouldYield,
  requestPaint,
} from './Scheduler';
import { PriorityLevel } from '@/scheduler/SchedulerPriorities';
import { CapturedValue, createCapturedValueAtFiber } from './ReactCapturedValue';
import {
  BeforeMutationMask,
  ForceClientRender,
  HostEffectMask,
  Incomplete,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveMask,
  StoreConsistency,
} from './ReactFiberFlags';
import { createRootErrorUpdate } from './ReactFiberThrow';
import { ContextOnlyDispatcher, FunctionComponentUpdateQueue } from './ReactFiberHooks';
import { unwindInterruptedWork, unwindWork } from './ReactFiberUnwindWork';
import { createWorkInProgress } from './ReactFiber';
import { finishQueueingConcurrentUpdates } from './ReactFiberConcurrentUpdates';
import { resetContextDependencies } from './ReactFiberNewContext';
import { beginWork } from './ReactFiberBeginWork';
import { completeWork } from './ReactFiberCompleteWork';

const {
  ReactCurrentDispatcher,
  ReactCurrentOwner,
  ReactCurrentBatchConfig,
  // ReactCurrentActQueue,
} = ReactSharedInternals;

type ExecutionContext = number;

export let subtreeRenderLanes: Lanes = NoLanes;

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
let workInProgressRootIncludedLanes: Lanes = NoLanes;

// Only used when enableProfilerNestedUpdateScheduledHook is true;
// to track which root is currently committing layout effects.
let rootCommittingMutationOrLayoutEffects: FiberRoot | null = null;

let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let pendingPassiveProfilerEffects: Array<Fiber> = [];
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;
let pendingPassiveTransitions: Array<Transition> | null = null;

// A fatal error, if one is thrown
let workInProgressRootFatalError: any = null;
// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

let workInProgressRootSkippedLanes: Lanes = NoLanes;

// todo，当前可以暂时不关心优先级
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;

// todo，当前可以暂时不关心优先级
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;

let workInProgressRootPingedLanes: Lanes = NoLanes;
// Errors that are thrown during the render phase.
let workInProgressRootConcurrentErrors: Array<CapturedValue<any>> | null = null;
// These are errors that we recovered from without surfacing them to the UI.
// We will log them once the tree commits.
let workInProgressRootRecoverableErrors: Array<CapturedValue<any>> | null = null;

// The most recent time we committed a fallback. This lets us ensure a train
// model where we don't commit new loading states in too quick succession.
let globalMostRecentFallbackTime: number = 0;
const FALLBACK_THROTTLE_MS: number = 500;

// The absolute time for when we should start giving up on rendering
// more and prefer CPU suspense heuristics instead.
let workInProgressRootRenderTargetTime: number = Infinity;
// How long a render is supposed to take before we start following CPU
// suspense heuristics and opt out of rendering more content.
const RENDER_TIMEOUT_MS = 500;

let workInProgressTransitions: Array<Transition> | null = null;

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

let currentEventTransitionLane: Lanes = NoLanes;

let isRunningInsertionEffect = false;

let hasUncaughtError = false;
let firstUncaughtError: any = null;
let legacyErrorBoundariesThatAlreadyFailed: Set<any> | null = null;

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

    // 这里省略了一堆新特性方法

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

function resetRenderTimer() {
  workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
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
      schedulerPriorityLevel as PriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }

  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}

export function markRootFinished(root: FiberRoot, remainingLanes: Lanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;

  root.pendingLanes = remainingLanes;

  // Let's try everything again
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;

  root.expiredLanes &= remainingLanes;
  root.mutableReadLanes &= remainingLanes;

  root.entangledLanes &= remainingLanes;

  const entanglements = root.entanglements;
  const eventTimes = root.eventTimes;
  const expirationTimes = root.expirationTimes;

  // Clear the lanes that no longer have pending work
  let lanes = noLongerPendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    entanglements[index] = NoLanes;
    eventTimes[index] = NoTimestamp;
    expirationTimes[index] = NoTimestamp;

    lanes &= ~lane;
  }
}

function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - Math.clz32(lanes);
}

// This is the entry point for every concurrent task, i.e. anything that
// goes through Scheduler.
function performConcurrentWorkOnRoot(root: FiberRoot, didTimeout: boolean): Function | null {
  // if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
  //   resetNestedUpdateFlag();
  // }

  // Since we know we're in a React event, we can clear the current
  // event time. The next update will compute a new event time.
  currentEventTime = NoTimestamp;
  currentEventTransitionLane = NoLanes;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  // Flush any pending passive effects before deciding which lanes to work on,
  // in case they schedule additional work.
  const originalCallbackNode = root.callbackNode;
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    // Something in the passive effect phase may have canceled the current task.
    // Check if the task node for this root was changed.
    if (root.callbackNode !== originalCallbackNode) {
      // The current task was canceled. Exit. We don't need to call
      // `ensureRootIsScheduled` because the check above implies either that
      // there's a new task, or that there's no remaining work on this root.
      return null;
    } else {
      // Current task was not canceled. Continue.
    }
  }

  // Determine the next lanes to work on, using the fields stored
  // on the root.
  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );
  if (lanes === NoLanes) {
    // Defensive coding. This is never expected to happen.
    return null;
  }

  // We disable time-slicing in some cases: if the work has been CPU-bound
  // for too long ("expired" work, to prevent starvation), or we're in
  // sync-updates-by-default mode.
  // TODO: We only check `didTimeout` defensively, to account for a Scheduler
  // bug we're still investigating. Once the bug in Scheduler is fixed,
  // we can remove this, since we track expiration ourselves.
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) && !includesExpiredLane(root, lanes) && !didTimeout;
  // disableSchedulerTimeoutInWorkLoop 是个特性，默认关掉
  // (disableSchedulerTimeoutInWorkLoop || !didTimeout);
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);
  if (exitStatus !== RootInProgress) {
    if (exitStatus === RootErrored) {
      // If something threw an error, try rendering one more time. We'll
      // render synchronously to block concurrent data mutations, and we'll
      // includes all pending updates are included. If it still fails after
      // the second attempt, we'll give up and commit the resulting tree.
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
      // The render unwound without completing the tree. This happens in special
      // cases where need to exit the current render without producing a
      // consistent tree or committing.
      //
      // This should only happen during a concurrent render, not a discrete or
      // synchronous update. We should have already checked for this when we
      // unwound the stack.
      markRootSuspended(root, lanes);
    } else {
      // The render completed.

      // Check if this render may have yielded to a concurrent event, and if so,
      // confirm that any newly rendered stores are consistent.
      // TODO: It's possible that even a concurrent render may never have yielded
      // to the main thread, if it was fast enough, or if it expired. We could
      // skip the consistency check in that case, too.
      const renderWasConcurrent = !includesBlockingLane(root, lanes);
      const finishedWork: Fiber = root.current.alternate!;
      if (renderWasConcurrent && !isRenderConsistentWithExternalStores(finishedWork)) {
        // A store was mutated in an interleaved event. Render again,
        // synchronously, to block further mutations.
        exitStatus = renderRootSync(root, lanes);

        // We need to check again if something threw
        if (exitStatus === RootErrored) {
          const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
          if (errorRetryLanes !== NoLanes) {
            lanes = errorRetryLanes;
            exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
            // We assume the tree is now consistent because we didn't yield to any
            // concurrent events.
          }
        }
        if (exitStatus === RootFatalErrored) {
          const fatalError = workInProgressRootFatalError;
          prepareFreshStack(root, NoLanes);
          markRootSuspended(root, lanes);
          ensureRootIsScheduled(root, now());
          throw fatalError;
        }
      }

      // We now have a consistent tree. The next step is either to commit it,
      // or, if something suspended, wait to commit it after a timeout.
      root.finishedWork = finishedWork;
      root.finishedLanes = lanes;
      finishConcurrentRender(root, exitStatus, lanes);
    }
  }

  ensureRootIsScheduled(root, now());
  if (root.callbackNode === originalCallbackNode) {
    // The task node scheduled for this root is the same one that's
    // currently executed. Need to return a continuation.
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  return null;
}

function cancelCallback(callbackNode: any) {
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_cancelCallback(callbackNode);
}

function recoverFromConcurrentError(root: FiberRoot, errorRetryLanes: Lanes) {
  // If an error occurred during hydration, discard server response and fall
  // back to client side render.

  // Before rendering again, save the errors from the previous attempt.
  const errorsFromFirstAttempt = workInProgressRootConcurrentErrors;

  if (isRootDehydrated(root)) {
    // The shell failed to hydrate. Set a flag to force a client rendering
    // during the next attempt. To do this, we call prepareFreshStack now
    // to create the root work-in-progress fiber. This is a bit weird in terms
    // of factoring, because it relies on renderRootSync not calling
    // prepareFreshStack again in the call below, which happens because the
    // root and lanes haven't changed.
    //
    // TODO: I think what we should do is set ForceClientRender inside
    // throwException, like we do for nested Suspense boundaries. The reason
    // it's here instead is so we can switch to the synchronous work loop, too.
    // Something to consider for a future refactor.
    const rootWorkInProgress = prepareFreshStack(root, errorRetryLanes);
    rootWorkInProgress.flags |= ForceClientRender;
    // if (__DEV__) {
    //   errorHydratingContainer(root.containerInfo);
    // }
  }

  const exitStatus = renderRootSync(root, errorRetryLanes);
  if (exitStatus !== RootErrored) {
    // Successfully finished rendering on retry

    // The errors from the failed first attempt have been recovered. Add
    // them to the collection of recoverable errors. We'll log them in the
    // commit phase.
    const errorsFromSecondAttempt = workInProgressRootRecoverableErrors;
    workInProgressRootRecoverableErrors = errorsFromFirstAttempt;
    // The errors from the second attempt should be queued after the errors
    // from the first attempt, to preserve the causal sequence.
    if (errorsFromSecondAttempt !== null) {
      queueRecoverableErrors(errorsFromSecondAttempt);
    }
  } else {
    // The UI failed to recover.
  }
  return exitStatus;
}

export function queueRecoverableErrors(errors: Array<CapturedValue<any>>) {
  if (workInProgressRootRecoverableErrors === null) {
    workInProgressRootRecoverableErrors = errors;
  } else {
    workInProgressRootRecoverableErrors.push.apply(workInProgressRootRecoverableErrors, errors);
  }
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
  const finishedWork: Fiber | null = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root, now());

  return null;
}

function finishConcurrentRender(root: FiberRoot, exitStatus: RootExitStatus, lanes: Lanes) {
  switch (exitStatus) {
    case RootInProgress:
    case RootFatalErrored: {
      throw new Error('Root did not complete. This is a bug in React.');
    }
    // Flow knows about invariant, so it complains if I add a break
    // statement, but eslint doesn't know about invariant, so it complains
    // if I do. eslint-disable-next-line no-fallthrough
    case RootErrored: {
      // We should have already attempted to retry this tree. If we reached
      // this point, it errored again. Commit it.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    // 先看主流程吧
    // case RootSuspended: {
    //   markRootSuspended(root, lanes);

    //   // We have an acceptable loading state. We need to figure out if we
    //   // should immediately commit it or wait a bit.

    //   if (
    //     includesOnlyRetries(lanes) &&
    //     true
    //     // do not delay if we're inside an act() scope
    //     // 和 dev 相关的，都先不管
    //     // !shouldForceFlushFallbacksInDEV()
    //   ) {
    //     // This render only included retries, no updates. Throttle committing
    //     // retries so that we don't show too many loading states too quickly.
    //     const msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
    //     // Don't bother with a very short suspense time.
    //     if (msUntilTimeout > 10) {
    //       const nextLanes = getNextLanes(root, NoLanes);
    //       if (nextLanes !== NoLanes) {
    //         // There's additional work on this root.
    //         break;
    //       }
    //       const suspendedLanes = root.suspendedLanes;
    //       if (!isSubsetOfLanes(suspendedLanes, lanes)) {
    //         // We should prefer to render the fallback of at the last
    //         // suspended level. Ping the last suspended level to try
    //         // rendering it again.
    //         // FIXME: What if the suspended lanes are Idle? Should not restart.
    //         const eventTime = requestEventTime();
    //         markRootPinged(root, suspendedLanes, eventTime);
    //         break;
    //       }

    //       // The render is suspended, it hasn't timed out, and there's no
    //       // lower priority work to do. Instead of committing the fallback
    //       // immediately, wait for more data to arrive.
    //       root.timeoutHandle = scheduleTimeout(
    //         commitRoot.bind(
    //           null,
    //           root,
    //           workInProgressRootRecoverableErrors,
    //           workInProgressTransitions
    //         ),
    //         msUntilTimeout
    //       );
    //       break;
    //     }
    //   }
    //   // The work expired. Commit immediately.
    //   commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
    //   break;
    // }
    // case RootSuspendedWithDelay: {
    //   markRootSuspended(root, lanes);

    //   if (includesOnlyTransitions(lanes)) {
    //     // This is a transition, so we should exit without committing a
    //     // placeholder and without scheduling a timeout. Delay indefinitely
    //     // until we receive more data.
    //     break;
    //   }

    //   if (!shouldForceFlushFallbacksInDEV()) {
    //     // This is not a transition, but we did trigger an avoided state.
    //     // Schedule a placeholder to display after a short delay, using the Just
    //     // Noticeable Difference.
    //     // TODO: Is the JND optimization worth the added complexity? If this is
    //     // the only reason we track the event time, then probably not.
    //     // Consider removing.

    //     const mostRecentEventTime = getMostRecentEventTime(root, lanes);
    //     const eventTimeMs = mostRecentEventTime;
    //     const timeElapsedMs = now() - eventTimeMs;
    //     const msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;

    //     // Don't bother with a very short suspense time.
    //     if (msUntilTimeout > 10) {
    //       // Instead of committing the fallback immediately, wait for more data
    //       // to arrive.
    //       root.timeoutHandle = scheduleTimeout(
    //         commitRoot.bind(
    //           null,
    //           root,
    //           workInProgressRootRecoverableErrors,
    //           workInProgressTransitions
    //         ),
    //         msUntilTimeout
    //       );
    //       break;
    //     }
    //   }

    //   // Commit the placeholder.
    //   commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
    //   break;
    // }
    case RootCompleted: {
      // The work completed. Ready to commit.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    default: {
      throw new Error('Unknown root exit status.');
    }
  }
}
function isRenderConsistentWithExternalStores(finishedWork: Fiber): boolean {
  // Search the rendered tree for external store reads, and check whether the
  // stores were mutated in a concurrent event. Intentionally using an iterative
  // loop instead of recursion so we can exit early.
  let node: Fiber = finishedWork;
  while (true) {
    if (node.flags & StoreConsistency) {
      const updateQueue: FunctionComponentUpdateQueue | null = node.updateQueue;
      if (updateQueue !== null) {
        const checks = updateQueue.stores;
        if (checks !== null) {
          for (let i = 0; i < checks.length; i++) {
            const check = checks[i];
            const getSnapshot = check.getSnapshot;
            const renderedValue = check.value;
            try {
              if (!Object.is(getSnapshot(), renderedValue)) {
                // Found an inconsistent store.
                return false;
              }
            } catch (error) {
              // If `getSnapshot` throws, return `false`. This will schedule
              // a re-render, and the error will be rethrown during render.
              return false;
            }
          }
        }
      }
    }
    const child = node.child;
    if (node.subtreeFlags & StoreConsistency && child !== null) {
      child.return = node;
      node = child;
      continue;
    }
    if (node === finishedWork) {
      return true;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return true;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitRoot(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<any>>,
  transitions: Array<Transition> | null
) {
  // TODO: This no longer makes any sense. We already wrap the mutation and
  // layout phases. Should be able to remove.
  const previousUpdateLanePriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    commitRootImpl(root, recoverableErrors, transitions, previousUpdateLanePriority);
  } finally {
    ReactCurrentBatchConfig.transition = prevTransition;
    setCurrentUpdatePriority(previousUpdateLanePriority);
  }

  return null;
}

function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<any>>,
  transitions: Array<Transition> | null,
  renderPriorityLevel: EventPriority
) {
  do {
    // `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
    // means `flushPassiveEffects` will sometimes result in additional
    // passive effects. So we need to keep flushing in a loop until there are
    // no more pending effects.
    // TODO: Might be better if `flushPassiveEffects` did not automatically
    // flush synchronous work at the end, to avoid factoring hazards like this.
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);
  // flushRenderPhaseStrictModeWarningsInDEV();

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  // if (__DEV__) {
  //   if (enableDebugTracing) {
  //     logCommitStarted(lanes);
  //   }
  // }

  // 特性，不看
  // if (enableSchedulingProfiler) {
  //   markCommitStarted(lanes);
  // }

  if (finishedWork === null) {
    // if (__DEV__) {
    //   if (enableDebugTracing) {
    //     logCommitStopped();
    //   }
    // }
    // 特性，不看
    // if (enableSchedulingProfiler) {
    //   markCommitStopped();
    // }

    return null;
  } else {
    // if (__DEV__) {
    //   if (lanes === NoLanes) {
    //     console.error(
    //       'root.finishedLanes should not be empty during a commit. This is a ' + 'bug in React.'
    //     );
    //   }
    // }
  }
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  if (finishedWork === root.current) {
    throw new Error(
      'Cannot commit the same tree as before. This error is likely caused by ' +
        'a bug in React. Please file an issue.'
    );
  }

  // commitRoot never returns a continuation; it always finishes synchronously.
  // So we can clear these now to allow a new callback to be scheduled.
  root.callbackNode = null;
  root.callbackPriority = NoLane;

  // Update the first and last pending times on this root. The new first
  // pending time is whatever is left on the root fiber.
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
  markRootFinished(root, remainingLanes);

  if (root === workInProgressRoot) {
    // We can reset these now that they are finished.
    workInProgressRoot = null;
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;
  } else {
    // This indicates that the last root we worked on is not the same one that
    // we're committing now. This most commonly happens when a suspended root
    // times out.
  }

  // If there are pending passive effects, schedule a callback to process them.
  // Do this as early as possible, so it is queued before anything else that
  // might get scheduled in the commit phase. (See #16714.)
  // TODO: Delete all other places that schedule the passive effect callback
  // They're redundant.
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      pendingPassiveEffectsRemainingLanes = remainingLanes;
      // workInProgressTransitions might be overwritten, so we want
      // to store it in pendingPassiveTransitions until they get processed
      // We need to pass this through as an argument to commitRoot
      // because workInProgressTransitions might have changed between
      // the previous render and commit if we throttle the commit
      // with setTimeout
      pendingPassiveTransitions = transitions;
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        // This render triggered passive effects: release the root cache pool
        // *after* passive effects fire to avoid freeing a cache pool that may
        // be referenced by a node in the tree (HostRoot, Cache boundary etc)
        return null;
      });
    }
  }

  // Check if there are any effects in the whole tree.
  // TODO: This is left over from the effect list implementation, where we had
  // to check for the existence of `firstEffect` to satisfy Flow. I think the
  // only other reason this optimization exists is because it affects profiling.
  // Reconsider whether this is necessary.
  const subtreeHasEffects =
    (finishedWork.subtreeFlags & (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffect =
    (finishedWork.flags & (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const prevTransition = ReactCurrentBatchConfig.transition;
    ReactCurrentBatchConfig.transition = null;
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(DiscreteEventPriority);

    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // Reset this to null before calling lifecycles
    ReactCurrentOwner.current = null;

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    // const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(root, finishedWork);

    // 特性，不看
    // if (enableProfilerTimer) {
    //   // Mark the current commit time to be shared by all Profilers in this
    //   // batch. This enables them to be grouped later.
    //   recordCommitTime();
    // }

    // 特性，不看
    // if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
    //   // Track the root here, rather than in commitLayoutEffects(), because of ref setters.
    //   // Updates scheduled during ref detachment should also be flagged.
    //   rootCommittingMutationOrLayoutEffects = root;
    // }

    // The next phase is the mutation phase, where we mutate the host tree.
    commitMutationEffects(root, finishedWork, lanes);

    // 特性，不看
    // if (enableCreateEventHandleAPI) {
    //   if (shouldFireAfterActiveInstanceBlur) {
    //     afterActiveInstanceBlur();
    //   }
    // }
    resetAfterCommit(root.containerInfo);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    // if (__DEV__) {
    //   if (enableDebugTracing) {
    //     logLayoutEffectsStarted(lanes);
    //   }
    // }

    // 特性，不看
    // if (enableSchedulingProfiler) {
    //   markLayoutEffectsStarted(lanes);
    // }
    commitLayoutEffects(finishedWork, root, lanes);
    // if (__DEV__) {
    //   if (enableDebugTracing) {
    //     logLayoutEffectsStopped();
    //   }
    // }

    // 特性，不看
    // if (enableSchedulingProfiler) {
    //   markLayoutEffectsStopped();
    // }

    // 特性，不看
    // if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
    //   rootCommittingMutationOrLayoutEffects = null;
    // }

    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();

    executionContext = prevExecutionContext;

    // Reset the priority to the previous non-sync value.
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  } else {
    // No effects.
    root.current = finishedWork;
    // Measure these anyway so the flamegraph explicitly shows that there were
    // no effects.
    // TODO: Maybe there's a better way to report this.
    // 特性，不看
    // if (enableProfilerTimer) {
    //   recordCommitTime();
    // }
  }

  const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

  if (rootDoesHavePassiveEffects) {
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsLanes = lanes;
  } else {
    // There were no passive effects, so we can immediately release the cache
    // pool for this render.
    releaseRootPooledCache(root, remainingLanes);
    // if (__DEV__) {
    //   nestedPassiveUpdateCount = 0;
    //   rootWithPassiveNestedUpdates = null;
    // }
  }

  // Read this again, since an effect might have updated it
  remainingLanes = root.pendingLanes;

  // Check if there's remaining work on this root
  // TODO: This is part of the `componentDidCatch` implementation. Its purpose
  // is to detect whether something might have called setState inside
  // `componentDidCatch`. The mechanism is known to be flawed because `setState`
  // inside `componentDidCatch` is itself flawed — that's why we recommend
  // `getDerivedStateFromError` instead. However, it could be improved by
  // checking if remainingLanes includes Sync work, instead of whether there's
  // any work remaining at all (which would also include stuff like Suspense
  // retries or transitions). It's been like this for a while, though, so fixing
  // it probably isn't that urgent.
  if (remainingLanes === NoLanes) {
    // If there's no remaining work, we can clear the set of already failed
    // error boundaries.
    legacyErrorBoundariesThatAlreadyFailed = null;
  }

  // if (__DEV__ && enableStrictEffects) {
  //   if (!rootDidHavePassiveEffects) {
  //     commitDoubleInvokeEffectsInDEV(root.current, false);
  //   }
  // }

  // onCommitRootDevTools(finishedWork.stateNode, renderPriorityLevel);

  // 特性 不看
  // if (enableUpdaterTracking) {
  //   if (isDevToolsPresent) {
  //     root.memoizedUpdaters.clear();
  //   }
  // }

  // if (__DEV__) {
  //   onCommitRootTestSelector();
  // }

  // Always call this before exiting `commitRoot`, to ensure that any
  // additional work on this root is scheduled.
  ensureRootIsScheduled(root, now());

  if (recoverableErrors !== null) {
    // There were errors during this render, but recovered from them without
    // needing to surface it to the UI. We log them here.
    const onRecoverableError = root.onRecoverableError;
    for (let i = 0; i < recoverableErrors.length; i++) {
      const recoverableError = recoverableErrors[i];
      const componentStack = recoverableError.stack;
      const digest = recoverableError.digest;
      onRecoverableError?.(recoverableError.value, {
        componentStack: componentStack || undefined,
        digest: digest || undefined,
      });
    }
  }

  if (hasUncaughtError) {
    hasUncaughtError = false;
    const error = firstUncaughtError;
    firstUncaughtError = null;
    throw error;
  }

  // If the passive effects are the result of a discrete render, flush them
  // synchronously at the end of the current task so that the result is
  // immediately observable. Otherwise, we assume that they are not
  // order-dependent and do not need to be observed by external systems, so we
  // can wait until after paint.
  // TODO: We can optimize this by not scheduling the callback earlier. Since we
  // currently schedule the callback in multiple places, will wait until those
  // are consolidated.
  if (includesSomeLane(pendingPassiveEffectsLanes, SyncLane) && root.tag !== LegacyRoot) {
    flushPassiveEffects();
  }

  // Read this again, since a passive effect might have updated it
  remainingLanes = root.pendingLanes;
  if (includesSomeLane(remainingLanes, SyncLane)) {
    //  特性，不看
    // if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    //   markNestedUpdateScheduled();
    // }

    // Count the number of times the root synchronously re-renders without
    // finishing. If there are too many, it indicates an infinite update loop.
    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  // If layout work was scheduled, flush it now.
  flushSyncCallbacks();

  //  特性，不看
  // if (enableSchedulingProfiler) {
  //   markCommitStopped();
  // }

  return null;
}

//  todo 暂时不看
function releaseRootPooledCache(root: FiberRoot, remainingLanes: Lanes) {
  // if (enableCache) {
  //   const pooledCacheLanes = (root.pooledCacheLanes &= remainingLanes);
  //   if (pooledCacheLanes === NoLanes) {
  //     // None of the remaining work relies on the cache pool. Clear it so
  //     // subsequent requests get a new cache
  //     const pooledCache = root.pooledCache;
  //     if (pooledCache != null) {
  //       root.pooledCache = null;
  //       releaseCache(pooledCache);
  //     }
  //   }
  // }
}

function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes) {
  // When suspending, we should always exclude lanes that were pinged or (more
  // rarely, since we try to avoid it) updated during the render phase.
  // TODO: Lol maybe there's a better way to factor this besides this
  // obnoxiously named function :)
  suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
  suspendedLanes = removeLanes(suspendedLanes, workInProgressRootInterleavedUpdatedLanes);
  markRootSuspended_dontCallThisOneDirectly(root, suspendedLanes);
}

function scheduleCallback(priorityLevel: PriorityLevel, callback: Function | null) {
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_scheduleCallback(priorityLevel, callback, null);
}

export function flushPassiveEffects(): boolean {
  // Returns whether passive effects were flushed.
  // TODO: Combine this check with the one in flushPassiveEFfectsImpl. We should
  // probably just combine the two functions. I believe they were only separate
  // in the first place because we used to wrap it with
  // `Scheduler.runWithPriority`, which accepts a function. But now we track the
  // priority within React itself, so we can mutate the variable directly.
  if (rootWithPendingPassiveEffects !== null) {
    // Cache the root since rootWithPendingPassiveEffects is cleared in
    // flushPassiveEffectsImpl
    const root = rootWithPendingPassiveEffects;
    // Cache and clear the remaining lanes flag; it must be reset since this
    // method can be called from various places, not always from commitRoot
    // where the remaining lanes are known
    const remainingLanes = pendingPassiveEffectsRemainingLanes;
    pendingPassiveEffectsRemainingLanes = NoLanes;

    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority);
    const prevTransition = ReactCurrentBatchConfig.transition;
    const previousPriority = getCurrentUpdatePriority();

    try {
      ReactCurrentBatchConfig.transition = null;
      setCurrentUpdatePriority(priority);
      return flushPassiveEffectsImpl();
    } finally {
      setCurrentUpdatePriority(previousPriority);
      ReactCurrentBatchConfig.transition = prevTransition;

      // Once passive effects have run for the tree - giving components a
      // chance to retain cache instances they use - release the pooled
      // cache at the root (if there is one)
      releaseRootPooledCache(root, remainingLanes);
    }
  }
  return false;
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle || undefined);
  }

  if (workInProgress !== null) {
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      const current = interruptedWork.alternate;
      unwindInterruptedWork(current, interruptedWork, workInProgressRootRenderLanes);
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;
  workInProgressRootExitStatus = RootInProgress;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootInterleavedUpdatedLanes = NoLanes;
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  workInProgressRootConcurrentErrors = null;
  workInProgressRootRecoverableErrors = null;

  finishQueueingConcurrentUpdates();

  // if (__DEV__) {
  //   ReactStrictModeWarnings.discardPendingWarnings();
  // }

  return rootWorkInProgress;
}

function renderRootSync(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // 特性，暂时不看
    // if (enableUpdaterTracking) {
    //   if (isDevToolsPresent) {
    //     const memoizedUpdaters = root.memoizedUpdaters;
    //     if (memoizedUpdaters.size > 0) {
    //       restorePendingUpdaters(root, workInProgressRootRenderLanes);
    //       memoizedUpdaters.clear();
    //     }

    //     // At this point, move Fibers that scheduled the upcoming work from the Map to the Set.
    //     // If we bailout on this work, we'll move them back (like above).
    //     // It's important to move them now in case the work spawns more work at the same priority with different updaters.
    //     // That way we can keep the current update and future updates separate.
    //     movePendingFibersToMemoized(root, lanes);
    //   }
    // }

    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    prepareFreshStack(root, lanes);
  }

  // 特性，暂时不看
  // if (enableSchedulingProfiler) {
  //   markRenderStarted(lanes);
  // }

  do {
    try {
      workLoopSync();
      break;
    } catch (thrownValue) {
      console.error(thrownValue);
      // handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  executionContext = prevExecutionContext;
  popDispatcher(prevDispatcher);

  if (workInProgress !== null) {
    // This is a sync render, so we should have finished the whole tree.
    throw new Error(
      'Cannot commit an incomplete root. This error is likely caused by a ' +
        'bug in React. Please file an issue.'
    );
  }

  // 特性，暂时不看
  // if (enableSchedulingProfiler) {
  //   markRenderStopped();
  // }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  return workInProgressRootExitStatus;
}

function pushDispatcher() {
  const prevDispatcher = ReactCurrentDispatcher.current;
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
  if (prevDispatcher === null) {
    // The React isomorphic package does not include a default dispatcher.
    // Instead the first renderer will lazily attach one, in order to give
    // nicer error messages.
    return ContextOnlyDispatcher;
  } else {
    return prevDispatcher;
  }
}

function popDispatcher(prevDispatcher: Dispatcher | null) {
  ReactCurrentDispatcher.current = prevDispatcher;
}

function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  const current = unitOfWork.alternate;
  // setCurrentDebugFiberInDEV(unitOfWork);

  let next;
  // 特性不看
  // if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
  //   startProfilerTimer(unitOfWork);
  //   next = beginWork(current, unitOfWork, subtreeRenderLanes);
  //   stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  // } else {
  next = beginWork(current, unitOfWork, subtreeRenderLanes);
  // }

  // resetCurrentDebugFiberInDEV();
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }

  ReactCurrentOwner.current = null;
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  let completedWork = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    // Check if the work completed or if something threw.
    if ((completedWork.flags & Incomplete) === NoFlags) {
      // setCurrentDebugFiberInDEV(completedWork);
      let next;
      if (
        // !enableProfilerTimer ||
        (completedWork.mode & ProfileMode) ===
        NoMode
      ) {
        next = completeWork(current, completedWork, subtreeRenderLanes);
      }
      // 特性不开启，走不到这里来
      //  else {
      //   startProfilerTimer(completedWork);
      //   next = completeWork(current, completedWork, subtreeRenderLanes);
      //   // Update render duration assuming we didn't error.
      //   stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
      // }
      // resetCurrentDebugFiberInDEV();

      if (next) {
        // Completing this fiber spawned new work. Work on that next.
        workInProgress = next;
        return;
      }
    } else {
      // This fiber did not complete because something threw. Pop values off
      // the stack without entering the complete phase. If this is a boundary,
      // capture values if possible.
      const next = unwindWork(current, completedWork, subtreeRenderLanes);

      // Because this fiber did not complete, don't reset its lanes.

      if (next !== null) {
        // If completing this work spawned new work, do that next. We'll come
        // back here again.
        // Since we're restarting, remove anything that is not a host effect
        // from the effect tag.
        next.flags &= HostEffectMask;
        workInProgress = next;
        return;
      }

      // 特性不开启
      // if (enableProfilerTimer && (completedWork.mode & ProfileMode) !== NoMode) {
      //   // Record the render duration for the fiber that errored.
      //   stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);

      //   // Include the time spent working on failed children before continuing.
      //   let actualDuration = completedWork.actualDuration;
      //   let child = completedWork.child;
      //   while (child !== null) {
      //     actualDuration += child.actualDuration;
      //     child = child.sibling;
      //   }
      //   completedWork.actualDuration = actualDuration;
      // }

      if (returnFiber !== null) {
        // Mark the parent fiber as incomplete and clear its subtree flags.
        returnFiber.flags |= Incomplete;
        returnFiber.subtreeFlags = NoFlags;
        returnFiber.deletions = null;
      } else {
        // We've unwound all the way to the root.
        workInProgressRootExitStatus = RootDidNotComplete;
        workInProgress = null;
        return;
      }
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      workInProgress = siblingFiber;
      return;
    }
    // Otherwise, return to the parent
    completedWork = returnFiber!;
    // Update the next thing we're working on in case something throws.
    workInProgress = completedWork;
  } while (completedWork !== null);

  // We've reached the root.
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  // Cache and clear the transitions flag
  const transitions = pendingPassiveTransitions;
  pendingPassiveTransitions = null;

  const root = rootWithPendingPassiveEffects;
  const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  // TODO: This is sometimes out of sync with rootWithPendingPassiveEffects.
  // Figure out why and fix it. It's not causing any known issues (probably
  // because it's only used for profiling), but it's a refactor hazard.
  pendingPassiveEffectsLanes = NoLanes;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Cannot flush passive effects while already rendering.');
  }

  // if (__DEV__) {
  //   isFlushingPassiveEffects = true;
  //   didScheduleUpdateDuringPassiveEffects = false;

  //   if (enableDebugTracing) {
  //     logPassiveEffectsStarted(lanes);
  //   }
  // }

  // if (enableSchedulingProfiler) {
  //   markPassiveEffectsStarted(lanes);
  // }

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes, transitions);

  // TODO: Move to commitPassiveMountEffects
  // if (enableProfilerTimer && enableProfilerCommitHooks) {
  //   const profilerEffects = pendingPassiveProfilerEffects;
  //   pendingPassiveProfilerEffects = [];
  //   for (let i = 0; i < profilerEffects.length; i++) {
  //     const fiber = ((profilerEffects[i]: any): Fiber);
  //     commitPassiveEffectDurations(root, fiber);
  //   }
  // }

  // if (__DEV__) {
  //   if (enableDebugTracing) {
  //     logPassiveEffectsStopped();
  //   }
  // }

  // if (enableSchedulingProfiler) {
  //   markPassiveEffectsStopped();
  // }

  // if (__DEV__ && enableStrictEffects) {
  //   commitDoubleInvokeEffectsInDEV(root.current, true);
  // }

  executionContext = prevExecutionContext;

  flushSyncCallbacks();

  // if (enableTransitionTracing) {
  //   const prevPendingTransitionCallbacks = currentPendingTransitionCallbacks;
  //   const prevRootTransitionCallbacks = root.transitionCallbacks;
  //   if (
  //     prevPendingTransitionCallbacks !== null &&
  //     prevRootTransitionCallbacks !== null
  //   ) {
  //     // TODO(luna) Refactor this code into the Host Config
  //     // TODO(luna) The end time here is not necessarily accurate
  //     // because passive effects could be called before paint
  //     // (synchronously) or after paint (normally). We need
  //     // to come up with a way to get the correct end time for both cases.
  //     // One solution is in the host config, if the passive effects
  //     // have not yet been run, make a call to flush the passive effects
  //     // right after paint.
  //     const endTime = now();
  //     currentPendingTransitionCallbacks = null;

  //     scheduleCallback(IdleSchedulerPriority, () =>
  //       processTransitionCallbacks(
  //         prevPendingTransitionCallbacks,
  //         endTime,
  //         prevRootTransitionCallbacks,
  //       ),
  //     );
  //   }
  // }

  // TODO: Move to commitPassiveMountEffects
  //  这个是 devTool ，先不管
  // onPostCommitRootDevTools(root);
  // if (enableProfilerTimer && enableProfilerCommitHooks) {
  //   const stateNode = root.current.stateNode;
  //   stateNode.effectDuration = 0;
  //   stateNode.passiveEffectDuration = 0;
  // }

  return true;
}

function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // 特性，不看
    // if (enableUpdaterTracking) {
    //   if (isDevToolsPresent) {
    //     const memoizedUpdaters = root.memoizedUpdaters;
    //     if (memoizedUpdaters.size > 0) {
    //       restorePendingUpdaters(root, workInProgressRootRenderLanes);
    //       memoizedUpdaters.clear();
    //     }

    //     // At this point, move Fibers that scheduled the upcoming work from the Map to the Set.
    //     // If we bailout on this work, we'll move them back (like above).
    //     // It's important to move them now in case the work spawns more work at the same priority with different updaters.
    //     // That way we can keep the current update and future updates separate.
    //     movePendingFibersToMemoized(root, lanes);
    //   }
    // }

    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    resetRenderTimer();
    prepareFreshStack(root, lanes);
  }

  // if (__DEV__) {
  //   if (enableDebugTracing) {
  //     logRenderStarted(lanes);
  //   }
  // }

  // 特性，不看
  // if (enableSchedulingProfiler) {
  //   markRenderStarted(lanes);
  // }

  do {
    try {
      workLoopConcurrent();
      break;
    } catch (thrownValue) {
      console.error(thrownValue);
      // handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  popDispatcher(prevDispatcher);
  executionContext = prevExecutionContext;

  // Check if the tree has completed.
  if (workInProgress !== null) {
    // Still work remaining.
    // 特性，不看
    // if (enableSchedulingProfiler) {
    //   markRenderYielded();
    // }
    return RootInProgress;
  } else {
    // Completed the tree.
    // 特性，不看
    // if (enableSchedulingProfiler) {
    //   markRenderStopped();
    // }

    // Set this to null to indicate there's no in-progress render.
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;

    // Return the final exit status.
    return workInProgressRootExitStatus;
  }
}

function captureCommitPhaseErrorOnRoot(rootFiber: Fiber, sourceFiber: Fiber, error: any) {
  const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
  const update = createRootErrorUpdate(rootFiber, errorInfo, SyncLane);
  const root = enqueueUpdate(rootFiber, update, SyncLane);
  const eventTime = requestEventTime();
  if (root !== null) {
    markRootUpdated(root, SyncLane, eventTime);
    ensureRootIsScheduled(root, eventTime);
  }
}

export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: any
) {
  // if (__DEV__) {
  //   reportUncaughtErrorInDEV(error);
  //   setIsRunningInsertionEffect(false);
  // }
  if (sourceFiber.tag === HostRoot) {
    // Error was thrown at the root. There is no parent, so the root
    // itself should capture it.
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    return;
  }

  let fiber = null;
  // todo 这里默认定义的是 true，先直接写死
  // if (skipUnmountedBoundaries) {
  fiber = nearestMountedAncestor;
  // } else {
  //   fiber = sourceFiber.return;
  // }

  while (fiber !== null) {
    if (fiber.tag === HostRoot) {
      captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error);
      return;
    }
    // ClassComponent 类型，Function 类型应该走不到这里来
    else if (fiber.tag === ClassComponent) {
      const ctor = fiber.type;
      const instance = fiber.stateNode;
      // if (
      //   typeof ctor.getDerivedStateFromError === 'function' ||
      //   (typeof instance.componentDidCatch === 'function' &&
      //     !isAlreadyFailedLegacyErrorBoundary(instance))
      // ) {
      //   const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
      //   const update = createClassErrorUpdate(fiber, errorInfo, SyncLane);
      //   const root = enqueueUpdate(fiber, update, SyncLane);
      //   const eventTime = requestEventTime();
      //   if (root !== null) {
      //     markRootUpdated(root, SyncLane, eventTime);
      //     ensureRootIsScheduled(root, eventTime);
      //   }
      //   return;
      // }
    }
    fiber = fiber.return;
  }

  // if (__DEV__) {
  //   // TODO: Until we re-land skipUnmountedBoundaries (see #20147), this warning
  //   // will fire for errors that are thrown by destroy functions inside deleted
  //   // trees. What it should instead do is propagate the error to the parent of
  //   // the deleted tree. In the meantime, do not add this warning to the
  //   // allowlist; this is only for our internal use.
  //   console.error(
  //     'Internal React error: Attempted to capture a commit phase error ' +
  //       'inside a detached tree. This indicates a bug in React. Likely ' +
  //       'causes include deleting the same fiber more than once, committing an ' +
  //       'already-finished tree, or an inconsistent return pointer.\n\n' +
  //       'Error message:\n\n%s',
  //     error,
  //   );
  // }
}

function prepareToThrowUncaughtError(error: any) {
  if (!hasUncaughtError) {
    hasUncaughtError = true;
    firstUncaughtError = error;
  }
}

export const onUncaughtError = prepareToThrowUncaughtError;
