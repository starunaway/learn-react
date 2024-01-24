import { Fiber } from './ReactInternalTypes';
import { createCursor, push, pop, StackCursor } from './ReactFiberStack';

export const emptyContextObject = {};

// A cursor to the current merged context object on the stack.
const contextStackCursor: StackCursor<Object | null> = createCursor(emptyContextObject);

// A cursor to a boolean indicating whether the context has changed.
const didPerformWorkStackCursor: StackCursor<boolean | null> = createCursor(false);

// Keep track of the previous context object that was on the stack.
// We use this to get access to the parent context after we have already
// pushed the next context provider, and now need to merge their contexts.
let previousContext: Object = emptyContextObject;

function popTopLevelContextObject(fiber: Fiber): void {
  pop(didPerformWorkStackCursor, fiber);
  pop(contextStackCursor, fiber);
}

export { popTopLevelContextObject };
