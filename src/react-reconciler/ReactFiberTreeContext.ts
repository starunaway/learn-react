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

export function pushTreeId(workInProgress: Fiber, totalChildren: number, index: number) {
  // warnIfNotHydrating();

  idStack[idStackIndex++] = treeContextId;
  idStack[idStackIndex++] = treeContextOverflow;
  idStack[idStackIndex++] = treeContextProvider;

  treeContextProvider = workInProgress;

  const baseIdWithLeadingBit = treeContextId;
  const baseOverflow = treeContextOverflow;

  // The leftmost 1 marks the end of the sequence, non-inclusive. It's not part
  // of the id; we use it to account for leading 0s.
  const baseLength = getBitLength(baseIdWithLeadingBit) - 1;
  const baseId = baseIdWithLeadingBit & ~(1 << baseLength);

  const slot = index + 1;
  const length = getBitLength(totalChildren) + baseLength;

  // 30 is the max length we can store without overflowing, taking into
  // consideration the leading 1 we use to mark the end of the sequence.
  if (length > 30) {
    // We overflowed the bitwise-safe range. Fall back to slower algorithm.
    // This branch assumes the length of the base id is greater than 5; it won't
    // work for smaller ids, because you need 5 bits per character.
    //
    // We encode the id in multiple steps: first the base id, then the
    // remaining digits.
    //
    // Each 5 bit sequence corresponds to a single base 32 character. So for
    // example, if the current id is 23 bits long, we can convert 20 of those
    // bits into a string of 4 characters, with 3 bits left over.
    //
    // First calculate how many bits in the base id represent a complete
    // sequence of characters.
    const numberOfOverflowBits = baseLength - (baseLength % 5);

    // Then create a bitmask that selects only those bits.
    const newOverflowBits = (1 << numberOfOverflowBits) - 1;

    // Select the bits, and convert them to a base 32 string.
    const newOverflow = (baseId & newOverflowBits).toString(32);

    // Now we can remove those bits from the base id.
    const restOfBaseId = baseId >> numberOfOverflowBits;
    const restOfBaseLength = baseLength - numberOfOverflowBits;

    // Finally, encode the rest of the bits using the normal algorithm. Because
    // we made more room, this time it won't overflow.
    const restOfLength = getBitLength(totalChildren) + restOfBaseLength;
    const restOfNewBits = slot << restOfBaseLength;
    const id = restOfNewBits | restOfBaseId;
    const overflow = newOverflow + baseOverflow;

    treeContextId = (1 << restOfLength) | id;
    treeContextOverflow = overflow;
  } else {
    // Normal path
    const newBits = slot << baseLength;
    const id = newBits | baseId;
    const overflow = baseOverflow;

    treeContextId = (1 << length) | id;
    treeContextOverflow = overflow;
  }
}

export function pushMaterializedTreeId(workInProgress: Fiber) {
  // warnIfNotHydrating();

  // This component materialized an id. This will affect any ids that appear
  // in its children.
  const returnFiber = workInProgress.return;
  if (returnFiber !== null) {
    const numberOfForks = 1;
    const slotIndex = 0;
    pushTreeFork(workInProgress, numberOfForks);
    pushTreeId(workInProgress, numberOfForks, slotIndex);
  }
}

function getBitLength(number: number): number {
  return 32 - Math.clz32(number);
}
