import { REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED } from '../shared/ReactSymbols';
import { ReactContext } from '../shared/ReactTypes';
import { ContextDependency, Fiber } from './ReactInternalTypes';
import type { StackCursor } from './ReactFiberStack';
import { createCursor, push, pop } from './ReactFiberStack';
import { isPrimaryRenderer } from '../react-dom/ReactFiberHostConfig';
import { enableLazyContextPropagation, enableServerContext } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { Lanes, NoLanes } from './ReactFiberLane';
import { Flags } from './ReactFiberFlags';
import { WorkTag } from './ReactWorkTags';

const valueCursor: StackCursor<any> = createCursor<any>(null);

let rendererSigil;

let currentlyRenderingFiber: Fiber | null = null;
let lastContextDependency: ContextDependency<any> | null = null;
let lastFullyObservedContext: ReactContext<any> | null = null;

let isDisallowedContextReadInDEV: boolean = false;

export function resetContextDependencies(): void {
  // This is called right before React yields execution, to ensure `readContext`
  // cannot be called outside the render phase.
  currentlyRenderingFiber = null;
  lastContextDependency = null;
  lastFullyObservedContext = null;
}

export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T
): void {
  if (isPrimaryRenderer) {
    push(valueCursor, context._currentValue, providerFiber);

    context._currentValue = nextValue;
  } else {
    push(valueCursor, context._currentValue2, providerFiber);

    context._currentValue2 = nextValue;
  }
}

export function popProvider(context: ReactContext<any>, providerFiber: Fiber): void {
  const currentValue = valueCursor.current;
  pop(valueCursor, providerFiber);
  if (isPrimaryRenderer) {
    if (enableServerContext && currentValue === REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED) {
      context._currentValue = context._defaultValue;
    } else {
      context._currentValue = currentValue;
    }
  } else {
    if (enableServerContext && currentValue === REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED) {
      context._currentValue2 = context._defaultValue;
    } else {
      context._currentValue2 = currentValue;
    }
  }
}

export function readContext<T>(context: ReactContext<T>): T | null {
  // if (__DEV__) {
  //   // This warning would fire if you read context inside a Hook like useMemo.
  //   // Unlike the class check below, it's not enforced in production for perf.
  //   if (isDisallowedContextReadInDEV) {
  //     console.error(
  //       'Context can only be read while React is rendering. ' +
  //         'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
  //         'In function components, you can read it directly in the function body, but not ' +
  //         'inside Hooks like useReducer() or useMemo().',
  //     );
  //   }
  // }

  const value = isPrimaryRenderer ? context._currentValue : context._currentValue2;

  if (lastFullyObservedContext === context) {
    // Nothing to do. We already observe everything in this context.
  } else {
    const contextItem = {
      context: context as ReactContext<any>,
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
    } else {
      // Append a new context item.
      lastContextDependency = lastContextDependency.next = contextItem;
    }
  }
  return value;
}

// read:将父级上下文的变更向下传播给它们的子级
function propagateParentContextChanges(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes,
  forcePropagateEntireTree: boolean
) {
  // read: 这里没有开启特性，直接跳过去了
  if (!enableLazyContextPropagation) {
    return;
  }

  /*
  // Collect all the parent providers that changed. Since this is usually small
  // number, we use an Array instead of Set.
  let contexts = null;
  let parent = workInProgress;
  let isInsidePropagationBailout = false;
  while (parent !== null) {
    if (!isInsidePropagationBailout) {
      if ((parent.flags & Flags.NeedsPropagation) !== Flags.NoFlags) {
        isInsidePropagationBailout = true;
      } else if ((parent.flags & Flags.DidPropagateContext) !== Flags.NoFlags) {
        break;
      }
    }

    if (parent.tag === WorkTag.ContextProvider) {
      const currentParent = parent.alternate;

      if (currentParent === null) {
        throw new Error('Should have a current fiber. This is a bug in React.');
      }

      const oldProps = currentParent.memoizedProps;
      if (oldProps !== null) {
        const providerType: ReactProviderType<any> = parent.type;
        const context: ReactContext<any> = providerType._context;

        const newProps = parent.pendingProps;
        const newValue = newProps.value;

        const oldValue = oldProps.value;

        if (!Object.is(newValue, oldValue)) {
          if (contexts !== null) {
            contexts.push(context);
          } else {
            contexts = [context];
          }
        }
      }
    }
    parent = parent.return;
  }
  // read 找到所有父级变化的 context
  if (contexts !== null) {
    // If there were any changed providers, search through the children and
    // propagate their changes.
    // read: propagate(传播到所有的子级)
    propagateContextChanges(workInProgress, contexts, renderLanes, forcePropagateEntireTree);
  }

  // This is an optimization so that we only propagate once per subtree. If a
  // deeply nested child bails out, and it calls this propagation function, it
  // uses this flag to know that the remaining ancestor providers have already
  // been propagated.
  //
  // NOTE: This optimization is only necessary because we sometimes enter the
  // begin phase of nodes that don't have any work scheduled on them —
  // specifically, the siblings of a node that _does_ have scheduled work. The
  // siblings will bail out and call this function again, even though we already
  // propagated content changes to it and its subtree. So we use this flag to
  // mark that the parent providers already propagated.
  //
  // Unfortunately, though, we need to ignore this flag when we're inside a
  // tree whose context propagation was deferred — that's what the
  // `NeedsPropagation` flag is for.
  //
  // If we could instead bail out before entering the siblings' begin phase,
  // then we could remove both `DidPropagateContext` and `NeedsPropagation`.
  // Consider this as part of the next refactor to the fiber tree structure.
  workInProgress.flags |= Flags.DidPropagateContext;


  */
}

export function lazilyPropagateParentContextChanges(
  current: Fiber,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const forcePropagateEntireTree = false;
  propagateParentContextChanges(current, workInProgress, renderLanes, forcePropagateEntireTree);
}
