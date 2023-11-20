import ReactSharedInternals from '@/react/ReactSharedInternals';
import { hasLegacyContextChanged } from './ReactFiberContext';
import { DidCapture, ForceUpdateForLegacySuspense, NoFlags } from './ReactFiberFlags';
import { Lanes, NoLanes, includesSomeLane } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { HostComponent, HostRoot } from './ReactWorkTags';

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

let didReceiveUpdate: boolean = false;

let didWarnAboutBadClass;
let didWarnAboutModulePatternComponent;
let didWarnAboutContextTypeOnFunctionComponent;
let didWarnAboutGetDerivedStateOnFunctionComponent;
let didWarnAboutFunctionRefs;
export let didWarnAboutReassigningProps: boolean;
let didWarnAboutRevealOrder;
let didWarnAboutTailOptions;
let didWarnAboutDefaultPropsOnFunctionComponent;

function checkScheduledUpdateOrContext(current: Fiber, renderLanes: Lanes): boolean {
  // Before performing an early bailout, we must check if there are pending
  // updates or context.
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) {
    return true;
  }
  // No pending update, but because context is propagated lazily, we need
  // to check for a context change before we bail out.
  // 特性，不看
  // if (enableLazyContextPropagation) {
  //   const dependencies = current.dependencies;
  //   if (dependencies !== null && checkIfContextChanged(dependencies)) {
  //     return true;
  //   }
  // }
  return false;
}

function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes): Fiber | null {
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (oldProps !== newProps || hasLegacyContextChanged()) {
      // If props or context changed, mark the fiber as having performed work.
      // This may be unset if the props are determined to be equal later (memo).
      didReceiveUpdate = true;
    } else {
      // Neither props nor legacy context changes. Check if there's a pending
      // update or context change.
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
      if (
        !hasScheduledUpdateOrContext &&
        // If this is the second pass of an error or suspense boundary, there
        // may not be work scheduled on `current`, so we check for this flag.
        (workInProgress.flags & DidCapture) === NoFlags
      ) {
        // No pending updates or context. Bail out now.
        didReceiveUpdate = false;
        return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
      }
      if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
        // This is a special case that only exists for legacy mode.
        // See https://github.com/facebook/react/pull/19216.
        didReceiveUpdate = true;
      } else {
        // An update was scheduled on this fiber, but there are no new props
        // nor legacy context. Set this to false. If an update queue or context
        // consumer produces a changed value, it will set this to true. Otherwise,
        // the component will assume the children have not changed and bail out.
        didReceiveUpdate = false;
      }
    }
  } else {
    didReceiveUpdate = false;

    //  SSR 相关的逻辑
    // if (getIsHydrating() && isForkedChild(workInProgress)) {
    //   // Check if this child belongs to a list of muliple children in
    //   // its parent.
    //   //
    //   // In a true multi-threaded implementation, we would render children on
    //   // parallel threads. This would represent the beginning of a new render
    //   // thread for this subtree.
    //   //
    //   // We only use this for id generation during hydration, which is why the
    //   // logic is located in this special branch.
    //   const slotIndex = workInProgress.index;
    //   const numberOfForks = getForksAtLevel(workInProgress);
    //   pushTreeId(workInProgress, numberOfForks, slotIndex);
    // }
  }

  // Before entering the begin phase, clear pending update priority.
  // TODO: This assumes that we're about to evaluate the component and process
  // the update queue. However, there's an exception: SimpleMemoComponent
  // sometimes bails out later in the begin phase. This indicates that we should
  // move this assignment out of the common path and into each branch.
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      return mountIndeterminateComponent(current, workInProgress, workInProgress.type, renderLanes);
    }
    case LazyComponent: {
      const elementType = workInProgress.elementType;
      return mountLazyComponent(current, workInProgress, elementType, renderLanes);
    }
    case FunctionComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes
      );
    }
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(current, workInProgress, Component, resolvedProps, renderLanes);
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
    case SuspenseComponent:
      return updateSuspenseComponent(current, workInProgress, renderLanes);
    case HostPortal:
      return updatePortalComponent(current, workInProgress, renderLanes);
    case ForwardRef: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === type
          ? unresolvedProps
          : resolveDefaultProps(type, unresolvedProps);
      return updateForwardRef(current, workInProgress, type, resolvedProps, renderLanes);
    }
    case Fragment:
      return updateFragment(current, workInProgress, renderLanes);
    case Mode:
      return updateMode(current, workInProgress, renderLanes);
    case Profiler:
      return updateProfiler(current, workInProgress, renderLanes);
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
    case ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes);
    case MemoComponent: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      // Resolve outer props first, then resolve inner props.
      let resolvedProps = resolveDefaultProps(type, unresolvedProps);
      //   if (__DEV__) {
      //     if (workInProgress.type !== workInProgress.elementType) {
      //       const outerPropTypes = type.propTypes;
      //       if (outerPropTypes) {
      //         checkPropTypes(
      //           outerPropTypes,
      //           resolvedProps, // Resolved for outer only
      //           'prop',
      //           getComponentNameFromType(type)
      //         );
      //       }
      //     }
      //   }
      resolvedProps = resolveDefaultProps(type.type, resolvedProps);
      return updateMemoComponent(current, workInProgress, type, resolvedProps, renderLanes);
    }
    case SimpleMemoComponent: {
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      );
    }
    case IncompleteClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return mountIncompleteClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes
      );
    }
    case SuspenseListComponent: {
      return updateSuspenseListComponent(current, workInProgress, renderLanes);
    }
    case ScopeComponent: {
      //   if (enableScopeAPI) {
      //     return updateScopeComponent(current, workInProgress, renderLanes);
      //   }
      break;
    }
    case OffscreenComponent: {
      return updateOffscreenComponent(current, workInProgress, renderLanes);
    }
    case LegacyHiddenComponent: {
      //   if (enableLegacyHidden) {
      //     return updateLegacyHiddenComponent(current, workInProgress, renderLanes);
      //   }
      break;
    }
    case CacheComponent: {
      //   if (enableCache) {
      //     return updateCacheComponent(current, workInProgress, renderLanes);
      //   }
      break;
    }
    case TracingMarkerComponent: {
      //   if (enableTransitionTracing) {
      //     return updateTracingMarkerComponent(current, workInProgress, renderLanes);
      //   }
      break;
    }
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      'React. Please file an issue.'
  );
}

function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  // This fiber does not have any pending work. Bailout without entering
  // the begin phase. There's still some bookkeeping we that needs to be done
  // in this optimized path, mostly pushing stuff onto the stack.
  switch (workInProgress.tag) {
    case HostRoot:
      pushHostRootContext(workInProgress);
      const root: FiberRoot = workInProgress.stateNode;
      pushRootTransition(workInProgress, root, renderLanes);

      // if (enableCache) {
      //   const cache: Cache = current.memoizedState.cache;
      //   pushCacheProvider(workInProgress, cache);
      // }
      resetHydrationState();
      break;
    case HostComponent:
      pushHostContext(workInProgress);
      break;
    // case ClassComponent: {
    //   const Component = workInProgress.type;
    //   if (isLegacyContextProvider(Component)) {
    //     pushLegacyContextProvider(workInProgress);
    //   }
    //   break;
    // }
    // case HostPortal:
    //   pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
    //   break;
    // case ContextProvider: {
    //   const newValue = workInProgress.memoizedProps.value;
    //   const context: ReactContext<any> = workInProgress.type._context;
    //   pushProvider(workInProgress, context, newValue);
    //   break;
    // }
    // case Profiler:
    //   if (enableProfilerTimer) {
    //     // Profiler should only call onRender when one of its descendants actually rendered.
    //     const hasChildWork = includesSomeLane(
    //       renderLanes,
    //       workInProgress.childLanes,
    //     );
    //     if (hasChildWork) {
    //       workInProgress.flags |= Update;
    //     }

    //     if (enableProfilerCommitHooks) {
    //       // Reset effect durations for the next eventual effect phase.
    //       // These are reset during render to allow the DevTools commit hook a chance to read them,
    //       const stateNode = workInProgress.stateNode;
    //       stateNode.effectDuration = 0;
    //       stateNode.passiveEffectDuration = 0;
    //     }
    //   }
    //   break;
    // case SuspenseComponent: {
    //   const state: SuspenseState | null = workInProgress.memoizedState;
    //   if (state !== null) {
    //     if (state.dehydrated !== null) {
    //       pushSuspenseContext(
    //         workInProgress,
    //         setDefaultShallowSuspenseContext(suspenseStackCursor.current),
    //       );
    //       // We know that this component will suspend again because if it has
    //       // been unsuspended it has committed as a resolved Suspense component.
    //       // If it needs to be retried, it should have work scheduled on it.
    //       workInProgress.flags |= DidCapture;
    //       // We should never render the children of a dehydrated boundary until we
    //       // upgrade it. We return null instead of bailoutOnAlreadyFinishedWork.
    //       return null;
    //     }

    //     // If this boundary is currently timed out, we need to decide
    //     // whether to retry the primary children, or to skip over it and
    //     // go straight to the fallback. Check the priority of the primary
    //     // child fragment.
    //     const primaryChildFragment: Fiber = (workInProgress.child: any);
    //     const primaryChildLanes = primaryChildFragment.childLanes;
    //     if (includesSomeLane(renderLanes, primaryChildLanes)) {
    //       // The primary children have pending work. Use the normal path
    //       // to attempt to render the primary children again.
    //       return updateSuspenseComponent(current, workInProgress, renderLanes);
    //     } else {
    //       // The primary child fragment does not have pending work marked
    //       // on it
    //       pushSuspenseContext(
    //         workInProgress,
    //         setDefaultShallowSuspenseContext(suspenseStackCursor.current),
    //       );
    //       // The primary children do not have pending work with sufficient
    //       // priority. Bailout.
    //       const child = bailoutOnAlreadyFinishedWork(
    //         current,
    //         workInProgress,
    //         renderLanes,
    //       );
    //       if (child !== null) {
    //         // The fallback children have pending work. Skip over the
    //         // primary children and work on the fallback.
    //         return child.sibling;
    //       } else {
    //         // Note: We can return `null` here because we already checked
    //         // whether there were nested context consumers, via the call to
    //         // `bailoutOnAlreadyFinishedWork` above.
    //         return null;
    //       }
    //     }
    //   } else {
    //     pushSuspenseContext(
    //       workInProgress,
    //       setDefaultShallowSuspenseContext(suspenseStackCursor.current),
    //     );
    //   }
    //   break;
    // }
    // case SuspenseListComponent: {
    //   const didSuspendBefore = (current.flags & DidCapture) !== NoFlags;

    //   let hasChildWork = includesSomeLane(
    //     renderLanes,
    //     workInProgress.childLanes,
    //   );

    //   if (enableLazyContextPropagation && !hasChildWork) {
    //     // Context changes may not have been propagated yet. We need to do
    //     // that now, before we can decide whether to bail out.
    //     // TODO: We use `childLanes` as a heuristic for whether there is
    //     // remaining work in a few places, including
    //     // `bailoutOnAlreadyFinishedWork` and
    //     // `updateDehydratedSuspenseComponent`. We should maybe extract this
    //     // into a dedicated function.
    //     lazilyPropagateParentContextChanges(
    //       current,
    //       workInProgress,
    //       renderLanes,
    //     );
    //     hasChildWork = includesSomeLane(renderLanes, workInProgress.childLanes);
    //   }

    //   if (didSuspendBefore) {
    //     if (hasChildWork) {
    //       // If something was in fallback state last time, and we have all the
    //       // same children then we're still in progressive loading state.
    //       // Something might get unblocked by state updates or retries in the
    //       // tree which will affect the tail. So we need to use the normal
    //       // path to compute the correct tail.
    //       return updateSuspenseListComponent(
    //         current,
    //         workInProgress,
    //         renderLanes,
    //       );
    //     }
    //     // If none of the children had any work, that means that none of
    //     // them got retried so they'll still be blocked in the same way
    //     // as before. We can fast bail out.
    //     workInProgress.flags |= DidCapture;
    //   }

    //   // If nothing suspended before and we're rendering the same children,
    //   // then the tail doesn't matter. Anything new that suspends will work
    //   // in the "together" mode, so we can continue from the state we had.
    //   const renderState = workInProgress.memoizedState;
    //   if (renderState !== null) {
    //     // Reset to the "together" mode in case we've started a different
    //     // update in the past but didn't complete it.
    //     renderState.rendering = null;
    //     renderState.tail = null;
    //     renderState.lastEffect = null;
    //   }
    //   pushSuspenseContext(workInProgress, suspenseStackCursor.current);

    //   if (hasChildWork) {
    //     break;
    //   } else {
    //     // If none of the children had any work, that means that none of
    //     // them got retried so they'll still be blocked in the same way
    //     // as before. We can fast bail out.
    //     return null;
    //   }
    // }
    // case OffscreenComponent:
    // case LegacyHiddenComponent: {
    //   // Need to check if the tree still needs to be deferred. This is
    //   // almost identical to the logic used in the normal update path,
    //   // so we'll just enter that. The only difference is we'll bail out
    //   // at the next level instead of this one, because the child props
    //   // have not changed. Which is fine.
    //   // TODO: Probably should refactor `beginWork` to split the bailout
    //   // path from the normal path. I'm tempted to do a labeled break here
    //   // but I won't :)
    //   workInProgress.lanes = NoLanes;
    //   return updateOffscreenComponent(current, workInProgress, renderLanes);
    // }
    // case CacheComponent: {
    //   if (enableCache) {
    //     const cache: Cache = current.memoizedState.cache;
    //     pushCacheProvider(workInProgress, cache);
    //   }
    //   break;
    // }
  }
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}

export { beginWork };
