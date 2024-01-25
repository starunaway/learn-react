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

export {
  popTopLevelContextObject,
  hasContextChanged,
  pushTopLevelContextObject,
  isContextProvider,
  pushContextProvider,
};
