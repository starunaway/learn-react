import { Fiber } from './ReactInternalTypes';

const forkStack: Array<any> = [];
let forkStackIndex: number = 0;
let treeForkProvider: Fiber | null = null;
let treeForkCount: number = 0;

const idStack: Array<any> = [];
let idStackIndex: number = 0;
let treeContextProvider: Fiber | null = null;
let treeContextId: number = 1;
let treeContextOverflow: string = '';

export function popTreeContext(workInProgress: Fiber) {
  // Restore the previous values.

  // This is a bit more complicated than other context-like modules in Fiber
  // because the same Fiber may appear on the stack multiple times and for
  // different reasons. We have to keep popping until the work-in-progress is
  // no longer at the top of the stack.

  while (workInProgress === treeForkProvider) {
    treeForkProvider = forkStack[--forkStackIndex];
    forkStack[forkStackIndex] = null;
    treeForkCount = forkStack[--forkStackIndex];
    forkStack[forkStackIndex] = null;
  }

  while (workInProgress === treeContextProvider) {
    treeContextProvider = idStack[--idStackIndex];
    idStack[idStackIndex] = null;
    treeContextOverflow = idStack[--idStackIndex];
    idStack[idStackIndex] = null;
    treeContextId = idStack[--idStackIndex];
    idStack[idStackIndex] = null;
  }
}

export function pushTreeFork(workInProgress: Fiber, totalChildren: number): void {
  // This is called right after we reconcile an array (or iterator) of child
  // fibers, because that's the only place where we know how many children in
  // the whole set without doing extra work later, or storing addtional
  // information on the fiber.
  //
  // That's why this function is separate from pushTreeId — it's called during
  // the render phase of the fork parent, not the child, which is where we push
  // the other context values.
  //
  // In the Fizz implementation this is much simpler because the child is
  // rendered in the same callstack as the parent.
  //
  // It might be better to just add a `forks` field to the Fiber type. It would
  // make this module simpler.

  // warnIfNotHydrating();

  forkStack[forkStackIndex++] = treeForkCount;
  forkStack[forkStackIndex++] = treeForkProvider;

  treeForkProvider = workInProgress;
  treeForkCount = totalChildren;
}
