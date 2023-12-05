import { ReactContext } from '@/shared/ReactTypes';
import { Lanes, NoLanes, includesSomeLane } from './ReactFiberLane';
import { isPrimaryRenderer } from './ReactFiberHostConfig';
import { ContextDependency, Fiber } from './ReactInternalTypes';
import { markWorkInProgressReceivedUpdate } from './ReactFiberBeginWork';

let currentlyRenderingFiber: Fiber | null = null;
let lastContextDependency: ContextDependency<any> | null = null;
let lastFullyObservedContext: ReactContext<any> | null = null;

export function readContext<T>(context: ReactContext<T>): T {
  const value = isPrimaryRenderer ? context._currentValue : context._currentValue2;

  if (lastFullyObservedContext === context) {
    // Nothing to do. We already observe everything in this context.
  } else {
    const contextItem = {
      context,
      memoizedValue: value,
      next: null,
    };

    if (lastContextDependency === null) {
      if (currentlyRenderingFiber === null) {
        throw new Error(
          'Context can only be read while React is rendering. ' +
            'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
            'In function components, you can read it directly in the function body, but not ' +
            'inside Hooks like useReducer() or useMemo().'
        );
      }

      // This is the first dependency for this component. Create a new list.
      lastContextDependency = contextItem;
      currentlyRenderingFiber.dependencies = {
        lanes: NoLanes,
        firstContext: contextItem,
      };
      //    特性，暂时不看
      //   if (enableLazyContextPropagation) {
      //     currentlyRenderingFiber.flags |= NeedsPropagation;
      //   }
    } else {
      // Append a new context item.
      lastContextDependency = lastContextDependency.next = contextItem;
    }
  }
  return value;
}

export function resetContextDependencies(): void {
  // This is called right before React yields execution, to ensure `readContext`
  // cannot be called outside the render phase.
  currentlyRenderingFiber = null;
  lastContextDependency = null;
  lastFullyObservedContext = null;
  // if (__DEV__) {
  //   isDisallowedContextReadInDEV = false;
  // }
}

export function prepareToReadContext(workInProgress: Fiber, renderLanes: Lanes): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;
  lastFullyObservedContext = null;

  const dependencies = workInProgress.dependencies;
  if (dependencies !== null) {
    // if (enableLazyContextPropagation) {
    //   // Reset the work-in-progress list
    //   dependencies.firstContext = null;
    // } else {
    const firstContext = dependencies.firstContext;
    if (firstContext !== null) {
      if (includesSomeLane(dependencies.lanes, renderLanes)) {
        // Context list has a pending update. Mark that this fiber performed work.
        markWorkInProgressReceivedUpdate();
      }
      // Reset the work-in-progress list
      dependencies.firstContext = null;
    }
  }
  // }
}
