import { NoFlags, Passive, PassiveMask } from './ReactFiberFlags';
import { Lanes } from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import {
  resetCurrentFiber as resetCurrentDebugFiberInDEV,
  setCurrentFiber as setCurrentDebugFiberInDEV,
  getCurrentFiber as getCurrentDebugFiberInDEV,
} from './ReactCurrentFiber';
import {
  CacheComponent,
  ForwardRef,
  FunctionComponent,
  HostRoot,
  LegacyHiddenComponent,
  OffscreenComponent,
  SimpleMemoComponent,
} from './ReactWorkTags';
import { captureCommitPhaseError } from './ReactFiberWorkLoop';
let nextEffect: Fiber | null = null;

export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  nextEffect = finishedWork;
  commitPassiveMountEffects_begin(finishedWork, root, committedLanes, committedTransitions);
}

function commitPassiveMountEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;
    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitPassiveMountEffects_complete(subtreeRoot, root, committedLanes, committedTransitions);
    }
  }
}

function commitPassiveMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    if ((fiber.flags & Passive) !== NoFlags) {
      setCurrentDebugFiberInDEV(fiber);
      try {
        commitPassiveMountOnFiber(root, fiber, committedLanes, committedTransitions);
      } catch (error) {
        captureCommitPhaseError(fiber, fiber.return, error);
      }
      resetCurrentDebugFiberInDEV();
    }

    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitPassiveMountOnFiber(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      // if (
      //   enableProfilerTimer &&
      //   enableProfilerCommitHooks &&
      //   finishedWork.mode & ProfileMode
      // ) {
      //   startPassiveEffectTimer();
      //   try {
      //     commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
      //   } finally {
      //     recordPassiveEffectDuration(finishedWork);
      //   }
      // } else {
      //   commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
      // }
      break;
    }
    case HostRoot: {
      // if (enableCache) {
      //   let previousCache: Cache | null = null;
      //   if (finishedWork.alternate !== null) {
      //     previousCache = finishedWork.alternate.memoizedState.cache;
      //   }
      //   const nextCache = finishedWork.memoizedState.cache;
      //   // Retain/release the root cache.
      //   // Note that on initial mount, previousCache and nextCache will be the same
      //   // and this retain won't occur. To counter this, we instead retain the HostRoot's
      //   // initial cache when creating the root itself (see createFiberRoot() in
      //   // ReactFiberRoot.js). Subsequent updates that change the cache are reflected
      //   // here, such that previous/next caches are retained correctly.
      //   if (nextCache !== previousCache) {
      //     retainCache(nextCache);
      //     if (previousCache != null) {
      //       releaseCache(previousCache);
      //     }
      //   }
      // }

      // if (enableTransitionTracing) {
      //   // Get the transitions that were initiatized during the render
      //   // and add a start transition callback for each of them
      //   const state = finishedWork.memoizedState;
      //   // TODO Since it's a mutable field, this should live on the FiberRoot
      //   if (state.transitions === null) {
      //     state.transitions = new Set([]);
      //   }
      //   const pendingTransitions = state.transitions;
      //   const pendingSuspenseBoundaries = state.pendingSuspenseBoundaries;

      //   // Initial render
      //   if (committedTransitions !== null) {
      //     committedTransitions.forEach(transition => {
      //       addTransitionStartCallbackToPendingTransition({
      //         transitionName: transition.name,
      //         startTime: transition.startTime,
      //       });
      //       pendingTransitions.add(transition);
      //     });

      //     if (
      //       pendingSuspenseBoundaries === null ||
      //       pendingSuspenseBoundaries.size === 0
      //     ) {
      //       pendingTransitions.forEach(transition => {
      //         addTransitionCompleteCallbackToPendingTransition({
      //           transitionName: transition.name,
      //           startTime: transition.startTime,
      //         });
      //       });
      //     }

      //     clearTransitionsForLanes(finishedRoot, committedLanes);
      //   }

      //   // If there are no more pending suspense boundaries we
      //   // clear the transitions because they are all complete.
      //   if (
      //     pendingSuspenseBoundaries === null ||
      //     pendingSuspenseBoundaries.size === 0
      //   ) {
      //     state.transitions = null;
      //   }
      // }
      break;
    }
    case LegacyHiddenComponent:
    case OffscreenComponent: {
      // if (enableCache) {
      //   let previousCache: Cache | null = null;
      //   if (
      //     finishedWork.alternate !== null &&
      //     finishedWork.alternate.memoizedState !== null &&
      //     finishedWork.alternate.memoizedState.cachePool !== null
      //   ) {
      //     previousCache = finishedWork.alternate.memoizedState.cachePool.pool;
      //   }
      //   let nextCache: Cache | null = null;
      //   if (
      //     finishedWork.memoizedState !== null &&
      //     finishedWork.memoizedState.cachePool !== null
      //   ) {
      //     nextCache = finishedWork.memoizedState.cachePool.pool;
      //   }
      //   // Retain/release the cache used for pending (suspended) nodes.
      //   // Note that this is only reached in the non-suspended/visible case:
      //   // when the content is suspended/hidden, the retain/release occurs
      //   // via the parent Suspense component (see case above).
      //   if (nextCache !== previousCache) {
      //     if (nextCache != null) {
      //       retainCache(nextCache);
      //     }
      //     if (previousCache != null) {
      //       releaseCache(previousCache);
      //     }
      //   }
      // }

      // if (enableTransitionTracing) {
      //   const isFallback = finishedWork.memoizedState;
      //   const queue = (finishedWork.updateQueue: any);
      //   const rootMemoizedState = finishedRoot.current.memoizedState;

      //   if (queue !== null) {
      //     // We have one instance of the pendingSuspenseBoundaries map.
      //     // We only need one because we update it during the commit phase.
      //     // We instantiate a new Map if we haven't already
      //     if (rootMemoizedState.pendingSuspenseBoundaries === null) {
      //       rootMemoizedState.pendingSuspenseBoundaries = new Map();
      //     }

      //     if (isFallback) {
      //       const transitions = queue.transitions;
      //       let prevTransitions = finishedWork.memoizedState.transitions;
      //       // Add all the transitions saved in the update queue during
      //       // the render phase (ie the transitions associated with this boundary)
      //       // into the transitions set.
      //       if (transitions !== null) {
      //         if (prevTransitions === null) {
      //           // We only have one instance of the transitions set
      //           // because we update it only during the commit phase. We
      //           // will create the set on a as needed basis in the commit phase
      //           finishedWork.memoizedState.transitions = prevTransitions = new Set();
      //         }

      //         transitions.forEach(transition => {
      //           prevTransitions.add(transition);
      //         });
      //       }
      //     }
      //   }

      //   commitTransitionProgress(finishedRoot, finishedWork);

      //   finishedWork.updateQueue = null;
      // }

      break;
    }
    case CacheComponent: {
      //   if (enableCache) {
      //     let previousCache: Cache | null = null;
      //     if (finishedWork.alternate !== null) {
      //       previousCache = finishedWork.alternate.memoizedState.cache;
      //     }
      //     const nextCache = finishedWork.memoizedState.cache;
      //     // Retain/release the cache. In theory the cache component
      //     // could be "borrowing" a cache instance owned by some parent,
      //     // in which case we could avoid retaining/releasing. But it
      //     // is non-trivial to determine when that is the case, so we
      //     // always retain/release.
      //     if (nextCache !== previousCache) {
      //       retainCache(nextCache);
      //       if (previousCache != null) {
      //         releaseCache(previousCache);
      //       }
      //     }
      //   }
      break;
    }
  }
}
