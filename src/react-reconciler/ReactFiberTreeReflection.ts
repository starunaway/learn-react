import { Container, SuspenseInstance } from '../react-dom/ReactFiberHostConfig';
import { Flags } from './ReactFiberFlags';
import { SuspenseState } from './ReactFiberSuspenseComponent';
import type { Fiber } from './ReactInternalTypes';
import { WorkTag } from './ReactWorkTags';

export function getContainerFromFiber(fiber: Fiber): null | Container {
  return fiber.tag === WorkTag.HostRoot ? fiber.stateNode.containerInfo : null;
}

export function getNearestMountedFiber(fiber: Fiber): null | Fiber {
  let node: Fiber | null = fiber;
  let nearestMounted: Fiber | null = fiber;
  if (!fiber.alternate) {
    // If there is no alternate, this might be a new tree that isn't inserted
    // yet. If it is, then it will have a pending insertion effect on it.
    let nextNode: Fiber | null = node;
    do {
      node = nextNode;
      if ((node.flags & (Flags.Placement | Flags.Hydrating)) !== Flags.NoFlags) {
        // This is an insertion or in-progress hydration. The nearest possible
        // mounted fiber is the parent but we need to continue to figure out
        // if that one is still mounted.
        nearestMounted = node.return;
      }
      nextNode = node.return;
    } while (nextNode);
  } else {
    while (node.return) {
      node = node.return;
    }
  }
  if (node.tag === WorkTag.HostRoot) {
    // TODO: Check if this was a nested HostRoot when used with
    // renderContainerIntoSubtree.
    return nearestMounted;
  }
  // If we didn't hit the root, that means that we're in an disconnected tree
  // that has been unmounted.
  return null;
}

export function getSuspenseInstanceFromFiber(fiber: Fiber): null | SuspenseInstance {
  if (fiber.tag === WorkTag.SuspenseComponent) {
    let suspenseState: SuspenseState | null = fiber.memoizedState;
    if (suspenseState === null) {
      const current = fiber.alternate;
      if (current !== null) {
        suspenseState = current.memoizedState;
      }
    }
    if (suspenseState !== null) {
      return suspenseState.dehydrated;
    }
  }
  return null;
}
