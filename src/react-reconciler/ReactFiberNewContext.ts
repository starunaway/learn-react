import { REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED } from '../shared/ReactSymbols';
import { ReactContext } from '../shared/ReactTypes';
import { ContextDependency, Fiber } from './ReactInternalTypes';
import type { StackCursor } from './ReactFiberStack';
import { createCursor, push, pop } from './ReactFiberStack';
import { isPrimaryRenderer } from '../react-dom/ReactFiberHostConfig';
import { enableLazyContextPropagation, enableServerContext } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { NoLanes } from './ReactFiberLane';

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
