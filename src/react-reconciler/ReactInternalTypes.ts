// A Fiber is work on a Component that needs to be done or was done. There can

import {
  MutableSource,
  ReactContext,
  RefObject,
  StartTransitionOptions,
  Wakeable,
} from '../shared/ReactTypes';
import { mixed } from '../types';
import { ConcurrentUpdate } from './ReactFiberConcurrentUpdates';
import { Flags } from './ReactFiberFlags';
import { NoTimeout, SuspenseInstance, TimeoutHandle } from '../react-dom/ReactFiberHostConfig';
import { Lane, LaneMap, Lanes } from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import { RootTag } from './ReactRootTags';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';
import type { Cache } from './ReactFiberCacheComponent';
import { UpdateQueue } from './ReactFiberClassUpdateQueue';
import { Task } from '../scheduler';

// Unwind Circular: moved from ReactFiberHooks.old
export type HookType =
  | 'useState'
  | 'useReducer'
  | 'useContext'
  | 'useRef'
  | 'useEffect'
  | 'useInsertionEffect'
  | 'useLayoutEffect'
  | 'useCallback'
  | 'useMemo'
  | 'useImperativeHandle'
  | 'useDebugValue'
  | 'useDeferredValue'
  | 'useTransition'
  | 'useMutableSource'
  | 'useSyncExternalStore'
  | 'useId'
  | 'useCacheRefresh';

export type ContextDependency<T> = {
  context: ReactContext<T>;
  next: ContextDependency<any> | null;
  memoizedValue: T;
} & mixed;
export type Dependencies = {
  lanes: Lanes;
  firstContext: ContextDependency<any> | null;
} & mixed;

// be more than one per component.
export type Fiber<Q extends mixed = any> = {
  // These first fields are conceptually members of an Instance. This used to
  // be split into a separate type and intersected with the other Fiber fields,
  // but until Flow fixes its intersection bugs, we've merged them into a
  // single type.

  // An Instance is shared between all versions of a component. We can easily
  // break this out into a separate object to avoid copying so much to the
  // alternate versions of the tree. We put this on a single object for now to
  // minimize the number of objects created during the initial render.

  // Tag identifying the type of fiber.
  tag: WorkTag;

  // Unique identifier of this child.
  key: null | string;

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  elementType: any;

  // The resolved function/class/ associated with this fiber.
  type: any;

  // The local state associated with this fiber.
  stateNode: any;

  // Conceptual aliases
  // parent : Instance -> return The parent happens to be the same as the
  // return fiber since we've merged the fiber and instance.

  // Remaining fields belong to Fiber

  // The Fiber to return to after finishing processing this one.
  // This is effectively the parent, but there can be multiple parents (two)
  // so this is only the parent of the thing we're currently processing.
  // It is conceptually the same as the return address of a stack frame.
  return: Fiber | null;

  // Singly Linked List Tree Structure.
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  ref: null | (((handle: any) => void) & { _stringRef?: string } & mixed) | RefObject;

  // Input is the data coming into process this fiber. Arguments. Props.
  pendingProps: any; // This type will be more specific once we overload the tag.
  memoizedProps: any; // The props used to create the output.

  // A queue of state updates and callbacks.
  updateQueue: UpdateQueue<Q> | null;

  // The state used to create the output
  // read: 实际代码中这里挂载的是 hooks？
  memoizedState: any;

  // Dependencies (contexts, events) for this fiber, if it has any
  dependencies: Dependencies | null;

  // Bitfield that describes properties about the fiber and its subtree. E.g.
  // the ConcurrentMode flag indicates whether the subtree should be async-by-
  // default. When a fiber is created, it inherits the mode of its
  // parent. Additional flags can be set at creation time, but after that the
  // value should remain unchanged throughout the fiber's lifetime, particularly
  // before its child fibers are created.
  mode: TypeOfMode;

  // Effect
  flags: Flags;
  subtreeFlags: Flags;
  deletions: Array<Fiber> | null;

  // Singly linked list fast path to the next fiber with side-effects.
  nextEffect: Fiber | null;

  // The first and last fiber with side-effect within this subtree. This allows
  // us to reuse a slice of the linked list when we reuse the work done within
  // this fiber.
  firstEffect: Fiber | null;
  lastEffect: Fiber | null;

  lanes: Lanes;
  childLanes: Lanes;

  // This is a pooled version of a Fiber. Every fiber that gets updated will
  // eventually have a pair. There are cases when we can clean up pairs to save
  // memory if we need to.
  alternate: Fiber | null;

  // Time spent rendering this Fiber and its descendants for the current update.
  // This tells us how well the tree makes use of sCU for memoization.
  // It is reset to 0 each time we render and only updated when we don't bailout.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualDuration?: number;

  // If the Fiber is currently active in the "render" phase,
  // This marks the time at which the work began.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualStartTime?: number;

  // Duration of the most recent render time for this Fiber.
  // This value is not updated when we bailout for memoization purposes.
  // This field is only set when the enableProfilerTimer flag is enabled.
  selfBaseDuration?: number;

  // Sum of base times for all descendants of this Fiber.
  // This value bubbles up during the "complete" phase.
  // This field is only set when the enableProfilerTimer flag is enabled.
  treeBaseDuration?: number;
};

type BaseFiberRootProperties = {
  // The type of root (legacy, batched, concurrent, etc.)
  tag: RootTag;

  // Any additional information from the host associated with this root.
  containerInfo: any;
  // Used only by persistent updates.
  pendingChildren: any;
  // The currently active root fiber. This is the mutable root of the tree.
  current: Fiber;

  pingCache: WeakMap<Wakeable, Set<mixed>> | Map<Wakeable, Set<mixed>> | null;

  // A finished work-in-progress HostRoot that's ready to be committed.
  finishedWork: Fiber | null;
  // Timeout handle returned by setTimeout. Used to cancel a pending timeout, if
  // it's superseded by a new one.
  timeoutHandle: TimeoutHandle | NoTimeout;
  // Top context object, used by renderSubtreeIntoContainer
  context: Object | null;
  pendingContext: Object | null;

  // Used by useMutableSource hook to avoid tearing during hydration.
  // fixme:暂时不支持
  // mutableSourceEagerHydrationData?: Array<MutableSource<any> | MutableSourceVersion> | null;

  // Node returned by Scheduler.scheduleCallback. Represents the next rendering
  // task that the root will work on.
  callbackNode: Task | null; // read: 这里是 scheduler 的 Task
  callbackPriority: Lane;
  eventTimes: LaneMap<number>;
  expirationTimes: LaneMap<number>;
  hiddenUpdates: LaneMap<Array<ConcurrentUpdate> | null>;

  pendingLanes: Lanes;
  suspendedLanes: Lanes;
  pingedLanes: Lanes;
  expiredLanes: Lanes;
  mutableReadLanes: Lanes;

  finishedLanes: Lanes;

  entangledLanes: Lanes;
  entanglements: LaneMap<Lanes>;

  pooledCache: Cache | null;
  pooledCacheLanes: Lanes;

  // TODO: In Fizz, id generation is specific to each server config. Maybe we
  // should do this in Fiber, too? Deferring this decision for now because
  // there's no other place to store the prefix except for an internal field on
  // the public createRoot object, which the fiber tree does not currently have
  // a reference to.
  identifierPrefix: string;

  onRecoverableError: (
    error: mixed,
    errorInfo: { digest?: string; componentStack?: string }
  ) => void;
};

export type SuspenseHydrationCallbacks = {
  onHydrated?: (suspenseInstance: SuspenseInstance) => void;
  onDeleted?: (suspenseInstance: SuspenseInstance) => void;
} & mixed;

// The follow fields are only used by enableSuspenseCallback for hydration.
type SuspenseCallbackOnlyFiberRootProperties = {
  hydrationCallbacks: null | SuspenseHydrationCallbacks;
};

type UpdaterTrackingOnlyFiberRootProperties = {
  memoizedUpdaters: Set<Fiber>;
  pendingUpdatersLaneMap: LaneMap<Set<Fiber>>;
};

export type TransitionTracingCallbacks = {
  onTransitionStart?: (transitionName: string, startTime: number) => void;
  onTransitionProgress?: (
    transitionName: string,
    startTime: number,
    currentTime: number,
    pending: Array<{ name: null | string }>
  ) => void;
  onTransitionIncomplete?: (
    transitionName: string,
    startTime: number,
    deletions: Array<{
      type: string;
      name?: string;
      newName?: string;
      endTime: number;
    }>
  ) => void;
  onTransitionComplete?: (transitionName: string, startTime: number, endTime: number) => void;
  onMarkerProgress?: (
    transitionName: string,
    marker: string,
    startTime: number,
    currentTime: number,
    pending: Array<{ name: null | string }>
  ) => void;
  onMarkerIncomplete?: (
    transitionName: string,
    marker: string,
    startTime: number,
    deletions: Array<{
      type: string;
      name?: string;
      newName?: string;
      endTime: number;
    }>
  ) => void;
  onMarkerComplete?: (
    transitionName: string,
    marker: string,
    startTime: number,
    endTime: number
  ) => void;
};

// The following fields are only used in transition tracing in Profile builds
type TransitionTracingOnlyFiberRootProperties = {
  transitionCallbacks: null | TransitionTracingCallbacks;
  transitionLanes: Array<Array<Transition> | null>;
};

// Exported FiberRoot type includes all properties,
// To avoid requiring potentially error-prone :any casts throughout the project.
// The types are defined separately within this file to ensure they stay in sync.
export type FiberRoot = BaseFiberRootProperties &
  SuspenseCallbackOnlyFiberRootProperties &
  UpdaterTrackingOnlyFiberRootProperties &
  TransitionTracingOnlyFiberRootProperties &
  mixed;

type BasicStateAction<S> = ((state: S) => S) | S;
type Dispatch<A> = (action: A) => void;

// read: 部分 hook 先不看
export type Dispatcher = {
  getCacheSignal?: () => AbortSignal;
  getCacheForType?: <T>(resourceType: () => T) => T;
  readContext<T>(context: ReactContext<T>): T | null;
  useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>];
  // useReducer<S, I, A>(
  //   reducer: (state: S, action: A) => S,
  //   initialArg: I,
  //   init?: (initial: I) => S
  // ): [S, Dispatch<A>];
  useContext<T>(context: ReactContext<T>): T;
  // useRef<T>(initialValue: T): { current: T };
  useEffect(create: () => (() => void) | void, deps: Array<mixed> | void | null): void;
  // useInsertionEffect(create: () => (() => void) | void, deps: Array<mixed> | void | null): void;
  // useLayoutEffect(create: () => (() => void) | void, deps: Array<mixed> | void | null): void;
  useCallback<T>(callback: T, deps: Array<mixed> | void | null): T;
  useMemo<T>(nextCreate: () => T, deps: Array<mixed> | void | null): T;
  // useImperativeHandle<T>(
  //   ref: { current: T | null } | ((inst: T | null) => mixed) | null | void,
  //   create: () => T,
  //   deps: Array<mixed> | void | null
  // ): void;
  // useDebugValue<T>(value: T, formatterFn?: (value: T) => mixed): void;
  // useDeferredValue<T>(value: T): T;
  // useTransition(): [boolean, (callback: () => void, options?: StartTransitionOptions) => void];

  // useMutableSource<Source, Snapshot>(
  //   source: MutableSource<Source>,
  //   getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
  //   subscribe: MutableSourceSubscribeFn<Source, Snapshot>,
  // ): Snapshot,
  // useSyncExternalStore<T>(
  //   subscribe: (() => void) => () => void,
  //   getSnapshot: () => T,
  //   getServerSnapshot?: () => T,
  // ): T,
  // useId(): string;
  // useCacheRefresh?: () => <T>(fn?: () => T, d?: T) => void;

  unstable_isNewReconciler?: boolean;
};
