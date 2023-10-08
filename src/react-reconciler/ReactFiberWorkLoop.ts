import { now } from '@/scheduler/Scheduler';
import { Lane, NoLanes, NoTimestamp, SyncLane, markRootUpdated } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';

type ExecutionContext = number;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

let executionContext: ExecutionContext = NoContext;

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
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane
    );
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
      if (deferRenderPhaseUpdateToNextBatch || (executionContext & RenderContext) === NoContext) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane
        );
      }
      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // The root already suspended with a delay, which means this render
        // definitely won't finish. Since we have a new update, let's mark it as
        // suspended now, right before marking the incoming update. This has the
        // effect of interrupting the current render and switching to the update.
        // TODO: Make sure this doesn't override pings that happen while we've
        // already started rendering.
        markRootSuspended(root, workInProgressRootRenderLanes);
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
