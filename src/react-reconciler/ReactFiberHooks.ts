import ReactCurrentDispatcher from '../react/ReactCurrentDispatcher';
import {
  enableCache,
  enableLazyContextPropagation,
  enableNewReconciler,
} from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork';
import { CacheContext } from './ReactFiberCacheComponent';
import type { Cache } from './ReactFiberCacheComponent';
import {
  enqueueConcurrentHookUpdate,
  enqueueConcurrentHookUpdateAndEagerlyBailout,
} from './ReactFiberConcurrentUpdates';
import { Flags } from './ReactFiberFlags';

import {
  Lane,
  Lanes,
  NoLanes,
  intersectLanes,
  isSubsetOfLanes,
  isTransitionLane,
  markRootEntangled,
  mergeLanes,
} from './ReactFiberLane';
import { readContext } from './ReactFiberNewContext';
import {
  markSkippedUpdateLanes,
  requestEventTime,
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from './ReactFiberWorkLoop';
import { HookFlags } from './ReactHookEffectTags';
import type { Fiber, Dispatcher, FiberRoot } from './ReactInternalTypes';

export type Update<S, A> = {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A> | null;
};

export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null;
  interleaved: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => any) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
};

export type Effect = {
  tag: HookFlags;
  create: () => (() => void) | void;
  destroy: (() => void) | void;
  deps: Array<mixed> | null;
  next: Effect | null;
};

type StoreInstance<T> = {
  value: T;
  getSnapshot: () => T;
};

type BasicStateAction<S> = ((state: S) => S) | S;

type Dispatch<A> = (action: A) => void;

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
};

export type Hook<S = any> = {
  memoizedState: S | null;
  baseState: S | null;
  baseQueue: Update<any, any> | null;
  queue: UpdateQueue<any, any> | null;
  next: Hook<S> | null;
};

// These are set right before calling the component.
let renderLanes: Lanes = NoLanes;
// The work-in-progress fiber. I've named it differently to distinguish it from
// the work-in-progress hook.
let currentlyRenderingFiber: Fiber | null = null;

// Hooks are stored as a linked list on the fiber's memoizedState field. The
// current hook list is the list that belongs to the current fiber. The
// work-in-progress hook list is a new list that will be added to the
// work-in-progress fiber.
let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;

// Whether an update was scheduled at any point during the render phase. This
// does not get reset if we do another render pass; only when we're completely
// finished evaluating this component. This is an optimization so we know
// whether we need to clear render phase updates after a throw.
let didScheduleRenderPhaseUpdate: boolean = false;
// Where an update was scheduled only during the current render pass. This
// gets reset after each attempt.
// TODO: Maybe there's some way to consolidate this with
// `didScheduleRenderPhaseUpdate`. Or with `numberOfReRenders`.
let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;

// Counts the number of useId hooks in this component.
let localIdCounter: number = 0;
// Used for ids that are generated completely client-side (i.e. not during
// hydration). This counter is global, so client ids are not stable across
// render attempts.
let globalClientIdCounter: number = 0;

const RE_RENDER_LIMIT = 25;

// 315
function throwInvalidHookError() {
  throw new Error(
    'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
      ' one of the following reasons:\n' +
      '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
      '2. You might be breaking the Rules of Hooks\n' +
      '3. You might have more than one copy of React in the same app\n' +
      'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.'
  );
}

// 326
// read: 比较 hook 的依赖项是否相同
function areHookInputsEqual(nextDeps: Array<any>, prevDeps: Array<any> | null) {
  if (prevDeps === null) {
    return false;
  }

  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

// 373
export function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes
): any {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  // The following should have already been reset
  // currentHook = null;
  // workInProgressHook = null;

  // didScheduleRenderPhaseUpdate = false;
  // localIdCounter = 0;

  // TODO Warn if no hooks are used at all during mount, then some are used during update.
  // Currently we will identify the update render as a mount because memoizedState === null.
  // This is tricky because it's valid for certain types of components (e.g. React.lazy)

  // Using memoizedState to differentiate between mount/update only works if at least one stateful hook is used.
  // Non-stateful hooks (e.g. context) don't get added to memoizedState,
  // so memoizedState would be null during updates and mounts.

  // read: 根据 fiber 的状态和 hook 的状态 确定是重新渲染还是首次渲染
  // read: 对于无状态hooks，比如 useContext，单独一套逻辑(也就是具体实现里，单独处理) - 都是 readContext
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  console.log('这里就是执行真正的 React Component了： ', Component);
  let children = Component(props, secondArg);

  // Check if there was a render phase update
  if (didScheduleRenderPhaseUpdateDuringThisPass) {
    console.log(
      '这里要看下进入到这里的逻辑是什么，可能是组件里面有有很多 hook，每个 hook 内部会标记'
    );
    // Keep rendering in a loop for as long as render phase updates continue to
    // be scheduled. Use a counter to prevent infinite loops.
    let numberOfReRenders: number = 0;
    do {
      didScheduleRenderPhaseUpdateDuringThisPass = false;
      localIdCounter = 0;

      if (numberOfReRenders >= RE_RENDER_LIMIT) {
        throw new Error(
          'Too many re-renders. React limits the number of renders to prevent ' +
            'an infinite loop.'
        );
      }

      numberOfReRenders += 1;

      // Start over from the beginning of the list
      currentHook = null;
      workInProgressHook = null;

      workInProgress.updateQueue = null;

      ReactCurrentDispatcher.current = HooksDispatcherOnRerender;

      children = Component(props, secondArg);
    } while (didScheduleRenderPhaseUpdateDuringThisPass);
  }

  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrance.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  // This check uses currentHook so that it works the same in DEV and prod bundles.
  // hookTypesDev could catch more cases (e.g. context) but only in DEV bundles.
  const didRenderTooFewHooks = currentHook !== null && currentHook.next !== null;

  renderLanes = NoLanes;
  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;
  // This is reset by checkDidRenderIdHook
  // localIdCounter = 0;

  if (didRenderTooFewHooks) {
    throw new Error(
      'Rendered fewer hooks than expected. This may be caused by an accidental ' +
        'early return statement.'
    );
  }

  // read: 这里特性是 false
  // if (enableLazyContextPropagation) {
  //   if (current !== null) {
  //     if (!checkIfWorkInProgressReceivedUpdate()) {
  //       // If there were no changes to props or state, we need to check if there
  //       // was a context change. We didn't already do this because there's no
  //       // 1:1 correspondence between dependencies and hooks. Although, because
  //       // there almost always is in the common case (`readContext` is an
  //       // internal API), we could compare in there. OTOH, we only hit this case
  //       // if everything else bails out, so on the whole it might be better to
  //       // keep the comparison out of the common path.
  //       const currentDependencies = current.dependencies;
  //       if (currentDependencies !== null && checkIfContextChanged(currentDependencies)) {
  //         markWorkInProgressReceivedUpdate();
  //       }
  //     }
  //   }
  // }
  return children;
}
// 557
export function checkDidRenderIdHook() {
  // This should be called immediately after every renderWithHooks call.
  // Conceptually, it's part of the return value of renderWithHooks; it's only a
  // separate function to avoid using an array tuple.
  const didRenderIdHook = localIdCounter !== 0;
  localIdCounter = 0;
  return didRenderIdHook;
}

// 591
export function resetHooksAfterThrow(): void {
  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrance.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  if (didScheduleRenderPhaseUpdate) {
    // There were render phase updates. These are only valid for this render
    // phase, which we are now aborting. Remove the updates from the queues so
    // they do not persist to the next render. Do not remove updates from hooks
    // that weren't processed.
    //
    // Only reset the updates from the queue if it has a clone. If it does
    // not have a clone, that means it wasn't processed, and the updates were
    // scheduled before we entered the render phase.
    let hook: Hook | null = currentlyRenderingFiber?.memoizedState;
    while (hook !== null) {
      const queue = hook.queue;
      if (queue !== null) {
        queue.pending = null;
      }
      hook = hook.next;
    }
    didScheduleRenderPhaseUpdate = false;
  }

  renderLanes = NoLanes;
  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdateDuringThisPass = false;
  localIdCounter = 0;
}

// 634
function mountWorkInProgressHook<MS = any>(): Hook<MS> {
  const hook: Hook<MS> = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  console.log('hook.queue 是在各个 hook mounted 里面赋值的');

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber!.memoizedState = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

// 656
function updateWorkInProgressHook<MS = any>(): Hook<MS> {
  // This function is used both for updates and for re-renders triggered by a
  // render phase update. It assumes there is either a current hook we can
  // clone, or a work-in-progress hook from a previous render pass that we can
  // use as a base. When we reach the end of the base list, we must switch to
  // the dispatcher used for mounts.
  let nextCurrentHook: null | Hook;
  if (currentHook === null) {
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook: null | Hook;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber?.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    // There's already a work-in-progress. Reuse it.
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;

    currentHook = nextCurrentHook;
  } else {
    // Clone from the current hook.

    if (nextCurrentHook === null) {
      throw new Error('Rendered more hooks than during the previous render.');
    }

    currentHook = nextCurrentHook;

    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };

    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber!.memoizedState = workInProgressHook = newHook;
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}
// 717
function createFunctionComponentUpdateQueue(): FunctionComponentUpdateQueue {
  return {
    lastEffect: null,
    stores: null,
  };
}

function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  // $FlowFixMe: Flow doesn't like mixed types
  return typeof action === 'function' ? (action as (state: S) => S)(state) : action;
}

function mountReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initial: I) => S
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook<S>();
  let initialState: S;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = initialArg as any as S;
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, A> = {
    pending: null,
    interleaved: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  const dispatch: Dispatch<A> = (queue.dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber!,
    queue as any
  ));
  return [hook.memoizedState, dispatch];
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initial: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook<S>();
  const queue = hook.queue;

  if (queue === null) {
    throw new Error('Should have a queue. This is likely a bug in React. Please file an issue.');
  }

  queue.lastRenderedReducer = reducer;

  const current: Hook = currentHook!;

  // The last rebase update that is NOT part of the base state.
  let baseQueue = current.baseQueue;

  // The last pending update that hasn't been processed yet.
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // We have new updates that haven't been processed yet.
    // We'll add them to the base queue.
    if (baseQueue !== null) {
      // Merge the pending queue and the base queue.
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }

    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  if (baseQueue !== null) {
    // We have a queue to process.
    const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast: Update<S, A> | null = null;
    let update = first;
    do {
      const updateLane = update?.lane;
      if (!isSubsetOfLanes(renderLanes, updateLane!)) {
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        const clone: Update<S, A> = {
          lane: updateLane!,
          action: update!.action,
          hasEagerState: update!.hasEagerState,
          eagerState: update!.eagerState,
          next: null,
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = (newBaseQueueLast as Update<S, A>).next = clone;
        }
        // Update the remaining priority in the queue.
        // TODO: Don't need to accumulate this. Instead, we can remove
        // renderLanes from the original lanes.
        currentlyRenderingFiber!.lanes = mergeLanes(currentlyRenderingFiber!.lanes, updateLane!);
        markSkippedUpdateLanes(updateLane!);
      } else {
        // This update does have sufficient priority.

        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            // This update is going to be committed so we never want uncommit
            // it. Using NoLane works because 0 is a subset of all bitmasks, so
            // this will never be skipped by the check above.
            lane: Lane.NoLane,
            action: update!.action,
            hasEagerState: update!.hasEagerState,
            eagerState: update!.eagerState,
            next: null,
          };
          newBaseQueueLast = (newBaseQueueLast as Update<S, A>).next = clone;
        }

        // Process this update.
        if (update!.hasEagerState) {
          // If this update is a state update (not a reducer) and was processed eagerly,
          // we can use the eagerly computed state
          newState = update!.eagerState;
        } else {
          const action = update!.action;
          newState = reducer(newState, action);
        }
      }
      update = update!.next;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  // Interleaved updates are stored on a separate queue. We aren't going to
  // process them during this render, but we do need to track which lanes
  // are remaining.
  const lastInterleaved = queue.interleaved;
  if (lastInterleaved !== null) {
    let interleaved = lastInterleaved;
    do {
      const interleavedLane = interleaved.lane;
      currentlyRenderingFiber!.lanes = mergeLanes(currentlyRenderingFiber!.lanes, interleavedLane);
      markSkippedUpdateLanes(interleavedLane);
      interleaved = interleaved.next as Update<S, A>;
    } while (interleaved !== lastInterleaved);
  } else if (baseQueue === null) {
    // `queue.lanes` is used for entangling transitions. We can set it back to
    // zero once the queue is empty.
    queue.lanes = NoLanes;
  }

  const dispatch: Dispatch<A> = queue.dispatch!;
  return [hook.memoizedState!, dispatch];
}

// 915
function rerenderReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (initial: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  if (queue === null) {
    throw new Error('Should have a queue. This is likely a bug in React. Please file an issue.');
  }

  queue.lastRenderedReducer = reducer;

  // This is a re-render. Apply the new render phase updates to the previous
  // work-in-progress hook.
  const dispatch: Dispatch<A> = queue.dispatch as any;
  const lastRenderPhaseUpdate = queue.pending;
  let newState = hook.memoizedState;
  if (lastRenderPhaseUpdate !== null) {
    // The queue doesn't persist past this render pass.
    queue.pending = null;

    const firstRenderPhaseUpdate = lastRenderPhaseUpdate.next;
    let update = firstRenderPhaseUpdate;
    do {
      // Process this render phase update. We don't have to check the
      // priority because it will always be the same as the current
      // render's.
      const action = update!.action;
      newState = reducer(newState, action);
      update = update!.next;
    } while (update !== firstRenderPhaseUpdate);

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    // Don't persist the state accumulated from the render phase updates to
    // the base state unless the queue is empty.
    // TODO: Not sure if this is the desired semantics, but it's what we
    // do for gDSFP. I can't remember why.
    if (hook.baseQueue === null) {
      hook.baseState = newState;
    }

    queue.lastRenderedState = newState;
  }
  return [newState, dispatch];
}

//1509
function mountState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook<S>();
  if (typeof initialState === 'function') {
    initialState = (initialState as () => S)();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    interleaved: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState as S,
  };
  hook.queue = queue;
  const dispatch: Dispatch<BasicStateAction<S>> = (queue.dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber!,
    queue as any
  ));
  return [hook.memoizedState, dispatch];
}

function updateState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, initialState);
}
// 1543
function rerenderState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
  return rerenderReducer(basicStateReducer, initialState);
}

// 1548
function pushEffect(
  tag: HookFlags,
  create: () => (() => void) | void,
  destroy: any,
  deps: Array<any> | null
) {
  const effect: Effect = {
    tag,
    create,
    destroy,
    deps,
    // Circular
    next: null,
  };
  let componentUpdateQueue: null | FunctionComponentUpdateQueue = currentlyRenderingFiber!
    .updateQueue as any;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue as any;
    componentUpdateQueue!.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}

// 1577
let stackContainsErrorMessage: boolean | null = null;

// 1667
function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const hook = mountWorkInProgressHook<Effect>();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber!.flags |= fiberFlags;
  hook.memoizedState = pushEffect(HookFlags.HasEffect | hookFlags, create, undefined, nextDeps);
}

function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
): void {
  const hook = updateWorkInProgressHook<Effect>();
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }

  currentlyRenderingFiber!.flags |= fiberFlags;

  hook.memoizedState = pushEffect(HookFlags.HasEffect | hookFlags, create, destroy, nextDeps);
}

function mountEffect(create: () => (() => void) | void, deps: Array<mixed> | void | null): void {
  return mountEffectImpl(Flags.Passive | Flags.PassiveStatic, HookFlags.Passive, create, deps);
}

function updateEffect(create: () => (() => void) | void, deps: Array<mixed> | void | null): void {
  return updateEffectImpl(Flags.Passive, HookFlags.Passive, create, deps);
}
// 1881
function mountCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = mountWorkInProgressHook<[T, Array<any> | null]>();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
// 1888
function updateCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook<[T, Array<any> | null]>();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps: Array<any> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function mountMemo<T>(nextCreate: () => T, deps?: Array<any> | void | null): T {
  const hook = mountWorkInProgressHook<[T, Array<any> | null]>();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
// 1915
function updateMemo<T>(nextCreate: () => T, deps: Array<mixed> | void | null): T {
  const hook = updateWorkInProgressHook<[T, Array<any> | null]>();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    // Assume these are defined. If they're not, areHookInputsEqual will warn.
    if (nextDeps !== null) {
      const prevDeps: Array<mixed> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

// 2194
function dispatchReducerAction<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A) {
  const lane = requestUpdateLane(fiber);

  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (root !== null) {
      const eventTime = requestEventTime();
      scheduleUpdateOnFiber(root, fiber, lane, eventTime);
      entangleTransitionUpdate(root, queue, lane);
    }
  }
}

//2233
function dispatchSetState<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A) {
  const lane = requestUpdateLane(fiber);

  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    const alternate = fiber.alternate;
    if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher;

        try {
          const currentState: S = queue.lastRenderedState!;
          const eagerState = lastRenderedReducer(currentState, action);
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.hasEagerState = true;
          update.eagerState = eagerState;
          if (Object.is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            // TODO: Do we still need to entangle transitions in this case?
            enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update, lane);
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {
        }
      }
    }

    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (root !== null) {
      const eventTime = requestEventTime();
      scheduleUpdateOnFiber(root, fiber, lane, eventTime);
      entangleTransitionUpdate(root, queue, lane);
    }
  }
}

// 2320
function isRenderPhaseUpdate(fiber: Fiber) {
  const alternate = fiber.alternate;
  return (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  );
}

function enqueueRenderPhaseUpdate<S, A>(queue: UpdateQueue<S, A>, update: Update<S, A>) {
  // This is a render phase update. Stash it in a lazily-created map of
  // queue -> linked list of updates. After this render pass, we'll restart
  // and apply the stashed updates on top of the work-in-progress hook.
  didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
  const pending = queue.pending;
  if (pending === null) {
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
}

// 2347
// TODO: Move to ReactFiberConcurrentUpdates?
function entangleTransitionUpdate<S, A>(root: FiberRoot, queue: UpdateQueue<S, A>, lane: Lane) {
  if (isTransitionLane(lane)) {
    let queueLanes = queue.lanes;

    // If any entangled lanes are no longer pending on the root, then they
    // must have finished. We can remove them from the shared queue, which
    // represents a superset of the actually pending lanes. In some cases we
    // may entangle more than we need to, but that's OK. In fact it's worse if
    // we *don't* entangle when we should.
    queueLanes = intersectLanes(queueLanes, root.pendingLanes);

    // Entangle the new transition lane with the other transition lanes.
    const newQueueLanes = mergeLanes(queueLanes, lane);
    queue.lanes = newQueueLanes;
    // Even if queue.lanes already include lane, we don't know for certain if
    // the lane finished since the last time we entangled it. So we need to
    // entangle it again, just to be sure.
    markRootEntangled(root, newQueueLanes);
  }
}

// 2388
function getCacheSignal(): AbortSignal {
  if (!enableCache) {
    throw new Error('Not implemented.');
  }
  const cache: Cache = readContext(CacheContext)!;
  return cache.controller.signal;
}

function getCacheForType<T extends any>(resourceType: () => T): T {
  if (!enableCache) {
    throw new Error('Not implemented.');
  }
  const cache: Cache = readContext(CacheContext)!;
  let cacheForType: T | void = cache.data.get(resourceType);
  if (cacheForType === undefined) {
    cacheForType = resourceType();
    cache.data.set(resourceType, cacheForType);
  }
  return cacheForType;
}

// 2409
// read: 部分 hook 的逻辑，先不看
export const ContextOnlyDispatcher: Dispatcher = {
  readContext,
  useCallback: throwInvalidHookError as any,
  useContext: throwInvalidHookError as any,
  useEffect: throwInvalidHookError as any,
  // useImperativeHandle: throwInvalidHookError,
  // useInsertionEffect: throwInvalidHookError,
  // useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError as any,
  // useReducer: throwInvalidHookError,
  // useRef: throwInvalidHookError as any,
  useState: throwInvalidHookError as any,
  // useDebugValue: throwInvalidHookError,
  // useDeferredValue: throwInvalidHookError,
  // useTransition: throwInvalidHookError,
  // useMutableSource: throwInvalidHookError,
  // useSyncExternalStore: throwInvalidHookError,
  // useId: throwInvalidHookError,

  unstable_isNewReconciler: enableNewReconciler,
};
if (enableCache) {
  ContextOnlyDispatcher.getCacheSignal = getCacheSignal;
  ContextOnlyDispatcher.getCacheForType = getCacheForType;
  // ContextOnlyDispatcher.useCacheRefresh = throwInvalidHookError;
}

const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  useCallback: mountCallback,
  useContext: readContext as Dispatcher['useContext'],
  useEffect: mountEffect,
  // useImperativeHandle: mountImperativeHandle,
  // useLayoutEffect: mountLayoutEffect,
  // useInsertionEffect: mountInsertionEffect,
  useMemo: mountMemo,
  // useReducer: mountReducer,
  // useRef: mountRef,
  useState: mountState,
  // useDebugValue: mountDebugValue,
  // useDeferredValue: mountDeferredValue,
  // useTransition: mountTransition,
  // useMutableSource: mountMutableSource,
  // useSyncExternalStore: mountSyncExternalStore,
  // useId: mountId,

  unstable_isNewReconciler: enableNewReconciler,
};
if (enableCache) {
  HooksDispatcherOnMount.getCacheSignal = getCacheSignal;
  HooksDispatcherOnMount.getCacheForType = getCacheForType;
  // HooksDispatcherOnMount.useCacheRefresh = mountRefresh;
}

const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext as Dispatcher['useContext'],
  useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useInsertionEffect: updateInsertionEffect,
  // useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  // useReducer: updateReducer,
  // useRef: updateRef,
  useState: updateState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: updateDeferredValue,
  // useTransition: updateTransition,
  // useMutableSource: updateMutableSource,
  // useSyncExternalStore: updateSyncExternalStore,
  // useId: updateId,

  unstable_isNewReconciler: enableNewReconciler,
};
if (enableCache) {
  HooksDispatcherOnUpdate.getCacheSignal = getCacheSignal;
  HooksDispatcherOnUpdate.getCacheForType = getCacheForType;
  // (HooksDispatcherOnUpdate).useCacheRefresh = updateRefresh;
}

const HooksDispatcherOnRerender: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext as Dispatcher['useContext'],
  useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useInsertionEffect: updateInsertionEffect,
  // useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  // useReducer: rerenderReducer,
  // useRef: updateRef,
  useState: rerenderState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: rerenderDeferredValue,
  // useTransition: rerenderTransition,
  // useMutableSource: updateMutableSource,
  // useSyncExternalStore: updateSyncExternalStore,
  // useId: updateId,

  unstable_isNewReconciler: enableNewReconciler,
};
if (enableCache) {
  HooksDispatcherOnRerender.getCacheSignal = getCacheSignal;
  HooksDispatcherOnRerender.getCacheForType = getCacheForType;
  // (HooksDispatcherOnRerender).useCacheRefresh = updateRefresh;
}
