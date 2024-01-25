// The deepest Fiber on the stack involved in a hydration context.

import { HydratableInstance, supportsHydration } from '../react-dom/ReactFiberHostConfig';
import { CapturedValue } from './ReactCapturedValue';
import { Fiber } from './ReactInternalTypes';

// This may have been an insertion or a hydration.
let hydrationParentFiber: null | Fiber = null;
let nextHydratableInstance: null | HydratableInstance = null;
let isHydrating: boolean = false;

// This flag allows for warning supression when we expect there to be mismatches
// due to earlier mismatches or a suspended fiber.
let didSuspendOrErrorDEV: boolean = false;

// Hydration errors that were thrown inside this boundary
let hydrationErrors: Array<CapturedValue<any>> | null = null;

function getIsHydrating(): boolean {
  return isHydrating;
}

function resetHydrationState(): void {
  // read: 和 ssr 相关的应该可以关闭了
  if (!supportsHydration) {
    return;
  }

  hydrationParentFiber = null;
  nextHydratableInstance = null;
  isHydrating = false;
  didSuspendOrErrorDEV = false;
}

export { getIsHydrating, resetHydrationState };
