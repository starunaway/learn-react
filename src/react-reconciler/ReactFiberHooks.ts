import { enableCache, enableNewReconciler } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { CacheContext } from './ReactFiberCacheComponent';
import type { Cache } from './ReactFiberCacheComponent';

import { Lane, Lanes } from './ReactFiberLane';
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
