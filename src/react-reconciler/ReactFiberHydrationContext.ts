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

//403
function tryToClaimNextHydratableInstance(fiber: Fiber): void {
  // read: 客户端渲染用不到
  if (!isHydrating) {
    return;
  }
  console.error('客户端渲染不应该走到这里');
  // let nextInstance = nextHydratableInstance;
  // if (!nextInstance) {
  //   if (shouldClientRenderOnMismatch(fiber)) {
  //     warnNonhydratedInstance((hydrationParentFiber: any), fiber);
  //     throwOnHydrationMismatch(fiber);
  //   }
  //   // Nothing to hydrate. Make it an insertion.
  //   insertNonHydratedInstance((hydrationParentFiber: any), fiber);
  //   isHydrating = false;
  //   hydrationParentFiber = fiber;
  //   return;
  // }
  // const firstAttemptedInstance = nextInstance;
  // if (!tryHydrate(fiber, nextInstance)) {
  //   if (shouldClientRenderOnMismatch(fiber)) {
  //     warnNonhydratedInstance((hydrationParentFiber: any), fiber);
  //     throwOnHydrationMismatch(fiber);
  //   }
  //   // If we can't hydrate this instance let's try the next one.
  //   // We use this as a heuristic. It's based on intuition and not data so it
  //   // might be flawed or unnecessary.
  //   nextInstance = getNextHydratableSibling(firstAttemptedInstance);
  //   const prevHydrationParentFiber: Fiber = (hydrationParentFiber: any);
  //   if (!nextInstance || !tryHydrate(fiber, nextInstance)) {
  //     // Nothing to hydrate. Make it an insertion.
  //     insertNonHydratedInstance((hydrationParentFiber: any), fiber);
  //     isHydrating = false;
  //     hydrationParentFiber = fiber;
  //     return;
  //   }
  //   // We matched the next one, we'll now assume that the first one was
  //   // superfluous and we'll delete it. Since we can't eagerly delete it
  //   // we'll have to schedule a deletion. To do that, this node needs a dummy
  //   // fiber associated with it.
  //   deleteHydratableInstance(prevHydrationParentFiber, firstAttemptedInstance);
  // }
}

export function queueHydrationError(error: CapturedValue<any>): void {
  if (hydrationErrors === null) {
    hydrationErrors = [error];
  } else {
    hydrationErrors.push(error);
  }
}

export { getIsHydrating, resetHydrationState, tryToClaimNextHydratableInstance };
