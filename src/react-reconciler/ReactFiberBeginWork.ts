import {
  disableLegacyContext,
  disableModulePatternComponents,
  enableCache,
  enableLazyContextPropagation,
  enableLegacyHidden,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableSchedulingProfiler,
  enableScopeAPI,
  enableSuspenseLayoutEffectSemantics,
  enableTransitionTracing,
  enableUseMutableSource,
} from '../shared/ReactFeatureFlags';
import { Flags } from './ReactFiberFlags';
import { Lanes, NoLanes, includesSomeLane } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { WorkTag } from './ReactWorkTags';
import type { Cache } from './ReactFiberCacheComponent';
import {
  // getMaskedContext,
  // getUnmaskedContext,
  hasContextChanged as hasLegacyContextChanged,
  pushTopLevelContextObject,
  pushContextProvider as pushLegacyContextProvider,
  isContextProvider as isLegacyContextProvider,
  getUnmaskedContext,
  getMaskedContext,
  // pushTopLevelContextObject,
  // invalidateContextProvider,
} from './ReactFiberContext';
import { ReactContext, ReactNodeList, ReactProviderType } from '../shared/ReactTypes';
import {
  lazilyPropagateParentContextChanges,
  prepareToReadContext,
  propagateContextChange,
  pushProvider,
} from './ReactFiberNewContext';
import { pushHostContainer, pushHostContext } from './ReactFiberHostContext';
import { pushRootTransition } from './ReactFiberTransition';
import { CacheContext, pushCacheProvider } from './ReactFiberCacheComponent';

import {
  getIsHydrating,
  queueHydrationError,
  resetHydrationState,
  tryToClaimNextHydratableInstance,
} from './ReactFiberHydrationContext';
import { markSkippedUpdateLanes } from './ReactFiberWorkLoop';
import { stopProfilerTimerIfRunning } from './ReactProfilerTimer';
import { cloneChildFibers, mountChildFibers, reconcileChildFibers } from './ReactChildFiber';

import {
  getForksAtLevel,
  isForkedChild,
  pushMaterializedTreeId,
  pushTreeId,
} from './ReactFiberTreeContext';
import { TypeOfMode } from './ReactTypeOfMode';
import { bailoutHooks, checkDidRenderIdHook, renderWithHooks } from './ReactFiberHooks';
import {
  UpdateQueue,
  cloneUpdateQueue,
  initializeUpdateQueue,
  processUpdateQueue,
} from './ReactFiberClassUpdateQueue';
import { resolveDefaultProps } from './ReactFiberLazyComponent';
import { RootState } from './ReactFiberRoot';
import { shouldSetTextContent, supportsHydration } from '../react-dom/ReactFiberHostConfig';
import { CapturedValue, createCapturedValueAtFiber } from './ReactCapturedValue';

let didReceiveUpdate: boolean = false;

// 288
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  console.log('reconcileChildren current is:', current, 'workInProgress is:', workInProgress);
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

// 937
function markRef(current: Fiber | null, workInProgress: Fiber) {
  const ref = workInProgress.ref;
  if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
    // Schedule a Ref effect
    workInProgress.flags |= Flags.Ref;
    if (enableSuspenseLayoutEffectSemantics) {
      workInProgress.flags |= Flags.RefStatic;
    }
  }
}
// 961
function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  console.log('updateFunctionComponent Component:', Component);
  let context;
  if (!disableLegacyContext) {
    const unmaskedContext = getUnmaskedContext(workInProgress, Component, true);
    context = getMaskedContext(workInProgress, unmaskedContext);
  }

  let nextChildren;
  let hasId;
  prepareToReadContext(workInProgress, renderLanes);
  // read: 这是给 devtool 用的
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStarted(workInProgress);
  // }

  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes
  );
  hasId = checkDidRenderIdHook();
  // read: 这是给 devtool 用的
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
  workInProgress.flags |= Flags.PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

//1263
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
//1278
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
  // read: 用不到,特性未开启
  // const root: FiberRoot = workInProgress.stateNode;
  // pushRootTransition(workInProgress, root, renderLanes);

  if (enableCache) {
    const nextCache: Cache = nextState.cache!;
    pushCacheProvider(workInProgress, nextCache);
    if (nextCache !== prevState.cache) {
      // The root cache refreshed.
      propagateContextChange(workInProgress, CacheContext, renderLanes);
    }
  }

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
    const updateQueue: UpdateQueue<RootState> = workInProgress.updateQueue!;
    // `baseState` can always be the last state because the root doesn't
    // have reducer functions so it doesn't need rebasing.
    updateQueue.baseState = overrideState;
    workInProgress.memoizedState = overrideState;

    if (workInProgress.flags & Flags.ForceClientRender) {
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
      console.error('这里是 ssr 相关的逻辑，没有实现。如果走到这里，需要实现');
      // enterHydrationState(workInProgress);

      // const child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
      // workInProgress.child = child;

      // let node = child;
      // while (node) {
      //   // Mark each child as hydrating. This is a fast path to know whether this
      //   // tree is part of a hydrating tree. This is used to determine if a child
      //   // node has fully mounted yet, and for scheduling event replaying.
      //   // Conceptually this is similar to Placement in that a new subtree is
      //   // inserted into the React tree here. It just happens to not need DOM
      //   // mutations because it already exists.
      //   node.flags = (node.flags & ~Flags.Placement) | Flags.Hydrating;
      //   node = node.sibling;
      // }
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

// 1408
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

  workInProgress.flags |= Flags.ForceClientRender;

  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

// 1426
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
  console.log('如果可以直接更新 dom，比如是 string 或 number 类型的 children', isDirectTextChild);
  console.log('current is :', current, 'workInProgress is:', workInProgress);
  if (isDirectTextChild) {
    // We special case a direct text child of a host node. This is a common
    // case. We won't handle it as a reified child. We will instead handle
    // this in the host environment that also has access to this prop. That
    // avoids allocating another HostText fiber and traversing it.
    nextChildren = null;
  } else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    // If we're switching from a direct text child to a normal child, or to
    // empty, we need to schedule the text content to be reset.
    workInProgress.flags |= Flags.ContentReset;
  }

  markRef(current, workInProgress);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostText(current: Fiber | null, workInProgress: Fiber) {
  if (current === null) {
    tryToClaimNextHydratableInstance(workInProgress);
  }
  // Nothing to do here. This is terminal. We'll do the completion step
  // immediately after.
  return null;
}

// 1618
function mountIndeterminateComponent(
  _current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  renderLanes: Lanes
) {
  resetSuspendedCurrentOnMountInLegacyMode(_current, workInProgress);

  const props = workInProgress.pendingProps;
  let context;
  if (!disableLegacyContext) {
    const unmaskedContext = getUnmaskedContext(workInProgress, Component, false);
    context = getMaskedContext(workInProgress, unmaskedContext);
  }

  prepareToReadContext(workInProgress, renderLanes);
  let value;
  let hasId;

  // read: devtools 才使用
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStarted(workInProgress);
  // }

  value = renderWithHooks(null, workInProgress, Component, props, context, renderLanes);
  console.log('renderWithHooks 的返回值应该就是组件的 return 结果， 是个 ReactElement：', value);
  hasId = checkDidRenderIdHook();
  // read: devtools 才使用
  // if (enableSchedulingProfiler) {
  //   markComponentRenderStopped();
  // }

  // React DevTools reads this flag.
  workInProgress.flags |= Flags.PerformedWork;

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.render === 'function' &&
    value.$$typeof === undefined
  ) {
    console.error('这里是类组件，讲道理FC 的逻辑不会走到这里。如果走到这里，需要补齐逻辑了');
    // // Proceed under the assumption that this is a class instance
    // workInProgress.tag = WorkTag.ClassComponent;

    // // Throw out any hooks that were used.
    // workInProgress.memoizedState = null;
    // workInProgress.updateQueue = null;

    // // Push context providers early to prevent context stack mismatches.
    // // During mounting we don't know the child context yet as the instance doesn't exist.
    // // We will invalidate the child context in finishClassComponent() right after rendering.
    // let hasContext = false;
    // if (isLegacyContextProvider(Component)) {
    //   hasContext = true;
    //   pushLegacyContextProvider(workInProgress);
    // } else {
    //   hasContext = false;
    // }

    // workInProgress.memoizedState =
    //   value.state !== null && value.state !== undefined ? value.state : null;

    // initializeUpdateQueue(workInProgress);

    // adoptClassInstance(workInProgress, value);
    // mountClassInstance(workInProgress, Component, props, renderLanes);
    // return finishClassComponent(null, workInProgress, Component, true, hasContext, renderLanes);
  } else {
    // Proceed under the assumption that this is a function component
    workInProgress.tag = WorkTag.FunctionComponent;

    if (getIsHydrating() && hasId) {
      pushMaterializedTreeId(workInProgress);
    }

    reconcileChildren(null, workInProgress, value, renderLanes);

    return workInProgress.child;
  }
}

// 3185
function updateContextProvider(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes) {
  const providerType: ReactProviderType<any> = workInProgress.type;
  const context: ReactContext<any> = providerType._context;

  const newProps = workInProgress.pendingProps;
  const oldProps = workInProgress.memoizedProps;

  const newValue = newProps.value;

  pushProvider(workInProgress, context, newValue);

  if (enableLazyContextPropagation) {
    // In the lazy propagation implementation, we don't scan for matching
    // consumers until something bails out, because until something bails out
    // we're going to visit those nodes, anyway. The trade-off is that it shifts
    // responsibility to the consumer to track whether something has changed.
  } else {
    if (oldProps !== null) {
      const oldValue = oldProps.value;
      if (Object.is(oldValue, newValue)) {
        // No change. Bailout early if children are the same.
        if (oldProps.children === newProps.children && !hasLegacyContextChanged()) {
          return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
        }
      } else {
        // The context value changed. Search for matching consumers and schedule
        // them to update.
        propagateContextChange(workInProgress, context, renderLanes);
      }
    }
  }

  const newChildren = newProps.children;
  reconcileChildren(current, workInProgress, newChildren, renderLanes);
  return workInProgress.child;
}

// 3328
export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}

export function checkIfWorkInProgressReceivedUpdate() {
  return didReceiveUpdate;
}

// 3336
// read:如果工作进展的模式与并发模式无关，则会执行某些操作。
// 如果当前组件不为空，则会断开当前组件和工作进展的交替指针，并将工作进展的标志设置为Placement
function resetSuspendedCurrentOnMountInLegacyMode(current: Fiber | null, workInProgress: Fiber) {
  if ((workInProgress.mode & TypeOfMode.ConcurrentMode) === TypeOfMode.NoMode) {
    if (current !== null) {
      // A lazy component only mounts if it suspended inside a non-
      // concurrent tree, in an inconsistent state. We want to treat it like
      // a new mount, even though an empty version of it already committed.
      // Disconnect the alternate pointers.
      current.alternate = null;
      workInProgress.alternate = null;
      // Since this is conceptually a new fiber, schedule a Placement effect
      workInProgress.flags |= Flags.Placement;
    }
  }
}
// 3351
function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  console.log('组件没有待处理的工作，尽早返回');
  if (current !== null) {
    // Reuse previous dependencies
    workInProgress.dependencies = current.dependencies;
  }

  if (enableProfilerTimer) {
    // Don't update "base" render times for bailouts.
    stopProfilerTimerIfRunning(workInProgress);
  }

  markSkippedUpdateLanes(workInProgress.lanes);

  // Check if the children have any pending work.
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // The children don't have any work either. We can skip them.
    // TODO: Once we add back resuming, we should check if the children are
    // a work-in-progress set. If so, we need to transfer their effects.

    if (enableLazyContextPropagation && current !== null) {
      // Before bailing out, check if there are any context changes in
      // the children.
      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
        return null;
      }
    } else {
      return null;
    }
  }

  // This fiber doesn't have work, but its subtree does. Clone the child
  // fibers and continue.
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

// 3456
function checkScheduledUpdateOrContext(current: Fiber, renderLanes: Lanes): boolean {
  // Before performing an early bailout, we must check if there are pending
  // updates or context.
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) {
    return true;
  }
  // No pending update, but because context is propagated lazily, we need
  // to check for a context change before we bail out.
  // 特性默认是关闭的
  // if (enableLazyContextPropagation) {
  //   const dependencies = current.dependencies;
  //   if (dependencies !== null && checkIfContextChanged(dependencies)) {
  //     return true;
  //   }
  // }
  return false;
}

//3477
// read: 如果组件没有待处理的工作
function attemptEarlyBailoutIfNoScheduledUpdate(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  // This fiber does not have any pending work. Bailout without entering
  // the begin phase. There's still some bookkeeping we that needs to be done
  // in this optimized path, mostly pushing stuff onto the stack.
  switch (workInProgress.tag) {
    case WorkTag.HostRoot:
      pushHostRootContext(workInProgress);
      const root: FiberRoot = workInProgress.stateNode;
      // read: 特性不支持
      // pushRootTransition(workInProgress, root, renderLanes);

      if (enableCache) {
        const cache: Cache = current.memoizedState.cache;
        pushCacheProvider(workInProgress, cache);
      }
      resetHydrationState();
      break;
    case WorkTag.HostComponent:
      pushHostContext(workInProgress);
      break;
    case WorkTag.ClassComponent: {
      const Component = workInProgress.type;
      if (isLegacyContextProvider(Component)) {
        pushLegacyContextProvider(workInProgress);
      }
      break;
    }
    case WorkTag.HostPortal:
      pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
      break;
    case WorkTag.ContextProvider: {
      const newValue = workInProgress.memoizedProps.value;
      const context: ReactContext<any> = workInProgress.type._context;
      pushProvider(workInProgress, context, newValue);
      break;
    }
    case WorkTag.Profiler:
      console.error('WorkTag.Profiler  暂时应该走不到这里，先不看');

      // if (enableProfilerTimer) {
      //   // Profiler should only call onRender when one of its descendants actually rendered.
      //   const hasChildWork = includesSomeLane(
      //     renderLanes,
      //     workInProgress.childLanes,
      //   );
      //   if (hasChildWork) {
      //     workInProgress.flags |= Update;
      //   }

      //   if (enableProfilerCommitHooks) {
      //     // Reset effect durations for the next eventual effect phase.
      //     // These are reset during render to allow the DevTools commit hook a chance to read them,
      //     const stateNode = workInProgress.stateNode;
      //     stateNode.effectDuration = 0;
      //     stateNode.passiveEffectDuration = 0;
      //   }
      // }
      break;
    case WorkTag.SuspenseComponent: {
      console.error('WorkTag.SuspenseComponent  暂时应该走不到这里，先不看');

      // const state: SuspenseState | null = workInProgress.memoizedState;
      // if (state !== null) {
      //   if (state.dehydrated !== null) {
      //     pushSuspenseContext(
      //       workInProgress,
      //       setDefaultShallowSuspenseContext(suspenseStackCursor.current),
      //     );
      //     // We know that this component will suspend again because if it has
      //     // been unsuspended it has committed as a resolved Suspense component.
      //     // If it needs to be retried, it should have work scheduled on it.
      //     workInProgress.flags |= DidCapture;
      //     // We should never render the children of a dehydrated boundary until we
      //     // upgrade it. We return null instead of bailoutOnAlreadyFinishedWork.
      //     return null;
      //   }

      //   // If this boundary is currently timed out, we need to decide
      //   // whether to retry the primary children, or to skip over it and
      //   // go straight to the fallback. Check the priority of the primary
      //   // child fragment.
      //   const primaryChildFragment: Fiber = (workInProgress.child: any);
      //   const primaryChildLanes = primaryChildFragment.childLanes;
      //   if (includesSomeLane(renderLanes, primaryChildLanes)) {
      //     // The primary children have pending work. Use the normal path
      //     // to attempt to render the primary children again.
      //     return updateSuspenseComponent(current, workInProgress, renderLanes);
      //   } else {
      //     // The primary child fragment does not have pending work marked
      //     // on it
      //     pushSuspenseContext(
      //       workInProgress,
      //       setDefaultShallowSuspenseContext(suspenseStackCursor.current),
      //     );
      //     // The primary children do not have pending work with sufficient
      //     // priority. Bailout.
      //     const child = bailoutOnAlreadyFinishedWork(
      //       current,
      //       workInProgress,
      //       renderLanes,
      //     );
      //     if (child !== null) {
      //       // The fallback children have pending work. Skip over the
      //       // primary children and work on the fallback.
      //       return child.sibling;
      //     } else {
      //       // Note: We can return `null` here because we already checked
      //       // whether there were nested context consumers, via the call to
      //       // `bailoutOnAlreadyFinishedWork` above.
      //       return null;
      //     }
      //   }
      // } else {
      //   pushSuspenseContext(
      //     workInProgress,
      //     setDefaultShallowSuspenseContext(suspenseStackCursor.current),
      //   );
      // }
      break;
    }
    case WorkTag.SuspenseListComponent: {
      console.error('WorkTag.SuspenseListComponent  暂时应该走不到这里，先不看');

      break;
      // const didSuspendBefore = (current.flags & DidCapture) !== NoFlags;

      // let hasChildWork = includesSomeLane(
      //   renderLanes,
      //   workInProgress.childLanes,
      // );

      // if (enableLazyContextPropagation && !hasChildWork) {
      //   // Context changes may not have been propagated yet. We need to do
      //   // that now, before we can decide whether to bail out.
      //   // TODO: We use `childLanes` as a heuristic for whether there is
      //   // remaining work in a few places, including
      //   // `bailoutOnAlreadyFinishedWork` and
      //   // `updateDehydratedSuspenseComponent`. We should maybe extract this
      //   // into a dedicated function.
      //   lazilyPropagateParentContextChanges(
      //     current,
      //     workInProgress,
      //     renderLanes,
      //   );
      //   hasChildWork = includesSomeLane(renderLanes, workInProgress.childLanes);
      // }

      // if (didSuspendBefore) {
      //   if (hasChildWork) {
      //     // If something was in fallback state last time, and we have all the
      //     // same children then we're still in progressive loading state.
      //     // Something might get unblocked by state updates or retries in the
      //     // tree which will affect the tail. So we need to use the normal
      //     // path to compute the correct tail.
      //     return updateSuspenseListComponent(
      //       current,
      //       workInProgress,
      //       renderLanes,
      //     );
      //   }
      //   // If none of the children had any work, that means that none of
      //   // them got retried so they'll still be blocked in the same way
      //   // as before. We can fast bail out.
      //   workInProgress.flags |= DidCapture;
      // }

      // // If nothing suspended before and we're rendering the same children,
      // // then the tail doesn't matter. Anything new that suspends will work
      // // in the "together" mode, so we can continue from the state we had.
      // const renderState = workInProgress.memoizedState;
      // if (renderState !== null) {
      //   // Reset to the "together" mode in case we've started a different
      //   // update in the past but didn't complete it.
      //   renderState.rendering = null;
      //   renderState.tail = null;
      //   renderState.lastEffect = null;
      // }
      // pushSuspenseContext(workInProgress, suspenseStackCursor.current);

      // if (hasChildWork) {
      //   break;
      // } else {
      //   // If none of the children had any work, that means that none of
      //   // them got retried so they'll still be blocked in the same way
      //   // as before. We can fast bail out.
      //   return null;
      // }
    }
    case WorkTag.OffscreenComponent:
    case WorkTag.LegacyHiddenComponent: {
      // Need to check if the tree still needs to be deferred. This is
      // almost identical to the logic used in the normal update path,
      // so we'll just enter that. The only difference is we'll bail out
      // at the next level instead of this one, because the child props
      // have not changed. Which is fine.
      // TODO: Probably should refactor `beginWork` to split the bailout
      // path from the normal path. I'm tempted to do a labeled break here
      // but I won't :)
      // read: 暂时应该走不到这里，先不看

      console.error(
        'WorkTag.OffscreenComponent WorkTag.LegacyHiddenComponent 暂时应该走不到这里，先不看'
      );

      break;
      // workInProgress.lanes = NoLanes;
      // return updateOffscreenComponent(current, workInProgress, renderLanes);
    }
    case WorkTag.CacheComponent: {
      if (enableCache) {
        const cache: Cache = current.memoizedState.cache;
        pushCacheProvider(workInProgress, cache);
      }
      break;
    }
  }
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}

function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes): Fiber | null {
  console.log('beginWork,current is:', current, 'workInProgress is:', workInProgress);
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
        (workInProgress.flags & Flags.DidCapture) === Flags.NoFlags
      ) {
        // No pending updates or context. Bail out now.
        didReceiveUpdate = false;
        console.info(
          '如果没有待处理的更新，则尽早返回: 调用attemptEarlyBailoutIfNoScheduledUpdate'
        );
        console.info('判断条件是当前 fiber 上是否有 lane');
        return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
      }
      if ((current.flags & Flags.ForceUpdateForLegacySuspense) !== Flags.NoFlags) {
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

    if (getIsHydrating() && isForkedChild(workInProgress)) {
      // Check if this child belongs to a list of muliple children in
      // its parent.
      //
      // In a true multi-threaded implementation, we would render children on
      // parallel threads. This would represent the beginning of a new render
      // thread for this subtree.
      //
      // We only use this for id generation during hydration, which is why the
      // logic is located in this special branch.
      const slotIndex = workInProgress.index;
      const numberOfForks = getForksAtLevel(workInProgress);
      pushTreeId(workInProgress, numberOfForks, slotIndex);
    }
  }

  // Before entering the begin phase, clear pending update priority.
  // TODO: This assumes that we're about to evaluate the component and process
  // the update queue. However, there's an exception: SimpleMemoComponent
  // sometimes bails out later in the begin phase. This indicates that we should
  // move this assignment out of the common path and into each branch.
  workInProgress.lanes = NoLanes;

  //read: 有部分类型，先不看，后面再补逻辑
  switch (workInProgress.tag) {
    case WorkTag.IndeterminateComponent: {
      console.log('begin 当前 Fiber 是 IndeterminateComponent');
      return mountIndeterminateComponent(
        current,
        workInProgress,
        workInProgress.type,
        renderLanes
      )!;
    }
    // case WorkTag.LazyComponent: {
    //   const elementType = workInProgress.elementType;
    //   return mountLazyComponent(current, workInProgress, elementType, renderLanes);
    // }
    case WorkTag.FunctionComponent: {
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
    // case WorkTag.ClassComponent: {
    //   const Component = workInProgress.type;
    //   const unresolvedProps = workInProgress.pendingProps;
    //   const resolvedProps =
    //     workInProgress.elementType === Component
    //       ? unresolvedProps
    //       : resolveDefaultProps(Component, unresolvedProps);
    //   return updateClassComponent(current, workInProgress, Component, resolvedProps, renderLanes);
    // }
    case WorkTag.HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case WorkTag.HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case WorkTag.HostText:
      return updateHostText(current, workInProgress);
    // case WorkTag.SuspenseComponent:
    //   return updateSuspenseComponent(current, workInProgress, renderLanes);
    // case WorkTag.HostPortal:
    //   return updatePortalComponent(current, workInProgress, renderLanes);
    // case WorkTag.ForwardRef: {
    //   const type = workInProgress.type;
    //   const unresolvedProps = workInProgress.pendingProps;
    //   const resolvedProps =
    //     workInProgress.elementType === type
    //       ? unresolvedProps
    //       : resolveDefaultProps(type, unresolvedProps);
    //   return updateForwardRef(current, workInProgress, type, resolvedProps, renderLanes);
    // }
    // case WorkTag.Fragment:
    //   return updateFragment(current, workInProgress, renderLanes);
    // case WorkTag.Mode:
    //   return updateMode(current, workInProgress, renderLanes);
    // case WorkTag.Profiler:
    //   return updateProfiler(current, workInProgress, renderLanes);
    case WorkTag.ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
    // case WorkTag.ContextConsumer:
    //   return updateContextConsumer(current, workInProgress, renderLanes);
    // case WorkTag.MemoComponent: {
    //   const type = workInProgress.type;
    //   const unresolvedProps = workInProgress.pendingProps;
    //   // Resolve outer props first, then resolve inner props.
    //   let resolvedProps = resolveDefaultProps(type, unresolvedProps);

    //   resolvedProps = resolveDefaultProps(type.type, resolvedProps);
    //   return updateMemoComponent(current, workInProgress, type, resolvedProps, renderLanes);
    // }
    // case WorkTag.SimpleMemoComponent: {
    //   return updateSimpleMemoComponent(
    //     current,
    //     workInProgress,
    //     workInProgress.type,
    //     workInProgress.pendingProps,
    //     renderLanes
    //   );
    // }
    // case WorkTag.IncompleteClassComponent: {
    //   const Component = workInProgress.type;
    //   const unresolvedProps = workInProgress.pendingProps;
    //   const resolvedProps =
    //     workInProgress.elementType === Component
    //       ? unresolvedProps
    //       : resolveDefaultProps(Component, unresolvedProps);
    //   return mountIncompleteClassComponent(
    //     current,
    //     workInProgress,
    //     Component,
    //     resolvedProps,
    //     renderLanes
    //   );
    // }
    // case WorkTag.SuspenseListComponent: {
    //   return updateSuspenseListComponent(current, workInProgress, renderLanes);
    // }
    // case WorkTag.ScopeComponent: {
    //   if (enableScopeAPI) {
    //     return updateScopeComponent(current, workInProgress, renderLanes);
    //   }
    //   break;
    // }
    // case WorkTag.OffscreenComponent: {
    //   return updateOffscreenComponent(current, workInProgress, renderLanes);
    // }
    // case WorkTag.LegacyHiddenComponent: {
    //   if (enableLegacyHidden) {
    //     return updateLegacyHiddenComponent(current, workInProgress, renderLanes);
    //   }
    //   break;
    // }
    // case WorkTag.CacheComponent: {
    //   if (enableCache) {
    //     return updateCacheComponent(current, workInProgress, renderLanes);
    //   }
    //   break;
    // }
    // case WorkTag.TracingMarkerComponent: {
    //   if (enableTransitionTracing) {
    //     return updateTracingMarkerComponent(current, workInProgress, renderLanes);
    //   }
    //   break;
    // }
  }

  console.error('有部分类型的 tag 没有实现，后续慢慢补齐');
  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      'React. Please file an issue.'
  );
}

export { beginWork };
