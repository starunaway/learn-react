import { REACT_SERVER_CONTEXT_DEFAULT_VALUE_NOT_LOADED } from '../shared/ReactSymbols';
import { ReactContext } from '../shared/ReactTypes';
import { Fiber } from './ReactInternalTypes';
import type { StackCursor } from './ReactFiberStack';
import { createCursor, push, pop } from './ReactFiberStack';
import { isPrimaryRenderer } from '../react-dom/ReactFiberHostConfig';
import { enableServerContext } from '../shared/ReactFeatureFlags';

const valueCursor: StackCursor<any> = createCursor<any>(null);

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
