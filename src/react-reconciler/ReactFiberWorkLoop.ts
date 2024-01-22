import { getCurrentEventPriority } from '../react-dom/ReactFiberHostConfig';
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
import { EventPriority, getCurrentUpdatePriority } from './ReactEventPriorities';
import { Lane, Lanes, NoLanes, NoTimestamp, pickArbitraryLane } from './ReactFiberLane';
import { NoTransition, requestCurrentTransition } from './ReactFiberTransition';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';

import {
  // Aliased because `act` will override and push to an internal queue
  scheduleCallback as Scheduler_scheduleCallback,
  cancelCallback as Scheduler_cancelCallback,
  shouldYield,
  requestPaint,
  now,
  //   ImmediatePriority as ImmediateSchedulerPriority,
  //   UserBlockingPriority as UserBlockingSchedulerPriority,
  //   NormalPriority as NormalSchedulerPriority,
  //   IdlePriority as IdleSchedulerPriority,
  PriorityLevel,
} from './Scheduler';

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

//   requestUpdateLane,
//   scheduleUpdateOnFiber,

//   batchedUpdates,
//   flushSync,
//   isAlreadyRendering,
//   flushControlled,
//   deferredUpdates,
//   discreteUpdates,
//   flushPassiveEffects,

// If two updates are scheduled within the same event, we should treat their
// event times as simultaneous, even if the actual clock time has advanced
// between the first and second call.
let currentEventTime: number = NoTimestamp;
let currentEventTransitionLane: Lanes = NoLanes;

let isRunningInsertionEffect = false;

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
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

//674
export function isUnsafeClassRenderPhaseUpdate(fiber: Fiber) {
  // Check if this is a render phase update. Only called by class components,
  // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
  return (
    (fiber.mode & TypeOfMode.ConcurrentMode) === TypeOfMode.NoMode &&
    (executionContext & ExecutionContext.RenderContext) !== ExecutionContext.NoContext
  );
}
