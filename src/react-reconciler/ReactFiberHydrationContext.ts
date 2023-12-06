// The deepest Fiber on the stack involved in a hydration context.

import { CapturedValue } from './ReactCapturedValue';
import {
  Container,
  HydratableInstance,
  getFirstHydratableChildWithinContainer,
} from './ReactFiberHostConfig';
import { Fiber } from './ReactInternalTypes';
let hydrationErrors: Array<CapturedValue<any>> | null = null;

// This may have been an insertion or a hydration.
let hydrationParentFiber: null | Fiber = null;
let nextHydratableInstance: null | HydratableInstance = null;
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

const supportsHydration = true;
export function enterHydrationState(fiber: Fiber): boolean {
  if (!supportsHydration) {
    return false;
  }

  const parentInstance: Container = fiber.stateNode.containerInfo;
  nextHydratableInstance = getFirstHydratableChildWithinContainer(parentInstance);
  hydrationParentFiber = fiber;
  isHydrating = true;
  hydrationErrors = null;
  // didSuspendOrErrorDEV = false;
  return true;
}

export function queueHydrationError(error: CapturedValue<any>): void {
  if (hydrationErrors === null) {
    hydrationErrors = [error];
  } else {
    hydrationErrors.push(error);
  }
}

export function tryToClaimNextHydratableInstance(fiber: Fiber): void {
  // todo 不考虑注水
  if (!isHydrating) {
    return;
  }
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
