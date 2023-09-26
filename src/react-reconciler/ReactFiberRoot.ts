import { FiberNode } from './ReactFiber';
import { initializeUpdateQueue } from './ReactFiberClassUpdateQueue';
import { Container, FiberRoot } from './ReactInternalTypes';
import { type RootTag } from './ReactRootTags';
import { NoMode } from './ReactTypeOfMode';
import { HostRoot } from './ReactWorkTags';

class FiberRootNode {
  containerInfo: Container;
  tag: RootTag;
  current: any;

  constructor(container: Container, tag: RootTag) {
    this.containerInfo = container;
    this.tag = tag;
    this.current = null;
  }
}

export function createFiberRoot(containerInfo: Container, tag: RootTag): FiberRoot {
  // $FlowFixMe[invalid-constructor] Flow no longer supports calling new on functions
  const root: FiberRoot = new FiberRootNode(containerInfo, tag);

  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  // todo： 如果要支持cocurrentmode，需要更新fiber
  //   const uninitializedFiber = createFiber(HostRoot, null, null, NoMode);
  const uninitializedFiber = new FiberNode(HostRoot, null, null, NoMode);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  //   const initialState: RootState = {
  //     element: initialChildren,
  //     isDehydrated: hydrate,
  //     cache: null, // not enabled yet
  //   };
  //   uninitializedFiber.memoizedState = initialState;

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
