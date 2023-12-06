import {
  ChildDeletion,
  ContentReset,
  LayoutMask,
  NoFlags,
  Passive,
  PassiveMask,
  Ref,
  Update,
} from './ReactFiberFlags';
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
  ClassComponent,
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  LegacyHiddenComponent,
  MemoComponent,
  OffscreenComponent,
  SimpleMemoComponent,
} from './ReactWorkTags';
import { captureCommitPhaseError } from './ReactFiberWorkLoop';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { Instance } from './ReactFiberHostConfig';
let nextEffect: Fiber | null = null;

let inProgressLanes: Lanes | null = null;
let inProgressRoot: FiberRoot | null = null;

// 702
function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  if ((finishedWork.flags & LayoutMask) !== NoFlags) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        if (
          true
          // 特性不开启，这里默认为 true
          // !enableSuspenseLayoutEffectSemantics ||
          // !offscreenSubtreeWasHidden
        ) {
          // At this point layout effects have already been destroyed (during mutation phase).
          // This is done to prevent sibling component effects from interfering with each other,
          // e.g. a destroy function in one component should never override a ref set
          // by a create function in another component during the same commit.
          // if (
          //   enableProfilerTimer &&
          //   enableProfilerCommitHooks &&
          //   finishedWork.mode & ProfileMode
          // ) {
          //   try {
          //     startLayoutEffectTimer();
          //     commitHookEffectListMount(
          //       HookLayout | HookHasEffect,
          //       finishedWork,
          //     );
          //   } finally {
          //     recordLayoutEffectDuration(finishedWork);
          //   }
          // } else {
          commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
          // }
        }
        break;
      }
      case ClassComponent: {
        const instance = finishedWork.stateNode;
        if (finishedWork.flags & Update) {
          // 默认开启
          // if (!offscreenSubtreeWasHidden) {
          if (true) {
            if (current === null) {
              // We could update instance props and state here,
              // but instead we rely on them being set during last render.
              // TODO: revisit this when we implement resuming.
              // if (__DEV__) {
              //   if (
              //     finishedWork.type === finishedWork.elementType &&
              //     !didWarnAboutReassigningProps
              //   ) {
              //     if (instance.props !== finishedWork.memoizedProps) {
              //       console.error(
              //         'Expected %s props to match memoized props before ' +
              //           'componentDidMount. ' +
              //           'This might either be because of a bug in React, or because ' +
              //           'a component reassigns its own `this.props`. ' +
              //           'Please file an issue.',
              //         getComponentNameFromFiber(finishedWork) || 'instance',
              //       );
              //     }
              //     if (instance.state !== finishedWork.memoizedState) {
              //       console.error(
              //         'Expected %s state to match memoized state before ' +
              //           'componentDidMount. ' +
              //           'This might either be because of a bug in React, or because ' +
              //           'a component reassigns its own `this.state`. ' +
              //           'Please file an issue.',
              //         getComponentNameFromFiber(finishedWork) || 'instance',
              //       );
              //     }
              //   }
              // }

              // 特性不看
              // if (
              //   enableProfilerTimer &&
              //   enableProfilerCommitHooks &&
              //   finishedWork.mode & ProfileMode
              // ) {
              //   try {
              //     startLayoutEffectTimer();
              //     instance.componentDidMount();
              //   } finally {
              //     recordLayoutEffectDuration(finishedWork);
              //   }
              // } else {
              instance.componentDidMount();
              // }
            } else {
              const prevProps =
                finishedWork.elementType === finishedWork.type
                  ? current.memoizedProps
                  : resolveDefaultProps(finishedWork.type, current.memoizedProps);
              const prevState = current.memoizedState;
              // We could update instance props and state here,
              // but instead we rely on them being set during last render.
              // TODO: revisit this when we implement resuming.
              // if (__DEV__) {
              //   if (
              //     finishedWork.type === finishedWork.elementType &&
              //     !didWarnAboutReassigningProps
              //   ) {
              //     if (instance.props !== finishedWork.memoizedProps) {
              //       console.error(
              //         'Expected %s props to match memoized props before ' +
              //           'componentDidUpdate. ' +
              //           'This might either be because of a bug in React, or because ' +
              //           'a component reassigns its own `this.props`. ' +
              //           'Please file an issue.',
              //         getComponentNameFromFiber(finishedWork) || 'instance',
              //       );
              //     }
              //     if (instance.state !== finishedWork.memoizedState) {
              //       console.error(
              //         'Expected %s state to match memoized state before ' +
              //           'componentDidUpdate. ' +
              //           'This might either be because of a bug in React, or because ' +
              //           'a component reassigns its own `this.state`. ' +
              //           'Please file an issue.',
              //         getComponentNameFromFiber(finishedWork) || 'instance',
              //       );
              //     }
              //   }
              // }
              // if (
              //   enableProfilerTimer &&
              //   enableProfilerCommitHooks &&
              //   finishedWork.mode & ProfileMode
              // ) {
              //   try {
              //     startLayoutEffectTimer();
              //     instance.componentDidUpdate(
              //       prevProps,
              //       prevState,
              //       instance.__reactInternalSnapshotBeforeUpdate,
              //     );
              //   } finally {
              //     recordLayoutEffectDuration(finishedWork);
              //   }
              // } else {
              instance.componentDidUpdate(
                prevProps,
                prevState,
                instance.__reactInternalSnapshotBeforeUpdate
              );
              // }
            }
          }
        }

        // TODO: I think this is now always non-null by the time it reaches the
        // commit phase. Consider removing the type check.
        const updateQueue: UpdateQueue<any> | null = finishedWork.updateQueue;
        if (updateQueue !== null) {
          // if (__DEV__) {
          //   if (
          //     finishedWork.type === finishedWork.elementType &&
          //     !didWarnAboutReassigningProps
          //   ) {
          //     if (instance.props !== finishedWork.memoizedProps) {
          //       console.error(
          //         'Expected %s props to match memoized props before ' +
          //           'processing the update queue. ' +
          //           'This might either be because of a bug in React, or because ' +
          //           'a component reassigns its own `this.props`. ' +
          //           'Please file an issue.',
          //         getComponentNameFromFiber(finishedWork) || 'instance',
          //       );
          //     }
          //     if (instance.state !== finishedWork.memoizedState) {
          //       console.error(
          //         'Expected %s state to match memoized state before ' +
          //           'processing the update queue. ' +
          //           'This might either be because of a bug in React, or because ' +
          //           'a component reassigns its own `this.state`. ' +
          //           'Please file an issue.',
          //         getComponentNameFromFiber(finishedWork) || 'instance',
          //       );
          //     }
          //   }
          // }
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          commitUpdateQueue(finishedWork, updateQueue, instance);
        }
        break;
      }
      case HostRoot: {
        // TODO: I think this is now always non-null by the time it reaches the
        // commit phase. Consider removing the type check.
        const updateQueue: UpdateQueue<any> | null = finishedWork.updateQueue;
        if (updateQueue !== null) {
          let instance = null;
          if (finishedWork.child !== null) {
            switch (finishedWork.child.tag) {
              case HostComponent:
                instance = getPublicInstance(finishedWork.child.stateNode);
                break;
              case ClassComponent:
                instance = finishedWork.child.stateNode;
                break;
            }
          }
          commitUpdateQueue(finishedWork, updateQueue, instance);
        }
        break;
      }
      case HostComponent: {
        const instance: Instance = finishedWork.stateNode;

        // Renderers may schedule work to be done after host components are mounted
        // (eg DOM renderer may schedule auto-focus for inputs and form controls).
        // These effects should only be committed when components are first mounted,
        // aka when there is no current/alternate.
        if (current === null && finishedWork.flags & Update) {
          const type = finishedWork.type;
          const props = finishedWork.memoizedProps;
          commitMount(instance, type, props, finishedWork);
        }

        break;
      }
      case HostText: {
        // We have no life-cycles associated with text.
        break;
      }
      // case HostPortal: {
      //   // We have no life-cycles associated with portals.
      //   break;
      // }
      // case Profiler: {
      //   // if (enableProfilerTimer) {
      //   //   const {onCommit, onRender} = finishedWork.memoizedProps;
      //   //   const {effectDuration} = finishedWork.stateNode;

      //   //   const commitTime = getCommitTime();

      //   //   let phase = current === null ? 'mount' : 'update';
      //   //   if (enableProfilerNestedUpdatePhase) {
      //   //     if (isCurrentUpdateNested()) {
      //   //       phase = 'nested-update';
      //   //     }
      //   //   }

      //   //   if (typeof onRender === 'function') {
      //   //     onRender(
      //   //       finishedWork.memoizedProps.id,
      //   //       phase,
      //   //       finishedWork.actualDuration,
      //   //       finishedWork.treeBaseDuration,
      //   //       finishedWork.actualStartTime,
      //   //       commitTime,
      //   //     );
      //   //   }

      //   //   if (enableProfilerCommitHooks) {
      //   //     if (typeof onCommit === 'function') {
      //   //       onCommit(
      //   //         finishedWork.memoizedProps.id,
      //   //         phase,
      //   //         effectDuration,
      //   //         commitTime,
      //   //       );
      //   //     }

      //   //     // Schedule a passive effect for this Profiler to call onPostCommit hooks.
      //   //     // This effect should be scheduled even if there is no onPostCommit callback for this Profiler,
      //   //     // because the effect is also where times bubble to parent Profilers.
      //   //     enqueuePendingPassiveProfilerEffect(finishedWork);

      //   //     // Propagate layout effect durations to the next nearest Profiler ancestor.
      //   //     // Do not reset these values until the next render so DevTools has a chance to read them first.
      //   //     let parentFiber = finishedWork.return;
      //   //     outer: while (parentFiber !== null) {
      //   //       switch (parentFiber.tag) {
      //   //         case HostRoot:
      //   //           const root = parentFiber.stateNode;
      //   //           root.effectDuration += effectDuration;
      //   //           break outer;
      //   //         case Profiler:
      //   //           const parentStateNode = parentFiber.stateNode;
      //   //           parentStateNode.effectDuration += effectDuration;
      //   //           break outer;
      //   //       }
      //   //       parentFiber = parentFiber.return;
      //   //     }
      //   //   }
      //   // }
      //   break;
      // }
      // case SuspenseComponent: {
      //   commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
      //   break;
      // }
      // case SuspenseListComponent:
      // case IncompleteClassComponent:
      // case ScopeComponent:
      // case OffscreenComponent:
      // case LegacyHiddenComponent:
      // case TracingMarkerComponent: {
      //   break;
      // }

      default:
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.'
        );
    }
  }

  if (!enableSuspenseLayoutEffectSemantics || !offscreenSubtreeWasHidden) {
    // if (enableScopeAPI) {
    //   // TODO: This is a temporary solution that allowed us to transition away
    //   // from React Flare on www.
    //   if (finishedWork.flags & Ref && finishedWork.tag !== ScopeComponent) {
    //     commitAttachRef(finishedWork);
    //   }
    // } else {
    if (finishedWork.flags & Ref) {
      commitAttachRef(finishedWork);
    }
    // }
  }
}

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

// 2036
export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber, committedLanes: Lanes) {
  inProgressLanes = committedLanes;
  inProgressRoot = root;

  // setCurrentDebugFiberInDEV(finishedWork);
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
  // setCurrentDebugFiberInDEV(finishedWork);

  inProgressLanes = null;
  inProgressRoot = null;
}

// 2083
function commitMutationEffectsOnFiber(finishedWork: Fiber, root: FiberRoot, lanes: Lanes) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  // The effect flag should be checked *after* we refine the type of fiber,
  // because the fiber tag is more specific. An exception is any flag related
  // to reconcilation, because those can be set on all fiber types.
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    // case SimpleMemoComponent: {
    //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   commitReconciliationEffects(finishedWork);

    //   if (flags & Update) {
    //     try {
    //       commitHookEffectListUnmount(
    //         HookInsertion | HookHasEffect,
    //         finishedWork,
    //         finishedWork.return,
    //       );
    //       commitHookEffectListMount(
    //         HookInsertion | HookHasEffect,
    //         finishedWork,
    //       );
    //     } catch (error) {
    //       captureCommitPhaseError(finishedWork, finishedWork.return, error);
    //     }
    //     // Layout effects are destroyed during the mutation phase so that all
    //     // destroy functions for all fibers are called before any create functions.
    //     // This prevents sibling component effects from interfering with each other,
    //     // e.g. a destroy function in one component should never override a ref set
    //     // by a create function in another component during the same commit.
    //     if (
    //       enableProfilerTimer &&
    //       enableProfilerCommitHooks &&
    //       finishedWork.mode & ProfileMode
    //     ) {
    //       try {
    //         startLayoutEffectTimer();
    //         commitHookEffectListUnmount(
    //           HookLayout | HookHasEffect,
    //           finishedWork,
    //           finishedWork.return,
    //         );
    //       } catch (error) {
    //         captureCommitPhaseError(finishedWork, finishedWork.return, error);
    //       }
    //       recordLayoutEffectDuration(finishedWork);
    //     } else {
    //       try {
    //         commitHookEffectListUnmount(
    //           HookLayout | HookHasEffect,
    //           finishedWork,
    //           finishedWork.return,
    //         );
    //       } catch (error) {
    //         captureCommitPhaseError(finishedWork, finishedWork.return, error);
    //       }
    //     }
    //   }
    //   return;
    // }
    // case ClassComponent: {
    //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   commitReconciliationEffects(finishedWork);

    //   if (flags & Ref) {
    //     if (current !== null) {
    //       safelyDetachRef(current, current.return);
    //     }
    //   }
    //   return;
    // }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Ref) {
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
        if (finishedWork.flags & ContentReset) {
          const instance: Instance = finishedWork.stateNode;
          try {
            resetTextContent(instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }

        if (flags & Update) {
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
            const updatePayload: null | UpdatePayload = finishedWork.updateQueue;
            finishedWork.updateQueue = null;
            if (updatePayload !== null) {
              try {
                commitUpdate(instance, updatePayload, type, oldProps, newProps, finishedWork);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
          }
        }
      }
      return;
    }
    case HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
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
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    case HostRoot: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        if (supportsMutation && supportsHydration) {
          if (current !== null) {
            const prevRootState: RootState = current.memoizedState;
            if (prevRootState.isDehydrated) {
              try {
                commitHydratedContainer(root.containerInfo);
              } catch (error) {
                captureCommitPhaseError(finishedWork, finishedWork.return, error);
              }
            }
          }
        }
        if (supportsPersistence) {
          const containerInfo = root.containerInfo;
          const pendingChildren = root.pendingChildren;
          try {
            replaceContainerChildren(containerInfo, pendingChildren);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    // case HostPortal: {
    //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   commitReconciliationEffects(finishedWork);

    //   if (flags & Update) {
    //     if (supportsPersistence) {
    //       const portal = finishedWork.stateNode;
    //       const containerInfo = portal.containerInfo;
    //       const pendingChildren = portal.pendingChildren;
    //       try {
    //         replaceContainerChildren(containerInfo, pendingChildren);
    //       } catch (error) {
    //         captureCommitPhaseError(finishedWork, finishedWork.return, error);
    //       }
    //     }
    //   }
    //   return;
    // }
    // case SuspenseComponent: {
    //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   commitReconciliationEffects(finishedWork);

    //   const offscreenFiber: Fiber = (finishedWork.child: any);

    //   if (offscreenFiber.flags & Visibility) {
    //     const offscreenInstance: OffscreenInstance = offscreenFiber.stateNode;
    //     const newState: OffscreenState | null = offscreenFiber.memoizedState;
    //     const isHidden = newState !== null;

    //     // Track the current state on the Offscreen instance so we can
    //     // read it during an event
    //     offscreenInstance.isHidden = isHidden;

    //     if (isHidden) {
    //       const wasHidden =
    //         offscreenFiber.alternate !== null &&
    //         offscreenFiber.alternate.memoizedState !== null;
    //       if (!wasHidden) {
    //         // TODO: Move to passive phase
    //         markCommitTimeOfFallback();
    //       }
    //     }
    //   }

    //   if (flags & Update) {
    //     try {
    //       commitSuspenseCallback(finishedWork);
    //     } catch (error) {
    //       captureCommitPhaseError(finishedWork, finishedWork.return, error);
    //     }
    //     attachSuspenseRetryListeners(finishedWork);
    //   }
    //   return;
    // }
    // case OffscreenComponent: {
    //   const wasHidden = current !== null && current.memoizedState !== null;

    //   if (
    //     // TODO: Remove this dead flag
    //     enableSuspenseLayoutEffectSemantics &&
    //     finishedWork.mode & ConcurrentMode
    //   ) {
    //     // Before committing the children, track on the stack whether this
    //     // offscreen subtree was already hidden, so that we don't unmount the
    //     // effects again.
    //     const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
    //     offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
    //     recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //     offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
    //   } else {
    //     recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   }

    //   commitReconciliationEffects(finishedWork);

    //   if (flags & Visibility) {
    //     const offscreenInstance: OffscreenInstance = finishedWork.stateNode;
    //     const newState: OffscreenState | null = finishedWork.memoizedState;
    //     const isHidden = newState !== null;
    //     const offscreenBoundary: Fiber = finishedWork;

    //     // Track the current state on the Offscreen instance so we can
    //     // read it during an event
    //     offscreenInstance.isHidden = isHidden;

    //     if (enableSuspenseLayoutEffectSemantics) {
    //       if (isHidden) {
    //         if (!wasHidden) {
    //           if ((offscreenBoundary.mode & ConcurrentMode) !== NoMode) {
    //             nextEffect = offscreenBoundary;
    //             let offscreenChild = offscreenBoundary.child;
    //             while (offscreenChild !== null) {
    //               nextEffect = offscreenChild;
    //               disappearLayoutEffects_begin(offscreenChild);
    //               offscreenChild = offscreenChild.sibling;
    //             }
    //           }
    //         }
    //       } else {
    //         if (wasHidden) {
    //           // TODO: Move re-appear call here for symmetry?
    //         }
    //       }
    //     }

    //     if (supportsMutation) {
    //       // TODO: This needs to run whenever there's an insertion or update
    //       // inside a hidden Offscreen tree.
    //       hideOrUnhideAllChildren(offscreenBoundary, isHidden);
    //     }
    //   }
    //   return;
    // }
    // case SuspenseListComponent: {
    //   recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //   commitReconciliationEffects(finishedWork);

    //   if (flags & Update) {
    //     attachSuspenseRetryListeners(finishedWork);
    //   }
    //   return;
    // }
    // case ScopeComponent: {
    //   if (enableScopeAPI) {
    //     recursivelyTraverseMutationEffects(root, finishedWork, lanes);
    //     commitReconciliationEffects(finishedWork);

    //     // TODO: This is a temporary solution that allowed us to transition away
    //     // from React Flare on www.
    //     if (flags & Ref) {
    //       if (current !== null) {
    //         safelyDetachRef(finishedWork, finishedWork.return);
    //       }
    //       safelyAttachRef(finishedWork, finishedWork.return);
    //     }
    //     if (flags & Update) {
    //       const scopeInstance = finishedWork.stateNode;
    //       prepareScopeUpdate(scopeInstance, finishedWork);
    //     }
    //   }
    //   return;
    // }
    default: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      return;
    }
  }
}

// 2459
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

function commitLayoutEffects_begin(subtreeRoot: Fiber, root: FiberRoot, committedLanes: Lanes) {
  // Suspense layout effects semantics don't change for legacy roots.
  const isModernRoot = (subtreeRoot.mode & ConcurrentMode) !== NoMode;

  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;

    // if (
    //   enableSuspenseLayoutEffectSemantics &&
    //   fiber.tag === OffscreenComponent &&
    //   isModernRoot
    // ) {
    //   // Keep track of the current Offscreen stack's state.
    //   const isHidden = fiber.memoizedState !== null;
    //   const newOffscreenSubtreeIsHidden = isHidden || offscreenSubtreeIsHidden;
    //   if (newOffscreenSubtreeIsHidden) {
    //     // The Offscreen tree is hidden. Skip over its layout effects.
    //     commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
    //     continue;
    //   } else {
    //     // TODO (Offscreen) Also check: subtreeFlags & LayoutMask
    //     const current = fiber.alternate;
    //     const wasHidden = current !== null && current.memoizedState !== null;
    //     const newOffscreenSubtreeWasHidden =
    //       wasHidden || offscreenSubtreeWasHidden;
    //     const prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
    //     const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;

    //     // Traverse the Offscreen subtree with the current Offscreen as the root.
    //     offscreenSubtreeIsHidden = newOffscreenSubtreeIsHidden;
    //     offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden;

    //     if (offscreenSubtreeWasHidden && !prevOffscreenSubtreeWasHidden) {
    //       // This is the root of a reappearing boundary. Turn its layout effects
    //       // back on.
    //       nextEffect = fiber;
    //       reappearLayoutEffects_begin(fiber);
    //     }

    //     let child = firstChild;
    //     while (child !== null) {
    //       nextEffect = child;
    //       commitLayoutEffects_begin(
    //         child, // New root; bubble back up to here and stop.
    //         root,
    //         committedLanes,
    //       );
    //       child = child.sibling;
    //     }

    //     // Restore Offscreen state and resume in our-progress traversal.
    //     nextEffect = fiber;
    //     offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
    //     offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
    //     commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);

    //     continue;
    //   }
    // }

    if ((fiber.subtreeFlags & LayoutMask) !== NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
    }
  }
}

function commitLayoutMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & LayoutMask) !== NoFlags) {
      const current = fiber.alternate;
      setCurrentDebugFiberInDEV(fiber);
      try {
        commitLayoutEffectOnFiber(root, current, fiber, committedLanes);
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

// 2801
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

// 2992
export function commitPassiveUnmountEffects(firstChild: Fiber): void {
  nextEffect = firstChild;
  commitPassiveUnmountEffects_begin();
}

function commitPassiveUnmountEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const child = fiber.child;

    if ((nextEffect.flags & ChildDeletion) !== NoFlags) {
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
                const detachedSibling = detachedChild.sibling;
                detachedChild.sibling = null;
                detachedChild = detachedSibling;
              } while (detachedChild !== null);
            }
          }
        }

        nextEffect = fiber;
      }
    }

    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffects_complete();
    }
  }
}

function commitPassiveUnmountEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & Passive) !== NoFlags) {
      setCurrentDebugFiberInDEV(fiber);
      commitPassiveUnmountOnFiber(fiber);
      resetCurrentDebugFiberInDEV();
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
