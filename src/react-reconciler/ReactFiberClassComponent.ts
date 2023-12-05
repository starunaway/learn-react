import {
  ForceUpdate,
  ReplaceState,
  UpdateQueue,
  checkHasForceUpdateAfterProcessing,
  cloneUpdateQueue,
  createUpdate,
  enqueueUpdate,
  entangleTransitions,
  initializeUpdateQueue,
  processUpdateQueue,
  resetHasForceUpdateBeforeProcessing,
} from './ReactFiberClassUpdateQueue';
import { Flags, Snapshot, Update } from './ReactFiberFlags';
import { isMounted } from './ReactFiberTreeReflection';
import { requestEventTime, requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop';
import { Fiber } from './ReactInternalTypes';
import { get as getInstance, set as setInstance } from '@/shared/ReactInstanceMap';
import {
  cacheContext,
  getMaskedContext,
  getUnmaskedContext,
  hasContextChanged,
  emptyContextObject,
} from './ReactFiberContext';
import { checkIfContextChanged, readContext } from './ReactFiberNewContext';
import { Lanes, NoLanes } from './ReactFiberLane';
import { resolveDefaultProps } from './ReactFiberLazyComponent';
import shallowEqual from '@/shared/shallowEqual';
const disableLegacyContext = true;

// todo 这个移动到 react 包下面
const emptyObject = {};
Object.freeze(emptyObject);
export const emptyRefsObject = emptyObject;

const classComponentUpdater = {
  isMounted,
  enqueueSetState(inst: any, payload: any, callback?: (() => any) | null) {
    const fiber = getInstance(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);

    const update = createUpdate(eventTime, lane);
    update.payload = payload;
    if (callback !== undefined && callback !== null) {
      // if (__DEV__) {
      //   warnOnInvalidCallback(callback, 'setState');
      // }
      update.callback = callback;
    }

    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane, eventTime);
      entangleTransitions(root, fiber, lane);
    }

    //   if (__DEV__) {
    //     if (enableDebugTracing) {
    //       if (fiber.mode & DebugTracingMode) {
    //         const name = getComponentNameFromFiber(fiber) || 'Unknown';
    //         logStateUpdateScheduled(name, lane, payload);
    //       }
    //     }
    //   }

    //   if (enableSchedulingProfiler) {
    //     markStateUpdateScheduled(fiber, lane);
    //   }
  },
  enqueueReplaceState(inst: any, payload: any, callback?: (() => any) | null) {
    const fiber = getInstance(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);

    const update = createUpdate(eventTime, lane);
    update.tag = ReplaceState;
    update.payload = payload;

    if (callback !== undefined && callback !== null) {
      // if (__DEV__) {
      //   warnOnInvalidCallback(callback, 'replaceState');
      // }
      update.callback = callback;
    }

    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane, eventTime);
      entangleTransitions(root, fiber, lane);
    }

    //   if (__DEV__) {
    //     if (enableDebugTracing) {
    //       if (fiber.mode & DebugTracingMode) {
    //         const name = getComponentNameFromFiber(fiber) || 'Unknown';
    //         logStateUpdateScheduled(name, lane, payload);
    //       }
    //     }
    //   }

    //   if (enableSchedulingProfiler) {
    //     markStateUpdateScheduled(fiber, lane);
    //   }
  },
  enqueueForceUpdate(inst: any, callback?: (() => any) | null) {
    const fiber = getInstance(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);

    const update = createUpdate(eventTime, lane);
    update.tag = ForceUpdate;

    if (callback !== undefined && callback !== null) {
      // if (__DEV__) {
      //   warnOnInvalidCallback(callback, 'forceUpdate');
      // }
      update.callback = callback;
    }

    const root = enqueueUpdate(fiber, update, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane, eventTime);
      entangleTransitions(root, fiber, lane);
    }

    //   if (__DEV__) {
    //     if (enableDebugTracing) {
    //       if (fiber.mode & DebugTracingMode) {
    //         const name = getComponentNameFromFiber(fiber) || 'Unknown';
    //         logForceUpdateScheduled(name, lane);
    //       }
    //     }
    //   }

    //   if (enableSchedulingProfiler) {
    //     markForceUpdateScheduled(fiber, lane);
    //   }
  },
};

function applyDerivedStateFromProps(
  workInProgress: Fiber,
  ctor: any,
  getDerivedStateFromProps: (props: any, state: any) => any,
  nextProps: any
) {
  const prevState = workInProgress.memoizedState;
  let partialState = getDerivedStateFromProps(nextProps, prevState);
  // if (__DEV__) {
  //   if (
  //     debugRenderPhaseSideEffectsForStrictMode &&
  //     workInProgress.mode & StrictLegacyMode
  //   ) {
  //     setIsStrictModeForDevtools(true);
  //     try {
  //       // Invoke the function an extra time to help detect side-effects.
  //       partialState = getDerivedStateFromProps(nextProps, prevState);
  //     } finally {
  //       setIsStrictModeForDevtools(false);
  //     }
  //   }
  //   warnOnUndefinedDerivedState(ctor, partialState);
  // }
  // Merge the partial state and the previous state.
  const memoizedState =
    partialState === null || partialState === undefined
      ? prevState
      : Object.assign({}, prevState, partialState);
  workInProgress.memoizedState = memoizedState;

  // Once the update queue is empty, persist the derived state onto the
  // base state.
  if (workInProgress.lanes === NoLanes) {
    // Queue is always non-null for classes
    const updateQueue: UpdateQueue<any> = workInProgress.updateQueue;
    updateQueue.baseState = memoizedState;
  }
}

export function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance;
  // The instance needs access to the fiber so that it can schedule updates
  setInstance(instance, workInProgress);
  // if (__DEV__) {
  //   instance._reactInternalInstance = fakeInternalInstance;
  // }
}

export function constructClassInstance(workInProgress: Fiber, ctor: any, props: any): any {
  let isLegacyContextConsumer = false;
  let unmaskedContext = emptyContextObject;
  let context = emptyContextObject;
  const contextType = ctor.contextType;

  // if (__DEV__) {
  //   if ('contextType' in ctor) {
  //     const isValid =
  //       // Allow null for conditional declaration
  //       contextType === null ||
  //       (contextType !== undefined &&
  //         contextType.$$typeof === REACT_CONTEXT_TYPE &&
  //         contextType._context === undefined); // Not a <Context.Consumer>

  //     if (!isValid && !didWarnAboutInvalidateContextType.has(ctor)) {
  //       didWarnAboutInvalidateContextType.add(ctor);

  //       let addendum = '';
  //       if (contextType === undefined) {
  //         addendum =
  //           ' However, it is set to undefined. ' +
  //           'This can be caused by a typo or by mixing up named and default imports. ' +
  //           'This can also happen due to a circular dependency, so ' +
  //           'try moving the createContext() call to a separate file.';
  //       } else if (typeof contextType !== 'object') {
  //         addendum = ' However, it is set to a ' + typeof contextType + '.';
  //       } else if (contextType.$$typeof === REACT_PROVIDER_TYPE) {
  //         addendum = ' Did you accidentally pass the Context.Provider instead?';
  //       } else if (contextType._context !== undefined) {
  //         // <Context.Consumer>
  //         addendum = ' Did you accidentally pass the Context.Consumer instead?';
  //       } else {
  //         addendum =
  //           ' However, it is set to an object with keys {' +
  //           Object.keys(contextType).join(', ') +
  //           '}.';
  //       }
  //       console.error(
  //         '%s defines an invalid contextType. ' +
  //           'contextType should point to the Context object returned by React.createContext().%s',
  //         getComponentNameFromType(ctor) || 'Component',
  //         addendum,
  //       );
  //     }
  //   }
  // }

  if (typeof contextType === 'object' && contextType !== null) {
    context = readContext(contextType);
  } else if (!disableLegacyContext) {
    unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    const contextTypes = ctor.contextTypes;
    isLegacyContextConsumer = contextTypes !== null && contextTypes !== undefined;
    context = isLegacyContextConsumer
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyContextObject;
  }

  let instance = new ctor(props, context);
  // Instantiate twice to help detect side-effects.
  // if (__DEV__) {
  //   if (
  //     debugRenderPhaseSideEffectsForStrictMode &&
  //     workInProgress.mode & StrictLegacyMode
  //   ) {
  //     setIsStrictModeForDevtools(true);
  //     try {
  //       instance = new ctor(props, context); // eslint-disable-line no-new
  //     } finally {
  //       setIsStrictModeForDevtools(false);
  //     }
  //   }
  // }

  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined ? instance.state : null);
  adoptClassInstance(workInProgress, instance);

  // if (__DEV__) {
  //   if (typeof ctor.getDerivedStateFromProps === 'function' && state === null) {
  //     const componentName = getComponentNameFromType(ctor) || 'Component';
  //     if (!didWarnAboutUninitializedState.has(componentName)) {
  //       didWarnAboutUninitializedState.add(componentName);
  //       console.error(
  //         '`%s` uses `getDerivedStateFromProps` but its initial state is ' +
  //           '%s. This is not recommended. Instead, define the initial state by ' +
  //           'assigning an object to `this.state` in the constructor of `%s`. ' +
  //           'This ensures that `getDerivedStateFromProps` arguments have a consistent shape.',
  //         componentName,
  //         instance.state === null ? 'null' : 'undefined',
  //         componentName,
  //       );
  //     }
  //   }

  //   // If new component APIs are defined, "unsafe" lifecycles won't be called.
  //   // Warn about these lifecycles if they are present.
  //   // Don't warn about react-lifecycles-compat polyfilled methods though.
  //   if (
  //     typeof ctor.getDerivedStateFromProps === 'function' ||
  //     typeof instance.getSnapshotBeforeUpdate === 'function'
  //   ) {
  //     let foundWillMountName = null;
  //     let foundWillReceivePropsName = null;
  //     let foundWillUpdateName = null;
  //     if (
  //       typeof instance.componentWillMount === 'function' &&
  //       instance.componentWillMount.__suppressDeprecationWarning !== true
  //     ) {
  //       foundWillMountName = 'componentWillMount';
  //     } else if (typeof instance.UNSAFE_componentWillMount === 'function') {
  //       foundWillMountName = 'UNSAFE_componentWillMount';
  //     }
  //     if (
  //       typeof instance.componentWillReceiveProps === 'function' &&
  //       instance.componentWillReceiveProps.__suppressDeprecationWarning !== true
  //     ) {
  //       foundWillReceivePropsName = 'componentWillReceiveProps';
  //     } else if (
  //       typeof instance.UNSAFE_componentWillReceiveProps === 'function'
  //     ) {
  //       foundWillReceivePropsName = 'UNSAFE_componentWillReceiveProps';
  //     }
  //     if (
  //       typeof instance.componentWillUpdate === 'function' &&
  //       instance.componentWillUpdate.__suppressDeprecationWarning !== true
  //     ) {
  //       foundWillUpdateName = 'componentWillUpdate';
  //     } else if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
  //       foundWillUpdateName = 'UNSAFE_componentWillUpdate';
  //     }
  //     if (
  //       foundWillMountName !== null ||
  //       foundWillReceivePropsName !== null ||
  //       foundWillUpdateName !== null
  //     ) {
  //       const componentName = getComponentNameFromType(ctor) || 'Component';
  //       const newApiName =
  //         typeof ctor.getDerivedStateFromProps === 'function'
  //           ? 'getDerivedStateFromProps()'
  //           : 'getSnapshotBeforeUpdate()';
  //       if (!didWarnAboutLegacyLifecyclesAndDerivedState.has(componentName)) {
  //         didWarnAboutLegacyLifecyclesAndDerivedState.add(componentName);
  //         console.error(
  //           'Unsafe legacy lifecycles will not be called for components using new component APIs.\n\n' +
  //             '%s uses %s but also contains the following legacy lifecycles:%s%s%s\n\n' +
  //             'The above lifecycles should be removed. Learn more about this warning here:\n' +
  //             'https://reactjs.org/link/unsafe-component-lifecycles',
  //           componentName,
  //           newApiName,
  //           foundWillMountName !== null ? `\n  ${foundWillMountName}` : '',
  //           foundWillReceivePropsName !== null
  //             ? `\n  ${foundWillReceivePropsName}`
  //             : '',
  //           foundWillUpdateName !== null ? `\n  ${foundWillUpdateName}` : '',
  //         );
  //       }
  //     }
  //   }
  // }

  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (isLegacyContextConsumer) {
    cacheContext(workInProgress, unmaskedContext, context);
  }

  return instance;
}

export function mountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes
): void {
  // if (__DEV__) {
  //   checkClassInstance(workInProgress, ctor, newProps);
  // }

  const instance = workInProgress.stateNode;
  instance.props = newProps;
  instance.state = workInProgress.memoizedState;
  instance.refs = emptyRefsObject;

  initializeUpdateQueue(workInProgress);

  const contextType = ctor.contextType;
  if (typeof contextType === 'object' && contextType !== null) {
    instance.context = readContext(contextType);
  } else if (disableLegacyContext) {
    instance.context = emptyContextObject;
  } else {
    const unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    instance.context = getMaskedContext(workInProgress, unmaskedContext);
  }

  // if (__DEV__) {
  //   if (instance.state === newProps) {
  //     const componentName = getComponentNameFromType(ctor) || 'Component';
  //     if (!didWarnAboutDirectlyAssigningPropsToState.has(componentName)) {
  //       didWarnAboutDirectlyAssigningPropsToState.add(componentName);
  //       console.error(
  //         '%s: It is not recommended to assign props directly to state ' +
  //           "because updates to props won't be reflected in state. " +
  //           'In most cases, it is better to use props directly.',
  //         componentName,
  //       );
  //     }
  //   }

  //   if (workInProgress.mode & StrictLegacyMode) {
  //     ReactStrictModeWarnings.recordLegacyContextWarning(
  //       workInProgress,
  //       instance,
  //     );
  //   }

  //   if (warnAboutDeprecatedLifecycles) {
  //     ReactStrictModeWarnings.recordUnsafeLifecycleWarnings(
  //       workInProgress,
  //       instance,
  //     );
  //   }
  // }

  instance.state = workInProgress.memoizedState;

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(workInProgress, ctor, getDerivedStateFromProps, newProps);
    instance.state = workInProgress.memoizedState;
  }

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    typeof ctor.getDerivedStateFromProps !== 'function' &&
    typeof instance.getSnapshotBeforeUpdate !== 'function' &&
    (typeof instance.UNSAFE_componentWillMount === 'function' ||
      typeof instance.componentWillMount === 'function')
  ) {
    callComponentWillMount(workInProgress, instance);
    // If we had additional state updates during this life-cycle, let's
    // process them now.
    processUpdateQueue(workInProgress, newProps, instance, renderLanes);
    instance.state = workInProgress.memoizedState;
  }

  if (typeof instance.componentDidMount === 'function') {
    let fiberFlags: Flags = Update;
    // if (enableSuspenseLayoutEffectSemantics) {
    //   fiberFlags |= LayoutStatic;
    // }
    // if (__DEV__ && enableStrictEffects && (workInProgress.mode & StrictEffectsMode) !== NoMode) {
    //   fiberFlags |= MountLayoutDev;
    // }
    workInProgress.flags |= fiberFlags;
  }
}

function callComponentWillMount(workInProgress: Fiber, instance: any) {
  const oldState = instance.state;

  if (typeof instance.componentWillMount === 'function') {
    instance.componentWillMount();
  }
  if (typeof instance.UNSAFE_componentWillMount === 'function') {
    instance.UNSAFE_componentWillMount();
  }

  if (oldState !== instance.state) {
    //   if (__DEV__) {
    //     console.error(
    //       '%s.componentWillMount(): Assigning directly to this.state is ' +
    //         "deprecated (except inside a component's " +
    //         'constructor). Use setState instead.',
    //       getComponentNameFromFiber(workInProgress) || 'Component',
    //     );
    //   }
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
  }
}

function checkShouldComponentUpdate(
  workInProgress: Fiber,
  ctor: any,
  oldProps: any,
  newProps: any,
  oldState: any,
  newState: any,
  nextContext: any
) {
  const instance = workInProgress.stateNode;
  if (typeof instance.shouldComponentUpdate === 'function') {
    let shouldUpdate = instance.shouldComponentUpdate(newProps, newState, nextContext);
    //   if (__DEV__) {
    //     if (
    //       debugRenderPhaseSideEffectsForStrictMode &&
    //       workInProgress.mode & StrictLegacyMode
    //     ) {
    //       setIsStrictModeForDevtools(true);
    //       try {
    //         // Invoke the function an extra time to help detect side-effects.
    //         shouldUpdate = instance.shouldComponentUpdate(
    //           newProps,
    //           newState,
    //           nextContext,
    //         );
    //       } finally {
    //         setIsStrictModeForDevtools(false);
    //       }
    //     }
    //     if (shouldUpdate === undefined) {
    //       console.error(
    //         '%s.shouldComponentUpdate(): Returned undefined instead of a ' +
    //           'boolean value. Make sure to return true or false.',
    //         getComponentNameFromType(ctor) || 'Component',
    //       );
    //     }
    //   }

    return shouldUpdate;
  }

  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState);
  }

  return true;
}

export function resumeMountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes
): boolean {
  const instance = workInProgress.stateNode;

  const oldProps = workInProgress.memoizedProps;
  instance.props = oldProps;

  const oldContext = instance.context;
  const contextType = ctor.contextType;
  let nextContext = emptyContextObject;
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType);
  } else if (!disableLegacyContext) {
    const nextLegacyUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    nextContext = getMaskedContext(workInProgress, nextLegacyUnmaskedContext);
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
      typeof instance.componentWillReceiveProps === 'function')
  ) {
    if (oldProps !== newProps || oldContext !== nextContext) {
      callComponentWillReceiveProps(workInProgress, instance, newProps, nextContext);
    }
  }

  resetHasForceUpdateBeforeProcessing();

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  newState = workInProgress.memoizedState;
  if (
    oldProps === newProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidMount === 'function') {
      let fiberFlags: Flags = Update;
      //   if (enableSuspenseLayoutEffectSemantics) {
      //     fiberFlags |= LayoutStatic;
      //   }
      //   if (__DEV__ && enableStrictEffects && (workInProgress.mode & StrictEffectsMode) !== NoMode) {
      //     fiberFlags |= MountLayoutDev;
      //   }
      workInProgress.flags |= fiberFlags;
    }
    return false;
  }

  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(workInProgress, ctor, getDerivedStateFromProps, newProps);
    newState = workInProgress.memoizedState;
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext
    );

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillMount === 'function' ||
        typeof instance.componentWillMount === 'function')
    ) {
      if (typeof instance.componentWillMount === 'function') {
        instance.componentWillMount();
      }
      if (typeof instance.UNSAFE_componentWillMount === 'function') {
        instance.UNSAFE_componentWillMount();
      }
    }
    if (typeof instance.componentDidMount === 'function') {
      let fiberFlags: Flags = Update;
      //   if (enableSuspenseLayoutEffectSemantics) {
      //     fiberFlags |= LayoutStatic;
      //   }
      //   if (__DEV__ && enableStrictEffects && (workInProgress.mode & StrictEffectsMode) !== NoMode) {
      //     fiberFlags |= MountLayoutDev;
      //   }
      workInProgress.flags |= fiberFlags;
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidMount === 'function') {
      let fiberFlags: Flags = Update;
      //   if (enableSuspenseLayoutEffectSemantics) {
      //     fiberFlags |= LayoutStatic;
      //   }
      //   if (__DEV__ && enableStrictEffects && (workInProgress.mode & StrictEffectsMode) !== NoMode) {
      //     fiberFlags |= MountLayoutDev;
      //   }
      workInProgress.flags |= fiberFlags;
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;

  return shouldUpdate;
}

function callComponentWillReceiveProps(
  workInProgress: Fiber,
  instance: any,
  newProps: any,
  nextContext: any
) {
  const oldState = instance.state;
  if (typeof instance.componentWillReceiveProps === 'function') {
    instance.componentWillReceiveProps(newProps, nextContext);
  }
  if (typeof instance.UNSAFE_componentWillReceiveProps === 'function') {
    instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
  }

  if (instance.state !== oldState) {
    //   if (__DEV__) {
    //     const componentName =
    //       getComponentNameFromFiber(workInProgress) || 'Component';
    //     if (!didWarnAboutStateAssignmentForComponent.has(componentName)) {
    //       didWarnAboutStateAssignmentForComponent.add(componentName);
    //       console.error(
    //         '%s.componentWillReceiveProps(): Assigning directly to ' +
    //           "this.state is deprecated (except inside a component's " +
    //           'constructor). Use setState instead.',
    //         componentName,
    //       );
    //     }
    //   }
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
  }
}
// Invokes the update life-cycles and returns false if it shouldn't rerender.
export function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes
): boolean {
  const instance = workInProgress.stateNode;

  cloneUpdateQueue(current, workInProgress);

  const unresolvedOldProps = workInProgress.memoizedProps;
  const oldProps =
    workInProgress.type === workInProgress.elementType
      ? unresolvedOldProps
      : resolveDefaultProps(workInProgress.type, unresolvedOldProps);
  instance.props = oldProps;
  const unresolvedNewProps = workInProgress.pendingProps;

  const oldContext = instance.context;
  const contextType = ctor.contextType;
  let nextContext = emptyContextObject;
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType);
  } else if (!disableLegacyContext) {
    const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    nextContext = getMaskedContext(workInProgress, nextUnmaskedContext);
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
      typeof instance.componentWillReceiveProps === 'function')
  ) {
    if (unresolvedOldProps !== unresolvedNewProps || oldContext !== nextContext) {
      callComponentWillReceiveProps(workInProgress, instance, newProps, nextContext);
    }
  }

  resetHasForceUpdateBeforeProcessing();

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  newState = workInProgress.memoizedState;

  if (
    unresolvedOldProps === unresolvedNewProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing() &&
    !(
      /**enableLazyContextPropagation &&**/
      (
        current !== null &&
        current.dependencies !== null &&
        checkIfContextChanged(current.dependencies)
      )
    )
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (unresolvedOldProps !== current.memoizedProps || oldState !== current.memoizedState) {
        workInProgress.flags |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (unresolvedOldProps !== current.memoizedProps || oldState !== current.memoizedState) {
        workInProgress.flags |= Snapshot;
      }
    }
    return false;
  }

  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(workInProgress, ctor, getDerivedStateFromProps, newProps);
    newState = workInProgress.memoizedState;
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext
    ) ||
    false;
  // TODO: In some cases, we'll end up checking if context has changed twice,
  // both before and after `shouldComponentUpdate` has been called. Not ideal,
  // but I'm loath to refactor this function. This only happens for memoized
  // components so it's not that common.
  // (enableLazyContextPropagation &&
  //   current !== null &&
  //   current.dependencies !== null &&
  //   checkIfContextChanged(current.dependencies));

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function')
    ) {
      if (typeof instance.componentWillUpdate === 'function') {
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
    }
    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.flags |= Update;
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      workInProgress.flags |= Snapshot;
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (unresolvedOldProps !== current.memoizedProps || oldState !== current.memoizedState) {
        workInProgress.flags |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (unresolvedOldProps !== current.memoizedProps || oldState !== current.memoizedState) {
        workInProgress.flags |= Snapshot;
      }
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;

  return shouldUpdate;
}
