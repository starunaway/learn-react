import { Hydrating, NoFlags, Placement } from './ReactFiberFlags';
import { Fiber } from './ReactInternalTypes';
import { get as getInstance } from '@/shared/ReactInstanceMap';
import { HostRoot } from './ReactWorkTags';

export function getNearestMountedFiber(fiber: Fiber): null | Fiber {
  let node = fiber;
  let nearestMounted: Fiber | null = fiber;
  if (!fiber.alternate) {
    // If there is no alternate, this might be a new tree that isn't inserted
    // yet. If it is, then it will have a pending insertion effect on it.
    let nextNode: Fiber | null = node;
    do {
      node = nextNode;
      if ((node.flags & (Placement | Hydrating)) !== NoFlags) {
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
  if (node.tag === HostRoot) {
    // TODO: Check if this was a nested HostRoot when used with
    // renderContainerIntoSubtree.
    return nearestMounted;
  }
  // If we didn't hit the root, that means that we're in an disconnected tree
  // that has been unmounted.
  return null;
}

export function isMounted(component: any): boolean {
  // if (__DEV__) {
  //   const owner = (ReactCurrentOwner.current: any);
  //   if (owner !== null && owner.tag === ClassComponent) {
  //     const ownerFiber: Fiber = owner;
  //     const instance = ownerFiber.stateNode;
  //     if (!instance._warnedAboutRefsInRender) {
  //       console.error(
  //         '%s is accessing isMounted inside its render() function. ' +
  //           'render() should be a pure function of props and state. It should ' +
  //           'never access something that requires stale data from the previous ' +
  //           'render, such as refs. Move this logic to componentDidMount and ' +
  //           'componentDidUpdate instead.',
  //         getComponentNameFromFiber(ownerFiber) || 'A component',
  //       );
  //     }
  //     instance._warnedAboutRefsInRender = true;
  //   }
  // }

  const fiber: Fiber | null = getInstance(component);
  if (!fiber) {
    return false;
  }
  return getNearestMountedFiber(fiber) === fiber;
}
