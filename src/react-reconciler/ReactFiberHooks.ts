import ReactCurrentDispatcher from '@/react/ReactCurrentDispatcher';
import { Lane, Lanes, NoLanes, removeLanes } from './ReactFiberLane';
import { readContext } from './ReactFiberNewContext';
import { HookFlags } from './ReactHookEffectTags';
import { Dispatcher, Fiber } from './ReactInternalTypes';
import {
  LayoutStatic as LayoutStaticEffect,
  // MountLayoutDev as MountLayoutDevEffect,
  // MountPassiveDev as MountPassiveDevEffect,
  Passive as PassiveEffect,
  PassiveStatic as PassiveStaticEffect,
  StaticMask as StaticMaskEffect,
  Update as UpdateEffect,
  StoreConsistency,
} from './ReactFiberFlags';

let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber: Fiber | null = null;
let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;
let didScheduleRenderPhaseUpdate: boolean = false;

export type Hook = {
  memoizedState: any;
  baseState: any;
  baseQueue: Update<any, any> | null;
  queue: any;
  next: Hook | null;
};

export type Effect = {
  tag: HookFlags;
  create: () => (() => void) | void;
  destroy: (() => void) | void;
  deps: Array<any> | null;
  next: Effect;
};
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
  dispatch: (a: A) => any | null;
  lastRenderedReducer: (s: S, a: A) => S | null;
  lastRenderedState: S | null;
};

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

let localIdCounter: number = 0;
const RE_RENDER_LIMIT = 25;

export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
};

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

const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  // useCallback: mountCallback,
  useContext: readContext,
  // useEffect: mountEffect,
  // useImperativeHandle: mountImperativeHandle,
  // useLayoutEffect: mountLayoutEffect,
  // useInsertionEffect: mountInsertionEffect,
  // useMemo: mountMemo,
  // useReducer: mountReducer,
  // useRef: mountRef,
  // useState: mountState,
  // useDebugValue: mountDebugValue,
  // useDeferredValue: mountDeferredValue,
  // useTransition: mountTransition,
  // useMutableSource: mountMutableSource,
  // useSyncExternalStore: mountSyncExternalStore,
  // useId: mountId,

  // unstable_isNewReconciler: enableNewReconciler,
};
// if (enableCache) {
//   (HooksDispatcherOnMount: Dispatcher).getCacheSignal = getCacheSignal;
//   (HooksDispatcherOnMount: Dispatcher).getCacheForType = getCacheForType;
//   (HooksDispatcherOnMount: Dispatcher).useCacheRefresh = mountRefresh;
// }

const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  // useCallback: updateCallback,
  useContext: readContext,
  // useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useInsertionEffect: updateInsertionEffect,
  // useLayoutEffect: updateLayoutEffect,
  // useMemo: updateMemo,
  // useReducer: updateReducer,
  // useRef: updateRef,
  // useState: updateState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: updateDeferredValue,
  // useTransition: updateTransition,
  // useMutableSource: updateMutableSource,
  // useSyncExternalStore: updateSyncExternalStore,
  // useId: updateId,

  // unstable_isNewReconciler: enableNewReconciler,
};
// if (enableCache) {
//   (HooksDispatcherOnUpdate: Dispatcher).getCacheSignal = getCacheSignal;
//   (HooksDispatcherOnUpdate: Dispatcher).getCacheForType = getCacheForType;
//   (HooksDispatcherOnUpdate: Dispatcher).useCacheRefresh = updateRefresh;
// }

const HooksDispatcherOnRerender: Dispatcher = {
  readContext,

  // useCallback: updateCallback,
  useContext: readContext,
  // useEffect: updateEffect,
  // useImperativeHandle: updateImperativeHandle,
  // useInsertionEffect: updateInsertionEffect,
  // useLayoutEffect: updateLayoutEffect,
  // useMemo: updateMemo,
  // useReducer: rerenderReducer,
  // useRef: updateRef,
  // useState: rerenderState,
  // useDebugValue: updateDebugValue,
  // useDeferredValue: rerenderDeferredValue,
  // useTransition: rerenderTransition,
  // useMutableSource: updateMutableSource,
  // useSyncExternalStore: updateSyncExternalStore,
  // useId: updateId,

  // unstable_isNewReconciler: enableNewReconciler,
};
// if (enableCache) {
//   (HooksDispatcherOnRerender: Dispatcher).getCacheSignal = getCacheSignal;
//   (HooksDispatcherOnRerender: Dispatcher).getCacheForType = getCacheForType;
//   (HooksDispatcherOnRerender: Dispatcher).useCacheRefresh = updateRefresh;
// }

// Hooks are stored as a linked list on the fiber's memoizedState field. The
// current hook list is the list that belongs to the current fiber. The
// work-in-progress hook list is a new list that will be added to the
// work-in-progress fiber.
let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;

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

  // if (__DEV__) {
  //   hookTypesDev =
  //     current !== null
  //       ? ((current._debugHookTypes: any): Array<HookType>)
  //       : null;
  //   hookTypesUpdateIndexDev = -1;
  //   // Used for hot reloading:
  //   ignorePreviousDependencies =
  //     current !== null && current.type !== workInProgress.type;
  // }

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
  // if (__DEV__) {
  //   if (current !== null && current.memoizedState !== null) {
  //     ReactCurrentDispatcher.current = HooksDispatcherOnUpdateInDEV;
  //   } else if (hookTypesDev !== null) {
  //     // This dispatcher handles an edge case where a component is updating,
  //     // but no stateful hooks have been used.
  //     // We want to match the production code behavior (which will use HooksDispatcherOnMount),
  //     // but with the extra DEV validation to ensure hooks ordering hasn't changed.
  //     // This dispatcher does that.
  //     ReactCurrentDispatcher.current = HooksDispatcherOnMountWithHookTypesInDEV;
  //   } else {
  //     ReactCurrentDispatcher.current = HooksDispatcherOnMountInDEV;
  //   }
  // } else {
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;
  // }

  let children = Component(props, secondArg);

  // Check if there was a render phase update
  if (didScheduleRenderPhaseUpdateDuringThisPass) {
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
      // if (__DEV__) {
      //   // Even when hot reloading, allow dependencies to stabilize
      //   // after first render to prevent infinite render phase updates.
      //   ignorePreviousDependencies = false;
      // }

      // Start over from the beginning of the list
      currentHook = null;
      workInProgressHook = null;

      workInProgress.updateQueue = null;

      // if (__DEV__) {
      //   // Also validate hook order for cascading updates.
      //   hookTypesUpdateIndexDev = -1;
      // }

      ReactCurrentDispatcher.current =
        /**
       * 
       *  __DEV__
        ? HooksDispatcherOnRerenderInDEV
        : 
       */
        HooksDispatcherOnRerender;

      children = Component(props, secondArg);
    } while (didScheduleRenderPhaseUpdateDuringThisPass);
  }

  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrance.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  // if (__DEV__) {
  //   workInProgress._debugHookTypes = hookTypesDev;
  // }

  // This check uses currentHook so that it works the same in DEV and prod bundles.
  // hookTypesDev could catch more cases (e.g. context) but only in DEV bundles.
  const didRenderTooFewHooks = currentHook !== null && currentHook.next !== null;

  renderLanes = NoLanes;
  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  // if (__DEV__) {
  //   currentHookNameInDev = null;
  //   hookTypesDev = null;
  //   hookTypesUpdateIndexDev = -1;

  //   // Confirm that a static flag was not added or removed since the last
  //   // render. If this fires, it suggests that we incorrectly reset the static
  //   // flags in some other part of the codebase. This has happened before, for
  //   // example, in the SuspenseList implementation.
  //   if (
  //     current !== null &&
  //     (current.flags & StaticMaskEffect) !==
  //       (workInProgress.flags & StaticMaskEffect) &&
  //     // Disable this warning in legacy mode, because legacy Suspense is weird
  //     // and creates false positives. To make this work in legacy mode, we'd
  //     // need to mark fibers that commit in an incomplete state, somehow. For
  //     // now I'll disable the warning that most of the bugs that would trigger
  //     // it are either exclusive to concurrent mode or exist in both.
  //     (current.mode & ConcurrentMode) !== NoMode
  //   ) {
  //     console.error(
  //       'Internal React error: Expected static flag was missing. Please ' +
  //         'notify the React team.',
  //     );
  //   }
  // }

  didScheduleRenderPhaseUpdate = false;
  // This is reset by checkDidRenderIdHook
  // localIdCounter = 0;

  if (didRenderTooFewHooks) {
    throw new Error(
      'Rendered fewer hooks than expected. This may be caused by an accidental ' +
        'early return statement.'
    );
  }

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
  //       if (
  //         currentDependencies !== null &&
  //         checkIfContextChanged(currentDependencies)
  //       ) {
  //         markWorkInProgressReceivedUpdate();
  //       }
  //     }
  //   }
  // }
  return children;
}

export const ContextOnlyDispatcher: Dispatcher = {
  readContext,

  useCallback: throwInvalidHookError,
  useContext: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  useImperativeHandle: throwInvalidHookError,
  useInsertionEffect: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useState: throwInvalidHookError,
  useDebugValue: throwInvalidHookError,
  useDeferredValue: throwInvalidHookError,
  useTransition: throwInvalidHookError,
  useMutableSource: throwInvalidHookError,
  useSyncExternalStore: throwInvalidHookError,
  useId: throwInvalidHookError,

  // unstable_isNewReconciler: false,
};
// if (enableCache) {
//   (ContextOnlyDispatcher: Dispatcher).getCacheSignal = getCacheSignal;
//   (ContextOnlyDispatcher: Dispatcher).getCacheForType = getCacheForType;
//   (ContextOnlyDispatcher: Dispatcher).useCacheRefresh = throwInvalidHookError;
// }

export function checkDidRenderIdHook() {
  // This should be called immediately after every renderWithHooks call.
  // Conceptually, it's part of the return value of renderWithHooks; it's only a
  // separate function to avoid using an array tuple.
  const didRenderIdHook = localIdCounter !== 0;
  localIdCounter = 0;
  return didRenderIdHook;
}

export function bailoutHooks(current: Fiber, workInProgress: Fiber, lanes: Lanes) {
  workInProgress.updateQueue = current.updateQueue;
  // TODO: Don't need to reset the flags here, because they're reset in the
  // complete phase (bubbleProperties).
  // if (
  //   __DEV__ &&
  //   enableStrictEffects &&
  //   (workInProgress.mode & StrictEffectsMode) !== NoMode
  // ) {
  //   workInProgress.flags &= ~(
  //     MountPassiveDevEffect |
  //     MountLayoutDevEffect |
  //     PassiveEffect |
  //     UpdateEffect
  //   );
  // } else {
  workInProgress.flags &= ~(PassiveEffect | UpdateEffect);
  // }
  current.lanes = removeLanes(current.lanes, lanes);
}
