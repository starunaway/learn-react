import ReactCurrentDispatcher from '../react/ReactCurrentDispatcher';
import { enableCache, enableNewReconciler } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { CacheContext } from './ReactFiberCacheComponent';
import type { Cache } from './ReactFiberCacheComponent';

import { Lane, Lanes, NoLanes } from './ReactFiberLane';
import { readContext } from './ReactFiberNewContext';
import type { HookFlags } from './ReactHookEffectTags';
import type { Fiber, Dispatcher } from './ReactInternalTypes';

export type Update<S, A> = {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A>;
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
  next: Effect;
};

type StoreInstance<T> = {
  value: T;
  getSnapshot: () => T;
};

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
};

export type Hook = {
  memoizedState: any;
  baseState: any;
  baseQueue: Update<any, any> | null;
  queue: any;
  next: Hook | null;
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
  useRef: throwInvalidHookError as any,
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
