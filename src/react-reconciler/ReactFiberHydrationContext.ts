// The deepest Fiber on the stack involved in a hydration context.

import { Fiber } from './ReactInternalTypes';

// This may have been an insertion or a hydration.
let hydrationParentFiber: null | Fiber = null;
// let nextHydratableInstance: null | HydratableInstance = null;
let isHydrating: boolean = false;
export function resetHydrationState(): void {
  // if (!supportsHydration) {
  //   return;
  // }
  hydrationParentFiber = null;
  // nextHydratableInstance = null;
  isHydrating = false;
  // didSuspendOrErrorDEV = false;
}

export function getIsHydrating(): boolean {
  return isHydrating;
}
