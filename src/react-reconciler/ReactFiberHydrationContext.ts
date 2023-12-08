// The deepest Fiber on the stack involved in a hydration context.

import { CapturedValue } from './ReactCapturedValue';
import {
  Container,
  HostContext,
  HydratableInstance,
  Instance,
  TextInstance,
  didNotMatchHydratedContainerTextInstance,
  didNotMatchHydratedTextInstance,
  getFirstHydratableChildWithinContainer,
  hydrateInstance,
  hydrateTextInstance,
} from './ReactFiberHostConfig';
import { queueRecoverableErrors } from './ReactFiberWorkLoop';
import { Fiber } from './ReactInternalTypes';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { HostComponent, HostRoot } from './ReactWorkTags';
let hydrationErrors: Array<CapturedValue<any>> | null = null;
let didSuspendOrErrorDEV: boolean = false;

// This may have been an insertion or a hydration.
let hydrationParentFiber: null | Fiber = null;
let nextHydratableInstance: null | HydratableInstance = null;
let isHydrating: boolean = false;
function resetHydrationState(): void {
  // if (!supportsHydration) {
  //   return;
  // }
  hydrationParentFiber = null;
  // nextHydratableInstance = null;
  isHydrating = false;
  didSuspendOrErrorDEV = false;
}

function getIsHydrating(): boolean {
  return isHydrating;
}

const supportsHydration = true;
function enterHydrationState(fiber: Fiber): boolean {
  if (!supportsHydration) {
    return false;
  }

  const parentInstance: Container = fiber.stateNode.containerInfo;
  nextHydratableInstance = getFirstHydratableChildWithinContainer(parentInstance);
  hydrationParentFiber = fiber;
  isHydrating = true;
  hydrationErrors = null;
  didSuspendOrErrorDEV = false;
  return true;
}

export function queueHydrationError(error: CapturedValue<any>): void {
  if (hydrationErrors === null) {
    hydrationErrors = [error];
  } else {
    hydrationErrors.push(error);
  }
}

function prepareToHydrateHostTextInstance(fiber: Fiber): boolean {
  if (!supportsHydration) {
    throw new Error(
      'Expected prepareToHydrateHostTextInstance() to never be called. ' +
        'This error is likely caused by a bug in React. Please file an issue.'
    );
  }

  const textInstance: TextInstance = fiber.stateNode;
  const textContent: string = fiber.memoizedProps;
  const shouldWarnIfMismatchDev = !didSuspendOrErrorDEV;
  const shouldUpdate = hydrateTextInstance(
    textInstance,
    textContent,
    fiber,
    shouldWarnIfMismatchDev
  );
  if (shouldUpdate) {
    // We assume that prepareToHydrateHostTextInstance is called in a context where the
    // hydration parent is the parent host component of this host text.
    const returnFiber = hydrationParentFiber;
    if (returnFiber !== null) {
      switch (returnFiber.tag) {
        case HostRoot: {
          const parentContainer = returnFiber.stateNode.containerInfo;
          const isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
          didNotMatchHydratedContainerTextInstance(
            parentContainer,
            textInstance,
            textContent,
            // TODO: Delete this argument when we remove the legacy root API.
            isConcurrentMode
          );
          break;
        }
        case HostComponent: {
          const parentType = returnFiber.type;
          const parentProps = returnFiber.memoizedProps;
          const parentInstance = returnFiber.stateNode;
          const isConcurrentMode = (returnFiber.mode & ConcurrentMode) !== NoMode;
          didNotMatchHydratedTextInstance(
            parentType,
            parentProps,
            parentInstance,
            textInstance,
            textContent,
            // TODO: Delete this argument when we remove the legacy root API.
            isConcurrentMode
          );
          break;
        }
      }
    }
  }
  return shouldUpdate;
}

function tryToClaimNextHydratableInstance(fiber: Fiber): void {
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

function prepareToHydrateHostInstance(
  fiber: Fiber,
  rootContainerInstance: Container,
  hostContext: HostContext
): boolean {
  if (!supportsHydration) {
    throw new Error(
      'Expected prepareToHydrateHostInstance() to never be called. ' +
        'This error is likely caused by a bug in React. Please file an issue.'
    );
  }

  const instance: Instance = fiber.stateNode;
  const shouldWarnIfMismatchDev = !didSuspendOrErrorDEV;
  const updatePayload = hydrateInstance(
    instance,
    fiber.type,
    fiber.memoizedProps,
    rootContainerInstance,
    hostContext,
    fiber,
    shouldWarnIfMismatchDev
  );
  // TODO: Type this specific to this type of component.
  fiber.updateQueue = updatePayload;
  // If the update payload indicates that there is a change or if there
  // is a new ref we mark this as an update.
  if (updatePayload !== null) {
    return true;
  }
  return false;
}
export function upgradeHydrationErrorsToRecoverable(): void {
  if (hydrationErrors !== null) {
    // Successfully completed a forced client render. The errors that occurred
    // during the hydration attempt are now recovered. We will log them in
    // commit phase, once the entire tree has finished.
    queueRecoverableErrors(hydrationErrors);
    hydrationErrors = null;
  }
}

function popHydrationState(fiber: Fiber): boolean {
  if (!supportsHydration) {
    return false;
  }
  if (fiber !== hydrationParentFiber) {
    // We're deeper than the current hydration context, inside an inserted
    // tree.
    return false;
  }
  if (!isHydrating) {
    // If we're not currently hydrating but we're in a hydration context, then
    // we were an insertion and now need to pop up reenter hydration of our
    // siblings.
    popToNextHostParent(fiber);
    isHydrating = true;
    return false;
  }

  // If we have any remaining hydratable nodes, we need to delete them now.
  // We only do this deeper than head and body since they tend to have random
  // other nodes in them. We also ignore components with pure text content in
  // side of them. We also don't delete anything inside the root container.
  if (
    fiber.tag !== HostRoot &&
    (fiber.tag !== HostComponent ||
      (shouldDeleteUnhydratedTailInstances(fiber.type) &&
        !shouldSetTextContent(fiber.type, fiber.memoizedProps)))
  ) {
    let nextInstance = nextHydratableInstance;
    if (nextInstance) {
      if (shouldClientRenderOnMismatch(fiber)) {
        warnIfUnhydratedTailNodes(fiber);
        throwOnHydrationMismatch(fiber);
      } else {
        while (nextInstance) {
          deleteHydratableInstance(fiber, nextInstance);
          nextInstance = getNextHydratableSibling(nextInstance);
        }
      }
    }
  }
  popToNextHostParent(fiber);
  if (fiber.tag === SuspenseComponent) {
    nextHydratableInstance = skipPastDehydratedSuspenseInstance(fiber);
  } else {
    nextHydratableInstance = hydrationParentFiber
      ? getNextHydratableSibling(fiber.stateNode)
      : null;
  }
  return true;
}

export {
  // warnIfHydrating,
  enterHydrationState,
  getIsHydrating,
  // reenterHydrationStateFromDehydratedSuspenseInstance,
  resetHydrationState,
  tryToClaimNextHydratableInstance,
  prepareToHydrateHostInstance,
  prepareToHydrateHostTextInstance,
  // prepareToHydrateHostSuspenseInstance,
  popHydrationState,
  // hasUnhydratedTailNodes,
  // warnIfUnhydratedTailNodes,
};
