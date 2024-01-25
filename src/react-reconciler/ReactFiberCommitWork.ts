import {
  deletedTreeCleanUpLevel,
  enableCache,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableTransitionTracing,
} from '../shared/ReactFeatureFlags';
import { releaseCache, retainCache } from './ReactFiberCacheComponent';
import { Flags, PassiveMask } from './ReactFiberFlags';
import { Lanes } from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';
import type { Cache } from './ReactFiberCacheComponent';
import { captureCommitPhaseError } from './ReactFiberWorkLoop';
import { HookFlags } from './ReactHookEffectTags';
import { startPassiveEffectTimer } from './ReactProfilerTimer';

let didWarnAboutUndefinedSnapshotBeforeUpdate: Set<any> | null = null;

// Used during the commit phase to track the state of the Offscreen component stack.
// Allows us to avoid traversing the return path to find the nearest Offscreen ancestor.
// Only used when enableSuspenseLayoutEffectSemantics is enabled.
let offscreenSubtreeIsHidden: boolean = false;
let offscreenSubtreeWasHidden: boolean = false;

const PossiblyWeakSet = typeof WeakSet === 'function' ? WeakSet : Set;

let nextEffect: Fiber | null = null;

// Used for Profiling builds to track updaters.
let inProgressLanes: Lanes | null = null;
let inProgressRoot: FiberRoot | null = null;
// 650
export function commitPassiveEffectDurations(finishedRoot: FiberRoot, finishedWork: Fiber): void {
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    // Only Profilers with work in their subtree will have an Update effect scheduled.
    if ((finishedWork.flags & Flags.Update) !== Flags.NoFlags) {
      switch (finishedWork.tag) {
        case WorkTag.Profiler: {
          console.error('commitPassiveEffectDurations 走到了 WorkTag.Profiler，逻辑待实现');
          //   const { passiveEffectDuration } = finishedWork.stateNode;
          //   const { id, onPostCommit } = finishedWork.memoizedProps;

          //   // This value will still reflect the previous commit phase.
          //   // It does not get reset until the start of the next commit phase.
          //   const commitTime = getCommitTime();

          //   let phase = finishedWork.alternate === null ? 'mount' : 'update';
          //   if (enableProfilerNestedUpdatePhase) {
          //     if (isCurrentUpdateNested()) {
          //       phase = 'nested-update';
          //     }
          //   }

          //   if (typeof onPostCommit === 'function') {
          //     onPostCommit(id, phase, passiveEffectDuration, commitTime);
          //   }

          //   // Bubble times to the next nearest ancestor Profiler.
          //   // After we process that Profiler, we'll bubble further up.
          //   let parentFiber = finishedWork.return;
          //   outer: while (parentFiber !== null) {
          //     switch (parentFiber.tag) {
          //       case HostRoot:
          //         const root = parentFiber.stateNode;
          //         root.passiveEffectDuration += passiveEffectDuration;
          //         break outer;
          //       case Profiler:
          //         const parentStateNode = parentFiber.stateNode;
          //         parentStateNode.passiveEffectDuration += passiveEffectDuration;
          //         break outer;
          //     }
          //     parentFiber = parentFiber.return;
          //   }
          break;
        }
        default:
          break;
      }
    }
  }
}

// 2723
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
    if ((fiber.subtreeFlags & PassiveMask) !== Flags.NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitPassiveMountEffects_complete(subtreeRoot, root, committedLanes, committedTransitions);
    }
  }
}
// 2761
function commitPassiveMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    if ((fiber.flags & Flags.Passive) !== Flags.NoFlags) {
      try {
        commitPassiveMountOnFiber(root, fiber, committedLanes, committedTransitions);
      } catch (error) {
        captureCommitPhaseError(fiber, fiber.return, error as any);
      }
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
    case WorkTag.FunctionComponent:
    case WorkTag.ForwardRef:
    case WorkTag.SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & TypeOfMode.ProfileMode
      ) {
        startPassiveEffectTimer();
        try {
          commitHookEffectListMount(HookFlags.Passive | HookFlags.HasEffect, finishedWork);
        } finally {
          recordPassiveEffectDuration(finishedWork);
        }
      } else {
        commitHookEffectListMount(HookFlags.Passive | HookFlags.HasEffect, finishedWork);
      }
      break;
    }
    case WorkTag.HostRoot: {
      if (enableCache) {
        let previousCache: Cache | null = null;
        if (finishedWork.alternate !== null) {
          previousCache = finishedWork.alternate.memoizedState.cache;
        }
        const nextCache = finishedWork.memoizedState.cache;
        // Retain/release the root cache.
        // Note that on initial mount, previousCache and nextCache will be the same
        // and this retain won't occur. To counter this, we instead retain the HostRoot's
        // initial cache when creating the root itself (see createFiberRoot() in
        // ReactFiberRoot.js). Subsequent updates that change the cache are reflected
        // here, such that previous/next caches are retained correctly.
        if (nextCache !== previousCache) {
          retainCache(nextCache);
          if (previousCache != null) {
            releaseCache(previousCache);
          }
        }
      }

      break;
    }
    case WorkTag.LegacyHiddenComponent:
    case WorkTag.OffscreenComponent: {
      console.error('commit WorkTag.LegacyHiddenComponent,WorkTag.OffscreenComponent 需要实现');
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
    case WorkTag.CacheComponent: {
      if (enableCache) {
        let previousCache: Cache | null = null;
        if (finishedWork.alternate !== null) {
          previousCache = finishedWork.alternate.memoizedState.cache;
        }
        const nextCache = finishedWork.memoizedState.cache;
        // Retain/release the cache. In theory the cache component
        // could be "borrowing" a cache instance owned by some parent,
        // in which case we could avoid retaining/releasing. But it
        // is non-trivial to determine when that is the case, so we
        // always retain/release.
        if (nextCache !== previousCache) {
          retainCache(nextCache);
          if (previousCache != null) {
            releaseCache(previousCache);
          }
        }
      }
      break;
    }
  }
}

//  2991
export function commitPassiveUnmountEffects(firstChild: Fiber): void {
  nextEffect = firstChild;
  commitPassiveUnmountEffects_begin();
}

function commitPassiveUnmountEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const child = fiber.child;

    if ((nextEffect.flags & Flags.ChildDeletion) !== Flags.NoFlags) {
      const deletions = fiber.deletions;
      if (deletions !== null) {
        for (let i = 0; i < deletions.length; i++) {
          const fiberToDelete = deletions[i];
          nextEffect = fiberToDelete;
          commitPassiveUnmountEffectsInsideOfDeletedTree_begin(fiberToDelete, fiber);
        }

        if (deletedTreeCleanUpLevel >= 1) {
          // A fiber was deleted from this parent fiber, but it's still part of
          // the previous (alternate) parent fiber's list of children. Because
          // children are a linked list, an earlier sibling that's still alive
          // will be connected to the deleted fiber via its `alternate`:
          //
          //   live fiber
          //   --alternate--> previous live fiber
          //   --sibling--> deleted fiber
          //
          // We can't disconnect `alternate` on nodes that haven't been deleted
          // yet, but we can disconnect the `sibling` and `child` pointers.
          const previousFiber = fiber.alternate;
          if (previousFiber !== null) {
            let detachedChild = previousFiber.child;
            if (detachedChild !== null) {
              previousFiber.child = null;
              do {
                const detachedSibling: Fiber | null = detachedChild.sibling;
                detachedChild.sibling = null;
                detachedChild = detachedSibling;
              } while (detachedChild !== null);
            }
          }
        }

        nextEffect = fiber;
      }
    }

    if ((fiber.subtreeFlags & PassiveMask) !== Flags.NoFlags && child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffects_complete();
    }
  }
}
