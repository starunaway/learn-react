import {
  enableCache,
  enableLazyContextPropagation,
  enableLegacyHidden,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableScopeAPI,
  enableTransitionTracing,
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
  // pushTopLevelContextObject,
  // invalidateContextProvider,
} from './ReactFiberContext';
import { ReactContext } from '../shared/ReactTypes';
import { lazilyPropagateParentContextChanges, pushProvider } from './ReactFiberNewContext';
import { pushHostContainer, pushHostContext } from './ReactFiberHostContext';
import { pushRootTransition } from './ReactFiberTransition';
import { pushCacheProvider } from './ReactFiberCacheComponent';

import { getIsHydrating, resetHydrationState } from './ReactFiberHydrationContext';
import { markSkippedUpdateLanes } from './ReactFiberWorkLoop';
import { stopProfilerTimerIfRunning } from './ReactProfilerTimer';
import { cloneChildFibers } from './ReactChildFiber';

let didReceiveUpdate: boolean = false;

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
      return mountIndeterminateComponent(current, workInProgress, workInProgress.type, renderLanes);
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
    case WorkTag.ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(current, workInProgress, Component, resolvedProps, renderLanes);
    }
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
    case WorkTag.ContextConsumer:
      return updateContextConsumer(current, workInProgress, renderLanes);
    case WorkTag.MemoComponent: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      // Resolve outer props first, then resolve inner props.
      let resolvedProps = resolveDefaultProps(type, unresolvedProps);

      resolvedProps = resolveDefaultProps(type.type, resolvedProps);
      return updateMemoComponent(current, workInProgress, type, resolvedProps, renderLanes);
    }
    case WorkTag.SimpleMemoComponent: {
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes
      );
    }
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