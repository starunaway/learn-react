import { mixed } from '../types';
import { Dependencies, Fiber } from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';
import { Lanes, NoLanes } from './ReactFiberLane';
import { Flags, StaticMask } from './ReactFiberFlags';
import { ReactFragment, RefObject } from '../shared/ReactTypes';
import { enableCache, enableProfilerTimer } from '../shared/ReactFeatureFlags';
import { ReactElement } from '../shared/ReactElementType';
import {
  REACT_CACHE_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_DEBUG_TRACING_MODE_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_LEGACY_HIDDEN_TYPE,
  REACT_MEMO_TYPE,
  REACT_OFFSCREEN_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_SCOPE_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_TRACING_MARKER_TYPE,
} from '../shared/ReactSymbols';

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

  constructor(tag: WorkTag, pendingProps: any, key: null | string, mode: TypeOfMode) {
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

    if (enableProfilerTimer) {
      // Note: The following is done to avoid a v8 performance cliff.
      //
      // Initializing the fields below to smis and later updating them with
      // double values will cause Fibers to end up having separate shapes.
      // This behavior/bug has something to do with Object.preventExtension().
      // Fortunately this only impacts DEV builds.
      // Unfortunately it makes React unusably slow for some applications.
      // To work around this, initialize the fields below with doubles.
      //
      // Learn more about this here:
      // https://github.com/facebook/react/issues/14365
      // https://bugs.chromium.org/p/v8/issues/detail?id=8538
      this.actualDuration = Number.NaN;
      this.actualStartTime = Number.NaN;
      this.selfBaseDuration = Number.NaN;
      this.treeBaseDuration = Number.NaN;

      // It's okay to replace the initial doubles with smis after initialization.
      // This won't trigger the performance cliff mentioned above,
      // and it simplifies other profiler code (including DevTools).
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
  pendingProps: any,
  key: null | string,
  mode: TypeOfMode
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode) as unknown as Fiber;
};

//220
function shouldConstruct(Component: Function) {
  console.log('这里是判断类组件还是函数组件');
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

// This is used to create an alternate fiber to do work on.
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

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    // Needed because Blocks store data on type.
    workInProgress.type = current.type;

    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.flags = Flags.NoFlags;

    // The effects are no longer valid.
    workInProgress.subtreeFlags = Flags.NoFlags;
    workInProgress.deletions = null;

    if (enableProfilerTimer) {
      // We intentionally reset, rather than copy, actualDuration & actualStartTime.
      // This prevents time from endlessly accumulating in new commits.
      // This has the downside of resetting values for different priority renders,
      // But works for yielding (the common case) and should support resuming.
      workInProgress.actualDuration = 0;
      workInProgress.actualStartTime = -1;
    }
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

  if (enableProfilerTimer) {
    workInProgress.selfBaseDuration = current.selfBaseDuration;
    workInProgress.treeBaseDuration = current.treeBaseDuration;
  }

  return workInProgress;
}

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

// 468
export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber | null {
  let fiberTag = WorkTag.IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = WorkTag.ClassComponent;
    } else {
    }
  } else if (typeof type === 'string') {
    fiberTag = WorkTag.HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, mode, lanes, key);
      case REACT_STRICT_MODE_TYPE:
        fiberTag = WorkTag.Mode;
        mode |= TypeOfMode.StrictLegacyMode;
        if ((mode & TypeOfMode.ConcurrentMode) !== TypeOfMode.NoMode) {
          // Strict effects should never run on legacy roots
          mode |= TypeOfMode.StrictEffectsMode;
        }
        break;
      case REACT_PROFILER_TYPE:
        console.error('createFiberFromTypeAndProps -> REACT_PROFILER_TYPE 未实现');
        // return createFiberFromProfiler(pendingProps, mode, lanes, key);
        return null;
      case REACT_SUSPENSE_TYPE:
        console.error('createFiberFromTypeAndProps -> REACT_SUSPENSE_TYPE 未实现');
        return null;

      // return createFiberFromSuspense(pendingProps, mode, lanes, key);

      case REACT_SUSPENSE_LIST_TYPE:
        console.error('createFiberFromTypeAndProps -> REACT_SUSPENSE_LIST_TYPE 未实现');
        return null;

      // return createFiberFromSuspenseList(pendingProps, mode, lanes, key);
      case REACT_OFFSCREEN_TYPE:
        console.error('createFiberFromTypeAndProps -> REACT_OFFSCREEN_TYPE 未实现');
        return null;

      // return createFiberFromOffscreen(pendingProps, mode, lanes, key);
      case REACT_LEGACY_HIDDEN_TYPE:

      // eslint-disable-next-line no-fallthrough
      case REACT_SCOPE_TYPE:

      // eslint-disable-next-line no-fallthrough
      case REACT_CACHE_TYPE:
        return createFiberFromCache(pendingProps, mode, lanes, key);
      // eslint-disable-next-line no-fallthrough
      case REACT_TRACING_MARKER_TYPE:

      // eslint-disable-next-line no-fallthrough
      case REACT_DEBUG_TRACING_MODE_TYPE:

      // eslint-disable-next-line no-fallthrough
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = WorkTag.ContextProvider;
              break getTag;
            case REACT_CONTEXT_TYPE:
              // This is a consumer
              fiberTag = WorkTag.ContextConsumer;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = WorkTag.ForwardRef;

              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = WorkTag.MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = WorkTag.LazyComponent;
              resolvedType = null;
              break getTag;
          }
        }
        let info = '';

        throw new Error(
          'Element type is invalid: expected a string (for built-in ' +
            'components) or a class/function (for composite components) ' +
            `but got: ${type == null ? type : typeof type}.${info}`
        );
      }
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.lanes = lanes;

  return fiber;
}

// 604
export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let owner = null;

  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes);

  return fiber!;
}

// 631
export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
): Fiber {
  const fiber = createFiber(WorkTag.Fragment, elements, key, mode);
  fiber.lanes = lanes;
  return fiber;
}

// 737
export function createFiberFromCache(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
) {
  const fiber = createFiber(WorkTag.CacheComponent, pendingProps, key, mode);
  fiber.elementType = REACT_CACHE_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

// 760
export function createFiberFromText(content: string, mode: TypeOfMode, lanes: Lanes): Fiber {
  const fiber = createFiber(WorkTag.HostText, content, null, mode);
  fiber.lanes = lanes;
  return fiber;
}
