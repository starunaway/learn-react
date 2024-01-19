import {
  EventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from '../../react-reconciler/ReactEventPriorities';
import { isRootDehydrated } from '../../react-reconciler/ReactFiberShellHydration';
import {
  getContainerFromFiber,
  getNearestMountedFiber,
  getSuspenseInstanceFromFiber,
} from '../../react-reconciler/ReactFiberTreeReflection';
import { Fiber, FiberRoot } from '../../react-reconciler/ReactInternalTypes';
import { WorkTag } from '../../react-reconciler/ReactWorkTags';
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
  getCurrentPriorityLevel,
} from '../../react-reconciler/Scheduler';
import ReactSharedInternals from '../../react/ReactSharedInternals';
import { getClosestInstanceFromNode, getInstanceFromNode } from '../ReactDOMComponentTree';
import { Container, SuspenseInstance } from '../ReactFiberHostConfig';
import { DOMEventName } from './DOMEventNames';
import { EventSystemFlags } from './EventSystemFlags';
import { AnyNativeEvent } from './PluginModuleType';
import getEventTarget from './getEventTarget';
import { dispatchEventForPluginEventSystem } from './DOMPluginEventSystem';
import {
  attemptSynchronousHydration,
  clearIfContinuousEvent,
  isDiscreteEventThatRequiresHydration,
  queueIfContinuousEvent,
} from './ReactDOMEventReplaying';

const { ReactCurrentBatchConfig } = ReactSharedInternals;

/**
 * read: 不同的事件有不同的处理优先级
 * read: react 定义了不同事件的优先级，比如离散事件(click)/ 持续性事件(scroll/drag)等。不同的优先级通过不同的方式进行处理
 * read: 这里的代码感觉可以合成一出，区别只是setCurrentUpdatePriority,真正dispatchEvent都是一个
 */
export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags
): Function {
  const eventPriority = getEventPriority(domEventName);
  let listenerWrapper;
  switch (eventPriority) {
    case EventPriority.DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent;
      break;
    case EventPriority.ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent;
      break;
    case EventPriority.DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent;
      break;
  }
  return listenerWrapper.bind(null, domEventName, eventSystemFlags, targetContainer);
}

/**
 * read: 大部分事件都是离散事件
 * @param domEventName
 * @param eventSystemFlags
 * @param container
 * @param nativeEvent
 */
function dispatchDiscreteEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = null;
  try {
    setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

function dispatchContinuousEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = null;
  try {
    setCurrentUpdatePriority(EventPriority.ContinuousEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

// TODO: can we stop exporting these?
export let _enabled = true;

// This is exported in FB builds for use by legacy FB layer infra.
// We'd like to remove this but it's not clear if this is safe.
export function setEnabled(enabled?: boolean) {
  _enabled = !!enabled;
}

export function isEnabled() {
  return _enabled;
}

export function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  if (!_enabled) {
    return;
  }
  dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent
  );
}

export let return_targetInst: Fiber | null = null;

function dispatchEventWithEnableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  let blockedOn = findInstanceBlockingEvent(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent
  );
  if (blockedOn === null) {
    dispatchEventForPluginEventSystem(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      return_targetInst,
      targetContainer
    );
    clearIfContinuousEvent(domEventName, nativeEvent);
    return;
  }

  if (
    queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent)
  ) {
    nativeEvent.stopPropagation();
    return;
  }
  // We need to clear only if we didn't queue because
  // queueing is accumulative.
  clearIfContinuousEvent(domEventName, nativeEvent);

  if (
    eventSystemFlags & EventSystemFlags.IS_CAPTURE_PHASE &&
    isDiscreteEventThatRequiresHydration(domEventName)
  ) {
    while (blockedOn !== null) {
      const fiber = getInstanceFromNode(blockedOn);
      if (fiber !== null) {
        attemptSynchronousHydration(fiber);
      }
      const nextBlockedOn = findInstanceBlockingEvent(
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent
      );
      if (nextBlockedOn === null) {
        dispatchEventForPluginEventSystem(
          domEventName,
          eventSystemFlags,
          nativeEvent,
          return_targetInst,
          targetContainer
        );
      }
      if (nextBlockedOn === blockedOn) {
        break;
      }
      blockedOn = nextBlockedOn;
    }
    if (blockedOn !== null) {
      nativeEvent.stopPropagation();
    }
    return;
  }

  // This is not replayable so we'll invoke it but without a target,
  // in case the event system needs to trace it.
  dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    null,
    targetContainer
  );
}

/**
 * read: 前 3 个参数已经确定没有用到，在其他使用该函数的地方, 可以删除了
 * @param domEventName
 * @param eventSystemFlags
 * @param targetContainer
 * @param nativeEvent
 * @returns
 */
export function findInstanceBlockingEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): null | Container | SuspenseInstance {
  // TODO: Warn if _enabled is false.

  return_targetInst = null;

  const nativeEventTarget = getEventTarget(nativeEvent);
  let targetInst = getClosestInstanceFromNode(nativeEventTarget);

  if (targetInst !== null) {
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted === null) {
      // This tree has been unmounted already. Dispatch without a target.
      targetInst = null;
    } else {
      const tag = nearestMounted.tag;
      if (tag === WorkTag.SuspenseComponent) {
        // read: 这里是 Suspense 组件, 将事件挂载到实例上
        // read: 如果是 Suspense 的 fallback 上的事件监听呢？需要看 Suspense的实现
        const instance = getSuspenseInstanceFromFiber(nearestMounted);
        if (instance !== null) {
          // Queue the event to be replayed later. Abort dispatching since we
          // don't want this event dispatched twice through the event system.
          // TODO: If this is the first discrete event in the queue. Schedule an increased
          // priority for this boundary.
          return instance;
        }
        // This shouldn't happen, something went wrong but to avoid blocking
        // the whole system, dispatch the event without a target.
        // TODO: Warn.
        targetInst = null;
      } else if (tag === WorkTag.HostRoot) {
        const root: FiberRoot = nearestMounted.stateNode;
        if (isRootDehydrated(root)) {
          // If this happens during a replay something went wrong and it might block
          // the whole system.
          return getContainerFromFiber(nearestMounted);
        }
        targetInst = null;
      } else if (nearestMounted !== targetInst) {
        // If we get an event (ex: img onload) before committing that
        // component's mount, ignore it for now (that is, treat it as if it was an
        // event on a non-React tree). We might also consider queueing events and
        // dispatching them after the mount.
        targetInst = null;
      }
    }
  }
  return_targetInst = targetInst;
  // We're not blocked on anything.
  return null;
}

export function getEventPriority(domEventName: DOMEventName): EventPriority {
  switch (domEventName) {
    // Used by SimpleEventPlugin:
    case 'cancel':
    case 'click':
    case 'close':
    case 'contextmenu':
    case 'copy':
    case 'cut':
    case 'auxclick':
    case 'dblclick':
    case 'dragend':
    case 'dragstart':
    case 'drop':
    case 'focusin':
    case 'focusout':
    case 'input':
    case 'invalid':
    case 'keydown':
    case 'keypress':
    case 'keyup':
    case 'mousedown':
    case 'mouseup':
    case 'paste':
    case 'pause':
    case 'play':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointerup':
    case 'ratechange':
    case 'reset':
    case 'resize':
    case 'seeked':
    case 'submit':
    case 'touchcancel':
    case 'touchend':
    case 'touchstart':
    case 'volumechange':
    // Used by polyfills:
    // eslint-disable-next-line no-fallthrough
    case 'change':
    case 'selectionchange':
    case 'textInput':
    case 'compositionstart':
    case 'compositionend':
    case 'compositionupdate':
    // Only enableCreateEventHandleAPI:
    // eslint-disable-next-line no-fallthrough
    case 'beforeblur':
    case 'afterblur':
    // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough
    case 'beforeinput':
    case 'blur':
    case 'fullscreenchange':
    case 'focus':
    case 'hashchange':
    case 'popstate':
    case 'select':
    case 'selectstart':
      return EventPriority.DiscreteEventPriority;
    case 'drag':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'toggle':
    case 'touchmove':
    case 'wheel':
    // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough
    case 'mouseenter':
    case 'mouseleave':
    case 'pointerenter':
    case 'pointerleave':
      return EventPriority.ContinuousEventPriority;
    case 'message': {
      // We might be in the Scheduler callback.
      // Eventually this mechanism will be replaced by a check
      // of the current priority on the native scheduler.
      // read: message 事件可能出现在 postMessage，这个时候要根据调度的优先级来决定触发顺序
      const schedulerPriority = getCurrentPriorityLevel();
      switch (schedulerPriority) {
        case ImmediatePriority:
          return EventPriority.DiscreteEventPriority;
        case UserBlockingPriority:
          return EventPriority.ContinuousEventPriority;
        case NormalPriority:
        case LowPriority:
          // TODO: Handle LowSchedulerPriority, somehow. Maybe the same lane as hydration.
          return EventPriority.DefaultEventPriority;
        case IdlePriority:
          return EventPriority.IdleEventPriority;
        default:
          return EventPriority.DefaultEventPriority;
      }
    }
    default:
      return EventPriority.DefaultEventPriority;
  }
}
