import { REACT_FRAGMENT_TYPE } from '@/shared/ReactSymbols';
import { ReactElement, ReactFragment, ReactPortal, RefObject } from '../shared/ReactTypes';
import { Flags, NoFlags, StaticMask } from './ReactFiberFlags';
import { Lane, Lanes, NoLanes } from './ReactFiberLane';
import { Fiber } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import {
  ClassComponent,
  Fragment,
  HostComponent,
  HostPortal,
  HostText,
  IndeterminateComponent,
  WorkTag,
} from './ReactWorkTags';

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

export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let fiberTag: WorkTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
      // if (__DEV__) {
      //   resolvedType = resolveClassForHotReloading(resolvedType);
      // }
    } else {
      // if (__DEV__) {
      //   resolvedType = resolveFunctionForHotReloading(resolvedType);
      // }
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, mode, lanes, key);
      // case REACT_STRICT_MODE_TYPE:
      //   fiberTag = Mode;
      //   mode |= StrictLegacyMode;
      //   // if (enableStrictEffects && (mode & ConcurrentMode) !== NoMode) {
      //   //   // Strict effects should never run on legacy roots
      //   //   mode |= StrictEffectsMode;
      //   // }
      //   break;
      // case REACT_PROFILER_TYPE:
      //   return createFiberFromProfiler(pendingProps, mode, lanes, key);
      // case REACT_SUSPENSE_TYPE:
      //   return createFiberFromSuspense(pendingProps, mode, lanes, key);
      // case REACT_SUSPENSE_LIST_TYPE:
      //   return createFiberFromSuspenseList(pendingProps, mode, lanes, key);
      // case REACT_OFFSCREEN_TYPE:
      //   return createFiberFromOffscreen(pendingProps, mode, lanes, key);
      // case REACT_LEGACY_HIDDEN_TYPE:
      //   if (enableLegacyHidden) {
      //     return createFiberFromLegacyHidden(pendingProps, mode, lanes, key);
      //   }
      // // eslint-disable-next-line no-fallthrough
      // case REACT_SCOPE_TYPE:
      //   if (enableScopeAPI) {
      //     return createFiberFromScope(type, pendingProps, mode, lanes, key);
      //   }
      // // eslint-disable-next-line no-fallthrough
      // case REACT_CACHE_TYPE:
      //   if (enableCache) {
      //     return createFiberFromCache(pendingProps, mode, lanes, key);
      //   }
      // eslint-disable-next-line no-fallthrough
      // case REACT_TRACING_MARKER_TYPE:
      //   if (enableTransitionTracing) {
      //     return createFiberFromTracingMarker(pendingProps, mode, lanes, key);
      //   }
      // // eslint-disable-next-line no-fallthrough
      // case REACT_DEBUG_TRACING_MODE_TYPE:
      //   if (enableDebugTracing) {
      //     fiberTag = Mode;
      //     mode |= DebugTracingMode;
      //     break;
      //   }
      // eslint-disable-next-line no-fallthrough
      default: {
        if (typeof type === 'object' && type !== null) {
          console.error('ReactFiber.ts: 走到了未实现的逻辑 ');
          // switch (type.$$typeof) {
          //   case REACT_PROVIDER_TYPE:
          //     fiberTag = ContextProvider;
          //     break getTag;
          //   case REACT_CONTEXT_TYPE:
          //     // This is a consumer
          //     fiberTag = ContextConsumer;
          //     break getTag;
          //   case REACT_FORWARD_REF_TYPE:
          //     fiberTag = ForwardRef;
          //     if (__DEV__) {
          //       resolvedType = resolveForwardRefForHotReloading(resolvedType);
          //     }
          //     break getTag;
          //   case REACT_MEMO_TYPE:
          //     fiberTag = MemoComponent;
          //     break getTag;
          //   case REACT_LAZY_TYPE:
          //     fiberTag = LazyComponent;
          //     resolvedType = null;
          //     break getTag;
          // }
        }
        let info = '';
        // if (__DEV__) {
        //   if (
        //     type === undefined ||
        //     (typeof type === 'object' &&
        //       type !== null &&
        //       Object.keys(type).length === 0)
        //   ) {
        //     info +=
        //       ' You likely forgot to export your component from the file ' +
        //       "it's defined in, or you might have mixed up default and " +
        //       'named imports.';
        //   }
        //   const ownerName = owner ? getComponentNameFromFiber(owner) : null;
        //   if (ownerName) {
        //     info += '\n\nCheck the render method of `' + ownerName + '`.';
        //   }
        // }

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

  // if (__DEV__) {
  //   fiber._debugOwner = owner;
  // }

  return fiber;
}

export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let owner = null;
  // if (__DEV__) {
  //   owner = element._owner;
  // }
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes);
  // if (__DEV__) {
  //   fiber._debugSource = element._source;
  //   fiber._debugOwner = element._owner;
  // }
  return fiber;
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromText(content: string, mode: TypeOfMode, lanes: Lanes): Fiber {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromPortal(portal: ReactPortal, mode: TypeOfMode, lanes: Lanes): Fiber {
  const pendingProps = portal.children !== null ? portal.children : [];
  const fiber = createFiber(HostPortal, pendingProps, portal.key, mode);
  fiber.lanes = lanes;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    pendingChildren: null, // Used by persistent updates
    implementation: portal.implementation,
  };
  return fiber;
}

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}
