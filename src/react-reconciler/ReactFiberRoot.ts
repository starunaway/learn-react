import { Container, noTimeout } from '../react-dom/ReactFiberHostConfig';
import { ReactNodeList } from '../shared/ReactTypes';
import { mixed } from '../types';
import type { Cache } from './ReactFiberCacheComponent';
import { Lane, NoLanes, NoTimestamp, createLaneMap } from './ReactFiberLane';
import type { PendingSuspenseBoundaries, Transition } from './ReactFiberTracingMarkerComponent';
import { Fiber, FiberRoot, SuspenseHydrationCallbacks } from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';
import { createHostRootFiber } from './ReactFiber';

import { createCache, retainCache } from './ReactFiberCacheComponent';

export type RootState = {
  element: any;
  isDehydrated: boolean;
  cache: Cache;
  pendingSuspenseBoundaries: PendingSuspenseBoundaries | null;
  transitions: Set<Transition> | null;
};

// read: 一些类型需要这这里继续补齐
class FiberRootNode {
  tag: RootTag;
  containerInfo: any;
  pendingChildren: null;
  current: Fiber | null;
  pingCache: null;
  finishedWork: null;
  timeoutHandle: any;
  context: null;
  pendingContext: null;
  callbackNode: null;
  callbackPriority: any;
  eventTimes: any;
  expirationTimes: any;
  pendingLanes: number;
  suspendedLanes: number;
  pingedLanes: number;
  expiredLanes: number;
  mutableReadLanes: number;
  finishedLanes: number;
  entangledLanes: number;
  entanglements: any;
  identifierPrefix: string;
  onRecoverableError: null | ((error: mixed) => void);
  pooledCache: null;
  pooledCacheLanes: number;
  mutableSourceEagerHydrationData: null;
  constructor(
    containerInfo: Container,
    tag: RootTag,
    /*hydrate,*/
    identifierPrefix: string,
    onRecoverableError: null | ((error: mixed) => void)
  ) {
    this.tag = tag;
    this.containerInfo = containerInfo;
    this.pendingChildren = null;
    this.current = null;
    this.pingCache = null;
    this.finishedWork = null;
    this.timeoutHandle = noTimeout;
    this.context = null;
    this.pendingContext = null;
    this.callbackNode = null;
    this.callbackPriority = Lane.NoLane;
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

    this.identifierPrefix = identifierPrefix;
    this.onRecoverableError = onRecoverableError;

    this.pooledCache = null;
    this.pooledCacheLanes = NoLanes;

    this.mutableSourceEagerHydrationData = null;

    // read: 这里不支持，所有对应的属性不存在，在其他的位置也需要注释掉
    // if (enableSuspenseCallback) {
    //   this.hydrationCallbacks = null;
    // }

    // read: 这里不支持，所有对应的属性不存在，在其他的位置也需要注释掉
    // if (enableTransitionTracing) {
    //   this.transitionCallbacks = null;
    //   const transitionLanesMap = (this.transitionLanes = []);
    //   for (let i = 0; i < TotalLanes; i++) {
    //     transitionLanesMap.push(null);
    //   }
    // }
  }
}

export function createFiberRoot(
  containerInfo: Container,
  tag: RootTag,
  hydrate: boolean,
  initialChildren: ReactNodeList,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  // TODO: We have several of these arguments that are conceptually part of the
  // host config, but because they are passed in at runtime, we have to thread
  // them through the root constructor. Perhaps we should put them all into a
  // single type, like a DynamicHostConfig that is defined by the renderer.
  identifierPrefix: string,
  onRecoverableError: null | ((error: mixed) => void)
  // transitionCallbacks: null | TransitionTracingCallbacks
): FiberRoot {
  const root: FiberRoot = new FiberRootNode(
    containerInfo,
    tag,
    /* hydrate */
    identifierPrefix,
    onRecoverableError
    // read: 源码里做了这种类型转换，😄
  ) as unknown as FiberRoot;

  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  const uninitializedFiber = createHostRootFiber(
    tag,
    isStrictMode,
    concurrentUpdatesByDefaultOverride
  );
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  const initialCache = createCache();
  retainCache(initialCache);

  // The pooledCache is a fresh cache instance that is used temporarily
  // for newly mounted boundaries during a render. In general, the
  // pooledCache is always cleared from the root at the end of a render:
  // it is either released when render commits, or moved to an Offscreen
  // component if rendering suspends. Because the lifetime of the pooled
  // cache is distinct from the main memoizedState.cache, it must be
  // retained separately.
  root.pooledCache = initialCache;
  retainCache(initialCache);
  const initialState: RootState = {
    element: initialChildren,
    isDehydrated: hydrate,
    cache: initialCache,
    transitions: null,
    pendingSuspenseBoundaries: null,
  };
  uninitializedFiber.memoizedState = initialState;

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
