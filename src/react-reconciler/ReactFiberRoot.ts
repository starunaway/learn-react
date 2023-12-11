import { FiberNode } from './ReactFiber';
import { initializeUpdateQueue } from './ReactFiberClassUpdateQueue';
import { NoLane, NoLanes, NoTimestamp, createLaneMap } from './ReactFiberLane';
import { PendingSuspenseBoundaries, Transition } from './ReactFiberTracingMarkerComponent';
import { Container, FiberRoot } from './ReactInternalTypes';
import { type RootTag } from './ReactRootTags';
import { NoMode } from './ReactTypeOfMode';
import { HostRoot } from './ReactWorkTags';

export type RootState = {
  element: any;
  isDehydrated: boolean;
  cache: Cache | null;
  pendingSuspenseBoundaries: PendingSuspenseBoundaries | null;
  transitions: Set<Transition> | null;
};

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
    this.eventTimes = createLaneMap(NoLanes);
    this.expirationTimes = createLaneMap(NoTimestamp);

    this.pendingLanes = NoLanes;
    this.suspendedLanes = NoLanes;
    this.pingedLanes = NoLanes;
    this.expiredLanes = NoLanes;
    this.mutableReadLanes = NoLanes;
    this.finishedLanes = NoLanes;

    this.entangledLanes = NoLanes;
    this.entanglements = createLaneMap(NoLanes);

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

  // if (enableCache) {
  //   const initialCache = createCache();
  //   retainCache(initialCache);

  //   // The pooledCache is a fresh cache instance that is used temporarily
  //   // for newly mounted boundaries during a render. In general, the
  //   // pooledCache is always cleared from the root at the end of a render:
  //   // it is either released when render commits, or moved to an Offscreen
  //   // component if rendering suspends. Because the lifetime of the pooled
  //   // cache is distinct from the main memoizedState.cache, it must be
  //   // retained separately.
  //   root.pooledCache = initialCache;
  //   retainCache(initialCache);
  //   const initialState: RootState = {
  //     element: initialChildren,
  //     isDehydrated: hydrate,
  //     cache: initialCache,
  //     transitions: null,
  //     pendingSuspenseBoundaries: null,
  //   };
  //   uninitializedFiber.memoizedState = initialState;
  // } else {
  const initialState: RootState = {
    element: null, // initialChildren,
    isDehydrated: false,
    cache: null, // not enabled yet
    transitions: null,
    pendingSuspenseBoundaries: null,
  };
  uninitializedFiber.memoizedState = initialState;
  // }
  //   const initialState: RootState = {
  //     element: initialChildren,
  //     isDehydrated: hydrate,
  //     cache: null, // not enabled yet
  //   };
  //   uninitializedFiber.memoizedState = initialState;

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
