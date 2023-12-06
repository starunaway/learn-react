import ReactSharedInternals from '@/react/ReactSharedInternals';
import {
  getMaskedContext,
  getUnmaskedContext,
  hasLegacyContextChanged,
  pushTopLevelContextObject,
  pushContextProvider as pushLegacyContextProvider,
  isContextProvider as isLegacyContextProvider,
  invalidateContextProvider,
} from './ReactFiberContext';
import {
  ContentReset,
  DidCapture,
  ForceClientRender,
  ForceUpdateForLegacySuspense,
  Hydrating,
  NoFlags,
  PerformedWork,
  Placement,
  Ref,
} from './ReactFiberFlags';
import { Lanes, NoLanes, includesSomeLane } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { mountChildFibers, reconcileChildFibers, cloneChildFibers } from './ReactChildFiber';
import {
  CacheComponent,
  ClassComponent,
  ContextConsumer,
  ContextProvider,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IncompleteClassComponent,
  IndeterminateComponent,
  LazyComponent,
  LegacyHiddenComponent,
  MemoComponent,
  Mode,
  OffscreenComponent,
  Profiler,
  ScopeComponent,
  SimpleMemoComponent,
  SuspenseListComponent,
  TracingMarkerComponent,
} from './ReactWorkTags';

import {
  adoptClassInstance,
  constructClassInstance,
  mountClassInstance,
  resumeMountClassInstance,
  updateClassInstance,
} from './ReactFiberClassComponent';

import { resolveDefaultProps } from './ReactFiberLazyComponent';
import { RootState } from './ReactFiberRoot';
import { shouldSetTextContent, supportsHydration } from './ReactFiberHostConfig';
import { UpdateQueue } from './ReactFiberClassUpdateQueue';
import { ReactNodeList } from '@/shared/ReactTypes';
import { CapturedValue, createCapturedValueAtFiber } from './ReactCapturedValue';
import { pushHostContainer, pushHostContext } from './ReactFiberHostContext';
import { pushRootTransition } from './ReactFiberTransition';
import {
  enterHydrationState,
  getIsHydrating,
  queueHydrationError,
  resetHydrationState,
  tryToClaimNextHydratableInstance,
} from './ReactFiberHydrationContext';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { prepareToReadContext } from './ReactFiberNewContext';
import { bailoutHooks, checkDidRenderIdHook, renderWithHooks } from './ReactFiberHooks';
import {
  processUpdateQueue,
  cloneUpdateQueue,
  initializeUpdateQueue,
  // enqueueCapturedUpdate,
} from './ReactFiberClassUpdateQueue';
import { pushMaterializedTreeId } from './ReactFiberTreeContext';
import { markSkippedUpdateLanes } from './ReactFiberWorkLoop';
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

function forceUnmountCurrentAndReconcile(
  current: Fiber,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  // This function is fork of reconcileChildren. It's used in cases where we
  // want to reconcile without matching against the existing set. This has the
  // effect of all current children being unmounted; even if the type and key
  // are the same, the old child is unmounted and a new child is created.
  //
  // To do this, we're going to go through the reconcile algorithm twice. In
  // the first pass, we schedule a deletion for all the current children by
  // passing null.
  workInProgress.child = reconcileChildFibers(workInProgress, current.child, null, renderLanes);
  // In the second pass, we mount the new children. The trick here is that we
  // pass null in place of where we usually pass the current child set. This has
  // the effect of remounting all children regardless of whether their
  // identities match.
  workInProgress.child = reconcileChildFibers(workInProgress, null, nextChildren, renderLanes);
}

export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  if (current === null) {
    // If this is a fresh new component that hasn't been rendered yet, we
    // won't update its child set by applying minimal side-effects. Instead,
    // we will add them all to the child before it gets rendered. That means
    // we can optimize this reconciliation pass by not tracking side-effects.
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    // If the current child is the same as the work in progress, it means that
    // we haven't yet started any work on these children. Therefore, we use
    // the clone algorithm to create a copy of all the current children.

    // If we had any progressed work already, that is invalid at this point so
    // let's throw it out.
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes
    );
  }
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
    // case LazyComponent: {
    //   const elementType = workInProgress.elementType;
    //   return mountLazyComponent(current, workInProgress, elementType, renderLanes);
    // }
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
    // case SuspenseComponent:
    //   return updateSuspenseComponent(current, workInProgress, renderLanes);
    // case HostPortal:
    //   return updatePortalComponent(current, workInProgress, renderLanes);
    // case ForwardRef: {
    //   const type = workInProgress.type;
    //   const unresolvedProps = workInProgress.pendingProps;
    //   const resolvedProps =
    //     workInProgress.elementType === type
    //       ? unresolvedProps
    //       : resolveDefaultProps(type, unresolvedProps);
    //   return updateForwardRef(current, workInProgress, type, resolvedProps, renderLanes);
    // }
    // case Fragment:
    //   return updateFragment(current, workInProgress, renderLanes);
    // case Mode:
    //   return updateMode(current, workInProgress, renderLanes);
    // case Profiler:
    //   return updateProfiler(current, workInProgress, renderLanes);
    // case ContextProvider:
    //   return updateContextProvider(current, workInProgress, renderLanes);
    // case ContextConsumer:
    //   return updateContextConsumer(current, workInProgress, renderLanes);
    case MemoComponent: {
      break;
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
      // return updateMemoComponent(current, workInProgress, type, resolvedProps, renderLanes);
    }
    case SimpleMemoComponent: {
      // return updateSimpleMemoComponent(
      //   current,
      //   workInProgress,
      //   workInProgress.type,
      //   workInProgress.pendingProps,
      //   renderLanes
      // );
      break;
    }
    case IncompleteClassComponent: {
      // const Component = workInProgress.type;
      // const unresolvedProps = workInProgress.pendingProps;
      // const resolvedProps =
      //   workInProgress.elementType === Component
      //     ? unresolvedProps
      //     : resolveDefaultProps(Component, unresolvedProps);
      // return mountIncompleteClassComponent(
      //   current,
      //   workInProgress,
      //   Component,
      //   resolvedProps,
      //   renderLanes
      // );
      break;
    }
    case SuspenseListComponent: {
      break;
      // return updateSuspenseListComponent(current, workInProgress, renderLanes);
    }
    case ScopeComponent: {
      //   if (enableScopeAPI) {
      //     return updateScopeComponent(current, workInProgress, renderLanes);
      //   }
      break;
    }
    case OffscreenComponent: {
      // return updateOffscreenComponent(current, workInProgress, renderLanes);
      break;
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

// function updateMemoComponent(
//   current: Fiber | null,
//   workInProgress: Fiber,
//   Component: any,
//   nextProps: any,
//   renderLanes: Lanes
// ): null | Fiber {
//   if (current === null) {
//     const type = Component.type;
//     if (
//       isSimpleFunctionComponent(type) &&
//       Component.compare === null &&
//       // SimpleMemoComponent codepath doesn't resolve outer props either.
//       Component.defaultProps === undefined
//     ) {
//       let resolvedType = type;
//       // if (__DEV__) {
//       //   resolvedType = resolveFunctionForHotReloading(type);
//       // }
//       // If this is a plain function component without default props,
//       // and with only the default shallow comparison, we upgrade it
//       // to a SimpleMemoComponent to allow fast path updates.
//       workInProgress.tag = SimpleMemoComponent;
//       workInProgress.type = resolvedType;
//       // if (__DEV__) {
//       //   validateFunctionComponentInDev(workInProgress, type);
//       // }
//       return updateSimpleMemoComponent(
//         current,
//         workInProgress,
//         resolvedType,
//         nextProps,
//         renderLanes
//       );
//     }
//     // if (__DEV__) {
//     //   const innerPropTypes = type.propTypes;
//     //   if (innerPropTypes) {
//     //     // Inner memo component props aren't currently validated in createElement.
//     //     // We could move it there, but we'd still need this for lazy code path.
//     //     checkPropTypes(
//     //       innerPropTypes,
//     //       nextProps, // Resolved props
//     //       'prop',
//     //       getComponentNameFromType(type)
//     //     );
//     //   }
//     // }
//     const child = createFiberFromTypeAndProps(
//       Component.type,
//       null,
//       nextProps,
//       workInProgress,
//       workInProgress.mode,
//       renderLanes
//     );
//     child.ref = workInProgress.ref;
//     child.return = workInProgress;
//     workInProgress.child = child;
//     return child;
//   }
//   // if (__DEV__) {
//   //   const type = Component.type;
//   //   const innerPropTypes = type.propTypes;
//   //   if (innerPropTypes) {
//   //     // Inner memo component props aren't currently validated in createElement.
//   //     // We could move it there, but we'd still need this for lazy code path.
//   //     checkPropTypes(
//   //       innerPropTypes,
//   //       nextProps, // Resolved props
//   //       'prop',
//   //       getComponentNameFromType(type)
//   //     );
//   //   }
//   // }
//   const currentChild = current.child as Fiber; // This is always exactly one child
//   const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
//   if (!hasScheduledUpdateOrContext) {
//     // This will be the props with resolved defaultProps,
//     // unlike current.memoizedProps which will be the unresolved ones.
//     const prevProps = currentChild.memoizedProps;
//     // Default to shallow comparison
//     let compare = Component.compare;
//     compare = compare !== null ? compare : shallowEqual;
//     if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
//       return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
//     }
//   }
//   // React DevTools reads this flag.
//   workInProgress.flags |= PerformedWork;
//   const newChild = createWorkInProgress(currentChild, nextProps);
//   newChild.ref = workInProgress.ref;
//   newChild.return = workInProgress;
//   workInProgress.child = newChild;
//   return newChild;
// }

function mountIndeterminateComponent(
  _current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  renderLanes: Lanes
) {
  resetSuspendedCurrentOnMountInLegacyMode(_current, workInProgress);

  const props = workInProgress.pendingProps;
  let context;
  //  默认为 true
  // if (!disableLegacyContext) {
  const unmaskedContext = getUnmaskedContext(workInProgress, Component, false);
  context = getMaskedContext(workInProgress, unmaskedContext);
  // }

  prepareToReadContext(workInProgress, renderLanes);
  let value;
  let hasId;

  // if (enableSchedulingProfiler) {
  //   markComponentRenderStarted(workInProgress);
  // }
  // if (__DEV__) {
  //   if (Component.prototype && typeof Component.prototype.render === 'function') {
  //     const componentName = getComponentNameFromType(Component) || 'Unknown';

  //     if (!didWarnAboutBadClass[componentName]) {
  //       console.error(
  //         "The <%s /> component appears to have a render method, but doesn't extend React.Component. " +
  //           'This is likely to cause errors. Change %s to extend React.Component instead.',
  //         componentName,
  //         componentName
  //       );
  //       didWarnAboutBadClass[componentName] = true;
  //     }
  //   }

  //   if (workInProgress.mode & StrictLegacyMode) {
  //     ReactStrictModeWarnings.recordLegacyContextWarning(workInProgress, null);
  //   }

  //   setIsRendering(true);
  //   ReactCurrentOwner.current = workInProgress;
  //   value = renderWithHooks(null, workInProgress, Component, props, context, renderLanes);
  //   hasId = checkDidRenderIdHook();
  //   setIsRendering(false);
  // } else {
  value = renderWithHooks(null, workInProgress, Component, props, context, renderLanes);
  hasId = checkDidRenderIdHook();
  // }
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStopped();
  // }

  // React DevTools reads this flag.
  workInProgress.flags |= PerformedWork;

  // if (__DEV__) {
  //   // Support for module components is deprecated and is removed behind a flag.
  //   // Whether or not it would crash later, we want to show a good message in DEV first.
  //   if (
  //     typeof value === 'object' &&
  //     value !== null &&
  //     typeof value.render === 'function' &&
  //     value.$$typeof === undefined
  //   ) {
  //     const componentName = getComponentNameFromType(Component) || 'Unknown';
  //     if (!didWarnAboutModulePatternComponent[componentName]) {
  //       console.error(
  //         'The <%s /> component appears to be a function component that returns a class instance. ' +
  //           'Change %s to a class that extends React.Component instead. ' +
  //           "If you can't use a class try assigning the prototype on the function as a workaround. " +
  //           "`%s.prototype = React.Component.prototype`. Don't use an arrow function since it " +
  //           'cannot be called with `new` by React.',
  //         componentName,
  //         componentName,
  //         componentName
  //       );
  //       didWarnAboutModulePatternComponent[componentName] = true;
  //     }
  //   }
  // }

  if (
    // Run these checks in production only if the flag is off.
    // Eventually we'll delete this branch altogether.
    // disableModulePatternComponents 默认是 false
    // !disableModulePatternComponents &&
    typeof value === 'object' &&
    value !== null &&
    typeof value.render === 'function' &&
    value.$$typeof === undefined
  ) {
    // if (__DEV__) {
    //   const componentName = getComponentNameFromType(Component) || 'Unknown';
    //   if (!didWarnAboutModulePatternComponent[componentName]) {
    //     console.error(
    //       'The <%s /> component appears to be a function component that returns a class instance. ' +
    //         'Change %s to a class that extends React.Component instead. ' +
    //         "If you can't use a class try assigning the prototype on the function as a workaround. " +
    //         "`%s.prototype = React.Component.prototype`. Don't use an arrow function since it " +
    //         'cannot be called with `new` by React.',
    //       componentName,
    //       componentName,
    //       componentName
    //     );
    //     didWarnAboutModulePatternComponent[componentName] = true;
    //   }
    // }

    // Proceed under the assumption that this is a class instance
    workInProgress.tag = ClassComponent;

    // Throw out any hooks that were used.
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;

    // Push context providers early to prevent context stack mismatches.
    // During mounting we don't know the child context yet as the instance doesn't exist.
    // We will invalidate the child context in finishClassComponent() right after rendering.
    let hasContext = false;
    if (isLegacyContextProvider(Component)) {
      hasContext = true;
      pushLegacyContextProvider(workInProgress);
    } else {
      hasContext = false;
    }

    workInProgress.memoizedState =
      value.state !== null && value.state !== undefined ? value.state : null;

    initializeUpdateQueue(workInProgress);

    adoptClassInstance(workInProgress, value);
    mountClassInstance(workInProgress, Component, props, renderLanes);
    return finishClassComponent(null, workInProgress, Component, true, hasContext, renderLanes);
  } else {
    // Proceed under the assumption that this is a function component
    workInProgress.tag = FunctionComponent;
    // if (__DEV__) {
    //   if (disableLegacyContext && Component.contextTypes) {
    //     console.error(
    //       '%s uses the legacy contextTypes API which is no longer supported. ' +
    //         'Use React.createContext() with React.useContext() instead.',
    //       getComponentNameFromType(Component) || 'Unknown'
    //     );
    //   }

    //   if (debugRenderPhaseSideEffectsForStrictMode && workInProgress.mode & StrictLegacyMode) {
    //     setIsStrictModeForDevtools(true);
    //     try {
    //       value = renderWithHooks(null, workInProgress, Component, props, context, renderLanes);
    //       hasId = checkDidRenderIdHook();
    //     } finally {
    //       setIsStrictModeForDevtools(false);
    //     }
    //   }
    // }

    // if (getIsHydrating() && hasId) {
    //   pushMaterializedTreeId(workInProgress);
    // }

    reconcileChildren(null, workInProgress, value, renderLanes);
    // if (__DEV__) {
    //   validateFunctionComponentInDev(workInProgress, Component);
    // }
    return workInProgress.child;
  }
}

function markRef(current: Fiber | null, workInProgress: Fiber) {
  const ref = workInProgress.ref;
  if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
    // Schedule a Ref effect
    workInProgress.flags |= Ref;
    // if (enableSuspenseLayoutEffectSemantics) {
    //   workInProgress.flags |= RefStatic;
    // }
  }
}

function pushHostRootContext(workInProgress: Fiber) {
  const root = workInProgress.stateNode as FiberRoot;
  if (root.pendingContext) {
    pushTopLevelContextObject(
      workInProgress,
      root.pendingContext,
      root.pendingContext !== root.context
    );
  } else if (root.context) {
    // Should always be set
    pushTopLevelContextObject(workInProgress, root.context, false);
  }
  pushHostContainer(workInProgress, root.containerInfo);
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  // if (__DEV__) {
  //   if (workInProgress.type !== workInProgress.elementType) {
  //     // Lazy component props can't be validated in createElement
  //     // because they're only guaranteed to be resolved here.
  //     const innerPropTypes = Component.propTypes;
  //     if (innerPropTypes) {
  //       checkPropTypes(
  //         innerPropTypes,
  //         nextProps, // Resolved props
  //         'prop',
  //         getComponentNameFromType(Component),
  //       );
  //     }
  //   }
  // }

  let context;
  //  默认为 true
  // if (!disableLegacyContext) {
  const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
  context = getMaskedContext(workInProgress, unmaskedContext);
  // }

  let nextChildren;
  let hasId;
  prepareToReadContext(workInProgress, renderLanes);
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStarted(workInProgress);
  // }
  // if (__DEV__) {
  //   ReactCurrentOwner.current = workInProgress;
  //   setIsRendering(true);
  //   nextChildren = renderWithHooks(
  //     current,
  //     workInProgress,
  //     Component,
  //     nextProps,
  //     context,
  //     renderLanes,
  //   );
  //   hasId = checkDidRenderIdHook();
  //   if (
  //     debugRenderPhaseSideEffectsForStrictMode &&
  //     workInProgress.mode & StrictLegacyMode
  //   ) {
  //     setIsStrictModeForDevtools(true);
  //     try {
  //       nextChildren = renderWithHooks(
  //         current,
  //         workInProgress,
  //         Component,
  //         nextProps,
  //         context,
  //         renderLanes,
  //       );
  //       hasId = checkDidRenderIdHook();
  //     } finally {
  //       setIsStrictModeForDevtools(false);
  //     }
  //   }
  //   setIsRendering(false);
  // } else {
  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes
  );
  hasId = checkDidRenderIdHook();
  // }
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStopped();
  // }

  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  if (getIsHydrating() && hasId) {
    pushMaterializedTreeId(workInProgress);
  }

  // React DevTools reads this flag.
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  // if (__DEV__) {
  //   // This is used by DevTools to force a boundary to error.
  //   switch (shouldError(workInProgress)) {
  //     case false: {
  //       const instance = workInProgress.stateNode;
  //       const ctor = workInProgress.type;
  //       // TODO This way of resetting the error boundary state is a hack.
  //       // Is there a better way to do this?
  //       const tempInstance = new ctor(
  //         workInProgress.memoizedProps,
  //         instance.context,
  //       );
  //       const state = tempInstance.state;
  //       instance.updater.enqueueSetState(instance, state, null);
  //       break;
  //     }
  //     case true: {
  //       workInProgress.flags |= DidCapture;
  //       workInProgress.flags |= ShouldCapture;
  //       // eslint-disable-next-line react-internal/prod-error-codes
  //       const error = new Error('Simulated error coming from DevTools');
  //       const lane = pickArbitraryLane(renderLanes);
  //       workInProgress.lanes = mergeLanes(workInProgress.lanes, lane);
  //       // Schedule the error boundary to re-render using updated state
  //       const update = createClassErrorUpdate(
  //         workInProgress,
  //         createCapturedValueAtFiber(error, workInProgress),
  //         lane,
  //       );
  //       enqueueCapturedUpdate(workInProgress, update);
  //       break;
  //     }
  //   }

  //   if (workInProgress.type !== workInProgress.elementType) {
  //     // Lazy component props can't be validated in createElement
  //     // because they're only guaranteed to be resolved here.
  //     const innerPropTypes = Component.propTypes;
  //     if (innerPropTypes) {
  //       checkPropTypes(
  //         innerPropTypes,
  //         nextProps, // Resolved props
  //         'prop',
  //         getComponentNameFromType(Component),
  //       );
  //     }
  //   }
  // }

  // Push context providers early to prevent context stack mismatches.
  // During mounting we don't know the child context yet as the instance doesn't exist.
  // We will invalidate the child context in finishClassComponent() right after rendering.
  let hasContext;
  if (isLegacyContextProvider(Component)) {
    hasContext = true;
    pushLegacyContextProvider(workInProgress);
  } else {
    hasContext = false;
  }
  prepareToReadContext(workInProgress, renderLanes);

  const instance = workInProgress.stateNode;
  let shouldUpdate;
  if (instance === null) {
    resetSuspendedCurrentOnMountInLegacyMode(current, workInProgress);

    // In the initial pass we might need to construct the instance.
    constructClassInstance(workInProgress, Component, nextProps);
    mountClassInstance(workInProgress, Component, nextProps, renderLanes);
    shouldUpdate = true;
  } else if (current === null) {
    // In a resume, we'll already have an instance we can reuse.
    shouldUpdate = resumeMountClassInstance(workInProgress, Component, nextProps, renderLanes);
  } else {
    shouldUpdate = updateClassInstance(current, workInProgress, Component, nextProps, renderLanes);
  }
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    hasContext,
    renderLanes
  );
  // if (__DEV__) {
  //   const inst = workInProgress.stateNode;
  //   if (shouldUpdate && inst.props !== nextProps) {
  //     if (!didWarnAboutReassigningProps) {
  //       console.error(
  //         'It looks like %s is reassigning its own `this.props` while rendering. ' +
  //           'This is not supported and can lead to confusing bugs.',
  //         getComponentNameFromFiber(workInProgress) || 'a component',
  //       );
  //     }
  //     didWarnAboutReassigningProps = true;
  //   }
  // }
  return nextUnitOfWork;
}

function finishClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  shouldUpdate: boolean,
  hasContext: boolean,
  renderLanes: Lanes
) {
  // Refs should update even if shouldComponentUpdate returns false
  markRef(current, workInProgress);

  const didCaptureError = (workInProgress.flags & DidCapture) !== NoFlags;

  if (!shouldUpdate && !didCaptureError) {
    // Context providers should defer to sCU for rendering
    if (hasContext) {
      invalidateContextProvider(workInProgress, Component, false);
    }

    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  const instance = workInProgress.stateNode;

  // Rerender
  ReactCurrentOwner.current = workInProgress;
  let nextChildren;
  if (didCaptureError && typeof Component.getDerivedStateFromError !== 'function') {
    // If we captured an error, but getDerivedStateFromError is not defined,
    // unmount all the children. componentDidCatch will schedule an update to
    // re-render a fallback. This is temporary until we migrate everyone to
    // the new API.
    // TODO: Warn in a future release.
    nextChildren = null;

    // if (enableProfilerTimer) {
    //   stopProfilerTimerIfRunning(workInProgress);
    // }
  } else {
    // if (enableSchedulingProfiler) {
    //   markComponentRenderStarted(workInProgress);
    // }
    // if (__DEV__) {
    //   setIsRendering(true);
    //   nextChildren = instance.render();
    //   if (
    //     debugRenderPhaseSideEffectsForStrictMode &&
    //     workInProgress.mode & StrictLegacyMode
    //   ) {
    //     setIsStrictModeForDevtools(true);
    //     try {
    //       instance.render();
    //     } finally {
    //       setIsStrictModeForDevtools(false);
    //     }
    //   }
    //   setIsRendering(false);
    // } else {
    nextChildren = instance.render();
    // }
    // if (enableSchedulingProfiler) {
    //   markComponentRenderStopped();
    // }
  }

  // React DevTools reads this flag.
  workInProgress.flags |= PerformedWork;
  if (current !== null && didCaptureError) {
    // If we're recovering from an error, reconcile without reusing any of
    // the existing children. Conceptually, the normal children and the children
    // that are shown on error are two different sets, so we shouldn't reuse
    // normal children even if their identities match.
    forceUnmountCurrentAndReconcile(current, workInProgress, nextChildren, renderLanes);
  } else {
    reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  }

  // Memoize state using the values we just used to render.
  // TODO: Restructure so we never read values from the instance.
  workInProgress.memoizedState = instance.state;

  // The context might have changed so we need to recalculate it.
  if (hasContext) {
    invalidateContextProvider(workInProgress, Component, true);
  }

  return workInProgress.child;
}

function updateHostRoot(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes) {
  pushHostRootContext(workInProgress);

  if (current === null) {
    throw new Error('Should have a current fiber. This is a bug in React.');
  }

  const nextProps = workInProgress.pendingProps;
  const prevState = workInProgress.memoizedState;
  const prevChildren = prevState.element;
  cloneUpdateQueue(current, workInProgress);
  processUpdateQueue(workInProgress, nextProps, null, renderLanes);

  const nextState: RootState = workInProgress.memoizedState;
  const root: FiberRoot = workInProgress.stateNode;
  pushRootTransition(workInProgress, root, renderLanes);

  // if (enableCache) {
  //   const nextCache: Cache = nextState.cache;
  //   pushCacheProvider(workInProgress, nextCache);
  //   if (nextCache !== prevState.cache) {
  //     // The root cache refreshed.
  //     propagateContextChange(workInProgress, CacheContext, renderLanes);
  //   }
  // }

  // Caution: React DevTools currently depends on this property
  // being called "element".
  const nextChildren = nextState.element;
  if (supportsHydration && prevState.isDehydrated) {
    // This is a hydration root whose shell has not yet hydrated. We should
    // attempt to hydrate.

    // Flip isDehydrated to false to indicate that when this render
    // finishes, the root will no longer be dehydrated.
    const overrideState: RootState = {
      element: nextChildren,
      isDehydrated: false,
      cache: nextState.cache,
      pendingSuspenseBoundaries: nextState.pendingSuspenseBoundaries,
      transitions: nextState.transitions,
    };
    const updateQueue: UpdateQueue<RootState> = workInProgress.updateQueue;
    // `baseState` can always be the last state because the root doesn't
    // have reducer functions so it doesn't need rebasing.
    updateQueue.baseState = overrideState;
    workInProgress.memoizedState = overrideState;

    if (workInProgress.flags & ForceClientRender) {
      // Something errored during a previous attempt to hydrate the shell, so we
      // forced a client render.
      const recoverableError = createCapturedValueAtFiber(
        new Error(
          'There was an error while hydrating. Because the error happened outside ' +
            'of a Suspense boundary, the entire root will switch to ' +
            'client rendering.'
        ),
        workInProgress
      );
      return mountHostRootWithoutHydrating(
        current,
        workInProgress,
        nextChildren,
        renderLanes,
        recoverableError
      );
    } else if (nextChildren !== prevChildren) {
      const recoverableError = createCapturedValueAtFiber(
        new Error(
          'This root received an early update, before anything was able ' +
            'hydrate. Switched the entire root to client rendering.'
        ),
        workInProgress
      );
      return mountHostRootWithoutHydrating(
        current,
        workInProgress,
        nextChildren,
        renderLanes,
        recoverableError
      );
    } else {
      // The outermost shell has not hydrated yet. Start hydrating.
      enterHydrationState(workInProgress);
      // if (enableUseMutableSource) {
      //   const mutableSourceEagerHydrationData =
      //     root.mutableSourceEagerHydrationData;
      //   if (mutableSourceEagerHydrationData != null) {
      //     for (let i = 0; i < mutableSourceEagerHydrationData.length; i += 2) {
      //       const mutableSource = ((mutableSourceEagerHydrationData[
      //         i
      //       ]: any): MutableSource<any>);
      //       const version = mutableSourceEagerHydrationData[i + 1];
      //       setWorkInProgressVersion(mutableSource, version);
      //     }
      //   }
      // }

      const child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
      workInProgress.child = child;

      let node = child;
      while (node) {
        // Mark each child as hydrating. This is a fast path to know whether this
        // tree is part of a hydrating tree. This is used to determine if a child
        // node has fully mounted yet, and for scheduling event replaying.
        // Conceptually this is similar to Placement in that a new subtree is
        // inserted into the React tree here. It just happens to not need DOM
        // mutations because it already exists.
        node.flags = (node.flags & ~Placement) | Hydrating;
        node = node.sibling;
      }
    }
  } else {
    // Root is not dehydrated. Either this is a client-only root, or it
    // already hydrated.
    resetHydrationState();
    if (nextChildren === prevChildren) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
    reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  }
  return workInProgress.child;
}

function mountHostRootWithoutHydrating(
  current: Fiber,
  workInProgress: Fiber,
  nextChildren: ReactNodeList,
  renderLanes: Lanes,
  recoverableError: CapturedValue<any>
) {
  // Revert to client rendering.
  resetHydrationState();

  queueHydrationError(recoverableError);

  workInProgress.flags |= ForceClientRender;

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostComponent(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes) {
  pushHostContext(workInProgress);

  if (current === null) {
    tryToClaimNextHydratableInstance(workInProgress);
  }

  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;

  let nextChildren = nextProps.children;
  const isDirectTextChild = shouldSetTextContent(type, nextProps);

  if (isDirectTextChild) {
    // We special case a direct text child of a host node. This is a common
    // case. We won't handle it as a reified child. We will instead handle
    // this in the host environment that also has access to this prop. That
    // avoids allocating another HostText fiber and traversing it.
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    // If we're switching from a direct text child to a normal child, or to
    // empty, we need to schedule the text content to be reset.
    workInProgress.flags |= ContentReset;
  }

  markRef(current, workInProgress);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostText(current: null | Fiber, workInProgress: Fiber) {
  if (current === null) {
    tryToClaimNextHydratableInstance(workInProgress);
  }
  // Nothing to do here. This is terminal. We'll do the completion step
  // immediately after.
  return null;
}

function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  if (current !== null) {
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies;
  }

  // if (enableProfilerTimer) {
  //   // Don't update "base" render times for bailouts.
  //   stopProfilerTimerIfRunning(workInProgress);
  // }

  markSkippedUpdateLanes(workInProgress.lanes);

  // Check if the children have any pending work.
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // The children don't have any work either. We can skip them.
    // TODO: Once we add back resuming, we should check if the children are
    // a work-in-progress set. If so, we need to transfer their effects.
    // if (enableLazyContextPropagation && current !== null) {
    //   // Before bailing out, check if there are any context changes in
    //   // the children.
    //   lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
    //   if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    //     return null;
    //   }
    // } else {
    //   return null;
    // }
  }

  // This fiber doesn't have work, but its subtree does. Clone the child
  // fibers and continue.
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

function resetSuspendedCurrentOnMountInLegacyMode(current: Fiber | null, workInProgress: Fiber) {
  if ((workInProgress.mode & ConcurrentMode) === NoMode) {
    if (current !== null) {
      // A lazy component only mounts if it suspended inside a non-
      // concurrent tree, in an inconsistent state. We want to treat it like
      // a new mount, even though an empty version of it already committed.
      // Disconnect the alternate pointers.
      current.alternate = null;
      workInProgress.alternate = null;
      // Since this is conceptually a new fiber, schedule a Placement effect
      workInProgress.flags |= Placement;
    }
  }
}

export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}

export { beginWork };
