import { FiberNode } from './ReactFiber';
import { initializeUpdateQueue } from './ReactFiberClassUpdateQueue';
import { NoLane, NoLanes } from './ReactFiberLane';
import { Container, FiberRoot } from './ReactInternalTypes';
import { type RootTag } from './ReactRootTags';
import { NoMode } from './ReactTypeOfMode';
import { HostRoot } from './ReactWorkTags';

class FiberRootNode {
  containerInfo: Container;
  tag: RootTag;
  current: any;
  pendingChildren: null;
  pingCache: null;
  finishedWork: null;
  timeoutHandle: any;
  context: null;
  pendingContext: null;
  callbackNode: null;
  callbackPriority: any;
  eventTimes: any;
  expirationTimes: any;
  pendingLanes: any;
  suspendedLanes: any;
  pingedLanes: any;
  expiredLanes: any;
  mutableReadLanes: any;
  finishedLanes: any;
  entangledLanes: any;
  entanglements: any;
  hiddenUpdates: any;
  identifierPrefix: any;
  onRecoverableError: any;

  constructor(containerInfo: Container, tag: RootTag) {
    this.tag = tag;
    this.containerInfo = containerInfo;
    this.pendingChildren = null;
    this.current = null;
    this.pingCache = null;
    this.finishedWork = null;
    // this.timeoutHandle = noTimeout;
    this.context = null;
    this.pendingContext = null;
    this.callbackNode = null;
    this.callbackPriority = NoLane;
    // this.eventTimes = createLaneMap(NoLanes);
    // this.expirationTimes = createLaneMap(NoTimestamp);

    this.pendingLanes = NoLanes;
    this.suspendedLanes = NoLanes;
    this.pingedLanes = NoLanes;
    this.expiredLanes = NoLanes;
    this.mutableReadLanes = NoLanes;
    this.finishedLanes = NoLanes;

    this.entangledLanes = NoLanes;
    // this.entanglements = createLaneMap(NoLanes);

    // this.hiddenUpdates = createLaneMap(null);

    // this.identifierPrefix = identifierPrefix;
    // this.onRecoverableError = onRecoverableError;
  }
}

export function createFiberRoot(containerInfo: Container, tag: RootTag): FiberRoot {
  // $FlowFixMe[invalid-constructor] Flow no longer supports calling new on functions
  const root: FiberRoot = new FiberRootNode(containerInfo, tag) as unknown as any;

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
