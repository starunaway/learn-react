import { Fiber } from './ReactInternalTypes';
import { StackCursor, createCursor, pop } from './ReactFiberStack';
import { Container, HostContext } from '../react-dom/ReactFiberHostConfig';

declare class NoContextT {}
const NO_CONTEXT: NoContextT = {} as any;

const contextStackCursor: StackCursor<HostContext | NoContextT | null> = createCursor(NO_CONTEXT);

const contextFiberStackCursor: StackCursor<Fiber | NoContextT | null> = createCursor(NO_CONTEXT);
const rootInstanceStackCursor: StackCursor<Container | NoContextT | null> =
  createCursor(NO_CONTEXT);

function popHostContainer(fiber: Fiber) {
  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
  pop(rootInstanceStackCursor, fiber);
}

function popHostContext(fiber: Fiber): void {
  // Do not pop unless this Fiber provided the current context.
  // pushHostContext() only pushes Fibers that provide unique contexts.
  if (contextFiberStackCursor.current !== fiber) {
    return;
  }

  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
}

export { popHostContainer, popHostContext };
