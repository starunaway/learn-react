import {
  deletedTreeCleanUpLevel,
  enableCache,
  enableCreateEventHandleAPI,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableSchedulingProfiler,
  enableScopeAPI,
  enableSuspenseCallback,
  enableSuspenseLayoutEffectSemantics,
  enableTransitionTracing,
} from '../shared/ReactFeatureFlags';
import { releaseCache, retainCache } from './ReactFiberCacheComponent';
import {
  BeforeMutationMask,
  Flags,
  LayoutMask,
  MutationMask,
  PassiveMask,
} from './ReactFiberFlags';
import { Lanes } from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';
import type { Cache } from './ReactFiberCacheComponent';
import { captureCommitPhaseError } from './ReactFiberWorkLoop';
import { HookFlags } from './ReactHookEffectTags';
import {
  recordLayoutEffectDuration,
  recordPassiveEffectDuration,
  startLayoutEffectTimer,
  startPassiveEffectTimer,
} from './ReactProfilerTimer';
import { FunctionComponentUpdateQueue } from './ReactFiberHooks';
import {
  Container,
  Instance,
  TextInstance,
  UpdatePayload,
  appendChild,
  appendChildToContainer,
  clearContainer,
  commitHydratedContainer,
  commitMount,
  commitTextUpdate,
  commitUpdate,
  detachDeletedInstance,
  getPublicInstance,
  insertBefore,
  insertInContainerBefore,
  prepareForCommit,
  removeChild,
  removeChildFromContainer,
  resetTextContent,
  supportsHydration,
  supportsMutation,
} from '../react-dom/ReactFiberHostConfig';
import { UpdateQueue, commitUpdateQueue } from './ReactFiberClassUpdateQueue';
import { resolveDefaultProps } from './ReactFiberLazyComponent';
import { RootState } from './ReactFiberRoot';

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

// 268
function safelyDetachRef(current: Fiber, nearestMountedAncestor: Fiber | null) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      let retVal;
      try {
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          current.mode & TypeOfMode.ProfileMode
        ) {
          try {
            startLayoutEffectTimer();
            retVal = ref(null);
          } finally {
            recordLayoutEffectDuration(current);
          }
        } else {
          retVal = ref(null);
        }
      } catch (error) {
        captureCommitPhaseError(current, nearestMountedAncestor, error as any);
      }
    } else {
      ref.current = null;
    }
  }
}
function safelyCallDestroy(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destroy: () => void
) {
  try {
    destroy();
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error as any);
  }
}

let focusedInstanceHandle: null | Fiber = null;
let shouldFireAfterActiveInstanceBlur: boolean = false;

// 321
export function commitBeforeMutationEffects(root: FiberRoot, firstChild: Fiber) {
  focusedInstanceHandle = prepareForCommit(root.containerInfo);

  nextEffect = firstChild;
  commitBeforeMutationEffects_begin();

  // We no longer need to track the active instance fiber
  const shouldFire = shouldFireAfterActiveInstanceBlur;
  shouldFireAfterActiveInstanceBlur = false;
  focusedInstanceHandle = null;

  return shouldFire;
}

// 338
function commitBeforeMutationEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // This phase is only used for beforeActiveInstanceBlur.
    // Let's skip the whole loop if it's off.
    // if (enableCreateEventHandleAPI) {
    //   // TODO: Should wrap this in flags check, too, as optimization
    //   const deletions = fiber.deletions;
    //   if (deletions !== null) {
    //     for (let i = 0; i < deletions.length; i++) {
    //       const deletion = deletions[i];
    //       commitBeforeMutationEffectsDeletion(deletion);
    //     }
    //   }
    // }

    const child = fiber.child;
    if ((fiber.subtreeFlags & BeforeMutationMask) !== Flags.NoFlags && child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitBeforeMutationEffects_complete();
    }
  }
}

// 368
function commitBeforeMutationEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    // setCurrentDebugFiberInDEV(fiber);
    try {
      commitBeforeMutationEffectsOnFiber(fiber);
    } catch (error) {
      captureCommitPhaseError(fiber, fiber.return, error as any);
    }
    // resetCurrentDebugFiberInDEV();

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

// 390
function commitBeforeMutationEffectsOnFiber(finishedWork: Fiber) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  // if (enableCreateEventHandleAPI) {
  //   if (!shouldFireAfterActiveInstanceBlur && focusedInstanceHandle !== null) {
  //     // Check to see if the focused element was inside of a hidden (Suspense) subtree.
  //     // TODO: Move this out of the hot path using a dedicated effect tag.
  //     if (
  //       finishedWork.tag === SuspenseComponent &&
  //       isSuspenseBoundaryBeingHidden(current, finishedWork) &&
  //       doesFiberContain(finishedWork, focusedInstanceHandle)
  //     ) {
  //       shouldFireAfterActiveInstanceBlur = true;
  //       beforeActiveInstanceBlur(finishedWork);
  //     }
  //   }
  // }

  if ((flags & Flags.Snapshot) !== Flags.NoFlags) {
    // setCurrentDebugFiberInDEV(finishedWork);

    switch (finishedWork.tag) {
      case WorkTag.FunctionComponent:
      case WorkTag.ForwardRef:
      case WorkTag.SimpleMemoComponent: {
        break;
      }
      case WorkTag.ClassComponent: {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode;
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.

          const snapshot = instance.getSnapshotBeforeUpdate(
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : resolveDefaultProps(finishedWork.type, prevProps),
            prevState
          );

          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
        break;
      }
      case WorkTag.HostRoot: {
        if (supportsMutation) {
          const root = finishedWork.stateNode;
          clearContainer(root.containerInfo);
        }
        break;
      }
      case WorkTag.HostComponent:
      case WorkTag.HostText:
      case WorkTag.HostPortal:
      case WorkTag.IncompleteClassComponent:
        // Nothing to do for these component types
        break;
      default: {
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.'
        );
      }
    }

    // resetCurrentDebugFiberInDEV();
  }
}

// 512
function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  console.log('commitHookEffectListUnmount');
  const updateQueue: FunctionComponentUpdateQueue | null = finishedWork.updateQueue as any;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect!;
    do {
      if ((effect.tag & flags) === flags) {
        // Unmount
        console.log('这里应该就是业务侧的 useEffect 逻辑了， effect is:', effect);
        const destroy = effect.destroy;
        effect.destroy = undefined;
        if (destroy !== undefined) {
          // read: 这里是给 devtool 用的
          //   if (enableSchedulingProfiler) {
          //     if ((flags & HookFlags.Passive) !== HookFlags.NoFlags) {
          //       markComponentPassiveEffectUnmountStarted(finishedWork);
          //     } else if ((flags & HookFlags.Layout) !== HookFlags.NoFlags) {
          //       markComponentLayoutEffectUnmountStarted(finishedWork);
          //     }
          //   }

          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
          // read: 这里是给 devtool 用的
          //   if (enableSchedulingProfiler) {
          //     if ((flags & HookFlags.Passive) !== HookFlags.NoFlags) {
          //       markComponentPassiveEffectUnmountStopped();
          //     } else if ((flags & HookFlags.Layout) !== HookFlags.NoFlags) {
          //       markComponentLayoutEffectUnmountStopped();
          //     }
          //   }
        }
      }
      effect = effect.next!;
    } while (effect !== firstEffect);
  }
}

function commitHookEffectListMount(flags: HookFlags, finishedWork: Fiber) {
  console.log('commitHookEffectListMount');
  const updateQueue: FunctionComponentUpdateQueue | null = finishedWork.updateQueue as any;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect!;
    do {
      if ((effect.tag & flags) === flags) {
        // read : 这里是给 devtool 用的
        // if (enableSchedulingProfiler) {
        //   if ((flags & HookPassive) !== NoHookEffect) {
        //     markComponentPassiveEffectMountStarted(finishedWork);
        //   } else if ((flags & HookLayout) !== NoHookEffect) {
        //     markComponentLayoutEffectMountStarted(finishedWork);
        //   }
        // }

        // Mount
        // read: 这个create 应该就是 useEffect 的 第一个参数
        const create = effect.create;

        effect.destroy = create();

        // read : 这里是给 devtool 用的
        // if (enableSchedulingProfiler) {
        //   if ((flags & HookPassive) !== NoHookEffect) {
        //     markComponentPassiveEffectMountStopped();
        //   } else if ((flags & HookLayout) !== NoHookEffect) {
        //     markComponentLayoutEffectMountStopped();
        //   }
        // }
      }
      effect = effect.next!;
    } while (effect !== firstEffect);
  }
}

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

//702
function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  if ((finishedWork.flags & LayoutMask) !== Flags.NoFlags) {
    switch (finishedWork.tag) {
      case WorkTag.FunctionComponent:
      case WorkTag.ForwardRef:
      case WorkTag.SimpleMemoComponent: {
        if (!enableSuspenseLayoutEffectSemantics || !offscreenSubtreeWasHidden) {
          // At this point layout effects have already been destroyed (during mutation phase).
          // This is done to prevent sibling component effects from interfering with each other,
          // e.g. a destroy function in one component should never override a ref set
          // by a create function in another component during the same commit.
          if (
            enableProfilerTimer &&
            enableProfilerCommitHooks &&
            finishedWork.mode & TypeOfMode.ProfileMode
          ) {
            try {
              startLayoutEffectTimer();
              commitHookEffectListMount(HookFlags.Layout | HookFlags.HasEffect, finishedWork);
            } finally {
              recordLayoutEffectDuration(finishedWork);
            }
          } else {
            commitHookEffectListMount(HookFlags.Layout | HookFlags.HasEffect, finishedWork);
          }
        }
        break;
      }
      case WorkTag.ClassComponent: {
        console.error('commitLayoutEffectOnFiber  ClassComponent 未实现');
        // const instance = finishedWork.stateNode;
        // if (finishedWork.flags & Update) {
        //   if (!offscreenSubtreeWasHidden) {
        //     if (current === null) {
        //       // We could update instance props and state here,
        //       // but instead we rely on them being set during last render.
        //       // TODO: revisit this when we implement resuming.
        //       if (__DEV__) {
        //         if (
        //           finishedWork.type === finishedWork.elementType &&
        //           !didWarnAboutReassigningProps
        //         ) {
        //           if (instance.props !== finishedWork.memoizedProps) {
        //             console.error(
        //               'Expected %s props to match memoized props before ' +
        //                 'componentDidMount. ' +
        //                 'This might either be because of a bug in React, or because ' +
        //                 'a component reassigns its own `this.props`. ' +
        //                 'Please file an issue.',
        //               getComponentNameFromFiber(finishedWork) || 'instance',
        //             );
        //           }
        //           if (instance.state !== finishedWork.memoizedState) {
        //             console.error(
        //               'Expected %s state to match memoized state before ' +
        //                 'componentDidMount. ' +
        //                 'This might either be because of a bug in React, or because ' +
        //                 'a component reassigns its own `this.state`. ' +
        //                 'Please file an issue.',
        //               getComponentNameFromFiber(finishedWork) || 'instance',
        //             );
        //           }
        //         }
        //       }
        //       if (
        //         enableProfilerTimer &&
        //         enableProfilerCommitHooks &&
        //         finishedWork.mode & ProfileMode
        //       ) {
        //         try {
        //           startLayoutEffectTimer();
        //           instance.componentDidMount();
        //         } finally {
        //           recordLayoutEffectDuration(finishedWork);
        //         }
        //       } else {
        //         instance.componentDidMount();
        //       }
        //     } else {
        //       const prevProps =
        //         finishedWork.elementType === finishedWork.type
        //           ? current.memoizedProps
        //           : resolveDefaultProps(
        //               finishedWork.type,
        //               current.memoizedProps,
        //             );
        //       const prevState = current.memoizedState;
        //       // We could update instance props and state here,
        //       // but instead we rely on them being set during last render.
        //       // TODO: revisit this when we implement resuming.
        //       if (__DEV__) {
        //         if (
        //           finishedWork.type === finishedWork.elementType &&
        //           !didWarnAboutReassigningProps
        //         ) {
        //           if (instance.props !== finishedWork.memoizedProps) {
        //             console.error(
        //               'Expected %s props to match memoized props before ' +
        //                 'componentDidUpdate. ' +
        //                 'This might either be because of a bug in React, or because ' +
        //                 'a component reassigns its own `this.props`. ' +
        //                 'Please file an issue.',
        //               getComponentNameFromFiber(finishedWork) || 'instance',
        //             );
        //           }
        //           if (instance.state !== finishedWork.memoizedState) {
        //             console.error(
        //               'Expected %s state to match memoized state before ' +
        //                 'componentDidUpdate. ' +
        //                 'This might either be because of a bug in React, or because ' +
        //                 'a component reassigns its own `this.state`. ' +
        //                 'Please file an issue.',
        //               getComponentNameFromFiber(finishedWork) || 'instance',
        //             );
        //           }
        //         }
        //       }
        //       if (
        //         enableProfilerTimer &&
        //         enableProfilerCommitHooks &&
        //         finishedWork.mode & ProfileMode
        //       ) {
        //         try {
        //           startLayoutEffectTimer();
        //           instance.componentDidUpdate(
        //             prevProps,
        //             prevState,
        //             instance.__reactInternalSnapshotBeforeUpdate,
        //           );
        //         } finally {
        //           recordLayoutEffectDuration(finishedWork);
        //         }
        //       } else {
        //         instance.componentDidUpdate(
        //           prevProps,
        //           prevState,
        //           instance.__reactInternalSnapshotBeforeUpdate,
        //         );
        //       }
        //     }
        //   }
        // }

        // // TODO: I think this is now always non-null by the time it reaches the
        // // commit phase. Consider removing the type check.
        // const updateQueue: UpdateQueue<
        //   any,
        // > | null = (finishedWork.updateQueue);
        // if (updateQueue !== null) {

        //   // We could update instance props and state here,
        //   // but instead we rely on them being set during last render.
        //   // TODO: revisit this when we implement resuming.
        //   commitUpdateQueue(finishedWork, updateQueue, instance);
        // }
        break;
      }
      case WorkTag.HostRoot: {
        // TODO: I think this is now always non-null by the time it reaches the
        // commit phase. Consider removing the type check.
        const updateQueue: UpdateQueue<any> | null = finishedWork.updateQueue;
        if (updateQueue !== null) {
          let instance = null;
          if (finishedWork.child !== null) {
            switch (finishedWork.child.tag) {
              case WorkTag.HostComponent:
                instance = getPublicInstance(finishedWork.child.stateNode);
                break;
              case WorkTag.ClassComponent:
                instance = finishedWork.child.stateNode;
                break;
            }
          }
          commitUpdateQueue(finishedWork, updateQueue, instance);
        }
        break;
      }
      case WorkTag.HostComponent: {
        const instance: Instance = finishedWork.stateNode;

        // Renderers may schedule work to be done after host components are mounted
        // (eg DOM renderer may schedule auto-focus for inputs and form controls).
        // These effects should only be committed when components are first mounted,
        // aka when there is no current/alternate.
        if (current === null && finishedWork.flags & Flags.Update) {
          const type = finishedWork.type;
          const props = finishedWork.memoizedProps;
          commitMount(instance, type, props, finishedWork);
        }

        break;
      }
      case WorkTag.HostText: {
        // We have no life-cycles associated with text.
        break;
      }
      case WorkTag.HostPortal: {
        // We have no life-cycles associated with portals.
        break;
      }
      case WorkTag.Profiler: {
        console.error('commitLayoutEffectOnFiber  Profiler 未实现');

        // if (enableProfilerTimer) {
        //   const { onCommit, onRender } = finishedWork.memoizedProps;
        //   const { effectDuration } = finishedWork.stateNode;

        //   const commitTime = getCommitTime();

        //   let phase = current === null ? 'mount' : 'update';
        //   if (enableProfilerNestedUpdatePhase) {
        //     if (isCurrentUpdateNested()) {
        //       phase = 'nested-update';
        //     }
        //   }

        //   if (typeof onRender === 'function') {
        //     onRender(
        //       finishedWork.memoizedProps.id,
        //       phase,
        //       finishedWork.actualDuration,
        //       finishedWork.treeBaseDuration,
        //       finishedWork.actualStartTime,
        //       commitTime
        //     );
        //   }

        //   if (enableProfilerCommitHooks) {
        //     if (typeof onCommit === 'function') {
        //       onCommit(finishedWork.memoizedProps.id, phase, effectDuration, commitTime);
        //     }

        //     // Schedule a passive effect for this Profiler to call onPostCommit hooks.
        //     // This effect should be scheduled even if there is no onPostCommit callback for this Profiler,
        //     // because the effect is also where times bubble to parent Profilers.
        //     enqueuePendingPassiveProfilerEffect(finishedWork);

        //     // Propagate layout effect durations to the next nearest Profiler ancestor.
        //     // Do not reset these values until the next render so DevTools has a chance to read them first.
        //     let parentFiber = finishedWork.return;
        //     outer: while (parentFiber !== null) {
        //       switch (parentFiber.tag) {
        //         case HostRoot:
        //           const root = parentFiber.stateNode;
        //           root.effectDuration += effectDuration;
        //           break outer;
        //         case Profiler:
        //           const parentStateNode = parentFiber.stateNode;
        //           parentStateNode.effectDuration += effectDuration;
        //           break outer;
        //       }
        //       parentFiber = parentFiber.return;
        //     }
        //   }
        // }
        break;
      }
      case WorkTag.SuspenseComponent: {
        console.error('commitLayoutEffectOnFiber  SuspenseComponent 未实现');

        // commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
        break;
      }
      case WorkTag.SuspenseListComponent:
      case WorkTag.IncompleteClassComponent:
      case WorkTag.ScopeComponent:
      case WorkTag.OffscreenComponent:
      case WorkTag.LegacyHiddenComponent:
      case WorkTag.TracingMarkerComponent: {
        break;
      }

      default:
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.'
        );
    }
  }

  if (!enableSuspenseLayoutEffectSemantics || !offscreenSubtreeWasHidden) {
    if (enableScopeAPI) {
      // TODO: This is a temporary solution that allowed us to transition away
      // from React Flare on www.
      // read: 特性未开启
      // if (finishedWork.flags & Ref && finishedWork.tag !== ScopeComponent) {
      //   commitAttachRef(finishedWork);
      // }
    } else {
      if (finishedWork.flags & Flags.Ref) {
        commitAttachRef(finishedWork);
      }
    }
  }
}

// 1232
function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    switch (finishedWork.tag) {
      case WorkTag.HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }
    // Moved outside to ensure DCE works with this flag
    if (enableScopeAPI && finishedWork.tag === WorkTag.ScopeComponent) {
      instanceToUse = instance;
    }
    if (typeof ref === 'function') {
      // read: retVal 没用到？
      let retVal;
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & TypeOfMode.ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          retVal = ref(instanceToUse);
        } finally {
          recordLayoutEffectDuration(finishedWork);
        }
      } else {
        retVal = ref(instanceToUse);
      }
    } else {
      ref.current = instanceToUse;
    }
  }
}

// 1313
function detachFiberMutation(fiber: Fiber) {
  // Cut off the return pointer to disconnect it from the tree.
  // This enables us to detect and warn against state updates on an unmounted component.
  // It also prevents events from bubbling from within disconnected components.
  //
  // Ideally, we should also clear the child pointer of the parent alternate to let this
  // get GC:ed but we don't know which for sure which parent is the current
  // one so we'll settle for GC:ing the subtree of this child.
  // This child itself will be GC:ed when the parent updates the next time.
  //
  // Note that we can't clear child or sibling pointers yet.
  // They're needed for passive effects and for findDOMNode.
  // We defer those fields, and all other cleanup, to the passive phase (see detachFiberAfterEffects).
  //
  // Don't reset the alternate yet, either. We need that so we can detach the
  // alternate's fields in the passive phase. Clearing the return pointer is
  // sufficient for findDOMNode semantics.
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.return = null;
  }
  fiber.return = null;
}

// 1337
function detachFiberAfterEffects(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    fiber.alternate = null;
    detachFiberAfterEffects(alternate);
  }

  // Note: Defensively using negation instead of < in case
  // `deletedTreeCleanUpLevel` is undefined.
  if (!(deletedTreeCleanUpLevel >= 2)) {
    // This is the default branch (level 0).
    fiber.child = null;
    fiber.deletions = null;
    fiber.dependencies = null;
    fiber.memoizedProps = null;
    fiber.memoizedState = null;
    fiber.pendingProps = null;
    fiber.sibling = null;
    fiber.stateNode = null;
    fiber.updateQueue = null;
  } else {
    // Clear cyclical Fiber fields. This level alone is designed to roughly
    // approximate the planned Fiber refactor. In that world, `setState` will be
    // bound to a special "instance" object instead of a Fiber. The Instance
    // object will not have any of these fields. It will only be connected to
    // the fiber tree via a single link at the root. So if this level alone is
    // sufficient to fix memory issues, that bodes well for our plans.
    fiber.child = null;
    fiber.deletions = null;
    fiber.sibling = null;

    // The `stateNode` is cyclical because on host nodes it points to the host
    // tree, which has its own pointers to children, parents, and siblings.
    // The other host nodes also point back to fibers, so we should detach that
    // one, too.
    if (fiber.tag === WorkTag.HostComponent) {
      const hostInstance: Instance = fiber.stateNode;
      if (hostInstance !== null) {
        detachDeletedInstance(hostInstance);
      }
    }
    fiber.stateNode = null;

    // I'm intentionally not clearing the `return` field in this level. We
    // already disconnect the `return` pointer at the root of the deleted
    // subtree (in `detachFiberMutation`). Besides, `return` by itself is not
    // cyclical — it's only cyclical when combined with `child`, `sibling`, and
    // `alternate`. But we'll clear it in the next level anyway, just in case.

    if (deletedTreeCleanUpLevel >= 3) {
      // Theoretically, nothing in here should be necessary, because we already
      // disconnected the fiber from the tree. So even if something leaks this
      // particular fiber, it won't leak anything else
      //
      // The purpose of this branch is to be super aggressive so we can measure
      // if there's any difference in memory impact. If there is, that could
      // indicate a React leak we don't know about.
      fiber.return = null;
      fiber.dependencies = null;
      fiber.memoizedProps = null;
      fiber.memoizedState = null;
      fiber.pendingProps = null;
      fiber.stateNode = null;
      // TODO: Move to `commitPassiveUnmountInsideDeletedTreeOnFiber` instead.
      fiber.updateQueue = null;
    }
  }
}
// 1429
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }

  throw new Error(
    'Expected to find a host parent. This error is likely caused by a bug ' +
      'in React. Please file an issue.'
  );
}

function isHostParent(fiber: Fiber): boolean {
  return (
    fiber.tag === WorkTag.HostComponent ||
    fiber.tag === WorkTag.HostRoot ||
    fiber.tag === WorkTag.HostPortal
  );
}

function getHostSibling(fiber: Fiber): Instance | null {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node: Fiber = fiber;
  siblings: while (true) {
    // If we didn't find anything, let's try the next sibling.
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (
      node.tag !== WorkTag.HostComponent &&
      node.tag !== WorkTag.HostText &&
      node.tag !== WorkTag.DehydratedFragment
    ) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.flags & Flags.Placement) {
        // If we don't have a child, try the siblings instead.
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      if (node.child === null || node.tag === WorkTag.HostPortal) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.flags & Flags.Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

// 1498
function commitPlacement(finishedWork: Fiber): void {
  console.log('commitPlacement 替换逻辑 ？：', finishedWork);
  if (!supportsMutation) {
    return;
  }

  // Recursively insert all host nodes into the parent.
  const parentFiber = getHostParentFiber(finishedWork);

  // Note: these two variables *must* always be updated together.
  switch (parentFiber.tag) {
    case WorkTag.HostComponent: {
      const parent: Instance = parentFiber.stateNode;
      if (parentFiber.flags & Flags.ContentReset) {
        // Reset the text content of the parent before doing any insertions
        resetTextContent(parent);
        // Clear ContentReset from the effect tag
        parentFiber.flags &= ~Flags.ContentReset;
      }

      const before = getHostSibling(finishedWork);
      // We only have the top Fiber that was inserted but we need to recurse down its
      // children to find all the terminal nodes.
      insertOrAppendPlacementNode(finishedWork, before!, parent);
      break;
    }
    case WorkTag.HostRoot:
    case WorkTag.HostPortal: {
      const parent: Container = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before!, parent);
      break;
    }
    // eslint-disable-next-line-no-fallthrough
    default:
      throw new Error(
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.'
      );
  }
}

function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before?: Instance,
  parent?: Container
): void {
  const { tag } = node;
  const isHost = tag === WorkTag.HostComponent || tag === WorkTag.HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertInContainerBefore(parent!, stateNode, before);
    } else {
      appendChildToContainer(parent!, stateNode);
    }
  } else if (tag === WorkTag.HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function insertOrAppendPlacementNode(node: Fiber, before?: Instance, parent?: Instance): void {
  const { tag } = node;
  const isHost = tag === WorkTag.HostComponent || tag === WorkTag.HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent!, stateNode, before);
    } else {
      appendChild(parent!, stateNode);
    }
  } else if (tag === WorkTag.HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

// 1600
// These are tracked on the stack as we recursively traverse a
// deleted subtree.
// TODO: Update these during the whole mutation phase, not just during
// a deletion.
let hostParent: Instance | Container | null = null;
let hostParentIsContainer: boolean = false;

function commitDeletionEffects(root: FiberRoot, returnFiber: Fiber, deletedFiber: Fiber) {
  if (supportsMutation) {
    // We only have the top Fiber that was deleted but we need to recurse down its
    // children to find all the terminal nodes.

    // Recursively delete all host nodes from the parent, detach refs, clean
    // up mounted layout effects, and call componentWillUnmount.

    // We only need to remove the topmost host child in each branch. But then we
    // still need to keep traversing to unmount effects, refs, and cWU. TODO: We
    // could split this into two separate traversals functions, where the second
    // one doesn't include any removeChild logic. This is maybe the same
    // function as "disappearLayoutEffects" (or whatever that turns into after
    // the layout phase is refactored to use recursion).

    // Before starting, find the nearest host parent on the stack so we know
    // which instance/container to remove the children from.
    // TODO: Instead of searching up the fiber return path on every deletion, we
    // can track the nearest host component on the JS stack as we traverse the
    // tree during the commit phase. This would make insertions faster, too.
    let parent: Fiber | null = returnFiber;
    findParent: while (parent !== null) {
      switch (parent.tag) {
        case WorkTag.HostComponent: {
          hostParent = parent.stateNode;
          hostParentIsContainer = false;
          break findParent;
        }
        case WorkTag.HostRoot: {
          hostParent = parent.stateNode.containerInfo;
          hostParentIsContainer = true;
          break findParent;
        }
        case WorkTag.HostPortal: {
          hostParent = parent.stateNode.containerInfo;
          hostParentIsContainer = true;
          break findParent;
        }
      }
      parent = parent.return;
    }
    if (hostParent === null) {
      throw new Error(
        'Expected to find a host parent. This error is likely caused by ' +
          'a bug in React. Please file an issue.'
      );
    }
    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
    hostParent = null;
    hostParentIsContainer = false;
  } else {
    // Detach refs and call componentWillUnmount() on the whole subtree.
    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
  }

  detachFiberMutation(deletedFiber);
}

function recursivelyTraverseDeletionEffects(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  parent: Fiber
) {
  // TODO: Use a static flag to skip trees that don't have unmount effects
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
    child = child.sibling;
  }
}
// 1683
function commitDeletionEffectsOnFiber(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  deletedFiber: Fiber
) {
  // read: devtool 的逻辑
  // onCommitUnmount(deletedFiber);

  // The cases in this outer switch modify the stack before they traverse
  // into their subtree. There are simpler cases in the inner switch
  // that don't modify the stack.
  switch (deletedFiber.tag) {
    case WorkTag.HostComponent: {
      if (!offscreenSubtreeWasHidden) {
        safelyDetachRef(deletedFiber, nearestMountedAncestor);
      }
      return;
      // Intentional fallthrough to next branch
    }
    // eslint-disable-next-line-no-fallthrough
    case WorkTag.HostText: {
      // We only need to remove the nearest host child. Set the host parent
      // to `null` on the stack to indicate that nested children don't
      // need to be removed.
      if (supportsMutation) {
        const prevHostParent = hostParent;
        const prevHostParentIsContainer = hostParentIsContainer;
        hostParent = null;
        recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;

        if (hostParent !== null) {
          // Now that all the child effects have unmounted, we can remove the
          // node from the tree.
          if (hostParentIsContainer) {
            removeChildFromContainer(
              hostParent as Container,
              deletedFiber.stateNode as Instance | TextInstance
            );
          } else {
            removeChild(hostParent as Instance, deletedFiber.stateNode as Instance | TextInstance);
          }
        }
      } else {
        recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      }
      return;
    }
    case WorkTag.DehydratedFragment: {
      console.error('commitDeletionEffectsOnFiber DehydratedFragment 未实现');
      // if (enableSuspenseCallback) {
      //   const hydrationCallbacks = finishedRoot.hydrationCallbacks;
      //   if (hydrationCallbacks !== null) {
      //     const onDeleted = hydrationCallbacks.onDeleted;
      //     if (onDeleted) {
      //       onDeleted((deletedFiber.stateNode: SuspenseInstance));
      //     }
      //   }
      // }

      // // Dehydrated fragments don't have any children

      // // Delete the dehydrated suspense boundary and all of its content.
      // if (supportsMutation) {
      //   if (hostParent !== null) {
      //     if (hostParentIsContainer) {
      //       clearSuspenseBoundaryFromContainer(
      //         ((hostParent: any): Container),
      //         (deletedFiber.stateNode: SuspenseInstance),
      //       );
      //     } else {
      //       clearSuspenseBoundary(
      //         ((hostParent: any): Instance),
      //         (deletedFiber.stateNode: SuspenseInstance),
      //       );
      //     }
      //   }
      // }
      return;
    }
    case WorkTag.HostPortal: {
      console.error('commitDeletionEffectsOnFiber HostPortal 未实现');

      // if (supportsMutation) {
      //   // When we go into a portal, it becomes the parent to remove from.
      //   const prevHostParent = hostParent;
      //   const prevHostParentIsContainer = hostParentIsContainer;
      //   hostParent = deletedFiber.stateNode.containerInfo;
      //   hostParentIsContainer = true;
      //   recursivelyTraverseDeletionEffects(
      //     finishedRoot,
      //     nearestMountedAncestor,
      //     deletedFiber,
      //   );
      //   hostParent = prevHostParent;
      //   hostParentIsContainer = prevHostParentIsContainer;
      // } else {
      //   emptyPortalContainer(deletedFiber);

      //   recursivelyTraverseDeletionEffects(
      //     finishedRoot,
      //     nearestMountedAncestor,
      //     deletedFiber,
      //   );
      // }
      return;
    }
    case WorkTag.FunctionComponent:
    case WorkTag.ForwardRef:
    case WorkTag.MemoComponent:
    case WorkTag.SimpleMemoComponent: {
      if (!offscreenSubtreeWasHidden) {
        const updateQueue: FunctionComponentUpdateQueue | null =
          deletedFiber.updateQueue as unknown as any;
        if (updateQueue !== null) {
          const lastEffect = updateQueue.lastEffect;
          if (lastEffect !== null) {
            const firstEffect = lastEffect.next;

            let effect = firstEffect;
            do {
              const { destroy, tag } = effect || {};
              if (destroy !== undefined) {
                if ((tag! & HookFlags.Insertion) !== HookFlags.NoFlags) {
                  safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                } else if ((tag! & HookFlags.Layout) !== HookFlags.NoFlags) {
                  if (
                    enableProfilerTimer &&
                    enableProfilerCommitHooks &&
                    deletedFiber.mode & TypeOfMode.ProfileMode
                  ) {
                    startLayoutEffectTimer();
                    safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                    recordLayoutEffectDuration(deletedFiber);
                  } else {
                    safelyCallDestroy(deletedFiber, nearestMountedAncestor, destroy);
                  }
                }
              }
              effect = effect!.next;
            } while (effect !== firstEffect);
          }
        }
      }

      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      return;
    }
    case WorkTag.ClassComponent: {
      console.error('commitDeletionEffectsOnFiber ClassComponent 未实现');

      // if (!offscreenSubtreeWasHidden) {
      //   safelyDetachRef(deletedFiber, nearestMountedAncestor);
      //   const instance = deletedFiber.stateNode;
      //   if (typeof instance.componentWillUnmount === 'function') {
      //     safelyCallComponentWillUnmount(
      //       deletedFiber,
      //       nearestMountedAncestor,
      //       instance,
      //     );
      //   }
      // }
      // recursivelyTraverseDeletionEffects(
      //   finishedRoot,
      //   nearestMountedAncestor,
      //   deletedFiber,
      // );
      return;
    }
    case WorkTag.ScopeComponent: {
      console.error('commitDeletionEffectsOnFiber ScopeComponent 未实现');

      // if (enableScopeAPI) {
      //   safelyDetachRef(deletedFiber, nearestMountedAncestor);
      // }
      // recursivelyTraverseDeletionEffects(
      //   finishedRoot,
      //   nearestMountedAncestor,
      //   deletedFiber,
      // );
      return;
    }
    case WorkTag.OffscreenComponent: {
      console.error('commitDeletionEffectsOnFiber OffscreenComponent 未实现');

      // if (
      //   // TODO: Remove this dead flag
      //   enableSuspenseLayoutEffectSemantics &&
      //   deletedFiber.mode & ConcurrentMode
      // ) {
      //   // If this offscreen component is hidden, we already unmounted it. Before
      //   // deleting the children, track that it's already unmounted so that we
      //   // don't attempt to unmount the effects again.
      //   // TODO: If the tree is hidden, in most cases we should be able to skip
      //   // over the nested children entirely. An exception is we haven't yet found
      //   // the topmost host node to delete, which we already track on the stack.
      //   // But the other case is portals, which need to be detached no matter how
      //   // deeply they are nested. We should use a subtree flag to track whether a
      //   // subtree includes a nested portal.
      //   const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
      //   offscreenSubtreeWasHidden =
      //     prevOffscreenSubtreeWasHidden || deletedFiber.memoizedState !== null;
      //   recursivelyTraverseDeletionEffects(
      //     finishedRoot,
      //     nearestMountedAncestor,
      //     deletedFiber,
      //   );
      //   offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      // } else {
      //   recursivelyTraverseDeletionEffects(
      //     finishedRoot,
      //     nearestMountedAncestor,
      //     deletedFiber,
      //   );
      // }
      break;
    }
    default: {
      recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, deletedFiber);
      return;
    }
  }
}

// 1981
export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber, committedLanes: Lanes) {
  inProgressLanes = committedLanes;
  inProgressRoot = root;

  // setCurrentDebugFiberInDEV(finishedWork);
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
  // setCurrentDebugFiberInDEV(finishedWork);

  inProgressLanes = null;
  inProgressRoot = null;
}

// 2052
function recursivelyTraverseMutationEffects(root: FiberRoot, parentFiber: Fiber, lanes: Lanes) {
  // Deletions effects can be scheduled on any fiber type. They need to happen
  // before the children effects hae fired.
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      try {
        commitDeletionEffects(root, parentFiber, childToDelete);
      } catch (error) {
        captureCommitPhaseError(childToDelete, parentFiber, error as any);
      }
    }
  }

  // const prevDebugFiber = getCurrentDebugFiberInDEV();
  if (parentFiber.subtreeFlags & MutationMask) {
    let child = parentFiber.child;
    while (child !== null) {
      // setCurrentDebugFiberInDEV(child);
      commitMutationEffectsOnFiber(child, root, lanes);
      child = child.sibling;
    }
  }
  // setCurrentDebugFiberInDEV(prevDebugFiber);
}

// 2083
function commitMutationEffectsOnFiber(finishedWork: Fiber, root: FiberRoot, lanes: Lanes) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  // The effect flag should be checked *after* we refine the type of fiber,
  // because the fiber tag is more specific. An exception is any flag related
  // to reconcilation, because those can be set on all fiber types.
  switch (finishedWork.tag) {
    case WorkTag.FunctionComponent:
    case WorkTag.ForwardRef:
    case WorkTag.MemoComponent:
    case WorkTag.SimpleMemoComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Flags.Update) {
        try {
          commitHookEffectListUnmount(
            HookFlags.Insertion | HookFlags.HasEffect,
            finishedWork,
            finishedWork.return
          );
          commitHookEffectListMount(HookFlags.Insertion | HookFlags.HasEffect, finishedWork);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
        }
        // Layout effects are destroyed during the mutation phase so that all
        // destroy functions for all fibers are called before any create functions.
        // This prevents sibling component effects from interfering with each other,
        // e.g. a destroy function in one component should never override a ref set
        // by a create function in another component during the same commit.
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          finishedWork.mode & TypeOfMode.ProfileMode
        ) {
          try {
            startLayoutEffectTimer();
            commitHookEffectListUnmount(
              HookFlags.Layout | HookFlags.HasEffect,
              finishedWork,
              finishedWork.return
            );
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
          }
          recordLayoutEffectDuration(finishedWork);
        } else {
          try {
            commitHookEffectListUnmount(
              HookFlags.Layout | HookFlags.HasEffect,
              finishedWork,
              finishedWork.return
            );
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
          }
        }
      }
      return;
    }
    case WorkTag.ClassComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Flags.Ref) {
        if (current !== null) {
          safelyDetachRef(current, current.return);
        }
      }
      return;
    }
    case WorkTag.HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Flags.Ref) {
        if (current !== null) {
          safelyDetachRef(current, current.return);
        }
      }
      if (supportsMutation) {
        // TODO: ContentReset gets cleared by the children during the commit
        // phase. This is a refactor hazard because it means we must read
        // flags the flags after `commitReconciliationEffects` has already run;
        // the order matters. We should refactor so that ContentReset does not
        // rely on mutating the flag during commit. Like by setting a flag
        // during the render phase instead.
        if (finishedWork.flags & Flags.ContentReset) {
          const instance: Instance = finishedWork.stateNode;
          try {
            resetTextContent(instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
          }
        }

        if (flags & Flags.Update) {
          const instance: Instance = finishedWork.stateNode;
          if (instance != null) {
            // Commit the work prepared earlier.
            const newProps = finishedWork.memoizedProps;
            // For hydration we reuse the update path but we treat the oldProps
            // as the newProps. The updatePayload will contain the real change in
            // this case.
            const oldProps = current !== null ? current.memoizedProps : newProps;
            const type = finishedWork.type;
            // TODO: Type the updateQueue to be specific to host components.
            // read：这里的类型其实不对应，源码里这么实现，需要关注下是否正确
            const updatePayload: null | UpdatePayload =
              finishedWork.updateQueue as unknown as UpdatePayload;
            finishedWork.updateQueue = null;
            if (updatePayload !== null) {
              try {
                commitUpdate(instance, updatePayload, type, oldProps, newProps, finishedWork);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
              }
            }
          }
        }
      }
      return;
    }
    case WorkTag.HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Flags.Update) {
        if (supportsMutation) {
          if (finishedWork.stateNode === null) {
            throw new Error(
              'This should have a text node initialized. This error is likely ' +
                'caused by a bug in React. Please file an issue.'
            );
          }

          const textInstance: TextInstance = finishedWork.stateNode;
          const newText: string = finishedWork.memoizedProps;
          // For hydration we reuse the update path but we treat the oldProps
          // as the newProps. The updatePayload will contain the real change in
          // this case.
          const oldText: string = current !== null ? current.memoizedProps : newText;

          try {
            commitTextUpdate(textInstance, oldText, newText);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
          }
        }
      }
      return;
    }
    case WorkTag.HostRoot: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Flags.Update) {
        if (supportsMutation && supportsHydration) {
          if (current !== null) {
            const prevRootState: RootState = current.memoizedState;
            if (prevRootState.isDehydrated) {
              try {
                commitHydratedContainer(root.containerInfo);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
              }
            }
          }
        }
        // read: supportsPersistence 看起来是 undefined
        // if (supportsPersistence) {
        //   const containerInfo = root.containerInfo;
        //   const pendingChildren = root.pendingChildren;
        //   try {
        //     replaceContainerChildren(containerInfo, pendingChildren);
        //   } catch (error) {
        //     captureCommitPhaseError(finishedWork, finishedWork.return, error);
        //   }
        // }
      }
      return;
    }
    case WorkTag.HostPortal: {
      console.error('commitMutationEffectsOnFiber HostPortal 待实现');

      // recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      // commitReconciliationEffects(finishedWork);

      // if (flags & Update) {
      //   if (supportsPersistence) {
      //     const portal = finishedWork.stateNode;
      //     const containerInfo = portal.containerInfo;
      //     const pendingChildren = portal.pendingChildren;
      //     try {
      //       replaceContainerChildren(containerInfo, pendingChildren);
      //     } catch (error) {
      //       captureCommitPhaseError(finishedWork, finishedWork.return, error);
      //     }
      //   }
      // }
      return;
    }
    case WorkTag.SuspenseComponent: {
      console.error('commitMutationEffectsOnFiber SuspenseComponent 待实现');

      // recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      // commitReconciliationEffects(finishedWork);

      // const offscreenFiber: Fiber = (finishedWork.child: any);

      // if (offscreenFiber.flags & Visibility) {
      //   const offscreenInstance: OffscreenInstance = offscreenFiber.stateNode;
      //   const newState: OffscreenState | null = offscreenFiber.memoizedState;
      //   const isHidden = newState !== null;

      //   // Track the current state on the Offscreen instance so we can
      //   // read it during an event
      //   offscreenInstance.isHidden = isHidden;

      //   if (isHidden) {
      //     const wasHidden =
      //       offscreenFiber.alternate !== null &&
      //       offscreenFiber.alternate.memoizedState !== null;
      //     if (!wasHidden) {
      //       // TODO: Move to passive phase
      //       markCommitTimeOfFallback();
      //     }
      //   }
      // }

      // if (flags & Update) {
      //   try {
      //     commitSuspenseCallback(finishedWork);
      //   } catch (error) {
      //     captureCommitPhaseError(finishedWork, finishedWork.return, error);
      //   }
      //   attachSuspenseRetryListeners(finishedWork);
      // }
      return;
    }
    case WorkTag.OffscreenComponent: {
      console.error('commitMutationEffectsOnFiber OffscreenComponent 待实现');

      // const wasHidden = current !== null && current.memoizedState !== null;

      // if (
      //   // TODO: Remove this dead flag
      //   enableSuspenseLayoutEffectSemantics &&
      //   finishedWork.mode & ConcurrentMode
      // ) {
      //   // Before committing the children, track on the stack whether this
      //   // offscreen subtree was already hidden, so that we don't unmount the
      //   // effects again.
      //   const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
      //   offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
      //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      //   offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      // } else {
      //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      // }

      // commitReconciliationEffects(finishedWork);

      // if (flags & Visibility) {
      //   const offscreenInstance: OffscreenInstance = finishedWork.stateNode;
      //   const newState: OffscreenState | null = finishedWork.memoizedState;
      //   const isHidden = newState !== null;
      //   const offscreenBoundary: Fiber = finishedWork;

      //   // Track the current state on the Offscreen instance so we can
      //   // read it during an event
      //   offscreenInstance.isHidden = isHidden;

      //   if (enableSuspenseLayoutEffectSemantics) {
      //     if (isHidden) {
      //       if (!wasHidden) {
      //         if ((offscreenBoundary.mode & ConcurrentMode) !== NoMode) {
      //           nextEffect = offscreenBoundary;
      //           let offscreenChild = offscreenBoundary.child;
      //           while (offscreenChild !== null) {
      //             nextEffect = offscreenChild;
      //             disappearLayoutEffects_begin(offscreenChild);
      //             offscreenChild = offscreenChild.sibling;
      //           }
      //         }
      //       }
      //     } else {
      //       if (wasHidden) {
      //         // TODO: Move re-appear call here for symmetry?
      //       }
      //     }
      //   }

      //   if (supportsMutation) {
      //     // TODO: This needs to run whenever there's an insertion or update
      //     // inside a hidden Offscreen tree.
      //     hideOrUnhideAllChildren(offscreenBoundary, isHidden);
      //   }
      // }
      return;
    }
    case WorkTag.SuspenseListComponent: {
      console.error('commitMutationEffectsOnFiber SuspenseListComponent 待实现');

      // recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      // commitReconciliationEffects(finishedWork);

      // if (flags & Update) {
      //   attachSuspenseRetryListeners(finishedWork);
      // }
      return;
    }
    case WorkTag.ScopeComponent: {
      console.error('commitMutationEffectsOnFiber ScopeComponent 待实现');
      // if (enableScopeAPI) {
      //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      //   commitReconciliationEffects(finishedWork);

      //   // TODO: This is a temporary solution that allowed us to transition away
      //   // from React Flare on www.
      //   if (flags & Ref) {
      //     if (current !== null) {
      //       safelyDetachRef(finishedWork, finishedWork.return);
      //     }
      //     safelyAttachRef(finishedWork, finishedWork.return);
      //   }
      //   if (flags & Update) {
      //     const scopeInstance = finishedWork.stateNode;
      //     prepareScopeUpdate(scopeInstance, finishedWork);
      //   }
      // }
      return;
    }
    default: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      return;
    }
  }
}

// 2436
function commitReconciliationEffects(finishedWork: Fiber) {
  // Placement effects (insertions, reorders) can be scheduled on any fiber
  // type. They needs to happen after the children effects have fired, but
  // before the effects on this fiber have fired.
  const flags = finishedWork.flags;
  if (flags & Flags.Placement) {
    try {
      commitPlacement(finishedWork);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error as any);
    }
    // Clear the "placement" from effect tag so that we know that this is
    // inserted, before any life-cycles like componentDidMount gets called.
    // TODO: findDOMNode doesn't rely on this any more but isMounted does
    // and isMounted is deprecated anyway so we should be able to kill this.
    finishedWork.flags &= ~Flags.Placement;
  }
  if (flags & Flags.Hydrating) {
    finishedWork.flags &= ~Flags.Hydrating;
  }
}

//2459
export function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  inProgressLanes = committedLanes;
  inProgressRoot = root;
  nextEffect = finishedWork;

  commitLayoutEffects_begin(finishedWork, root, committedLanes);

  inProgressLanes = null;
  inProgressRoot = null;
}

// 2474
function commitLayoutEffects_begin(subtreeRoot: Fiber, root: FiberRoot, committedLanes: Lanes) {
  // Suspense layout effects semantics don't change for legacy roots.
  const isModernRoot = (subtreeRoot.mode & TypeOfMode.ConcurrentMode) !== TypeOfMode.NoMode;

  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;

    if (
      enableSuspenseLayoutEffectSemantics &&
      fiber.tag === WorkTag.OffscreenComponent &&
      isModernRoot
    ) {
      console.error('OffscreenComponent类型的 layout effect, 需要实现');
      // read: 看起来是在处理Offscreen类型的 effect，应该有个优化，现在没看
      // Keep track of the current Offscreen stack's state.
      // const isHidden = fiber.memoizedState !== null;
      // const newOffscreenSubtreeIsHidden = isHidden || offscreenSubtreeIsHidden;
      // if (newOffscreenSubtreeIsHidden) {
      //   // The Offscreen tree is hidden. Skip over its layout effects.
      //   commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
      //   continue;
      // } else {
      //   // TODO (Offscreen) Also check: subtreeFlags & LayoutMask
      //   const current = fiber.alternate;
      //   const wasHidden = current !== null && current.memoizedState !== null;
      //   const newOffscreenSubtreeWasHidden =
      //     wasHidden || offscreenSubtreeWasHidden;
      //   const prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
      //   const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;

      //   // Traverse the Offscreen subtree with the current Offscreen as the root.
      //   offscreenSubtreeIsHidden = newOffscreenSubtreeIsHidden;
      //   offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden;

      //   if (offscreenSubtreeWasHidden && !prevOffscreenSubtreeWasHidden) {
      //     // This is the root of a reappearing boundary. Turn its layout effects
      //     // back on.
      //     nextEffect = fiber;
      //     reappearLayoutEffects_begin(fiber);
      //   }

      //   let child = firstChild;
      //   while (child !== null) {
      //     nextEffect = child;
      //     commitLayoutEffects_begin(
      //       child, // New root; bubble back up to here and stop.
      //       root,
      //       committedLanes,
      //     );
      //     child = child.sibling;
      //   }

      //   // Restore Offscreen state and resume in our-progress traversal.
      //   nextEffect = fiber;
      //   offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
      //   offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      //   commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);

      //   continue;
      // }
    }

    if ((fiber.subtreeFlags & LayoutMask) !== Flags.NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
    }
  }
}

// 2548
function commitLayoutMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & LayoutMask) !== Flags.NoFlags) {
      const current = fiber.alternate;
      try {
        commitLayoutEffectOnFiber(root, current, fiber, committedLanes);
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

// 2723
export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
): void {
  nextEffect = finishedWork;
  console.log('commitPassiveMountEffects:', finishedWork);
  commitPassiveMountEffects_begin(finishedWork, root, committedLanes, committedTransitions);
}

function commitPassiveMountEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null
) {
  console.log('commitPassiveMountEffects_begin');
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
  console.log('commitPassiveMountEffects_complete:', subtreeRoot);
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
  console.log('commitPassiveMountOnFiber:', finishedWork);
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
  console.log('commitPassiveUnmountEffects begin');
  nextEffect = firstChild;
  commitPassiveUnmountEffects_begin();
}

function commitPassiveUnmountEffects_begin() {
  while (nextEffect !== null) {
    console.log('commitPassiveUnmountEffects_begin nextEffect:', nextEffect);
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

// 3053
function commitPassiveUnmountEffects_complete() {
  console.log('commitPassiveUnmountEffects_complete,nextEffect:', nextEffect);
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & Flags.Passive) !== Flags.NoFlags) {
      commitPassiveUnmountOnFiber(fiber);
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

// 3073
function commitPassiveUnmountOnFiber(finishedWork: Fiber): void {
  console.log('commitPassiveUnmountOnFiber finishedWork:', finishedWork);
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
        commitHookEffectListUnmount(
          HookFlags.Passive | HookFlags.HasEffect,
          finishedWork,
          finishedWork.return
        );
        recordPassiveEffectDuration(finishedWork);
      } else {
        commitHookEffectListUnmount(
          HookFlags.Passive | HookFlags.HasEffect,
          finishedWork,
          finishedWork.return
        );
      }
      break;
    }
  }
}

// 3102
function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // Deletion effects fire in parent -> child order
    // TODO: Check if fiber has a PassiveStatic flag
    // setCurrentDebugFiberInDEV(fiber);
    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);
    // resetCurrentDebugFiberInDEV();

    const child = fiber.child;
    // TODO: Only traverse subtree if it has a PassiveStatic flag. (But, if we
    // do this, still need to handle `deletedTreeCleanUpLevel` correctly.)
    if (child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(deletedSubtreeRoot);
    }
  }
}
// 3129
function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(deletedSubtreeRoot: Fiber) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const sibling = fiber.sibling;
    const returnFiber = fiber.return;

    if (deletedTreeCleanUpLevel >= 2) {
      // Recursively traverse the entire deleted tree and clean up fiber fields.
      // This is more aggressive than ideal, and the long term goal is to only
      // have to detach the deleted tree at the root.
      detachFiberAfterEffects(fiber);
      if (fiber === deletedSubtreeRoot) {
        nextEffect = null;
        return;
      }
    } else {
      // This is the default branch (level 0). We do not recursively clear all
      // the fiber fields. Only the root of the deleted subtree.
      if (fiber === deletedSubtreeRoot) {
        detachFiberAfterEffects(fiber);
        nextEffect = null;
        return;
      }
    }

    if (sibling !== null) {
      sibling.return = returnFiber;
      nextEffect = sibling;
      return;
    }

    nextEffect = returnFiber;
  }
}

// 3166
function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current: Fiber,
  nearestMountedAncestor: Fiber | null
): void {
  switch (current.tag) {
    case WorkTag.FunctionComponent:
    case WorkTag.ForwardRef:
    case WorkTag.SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        current.mode & TypeOfMode.ProfileMode
      ) {
        startPassiveEffectTimer();
        commitHookEffectListUnmount(HookFlags.Passive, current, nearestMountedAncestor);
        recordPassiveEffectDuration(current);
      } else {
        commitHookEffectListUnmount(HookFlags.Passive, current, nearestMountedAncestor);
      }
      break;
    }
    // TODO: run passive unmount effects when unmounting a root.
    // Because passive unmount effects are not currently run,
    // the cache instance owned by the root will never be freed.
    // When effects are run, the cache should be freed here:
    // case HostRoot: {
    //   if (enableCache) {
    //     const cache = current.memoizedState.cache;
    //     releaseCache(cache);
    //   }
    //   break;
    // }
    case WorkTag.LegacyHiddenComponent:
    case WorkTag.OffscreenComponent: {
      if (enableCache) {
        if (current.memoizedState !== null && current.memoizedState.cachePool !== null) {
          const cache: Cache = current.memoizedState.cachePool.pool;
          // Retain/release the cache used for pending (suspended) nodes.
          // Note that this is only reached in the non-suspended/visible case:
          // when the content is suspended/hidden, the retain/release occurs
          // via the parent Suspense component (see case above).
          if (cache != null) {
            retainCache(cache);
          }
        }
      }
      break;
    }
    case WorkTag.CacheComponent: {
      if (enableCache) {
        const cache = current.memoizedState.cache;
        releaseCache(cache);
      }
      break;
    }
  }
}
