import { mixed } from '../types';
import { Dependencies, Fiber } from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';
import { Lanes, NoLanes } from './ReactFiberLane';
import { Flags } from './ReactFiberFlags';
import { RefObject } from '../shared/ReactTypes';

// function FiberNode(tag: WorkTag, pendingProps: mixed, key: null | string, mode: TypeOfMode) {
//   // Instance
//   this.tag = tag;
//   this.key = key;
//   this.elementType = null;
//   this.type = null;
//   this.stateNode = null;

//   // Fiber
//   this.return = null;
//   this.child = null;
//   this.sibling = null;
//   this.index = 0;

//   this.ref = null;

//   this.pendingProps = pendingProps;
//   this.memoizedProps = null;
//   this.updateQueue = null;
//   this.memoizedState = null;
//   this.dependencies = null;

//   this.mode = mode;

//   // Effects
//   this.flags = NoFlags;
//   this.subtreeFlags = NoFlags;
//   this.deletions = null;

//   this.lanes = NoLanes;
//   this.childLanes = NoLanes;

//   this.alternate = null;

//   if (enableProfilerTimer) {
//     // Note: The following is done to avoid a v8 performance cliff.
//     //
//     // Initializing the fields below to smis and later updating them with
//     // double values will cause Fibers to end up having separate shapes.
//     // This behavior/bug has something to do with Object.preventExtension().
//     // Fortunately this only impacts DEV builds.
//     // Unfortunately it makes React unusably slow for some applications.
//     // To work around this, initialize the fields below with doubles.
//     //
//     // Learn more about this here:
//     // https://github.com/facebook/react/issues/14365
//     // https://bugs.chromium.org/p/v8/issues/detail?id=8538
//     this.actualDuration = Number.NaN;
//     this.actualStartTime = Number.NaN;
//     this.selfBaseDuration = Number.NaN;
//     this.treeBaseDuration = Number.NaN;

//     // It's okay to replace the initial doubles with smis after initialization.
//     // This won't trigger the performance cliff mentioned above,
//     // and it simplifies other profiler code (including DevTools).
//     this.actualDuration = 0;
//     this.actualStartTime = -1;
//     this.selfBaseDuration = 0;
//     this.treeBaseDuration = 0;
//   }
// }

class FiberNode {
  tag: WorkTag;
  key: null | string;
  elementType: any;
  type: null;
  stateNode: any;

  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;
  ref: null | (((handle: mixed) => void) & { _stringRef?: string } & mixed) | RefObject;

  pendingProps: any;
  memoizedProps: any;
  updateQueue: mixed | null;
  memoizedState: mixed | null;
  dependencies: Dependencies | null;
  mode: TypeOfMode;

  flags: Flags.NoFlags;
  subtreeFlags: Flags.NoFlags;
  deletions: Array<Fiber> | null;
  lanes: Lanes;
  childLanes: Lanes;
  alternate: Fiber | null;

  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;

  constructor(tag: WorkTag, pendingProps: mixed | null, key: null | string, mode: TypeOfMode) {
    this.tag = tag;
    this.key = key;
    this.elementType = null;
    this.type = null;
    this.stateNode = null;

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

    this.flags = Flags.NoFlags;
    this.subtreeFlags = Flags.NoFlags;
    this.deletions = null;
    this.lanes = NoLanes;
    this.childLanes = NoLanes;

    this.alternate = null;

    if (true) {
      this.actualDuration = Number.NaN;
      this.actualStartTime = Number.NaN;
      this.selfBaseDuration = Number.NaN;
      this.treeBaseDuration = Number.NaN;

      // After initialization, replace doubles with smis.
      this.actualDuration = 0;
      this.actualStartTime = -1;
      this.selfBaseDuration = 0;
      this.treeBaseDuration = 0;
    }
  }
}
// This is a constructor function, rather than a POJO constructor, still
// please ensure we do the following:
// 1) Nobody should add any instance methods on this. Instance methods can be
//    more difficult to predict when they get optimized and they are almost
//    never inlined properly in static compilers.
// 2) Nobody should rely on `instanceof Fiber` for type testing. We should
//    always know when it is a fiber.
// 3) We might want to experiment with using numeric keys since they are easier
//    to optimize in a non-JIT environment.
// 4) We can easily go from a constructor to a createFiber object literal if that
//    is faster.
// 5) It should be easy to port this to a C struct and keep a C implementation
//    compatible.
const createFiber = function (
  tag: WorkTag,
  pendingProps: mixed | null,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode) as unknown as Fiber;
};

export function createHostRootFiber(
  tag: RootTag,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean
): Fiber {
  let mode: TypeOfMode;
  if (tag === RootTag.ConcurrentRoot) {
    mode = TypeOfMode.ConcurrentMode;
    if (isStrictMode === true) {
      mode |= TypeOfMode.StrictLegacyMode;
    }
  } else {
    mode = TypeOfMode.NoMode;
  }

  return createFiber(WorkTag.HostRoot, null, null, mode);
}
