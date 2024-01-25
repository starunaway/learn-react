import { Fiber } from './ReactInternalTypes';
import { createCursor, push, pop, StackCursor } from './ReactFiberStack';
import { disableLegacyContext } from '../shared/ReactFeatureFlags';

export const emptyContextObject = {};

// A cursor to the current merged context object on the stack.
const contextStackCursor: StackCursor<Object | null> = createCursor(emptyContextObject);

// A cursor to a boolean indicating whether the context has changed.
const didPerformWorkStackCursor: StackCursor<boolean | null> = createCursor(false);

// Keep track of the previous context object that was on the stack.
// We use this to get access to the parent context after we have already
// pushed the next context provider, and now need to merge their contexts.
let previousContext: Object | null = emptyContextObject;

function popTopLevelContextObject(fiber: Fiber): void {
  pop(didPerformWorkStackCursor, fiber);
  pop(contextStackCursor, fiber);
}

function hasContextChanged(): boolean {
  return !!didPerformWorkStackCursor.current;
}

function isContextProvider(type: Function & { childContextTypes?: any }): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    const childContextTypes = type.childContextTypes;
    return childContextTypes !== null && childContextTypes !== undefined;
  }
}

function pushTopLevelContextObject(fiber: Fiber, context: Object, didChange: boolean): void {
  if (disableLegacyContext) {
    return;
  } else {
    if (contextStackCursor.current !== emptyContextObject) {
      throw new Error(
        'Unexpected context found on stack. ' +
          'This error is likely caused by a bug in React. Please file an issue.'
      );
    }

    push(contextStackCursor, context, fiber);
    push(didPerformWorkStackCursor, didChange, fiber);
  }
}

function pushContextProvider(workInProgress: Fiber): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    const instance = workInProgress.stateNode;
    // We push the context as early as possible to ensure stack integrity.
    // If the instance does not exist yet, we will push null at first,
    // and replace it on the stack later when invalidating the context.
    const memoizedMergedChildContext =
      (instance && instance.__reactInternalMemoizedMergedChildContext) || emptyContextObject;

    // Remember the parent context so we can merge with it later.
    // Inherit the parent's did-perform-work value to avoid inadvertently blocking updates.
    previousContext = contextStackCursor.current;
    push(contextStackCursor, memoizedMergedChildContext, workInProgress);
    push(didPerformWorkStackCursor, didPerformWorkStackCursor.current, workInProgress);

    return true;
  }
}

function getUnmaskedContext(
  workInProgress: Fiber,
  Component: Function,
  didPushOwnContextIfProvider: boolean
): Record<string | number | symbol, any> {
  if (disableLegacyContext) {
    return emptyContextObject;
  } else {
    if (didPushOwnContextIfProvider && isContextProvider(Component)) {
      // If the fiber is a context provider itself, when we read its context
      // we may have already pushed its own child context on the stack. A context
      // provider should not "see" its own child context. Therefore we read the
      // previous (parent) context instead for a context provider.
      return previousContext!;
    }
    return contextStackCursor.current!;
  }
}

function cacheContext(
  workInProgress: Fiber,
  unmaskedContext: Record<string | number | symbol, any>,
  maskedContext: Record<string | number | symbol, any>
): void {
  if (disableLegacyContext) {
    return;
  } else {
    const instance = workInProgress.stateNode;
    instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
    instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
  }
}

function getMaskedContext(
  workInProgress: Fiber,
  unmaskedContext: Record<string | number | symbol, any>
): Object {
  if (disableLegacyContext) {
    return emptyContextObject;
  } else {
    const type = workInProgress.type;
    const contextTypes = type.contextTypes;
    if (!contextTypes) {
      return emptyContextObject;
    }

    // Avoid recreating masked context unless unmasked context has changed.
    // Failing to do this will result in unnecessary calls to componentWillReceiveProps.
    // This may trigger infinite loops if componentWillReceiveProps calls setState.
    const instance = workInProgress.stateNode;
    if (instance && instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext) {
      return instance.__reactInternalMemoizedMaskedChildContext;
    }

    const context: Record<string | number | symbol, any> = {};
    for (const key in contextTypes) {
      context[key] = unmaskedContext[key];
    }

    // Cache unmasked context so we can avoid recreating masked context unless necessary.
    // Context is created before the class component is instantiated so check for instance.
    if (instance) {
      cacheContext(workInProgress, unmaskedContext, context);
    }

    return context;
  }
}

export {
  popTopLevelContextObject,
  hasContextChanged,
  pushTopLevelContextObject,
  isContextProvider,
  pushContextProvider,
  getUnmaskedContext,
  getMaskedContext,
};
