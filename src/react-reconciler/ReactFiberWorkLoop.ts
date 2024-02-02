import {
  getCurrentEventPriority,
  noTimeout,
  resetAfterCommit,
  scheduleMicrotask,
  supportsMicrotasks,
} from '../react-dom/ReactFiberHostConfig';
import ReactCurrentBatchConfig from '../react/ReactCurrentBatchConfig';
import {
  warnAboutDeprecatedLifecycles,
  replayFailedUnitOfWorkWithInvokeGuardedCallback,
  enableCreateEventHandleAPI,
  enableProfilerTimer,
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerNestedUpdateScheduledHook,
  deferRenderPhaseUpdateToNextBatch,
  enableDebugTracing,
  enableSchedulingProfiler,
  disableSchedulerTimeoutInWorkLoop,
  enableStrictEffects,
  skipUnmountedBoundaries,
  enableUpdaterTracking,
  enableCache,
  enableTransitionTracing,
} from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import {
  EventPriority,
  getCurrentUpdatePriority,
  lanesToEventPriority,
  lowerEventPriority,
  setCurrentUpdatePriority,
} from './ReactEventPriorities';
import { isRootDehydrated } from './ReactFiberShellHydration';
import { releaseCache } from './ReactFiberCacheComponent';
import {
  Lane,
  Lanes,
  NoLanes,
  NoTimestamp,
  getHighestPriorityLane,
  getLanesToRetrySynchronouslyOnError,
  getMostRecentEventTime,
  getNextLanes,
  getTransitionsForLanes,
  includesBlockingLane,
  includesExpiredLane,
  includesOnlyRetries,
  includesOnlyTransitions,
  includesSomeLane,
  isSubsetOfLanes,
  markRootFinished,
  markRootPinged,
  markRootSuspended,
  markRootUpdated,
  markStarvedLanesAsExpired,
  mergeLanes,
  pickArbitraryLane,
} from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import {
  ContextOnlyDispatcher,
  resetHooksAfterThrow,
  type FunctionComponentUpdateQueue,
} from './ReactFiberHooks';

import { NoTransition, requestCurrentTransition } from './ReactFiberTransition';
import { Dispatcher, Fiber, FiberRoot } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveEffectDurations,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
} from './ReactFiberCommitWork';

import { finishQueueingConcurrentUpdates } from './ReactFiberConcurrentUpdates';

import {
  flushSyncCallbacks,
  flushSyncCallbacksOnlyInLegacyMode,
  scheduleLegacySyncCallback,
  scheduleSyncCallback,
} from './ReactFiberSyncTaskQueue';

import {
  markNestedUpdateScheduled,
  recordCommitTime,
  resetNestedUpdateFlag,
  startProfilerTimer,
  stopProfilerTimerIfRunningAndRecordDelta,
  syncNestedUpdateFlag,
} from './ReactProfilerTimer';

import {
  // Aliased because `act` will override and push to an internal queue
  scheduleCallback,
  // shouldYield,
  // requestPaint,
  now,
  //   ImmediatePriority as ImmediateSchedulerPriority,
  //   UserBlockingPriority as UserBlockingSchedulerPriority,
  //   NormalPriority as NormalSchedulerPriority,
  //   IdlePriority as IdleSchedulerPriority,
  PriorityLevel,
  cancelCallback,
  shouldYield,
  requestPaint,
} from './Scheduler';
import { StackCursor, createCursor } from './ReactFiberStack';
import { CapturedValue } from './ReactCapturedValue';
import { RootTag } from './ReactRootTags';
import { Wakeable } from '../shared/ReactTypes';
import ReactCurrentOwner from '../react/ReactCurrentOwner';
import {
  BeforeMutationMask,
  Flags,
  LayoutMask,
  MutationMask,
  PassiveMask,
} from './ReactFiberFlags';
import { unwindInterruptedWork, unwindWork } from './ReactFiberUnwindWork';
import { createWorkInProgress } from './ReactFiber';
import ReactCurrentDispatcher from '../react/ReactCurrentDispatcher';
import { read } from 'fs';
import { resetContextDependencies } from './ReactFiberNewContext';
import { WorkTag } from './ReactWorkTags';
import { enqueueUpdate } from './ReactFiberClassUpdateQueue';
import { throwException } from './ReactFiberThrow';
import { completeWork } from './ReactFiberCompleteWork';
import { beginWork } from './ReactFiberBeginWork';

enum ExecutionContext {
  NoContext = /*                    */ 0b000,
  BatchedContext = /*               */ 0b001,
  RenderContext = /*                */ 0b010,
  CommitContext = /*                */ 0b100,
}

// export const NoContext = /*             */ 0b000;
// const BatchedContext = /*               */ 0b001;
// const RenderContext = /*                */ 0b010;
// const CommitContext = /*                */ 0b100;

enum RootExitStatus {
  RootInProgress = 0,
  RootFatalErrored = 1,
  RootErrored = 2,
  RootSuspended = 3,
  RootSuspendedWithDelay = 4,
  RootCompleted = 5,
  RootDidNotComplete = 6,
}

// Describes where we are in the React execution stack
let executionContext: ExecutionContext = ExecutionContext.NoContext;
// The root we're working on
let workInProgressRoot: FiberRoot | null = null;
// The fiber we're working on
let workInProgress: Fiber | null = null;
// The lanes we're rendering
let workInProgressRootRenderLanes: Lanes = NoLanes;

// Stack that allows components to change the render lanes for its subtree
// This is a superset of the lanes we started working on at the root. The only
// case where it's different from `workInProgressRootRenderLanes` is when we
// enter a subtree that is hidden and needs to be unhidden: Suspense and
// Offscreen component.
//
// Most things in the work loop should deal with workInProgressRootRenderLanes.
// Most things in begin/complete phases should deal with subtreeRenderLanes.
export let subtreeRenderLanes: Lanes = NoLanes;
const subtreeRenderLanesCursor: StackCursor<Lanes | null> = createCursor(NoLanes);

// Whether to root completed, errored, suspended, etc.
let workInProgressRootExitStatus: RootExitStatus = RootExitStatus.RootInProgress;
// A fatal error, if one is thrown
let workInProgressRootFatalError: mixed | null = null;
// "Included" lanes refer to lanes that were worked on during this render. It's
// slightly different than `renderLanes` because `renderLanes` can change as you
// enter and exit an Offscreen tree. This value is the combination of all render
// lanes for the entire render phase.
let workInProgressRootIncludedLanes: Lanes = NoLanes;
// The work left over by components that were visited during this render. Only
// includes unprocessed updates, not work in bailed out children.
let workInProgressRootSkippedLanes: Lanes = NoLanes;
// Lanes that were updated (in an interleaved event) during this render.
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;
// Lanes that were updated during the render phase (*not* an interleaved event).
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;
// Lanes that were pinged (in an interleaved event) during this render.
let workInProgressRootPingedLanes: Lanes = NoLanes;
// Errors that are thrown during the render phase.
let workInProgressRootConcurrentErrors: Array<CapturedValue<mixed>> | null = null;
// These are errors that we recovered from without surfacing them to the UI.
// We will log them once the tree commits.
let workInProgressRootRecoverableErrors: Array<CapturedValue<mixed>> | null = null;

let hasUncaughtError = false;
let firstUncaughtError: any = null;
let legacyErrorBoundariesThatAlreadyFailed: Set<mixed> | null = null;

// Only used when enableProfilerNestedUpdateScheduledHook is true;
// to track which root is currently committing layout effects.
let rootCommittingMutationOrLayoutEffects: FiberRoot | null = null;

let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let pendingPassiveProfilerEffects: Array<Fiber> = [];
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;
let pendingPassiveTransitions: Array<Transition> | null = null;

// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

// If two updates are scheduled within the same event, we should treat their
// event times as simultaneous, even if the actual clock time has advanced
// between the first and second call.
let currentEventTime: number = NoTimestamp;
let currentEventTransitionLane: Lanes = NoLanes;

let isRunningInsertionEffect = false;

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

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}
//382
function resetRenderTimer() {
  workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
}

// 428
export function requestEventTime() {
  if (
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) !==
    ExecutionContext.NoContext
  ) {
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

export function getCurrentTime() {
  return now();
}

// 447
export function requestUpdateLane(fiber: Fiber): Lane {
  // Special cases
  const mode = fiber.mode;
  if ((mode & TypeOfMode.ConcurrentMode) === TypeOfMode.NoMode) {
    return Lane.SyncLane;
  } else if (
    (executionContext & ExecutionContext.RenderContext) !== ExecutionContext.NoContext &&
    workInProgressRootRenderLanes !== NoLanes
  ) {
    // This is a render phase update. These are not officially supported. The
    // old behavior is to give this the same "thread" (lanes) as
    // whatever is currently rendering. So if you call `setState` on a component
    // that happens later in the same render, it will flush. Ideally, we want to
    // remove the special case and treat them as if they came from an
    // interleaved event. Regardless, this pattern is not officially supported.
    // This behavior is only a fallback. The flag only exists until we can roll
    // out the setState warning, since existing code might accidentally rely on
    // the current behavior.
    return pickArbitraryLane(workInProgressRootRenderLanes);
  }

  const isTransition = requestCurrentTransition() !== NoTransition;
  if (isTransition) {
    // read: Transition 应该主动开启，这里应该不会触发
    console.error('Transition 应该主动开启，这里应该不会触发');
    // The algorithm for assigning an update to a lane should be stable for all
    // updates at the same priority within the same event. To do this, the
    // inputs to the algorithm must be the same.
    //
    // The trick we use is to cache the first of each of these inputs within an
    // event. Then reset the cached values once we can be sure the event is
    // over. Our heuristic for that is whenever we enter a concurrent work loop.
    // if (currentEventTransitionLane === Lane.NoLane) {
    //   // All transitions within the same event are assigned the same lane.
    //   currentEventTransitionLane = claimNextTransitionLane();
    // }
    // return currentEventTransitionLane;
  }

  // Updates originating inside certain React methods, like flushSync, have
  // their priority set by tracking it with a context variable.
  //
  // The opaque type returned by the host config is internally a lane, so we can
  // use that directly.
  // TODO: Move this type conversion to the event priority module.
  const updateLane = getCurrentUpdatePriority();
  if (updateLane !== Lane.NoLane) {
    return updateLane;
  }

  // read: 更新发生在 react 之外，比如用户交互，所以这里和宿主环境相关
  // This update originated outside React. Ask the host environment for an
  // appropriate priority, based on the type of event.
  //
  // The opaque type returned by the host config is internally a lane, so we can
  // use that directly.
  // TODO: Move this type conversion to the event priority module.
  const eventLane: Lane = getCurrentEventPriority();
  return eventLane;
}

// 528
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane,
  eventTime: number
) {
  checkForNestedUpdates();

  // Mark that the root has a pending update.
  markRootUpdated(root, lane, eventTime);

  if (
    (executionContext & ExecutionContext.RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    // Track lanes that were updated during the render phase
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane
    );
  } else {
    if (root === workInProgressRoot) {
      // Received an update to a tree that's in the middle of rendering. Mark
      // that there was an interleaved update work on this root. Unless the
      // `deferRenderPhaseUpdateToNextBatch` flag is off and this is a render
      // phase update. In that case, we don't treat render phase updates as if
      // they were interleaved, for backwards compat reasons.
      if (
        deferRenderPhaseUpdateToNextBatch ||
        (executionContext & ExecutionContext.RenderContext) === ExecutionContext.NoContext
      ) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane
        );
      }
      if (workInProgressRootExitStatus === RootExitStatus.RootSuspendedWithDelay) {
        // The root already suspended with a delay, which means this render
        // definitely won't finish. Since we have a new update, let's mark it as
        // suspended now, right before marking the incoming update. This has the
        // effect of interrupting the current render and switching to the update.
        // TODO: Make sure this doesn't override pings that happen while we've
        // already started rendering.
        markRootSuspended(root, workInProgressRootRenderLanes);
      }
    }

    console.info('scheduleUpdateOnFiber ensureRootIsScheduled,这里是将待更新事件放入队列');
    ensureRootIsScheduled(root, eventTime);
    if (
      lane === Lane.SyncLane &&
      executionContext === ExecutionContext.NoContext &&
      (fiber.mode & TypeOfMode.ConcurrentMode) === TypeOfMode.NoMode
    ) {
      // Flush the synchronous work now, unless we're already working or inside
      // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
      // scheduleCallbackForFiber to preserve the ability to schedule a callback
      // without immediately flushing it. We only do this for user-initiated
      // updates, to preserve historical behavior of legacy mode.
      resetRenderTimer();
      console.info(
        'scheduleUpdateOnFiber 关键点：flushSyncCallbacksOnlyInLegacyMode，这里开始执行更新事件'
      );
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

//674
export function isUnsafeClassRenderPhaseUpdate(fiber: Fiber) {
  // Check if this is a render phase update. Only called by class components,
  // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
  return (
    (fiber.mode & TypeOfMode.ConcurrentMode) === TypeOfMode.NoMode &&
    (executionContext & ExecutionContext.RenderContext) !== ExecutionContext.NoContext
  );
}
//686
// Use this function to schedule a task for a root. There's only one task per
// root; if a task was already scheduled, we'll check to make sure the priority
// of the existing task is the same as the priority of the next level that the
// root has work on. This function is called on every update, and right before
// exiting a task.
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  console.log('ensureRootIsScheduled:确保FiberRoot已经被标记需要更新');
  const existingCallbackNode = root.callbackNode;

  // Check if any lanes are being starved by other work. If so, mark them as
  // expired so we know to work on those next.
  markStarvedLanesAsExpired(root, currentTime);

  // Determine the next lanes to work on, and their priority.
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );

  console.log('根据 lane判断进入哪种更新模式，nextLanes：', nextLanes);

  if (nextLanes === NoLanes) {
    // Special case: There's nothing to work on.
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = Lane.NoLane;
    return;
  }

  // We use the highest priority lane to represent the priority of the callback.
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // Check if there's an existing task. We may be able to reuse it.
  const existingCallbackPriority = root.callbackPriority;
  if (existingCallbackPriority === newCallbackPriority) {
    // The priority hasn't changed. We can reuse the existing task. Exit.
    return;
  }

  if (existingCallbackNode != null) {
    // Cancel the existing callback. We'll schedule a new one below.
    cancelCallback(existingCallbackNode);
  }

  // Schedule a new callback.
  let newCallbackNode;
  console.log('performConcurrentWorkOnRoot 和 performSyncWorkOnRoot 只会触发一个');
  console.log('流程里面，应该先移除之前的 effect 副作用，然后再更新');
  if (newCallbackPriority === Lane.SyncLane) {
    console.info('performSyncWorkOnRoot 开始');
    // Special case: Sync React callbacks are scheduled on a special
    // internal queue
    console.info('performSyncWorkOnRoot 开始，将performSyncWorkOnRoot 放入执行队列');
    if (root.tag === RootTag.LegacyRoot) {
      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
    } else {
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    }
    if (supportsMicrotasks) {
      console.info('performSyncWorkOnRoot scheduleMicrotask 开始');
      scheduleMicrotask(() => {
        // In Safari, appending an iframe forces microtasks to run.
        // https://github.com/facebook/react/issues/22459
        // We don't support running callbacks in the middle of render
        // or commit so we need to check against that.
        if (
          (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) ===
          ExecutionContext.NoContext
        ) {
          // Note that this would still prematurely flush the callbacks
          // if this happens outside render or commit phase (e.g. in an event).
          flushSyncCallbacks();
        }
      });
    } else {
      // Flush the queue in an Immediate task.
      scheduleCallback(PriorityLevel.ImmediatePriority, flushSyncCallbacks);
    }
    newCallbackNode = null;
  } else {
    console.info('performConcurrentWorkOnRoot 开始 --- ,进入到了此处的逻辑');

    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      case EventPriority.DiscreteEventPriority:
        schedulerPriorityLevel = PriorityLevel.ImmediatePriority;
        break;
      case EventPriority.ContinuousEventPriority:
        schedulerPriorityLevel = PriorityLevel.UserBlockingPriority;
        break;
      case EventPriority.DefaultEventPriority:
        schedulerPriorityLevel = PriorityLevel.NormalPriority;
        break;
      case EventPriority.IdleEventPriority:
        schedulerPriorityLevel = PriorityLevel.IdlePriority;
        break;
      default:
        schedulerPriorityLevel = PriorityLevel.NormalPriority;
        break;
    }
    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }

  root.callbackPriority = newCallbackPriority;
  // read:返回来一个 scheduler 的 task
  root.callbackNode = newCallbackNode;
}

// 822
// This is the entry point for every concurrent task, i.e. anything that
// goes through Scheduler.
function performConcurrentWorkOnRoot(root: FiberRoot, didTimeout?: boolean): null | any {
  console.info('performConcurrentWorkOnRoot:Concurrent mode ');
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    resetNestedUpdateFlag();
  }

  // Since we know we're in a React event, we can clear the current
  // event time. The next update will compute a new event time.
  currentEventTime = NoTimestamp;
  currentEventTransitionLane = NoLanes;

  if (
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) !==
    ExecutionContext.NoContext
  ) {
    throw new Error('Should not already be working.');
  }

  // Flush any pending passive effects before deciding which lanes to work on,
  // in case they schedule additional work.
  const originalCallbackNode = root.callbackNode;
  console.log(
    'performConcurrentWorkOnRoot: root.callbackNode 会在更新后被处理，和原始的不一样。如果一样,说明还需要处理'
  );
  console.info('performConcurrentWorkOnRoot 内 renderRoot 开始之前 ，需要处理上一次渲染的副作用');
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

  console.info('performConcurrentWorkOnRoot 内 renderRoot 开始 ，');

  // We disable time-slicing in some cases: if the work has been CPU-bound
  // for too long ("expired" work, to prevent starvation), or we're in
  // sync-updates-by-default mode.
  // TODO: We only check `didTimeout` defensively, to account for a Scheduler
  // bug we're still investigating. Once the bug in Scheduler is fixed,
  // we can remove this, since we track expiration ourselves.
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    (disableSchedulerTimeoutInWorkLoop || !didTimeout);
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);
  console.info('performConcurrentWorkOnRoot 内 renderRoot 已经完成 ，根据结果看后续操作');

  console.info('exitStatus 不是RootInProgress,根据状态判断是否继续执行');
  if (exitStatus !== RootExitStatus.RootInProgress) {
    if (exitStatus === RootExitStatus.RootErrored) {
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
    if (exitStatus === RootExitStatus.RootFatalErrored) {
      const fatalError = workInProgressRootFatalError;
      prepareFreshStack(root, NoLanes);
      markRootSuspended(root, lanes);
      ensureRootIsScheduled(root, now());
      throw fatalError;
    }

    if (exitStatus === RootExitStatus.RootDidNotComplete) {
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
      console.info('renderRoot执行完成了!');
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
        // read:当发生并发事件导致store状态改变时，重新同步渲染组件
        exitStatus = renderRootSync(root, lanes);

        // We need to check again if something threw
        if (exitStatus === RootExitStatus.RootErrored) {
          const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
          if (errorRetryLanes !== NoLanes) {
            lanes = errorRetryLanes;
            exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
            // We assume the tree is now consistent because we didn't yield to any
            // concurrent events.
          }
        }
        if (exitStatus === RootExitStatus.RootFatalErrored) {
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
    console.info('root.callbackNode === originalCallbackNode,还需要再次执行');

    // The task node scheduled for this root is the same one that's
    // currently executed. Need to return a continuation.
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  return null;
}

// 962
/**
 * read: 按 renderRoot 的逻辑，在Concurrent模式下，如果失败了，转同步模式再试一次
 * read: 和hydration有关 ？
 * @param root
 * @param errorRetryLanes
 * @returns
 */
function recoverFromConcurrentError(root: FiberRoot, errorRetryLanes: Lanes) {
  // If an error occurred during hydration, discard server response and fall
  // back to client side render.

  // Before rendering again, save the errors from the previous attempt.
  const errorsFromFirstAttempt = workInProgressRootConcurrentErrors;

  if (isRootDehydrated(root)) {
    console.error('这里是和hydration有关的,客户端渲染应该到不了这里，先不看');
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
    // fixme: 这里是和hydration有关的,如果走到了这里,需要实现
    console.error('这里是和hydration有关的,如果走到了这里,需要实现下面两行');
    // const rootWorkInProgress = prepareFreshStack(root, errorRetryLanes);
    // rootWorkInProgress.flags |= ForceClientRender;
  }

  const exitStatus = renderRootSync(root, errorRetryLanes);
  if (exitStatus !== RootExitStatus.RootErrored) {
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

// 1008
export function queueRecoverableErrors(errors: Array<CapturedValue<mixed>>) {
  if (workInProgressRootRecoverableErrors === null) {
    workInProgressRootRecoverableErrors = errors;
  } else {
    workInProgressRootRecoverableErrors.push.apply(workInProgressRootRecoverableErrors, errors);
  }
}

// 1018
function finishConcurrentRender(root: FiberRoot, exitStatus: RootExitStatus, lanes: Lane) {
  console.log('finishConcurrentRender,exitStatus is:', exitStatus);
  switch (exitStatus) {
    case RootExitStatus.RootInProgress:
    case RootExitStatus.RootFatalErrored: {
      throw new Error('Root did not complete. This is a bug in React.');
    }
    // Flow knows about invariant, so it complains if I add a break
    // statement, but eslint doesn't know about invariant, so it complains
    // if I do. eslint-disable-next-line no-fallthrough
    case RootExitStatus.RootErrored: {
      // We should have already attempted to retry this tree. If we reached
      // this point, it errored again. Commit it.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    case RootExitStatus.RootSuspended: {
      markRootSuspended(root, lanes);

      // We have an acceptable loading state. We need to figure out if we
      // should immediately commit it or wait a bit.

      if (includesOnlyRetries(lanes)) {
        // This render only included retries, no updates. Throttle committing
        // retries so that we don't show too many loading states too quickly.
        const msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
        // Don't bother with a very short suspense time.
        if (msUntilTimeout > 10) {
          const nextLanes = getNextLanes(root, NoLanes);
          if (nextLanes !== NoLanes) {
            // There's additional work on this root.
            break;
          }
          const suspendedLanes = root.suspendedLanes;
          if (!isSubsetOfLanes(suspendedLanes, lanes)) {
            // We should prefer to render the fallback of at the last
            // suspended level. Ping the last suspended level to try
            // rendering it again.
            // FIXME: What if the suspended lanes are Idle? Should not restart.
            const eventTime = requestEventTime();
            markRootPinged(root, suspendedLanes, eventTime);
            break;
          }

          // The render is suspended, it hasn't timed out, and there's no
          // lower priority work to do. Instead of committing the fallback
          // immediately, wait for more data to arrive.
          // read: 如果有suspend的状态，就等会再次render。多处理点数据，避免重复渲染
          root.timeoutHandle = setTimeout(
            commitRoot.bind(
              null,
              root,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions
            ),
            msUntilTimeout
          ) as unknown as number;
          break;
        }
      }
      // The work expired. Commit immediately.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    case RootExitStatus.RootSuspendedWithDelay: {
      markRootSuspended(root, lanes);

      if (includesOnlyTransitions(lanes)) {
        // This is a transition, so we should exit without committing a
        // placeholder and without scheduling a timeout. Delay indefinitely
        // until we receive more data.
        break;
      }

      // This is not a transition, but we did trigger an avoided state.
      // Schedule a placeholder to display after a short delay, using the Just
      // Noticeable Difference.
      // TODO: Is the JND optimization worth the added complexity? If this is
      // the only reason we track the event time, then probably not.
      // Consider removing.

      const mostRecentEventTime = getMostRecentEventTime(root, lanes);
      const eventTimeMs = mostRecentEventTime;
      const timeElapsedMs = now() - eventTimeMs;
      const msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;

      // Don't bother with a very short suspense time.
      if (msUntilTimeout > 10) {
        // Instead of committing the fallback immediately, wait for more data
        // to arrive.
        root.timeoutHandle = setTimeout(
          commitRoot.bind(
            null,
            root,
            workInProgressRootRecoverableErrors,
            workInProgressTransitions
          ),
          msUntilTimeout
        ) as unknown as number;
        break;
      }

      // Commit the placeholder.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    case RootExitStatus.RootCompleted: {
      // The work completed. Ready to commit.
      commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);
      break;
    }
    default: {
      throw new Error('Unknown root exit status.');
    }
  }
}

// 1157
function isRenderConsistentWithExternalStores(finishedWork: Fiber): boolean {
  // Search the rendered tree for external store reads, and check whether the
  // stores were mutated in a concurrent event. Intentionally using an iterative
  // loop instead of recursion so we can exit early.
  let node: Fiber = finishedWork;
  while (true) {
    if (node.flags & Flags.StoreConsistency) {
      // read:
      const updateQueue: FunctionComponentUpdateQueue | null = node.updateQueue as any;
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
    if (node.subtreeFlags & Flags.StoreConsistency && child !== null) {
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
  // Flow doesn't know this is unreachable, but eslint does
  // eslint-disable-next-line no-unreachable
  return true;
}

// 1222
// This is the entry point for synchronous tasks that don't go
// through Scheduler
function performSyncWorkOnRoot(root: FiberRoot) {
  console.log('performSyncWorkOnRoot 开始');
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    syncNestedUpdateFlag();
  }

  if (
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) !==
    ExecutionContext.NoContext
  ) {
    throw new Error('Should not already be working.');
  }

  flushPassiveEffects();

  let lanes = getNextLanes(root, NoLanes);
  if (!includesSomeLane(lanes, Lane.SyncLane)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root, now());
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);
  if (root.tag !== RootTag.LegacyRoot && exitStatus === RootExitStatus.RootErrored) {
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

  if (exitStatus === RootExitStatus.RootFatalErrored) {
    const fatalError = workInProgressRootFatalError;
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, lanes);
    ensureRootIsScheduled(root, now());
    throw fatalError;
  }

  if (exitStatus === RootExitStatus.RootDidNotComplete) {
    throw new Error('Root did not complete. This is a bug in React.');
  }

  // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.
  const finishedWork: Fiber = root.current.alternate!;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(root, workInProgressRootRecoverableErrors, workInProgressTransitions);

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root, now());

  return null;
}

// 1300
export function deferredUpdates<A>(fn: () => A): A {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(EventPriority.DefaultEventPriority);
    return fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

export function batchedUpdates<A, R>(fn: (a: A) => R, a: A): R {
  console.log('workloop -> batchedUpdates ', fn);
  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.BatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    // If there were legacy sync updates, flush them at the end of the outer
    // most batchedUpdates-like method.
    if (executionContext === ExecutionContext.NoContext) {
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

// 1334
export function discreteUpdates<A, B, C, D, R>(
  fn: (a: A, b: B, c: C, d: D) => R,
  a: A,
  b: B,
  c: C,
  d: D
): R {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
    return fn(a, b, c, d);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
    if (executionContext === ExecutionContext.NoContext) {
      resetRenderTimer();
    }
  }
}

// Overload the definition to the two valid signatures.
// Warning, this opts-out of checking the function body.
export function flushSync<R>(fn: () => R): R;
export function flushSync(): void;
export function flushSync(fn?: () => any) {
  // In legacy mode, we flush pending passive effects at the beginning of the
  // next event, not at the end of the previous one.
  if (
    rootWithPendingPassiveEffects !== null &&
    rootWithPendingPassiveEffects.tag === RootTag.LegacyRoot &&
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) ===
      ExecutionContext.NoContext
  ) {
    flushPassiveEffects();
  }

  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.BatchedContext;

  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    // Flush the immediate callbacks that were scheduled during this batch.
    // Note that this will happen even if batchedUpdates is higher up
    // the stack.
    if (
      (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) ===
      ExecutionContext.NoContext
    ) {
      flushSyncCallbacks();
    }
  }
}

// 1400
export function isAlreadyRendering() {
  console.error('isAlreadyRendering，dev 环境下用到，可以删除了');
  // Used by the renderer to print a warning if certain APIs are called from
  // the wrong context.
  return false;
}

// 1410
export function flushControlled(fn: () => mixed): void {
  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.BatchedContext;
  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
    fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    if (executionContext === ExecutionContext.NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      resetRenderTimer();
      flushSyncCallbacks();
    }
  }
}

//1445
function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    clearTimeout(timeoutHandle);
  }

  if (workInProgress !== null) {
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      const current = interruptedWork.alternate;
      // read: 恢复中断之前的状态
      unwindInterruptedWork(current, interruptedWork, workInProgressRootRenderLanes);
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;
  workInProgressRootExitStatus = RootExitStatus.RootInProgress;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootInterleavedUpdatedLanes = NoLanes;
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  workInProgressRootConcurrentErrors = null;
  workInProgressRootRecoverableErrors = null;

  finishQueueingConcurrentUpdates();

  return rootWorkInProgress;
}
//1492
// read: 处理 workloop 的错误
function handleError(root: FiberRoot, thrownValue: any): void {
  do {
    let erroredWork = workInProgress;
    try {
      // Reset module-level state that was set during the render phase.
      resetContextDependencies();
      resetHooksAfterThrow();
      // TODO: I found and added this missing line while investigating a
      // separate issue. Write a regression test using string refs.
      ReactCurrentOwner.current = null;

      if (erroredWork === null || erroredWork.return === null) {
        // Expected to be working on a non-root fiber. This is a fatal error
        // because there's no ancestor that can handle it; the root is
        // supposed to capture all errors that weren't caught by an error
        // boundary.
        workInProgressRootExitStatus = RootExitStatus.RootFatalErrored;
        workInProgressRootFatalError = thrownValue;
        // Set `workInProgress` to null. This represents advancing to the next
        // sibling, or the parent if there are no siblings. But since the root
        // has no siblings nor a parent, we set it to null. Usually this is
        // handled by `completeUnitOfWork` or `unwindWork`, but since we're
        // intentionally not calling those, we need set it here.
        // TODO: Consider calling `unwindWork` to pop the contexts.
        workInProgress = null;
        return;
      }

      if (enableProfilerTimer && erroredWork.mode & TypeOfMode.ProfileMode) {
        // Record the time spent rendering before an error was thrown. This
        // avoids inaccurate Profiler durations in the case of a
        // suspended render.
        stopProfilerTimerIfRunningAndRecordDelta(erroredWork, true);
      }

      if (enableSchedulingProfiler) {
        // read: devtool 用到的
        // markComponentRenderStopped();

        if (
          thrownValue !== null &&
          typeof thrownValue === 'object' &&
          typeof thrownValue.then === 'function'
        ) {
          // read: devtool 用到的
          // const wakeable: Wakeable = (thrownValue );
          // markComponentSuspended(
          //   erroredWork,
          //   wakeable,
          //   workInProgressRootRenderLanes,
          // );
        } else {
          // read: devtool 用到的
          // markComponentErrored(erroredWork, thrownValue, workInProgressRootRenderLanes);
        }
      }

      throwException(
        root,
        erroredWork.return,
        erroredWork,
        thrownValue,
        workInProgressRootRenderLanes
      );
      completeUnitOfWork(erroredWork);
    } catch (yetAnotherThrownValue) {
      // Something in the return path also threw.
      thrownValue = yetAnotherThrownValue;
      if (workInProgress === erroredWork && erroredWork !== null) {
        // If this boundary has already errored, then we had trouble processing
        // the error. Bubble it to the next boundary.
        erroredWork = erroredWork.return;
        workInProgress = erroredWork;
      } else {
        erroredWork = workInProgress;
      }
      continue;
    }
    // Return to the normal work loop.
    return;
  } while (true);
}

// 1578
// read: 这里是一些 hooks。不同的触发时机，hook 还不一样
function pushDispatcher() {
  const prevDispatcher = ReactCurrentDispatcher.current;
  console.log('ReactCurrentDispatcher: 也就是 hook  设置成 ContextOnlyDispatcher ');
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

function popDispatcher(prevDispatcher: Dispatcher) {
  console.log('ReactCurrentDispatcher: 也就是 hook 设置成之前的状态 ');
  ReactCurrentDispatcher.current = prevDispatcher;
}

export function markCommitTimeOfFallback() {
  globalMostRecentFallbackTime = now();
}
// 1599
export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  workInProgressRootSkippedLanes = mergeLanes(lane, workInProgressRootSkippedLanes);
}

// 1658
function renderRootSync(root: FiberRoot, lanes: Lanes) {
  console.log('renderRootSync');
  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    prepareFreshStack(root, lanes);
  }

  // read: 这里是给 devtool 用的
  // if (enableSchedulingProfiler) {
  //   markRenderStarted(lanes);
  // }

  do {
    try {
      workLoopSync();
      break;
    } catch (thrownValue) {
      console.error('thrownValue in renderRootSync,handleError函数需要实现', thrownValue);
      handleError(root, thrownValue);
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

  // read: 这里是给 devtool 用的
  // if (enableSchedulingProfiler) {
  //   markRenderStopped();
  // }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  return workInProgressRootExitStatus;
}

// 1734
// The work loop is an extremely hot path. Tell Closure not to inline it.
/** @noinline */
function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}
// 1743
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  console.log('renderRootConcurrent');
  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // read: 这里默认没有打开 Transition Trace, 始终都是 null
    // read: 可能要看一下， 使用了 useTransiton hook 后，lane 也不关吗？
    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    resetRenderTimer();
    prepareFreshStack(root, lanes);
  }

  // read: 这里是给 devtool 用的
  // if (enableSchedulingProfiler) {
  //   markRenderStarted(lanes);
  // }

  do {
    try {
      workLoopConcurrent();
      break;
    } catch (thrownValue) {
      console.error('thrownValue in renderRootConcurrent,handleError函数需要实现', thrownValue);
      handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  popDispatcher(prevDispatcher);
  executionContext = prevExecutionContext;

  // Check if the tree has completed.
  if (workInProgress !== null) {
    // Still work remaining.
    // read: 这里是给 devtool 用的
    // if (enableSchedulingProfiler) {
    //   markRenderYielded();
    // }
    return RootExitStatus.RootInProgress;
  } else {
    // Completed the tree.
    // read: 这里是给 devtool 用的
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
// 1823
/** @noinline */
function workLoopConcurrent() {
  console.log('workLoopConcurrent');
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
  console.log('workLoopConcurrent 完成');
}

// 1831
function performUnitOfWork(unitOfWork: Fiber): void {
  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  const current = unitOfWork.alternate;
  console.log('performUnitOfWork unitOfWork.type: ', unitOfWork.type);

  let next;
  if (enableProfilerTimer && (unitOfWork.mode & TypeOfMode.ProfileMode) !== TypeOfMode.NoMode) {
    startProfilerTimer(unitOfWork);
    next = beginWork(current, unitOfWork, subtreeRenderLanes);
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    next = beginWork(current, unitOfWork, subtreeRenderLanes);
  }

  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    console.log('深度便利，已经走到一个叶子节点,开始进入completeUnitOfWork阶段');
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }

  ReactCurrentOwner.current = null;
}
// 1859
function completeUnitOfWork(unitOfWork: Fiber): void {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  let completedWork: Fiber | null = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    const current = completedWork.alternate;
    const returnFiber: Fiber | null = completedWork.return;
    console.log('completeUnitOfWork,completedWork.type:', completedWork.type);

    // Check if the work completed or if something threw.
    if ((completedWork.flags & Flags.Incomplete) === Flags.NoFlags) {
      let next;
      if (
        !enableProfilerTimer ||
        (completedWork.mode & TypeOfMode.ProfileMode) === TypeOfMode.NoMode
      ) {
        next = completeWork(current, completedWork, subtreeRenderLanes);
      } else {
        startProfilerTimer(completedWork);
        next = completeWork(current, completedWork, subtreeRenderLanes);
        // Update render duration assuming we didn't error.
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
      }

      if (next !== null) {
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
        next.flags &= Flags.HostEffectMask;
        workInProgress = next;
        return;
      }

      if (
        enableProfilerTimer &&
        (completedWork.mode & TypeOfMode.ProfileMode) !== TypeOfMode.NoMode
      ) {
        // Record the render duration for the fiber that errored.
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);

        // Include the time spent working on failed children before continuing.
        let actualDuration = completedWork.actualDuration || 0;
        let child = completedWork.child;
        while (child !== null) {
          actualDuration += child.actualDuration || 0;
          child = child.sibling;
        }
        completedWork.actualDuration = actualDuration;
      }

      if (returnFiber !== null) {
        // Mark the parent fiber as incomplete and clear its subtree flags.
        returnFiber.flags |= Flags.Incomplete;
        returnFiber.subtreeFlags = Flags.NoFlags;
        returnFiber.deletions = null;
      } else {
        // We've unwound all the way to the root.
        workInProgressRootExitStatus = RootExitStatus.RootDidNotComplete;
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
    completedWork = returnFiber;
    // Update the next thing we're working on in case something throws.
    workInProgress = completedWork;
  } while (completedWork !== null);

  // We've reached the root.
  if (workInProgressRootExitStatus === RootExitStatus.RootInProgress) {
    workInProgressRootExitStatus = RootExitStatus.RootCompleted;
  }
}

// 1958
function commitRoot(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null
) {
  console.log('commitRoot:The work completed. Ready to commit');
  // TODO: This no longer makes any sense. We already wrap the mutation and
  // layout phases. Should be able to remove.
  const previousUpdateLanePriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
    commitRootImpl(root, recoverableErrors, transitions, previousUpdateLanePriority);
  } finally {
    ReactCurrentBatchConfig.transition = prevTransition;
    setCurrentUpdatePriority(previousUpdateLanePriority);
  }

  return null;
}

// 1985
function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null,
  renderPriorityLevel: Lane
) {
  do {
    console.log(
      'flushPassiveEffects, 当前rootWithPendingPassiveEffects：',
      rootWithPendingPassiveEffects
    );
    console.log(
      '这里flushPassiveEffects 是在本次 dom 更新完成之后，最终还没挂载到root container 之前的处理逻辑'
    );
    // `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
    // means `flushPassiveEffects` will sometimes result in additional
    // passive effects. So we need to keep flushing in a loop until there are
    // no more pending effects.
    // TODO: Might be better if `flushPassiveEffects` did not automatically
    // flush synchronous work at the end, to avoid factoring hazards like this.
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);

  if (
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) !==
    ExecutionContext.NoContext
  ) {
    throw new Error('Should not already be working.');
  }

  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  if (finishedWork === null) {
    return null;
  } else {
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
  root.callbackPriority = Lane.NoLane;

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
    (finishedWork.subtreeFlags & PassiveMask) !== Flags.NoFlags ||
    (finishedWork.flags & PassiveMask) !== Flags.NoFlags
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
      scheduleCallback(PriorityLevel.NormalPriority, () => {
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
    Flags.NoFlags;
  const rootHasEffect =
    (finishedWork.flags & (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    Flags.NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const prevTransition = ReactCurrentBatchConfig.transition;
    ReactCurrentBatchConfig.transition = null;
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);

    const prevExecutionContext = executionContext;
    executionContext |= ExecutionContext.CommitContext;

    // Reset this to null before calling lifecycles
    ReactCurrentOwner.current = null;

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(root, finishedWork);

    if (enableProfilerTimer) {
      // Mark the current commit time to be shared by all Profilers in this
      // batch. This enables them to be grouped later.
      recordCommitTime();
    }

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      // Track the root here, rather than in commitLayoutEffects(), because of ref setters.
      // Updates scheduled during ref detachment should also be flagged.
      rootCommittingMutationOrLayoutEffects = root;
    }

    // The next phase is the mutation phase, where we mutate the host tree.
    commitMutationEffects(root, finishedWork, lanes);

    resetAfterCommit(root.containerInfo);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    commitLayoutEffects(finishedWork, root, lanes);

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      rootCommittingMutationOrLayoutEffects = null;
    }

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
    if (enableProfilerTimer) {
      recordCommitTime();
    }
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

  // Always call this before exiting `commitRoot`, to ensure that any
  // additional work on this root is scheduled.
  ensureRootIsScheduled(root, now());

  if (recoverableErrors !== null) {
    // There were errors during this render, but recovered from them without
    // needing to surface it to the UI. We log them here.
    const onRecoverableError = root.onRecoverableError;
    for (let i = 0; i < recoverableErrors.length; i++) {
      const recoverableError = recoverableErrors[i];
      const componentStack = recoverableError.stack!;
      const digest = recoverableError.digest!;
      onRecoverableError(recoverableError.value, { componentStack, digest });
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
  if (
    includesSomeLane(pendingPassiveEffectsLanes, Lane.SyncLane) &&
    root.tag !== RootTag.LegacyRoot
  ) {
    flushPassiveEffects();
  }

  // Read this again, since a passive effect might have updated it
  remainingLanes = root.pendingLanes;
  if (includesSomeLane(remainingLanes, Lane.SyncLane)) {
    if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
      markNestedUpdateScheduled();
    }

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

  return null;
}

// 2341
function releaseRootPooledCache(root: FiberRoot, remainingLanes: Lanes) {
  if (enableCache) {
    const pooledCacheLanes = (root.pooledCacheLanes &= remainingLanes);
    if (pooledCacheLanes === NoLanes) {
      // None of the remaining work relies on the cache pool. Clear it so
      // subsequent requests get a new cache
      const pooledCache = root.pooledCache;
      if (pooledCache != null) {
        root.pooledCache = null;
        releaseCache(pooledCache);
      }
    }
  }
}

// 2356
export function flushPassiveEffects(): boolean {
  // read: 该函数调用有两个时机，一个是unmount 的时候，移除上一次的 useEffect 里的 return
  //  另一个是本次 dom 更新，但还没挂载到 root container 时，执行本次的 effect
  console.log(
    'flushPassiveEffects调用有两个时机，一个是unmount 的时候，移除上一次的 useEffect 里的 return \n另一个是本次 dom 更新，但还没挂载到 root container 时，执行本次的 effect'
  );
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
    const priority = lowerEventPriority(EventPriority.DefaultEventPriority, renderPriority);
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

// 2408
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

  if (
    (executionContext & (ExecutionContext.RenderContext | ExecutionContext.CommitContext)) !==
    ExecutionContext.NoContext
  ) {
    throw new Error('Cannot flush passive effects while already rendering.');
  }

  // read: 实际上是和 devtool 相关，先不看
  // if (enableSchedulingProfiler) {
  //   markPassiveEffectsStarted(lanes);
  // }

  const prevExecutionContext = executionContext;
  executionContext |= ExecutionContext.CommitContext;

  // 这里是先卸载之前的fiber，再重新挂载
  // React 的 effects 在每次渲染中都会执行这两个函数
  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes, transitions);

  // TODO: Move to commitPassiveMountEffects
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const profilerEffects = pendingPassiveProfilerEffects;
    pendingPassiveProfilerEffects = [];
    for (let i = 0; i < profilerEffects.length; i++) {
      const fiber = profilerEffects[i];
      commitPassiveEffectDurations(root, fiber);
    }
  }

  // read: 实际上是和 devtool 相关，先不看
  // if (enableSchedulingProfiler) {
  //   markPassiveEffectsStopped();
  // }

  executionContext = prevExecutionContext;

  flushSyncCallbacks();

  // TODO: Move to commitPassiveMountEffects
  // read: 实际上是和 devtool 相关，先不看
  // onPostCommitRootDevTools(root);
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const stateNode = root.current.stateNode;
    stateNode.effectDuration = 0;
    stateNode.passiveEffectDuration = 0;
  }

  return true;
}

// 2555
function captureCommitPhaseErrorOnRoot(rootFiber: Fiber, sourceFiber: Fiber, error: mixed) {
  console.error('captureCommitPhaseErrorOnRoot 未实现');
}

export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: mixed
) {
  console.error('captureCommitPhaseError 未实现,error is:', error);
}

// 2749
// Computes the next Just Noticeable Difference (JND) boundary.
// The theory is that a person can't tell the difference between small differences in time.
// Therefore, if we wait a bit longer than necessary that won't translate to a noticeable
// difference in the experience. However, waiting for longer might mean that we can avoid
// showing an intermediate loading state. The longer we have already waited, the harder it
// is to tell small differences in time. Therefore, the longer we've already waited,
// the longer we can wait additionally. At some point we have to give up though.
// We pick a train model where the next boundary commits at a consistent schedule.
// These particular numbers are vague estimates. We expect to adjust them based on research.
function jnd(timeElapsed: number) {
  return timeElapsed < 120
    ? 120
    : timeElapsed < 480
    ? 480
    : timeElapsed < 1080
    ? 1080
    : timeElapsed < 1920
    ? 1920
    : timeElapsed < 3000
    ? 3000
    : timeElapsed < 4320
    ? 4320
    : Math.ceil(timeElapsed / 1960) * 1960;
}

// 2774
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
