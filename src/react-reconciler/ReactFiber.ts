import { RefObject } from '../shared/ReactTypes';
import { Flags, NoFlags, StaticMask } from './ReactFiberFlags';
import { Lane, Lanes, NoLanes } from './ReactFiberLane';
import { Fiber } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';

export class FiberNode implements Fiber {
  tag: WorkTag;
  key: null | string;
  elementType: any;
  type: any;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;
  ref: null | (((handle: any) => void) & { _stringRef?: string }) | RefObject;

  pendingProps: any;
  memoizedProps: any;
  updateQueue: any;
  memoizedState: any;
  dependencies: any;

  mode: TypeOfMode;
  flags: Flags;
  subtreeFlags: Flags;
  deletions: Array<Fiber> | null;
  alternate: Fiber | null;

  stateNode: any;
  refCleanup?: (() => void) | null;
  nextEffect?: Fiber | null;
  firstEffect?: Fiber | null;
  lastEffect?: Fiber | null;
  actualDuration?: number | undefined;
  actualStartTime?: number | undefined;
  selfBaseDuration?: number | undefined;
  treeBaseDuration?: number | undefined;
  lanes: Lanes;
  childLanes: Lanes;

  constructor(tag: WorkTag, pendingProps: any, key: null | string, mode: TypeOfMode) {
    // Instance
    this.tag = tag;
    this.key = key;
    this.elementType = null;
    this.type = null;

    // Fiber
    this.return = null;
    this.child = null;
    this.sibling = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;
    this.dependencies = null;

    this.mode = mode;

    // Effects
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;

    this.lanes = NoLanes;
    this.childLanes = NoLanes;

    this.alternate = null;

    this.stateNode = null;
  }
}

const createFiber = function (
  tag: WorkTag,
  pendingProps: any,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  return new FiberNode(tag, pendingProps, key, mode);
};

export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    // We use a double buffering pooling technique because we know that we'll
    // only ever need at most two versions of a tree. We pool the "other" unused
    // node that we're free to reuse. This is lazily created to avoid allocating
    // extra objects for things that are never updated. It also allow us to
    // reclaim the extra memory if needed.
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    // if (__DEV__) {
    //   // DEV-only fields

    //   workInProgress._debugSource = current._debugSource;
    //   workInProgress._debugOwner = current._debugOwner;
    //   workInProgress._debugHookTypes = current._debugHookTypes;
    // }

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    // Needed because Blocks store data on type.
    workInProgress.type = current.type;

    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.flags = NoFlags;

    // The effects are no longer valid.
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;

    // if (enableProfilerTimer) {
    //   // We intentionally reset, rather than copy, actualDuration & actualStartTime.
    //   // This prevents time from endlessly accumulating in new commits.
    //   // This has the downside of resetting values for different priority renders,
    //   // But works for yielding (the common case) and should support resuming.
    //   workInProgress.actualDuration = 0;
    //   workInProgress.actualStartTime = -1;
    // }
  }

  // Reset all effects except static ones.
  // Static effects are not specific to a render.
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // Clone the dependencies object. This is mutated during the render phase, so
  // it cannot be shared with the current fiber.
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          lanes: currentDependencies.lanes,
          firstContext: currentDependencies.firstContext,
        };

  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  // if (enableProfilerTimer) {
  //   workInProgress.selfBaseDuration = current.selfBaseDuration;
  //   workInProgress.treeBaseDuration = current.treeBaseDuration;
  // }

  // if (__DEV__) {
  //   workInProgress._debugNeedsRemount = current._debugNeedsRemount;
  //   switch (workInProgress.tag) {
  //     case IndeterminateComponent:
  //     case FunctionComponent:
  //     case SimpleMemoComponent:
  //       workInProgress.type = resolveFunctionForHotReloading(current.type);
  //       break;
  //     case ClassComponent:
  //       workInProgress.type = resolveClassForHotReloading(current.type);
  //       break;
  //     case ForwardRef:
  //       workInProgress.type = resolveForwardRefForHotReloading(current.type);
  //       break;
  //     default:
  //       break;
  //   }
  // }

  return workInProgress;
}
