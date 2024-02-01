import { Lane } from '../../react-reconciler/ReactFiberLane';
import { isRootDehydrated } from '../../react-reconciler/ReactFiberShellHydration';
import {
  getContainerFromFiber,
  getNearestMountedFiber,
  getSuspenseInstanceFromFiber,
} from '../../react-reconciler/ReactFiberTreeReflection';
import { Fiber, FiberRoot } from '../../react-reconciler/ReactInternalTypes';
import { WorkTag } from '../../react-reconciler/ReactWorkTags';
import { PriorityLevel, scheduleCallback } from '../../react-reconciler/Scheduler';
import { enableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay } from '../../shared/ReactFeatureFlags';
import { getClosestInstanceFromNode, getInstanceFromNode } from '../ReactDOMComponentTree';
import { Container, SuspenseInstance } from '../ReactFiberHostConfig';
import { DOMEventName } from './DOMEventNames';
import { dispatchEventForPluginEventSystem } from './DOMPluginEventSystem';
import { EventSystemFlags } from './EventSystemFlags';
import { AnyNativeEvent } from './PluginModuleType';
import { findInstanceBlockingEvent, return_targetInst } from './ReactDOMEventListener';
import { setReplayingEvent, resetReplayingEvent } from './CurrentReplayingEvent';

// TODO: Upgrade this definition once we're on a newer version of Flow that
// has this definition built-in.
type PointerEvent = Event & {
  pointerId: number;
  relatedTarget: EventTarget | null;
};

type QueuedReplayableEvent = {
  blockedOn: null | Container | SuspenseInstance;
  domEventName: DOMEventName;
  eventSystemFlags: EventSystemFlags;
  nativeEvent: AnyNativeEvent;
  targetContainers: Array<EventTarget>;
};

let hasScheduledReplayAttempt = false;

// The queue of discrete events to be replayed.
const queuedDiscreteEvents: Array<QueuedReplayableEvent> = [];

// Indicates if any continuous event targets are non-null for early bailout.
const hasAnyQueuedContinuousEvents: boolean = false;
// The last of each continuous event type. We only need to replay the last one
// if the last target was dehydrated.
let queuedFocus: null | QueuedReplayableEvent = null;
let queuedDrag: null | QueuedReplayableEvent = null;
let queuedMouse: null | QueuedReplayableEvent = null;
// For pointer events there can be one latest event per pointerId.
const queuedPointers: Map<number, QueuedReplayableEvent> = new Map();
const queuedPointerCaptures: Map<number, QueuedReplayableEvent> = new Map();
// We could consider replaying selectionchange and touchmoves too.

type QueuedHydrationTarget = {
  blockedOn: null | Container | SuspenseInstance;
  target: Node;
  priority: Lane;
};
const queuedExplicitHydrationTargets: Array<QueuedHydrationTarget> = [];

// Resets the replaying for this type of continuous event to no event.
export function clearIfContinuousEvent(
  domEventName: DOMEventName,
  nativeEvent: AnyNativeEvent
): void {
  // fixme: 这些类型的事件不影响源码主流程，先不关注
  //   switch (domEventName) {
  //     case 'focusin':
  //     case 'focusout':
  //       queuedFocus = null;
  //       break;
  //     case 'dragenter':
  //     case 'dragleave':
  //       queuedDrag = null;
  //       break;
  //     case 'mouseover':
  //     case 'mouseout':
  //       queuedMouse = null;
  //       break;
  //     case 'pointerover':
  //     case 'pointerout': {
  //       const pointerId = (nativeEvent as PointerEvent).pointerId;
  //       queuedPointers.delete(pointerId);
  //       break;
  //     }
  //     case 'gotpointercapture':
  //     case 'lostpointercapture': {
  //       const pointerId = (nativeEvent as PointerEvent).pointerId;
  //       queuedPointerCaptures.delete(pointerId);
  //       break;
  //     }
  //   }
}

export function queueIfContinuousEvent(
  blockedOn: null | Container | SuspenseInstance,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): boolean {
  // fixme: 这些类型的事件不影响源码主流程，先不关注
  // These set relatedTarget to null because the replayed event will be treated as if we
  // moved from outside the window (no target) onto the target once it hydrates.
  // Instead of mutating we could clone the event.
  // switch (domEventName) {
  //   case 'focusin': {
  //     const focusEvent = ((nativeEvent: any): FocusEvent);
  //     queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
  //       queuedFocus,
  //       blockedOn,
  //       domEventName,
  //       eventSystemFlags,
  //       targetContainer,
  //       focusEvent,
  //     );
  //     return true;
  //   }
  //   case 'dragenter': {
  //     const dragEvent = ((nativeEvent: any): DragEvent);
  //     queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
  //       queuedDrag,
  //       blockedOn,
  //       domEventName,
  //       eventSystemFlags,
  //       targetContainer,
  //       dragEvent,
  //     );
  //     return true;
  //   }
  //   case 'mouseover': {
  //     const mouseEvent = ((nativeEvent: any): MouseEvent);
  //     queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
  //       queuedMouse,
  //       blockedOn,
  //       domEventName,
  //       eventSystemFlags,
  //       targetContainer,
  //       mouseEvent,
  //     );
  //     return true;
  //   }
  //   case 'pointerover': {
  //     const pointerEvent = ((nativeEvent: any): PointerEvent);
  //     const pointerId = pointerEvent.pointerId;
  //     queuedPointers.set(
  //       pointerId,
  //       accumulateOrCreateContinuousQueuedReplayableEvent(
  //         queuedPointers.get(pointerId) || null,
  //         blockedOn,
  //         domEventName,
  //         eventSystemFlags,
  //         targetContainer,
  //         pointerEvent,
  //       ),
  //     );
  //     return true;
  //   }
  //   case 'gotpointercapture': {
  //     const pointerEvent = ((nativeEvent: any): PointerEvent);
  //     const pointerId = pointerEvent.pointerId;
  //     queuedPointerCaptures.set(
  //       pointerId,
  //       accumulateOrCreateContinuousQueuedReplayableEvent(
  //         queuedPointerCaptures.get(pointerId) || null,
  //         blockedOn,
  //         domEventName,
  //         eventSystemFlags,
  //         targetContainer,
  //         pointerEvent,
  //       ),
  //     );
  //     return true;
  //   }
  // }
  return false;
}

const discreteReplayableEvents: Array<DOMEventName> = [
  'mousedown',
  'mouseup',
  'touchcancel',
  'touchend',
  'touchstart',
  'auxclick',
  'dblclick',
  'pointercancel',
  'pointerdown',
  'pointerup',
  'dragend',
  'dragstart',
  'drop',
  'compositionend',
  'compositionstart',
  'keydown',
  'keypress',
  'keyup',
  'input',
  'textInput', // Intentionally camelCase
  'copy',
  'cut',
  'paste',
  'click',
  'change',
  'contextmenu',
  'reset',
  'submit',
];

export function isDiscreteEventThatRequiresHydration(eventType: DOMEventName): boolean {
  return discreteReplayableEvents.indexOf(eventType) > -1;
}

let _attemptSynchronousHydration: (Fiber: Fiber) => void;

export function setAttemptSynchronousHydration(fn: (fiber: Fiber) => void) {
  _attemptSynchronousHydration = fn;
}

export function attemptSynchronousHydration(fiber: Fiber) {
  _attemptSynchronousHydration(fiber);
}

let attemptDiscreteHydration: (fiber: Fiber) => void;

export function setAttemptDiscreteHydration(fn: (fiber: Fiber) => void) {
  attemptDiscreteHydration = fn;
}

let attemptContinuousHydration: (fiber: Fiber) => void;

export function setAttemptContinuousHydration(fn: (fiber: Fiber) => void) {
  attemptContinuousHydration = fn;
}

let attemptHydrationAtCurrentPriority: (fiber: Fiber) => void;

export function setAttemptHydrationAtCurrentPriority(fn: (fiber: Fiber) => void) {
  attemptHydrationAtCurrentPriority = fn;
}

let getCurrentUpdatePriority: () => Lane;

export function setGetCurrentUpdatePriority(fn: () => Lane) {
  getCurrentUpdatePriority = fn;
}

let attemptHydrationAtPriority: <T>(priority: Lane, fn: () => T) => T;

export function setAttemptHydrationAtPriority(fn: <T>(priority: Lane, fn: () => T) => T) {
  attemptHydrationAtPriority = fn;
}

// 388
// Check if this target is unblocked. Returns true if it's unblocked.
function attemptExplicitHydrationTarget(queuedTarget: QueuedHydrationTarget): void {
  // TODO: This function shares a lot of logic with findInstanceBlockingEvent.
  // Try to unify them. It's a bit tricky since it would require two return
  // values.
  const targetInst = getClosestInstanceFromNode(queuedTarget.target);
  if (targetInst !== null) {
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted !== null) {
      const tag = nearestMounted.tag;
      if (tag === WorkTag.SuspenseComponent) {
        const instance = getSuspenseInstanceFromFiber(nearestMounted);
        if (instance !== null) {
          // We're blocked on hydrating this boundary.
          // Increase its priority.
          queuedTarget.blockedOn = instance;
          attemptHydrationAtPriority(queuedTarget.priority, () => {
            attemptHydrationAtCurrentPriority(nearestMounted);
          });

          return;
        }
      } else if (tag === WorkTag.HostRoot) {
        const root: FiberRoot = nearestMounted.stateNode;
        if (isRootDehydrated(root)) {
          queuedTarget.blockedOn = getContainerFromFiber(nearestMounted);
          // We don't currently have a way to increase the priority of
          // a root other than sync.
          return;
        }
      }
    }
  }
  queuedTarget.blockedOn = null;
}
// 452
function attemptReplayContinuousQueuedEvent(queuedEvent: QueuedReplayableEvent): boolean {
  if (queuedEvent.blockedOn !== null) {
    return false;
  }
  const targetContainers = queuedEvent.targetContainers;
  while (targetContainers.length > 0) {
    const targetContainer = targetContainers[0];
    const nextBlockedOn = findInstanceBlockingEvent(
      queuedEvent.domEventName,
      queuedEvent.eventSystemFlags,
      targetContainer,
      queuedEvent.nativeEvent
    );
    if (nextBlockedOn === null) {
      if (enableCapturePhaseSelectiveHydrationWithoutDiscreteEventReplay) {
        const nativeEvent = queuedEvent.nativeEvent;
        const nativeEventClone = new (nativeEvent.constructor as any)(
          nativeEvent.type,
          nativeEvent as any
        );
        setReplayingEvent(nativeEventClone);
        nativeEvent.target!.dispatchEvent(nativeEventClone);
        resetReplayingEvent();
      } else {
        setReplayingEvent(queuedEvent.nativeEvent);
        dispatchEventForPluginEventSystem(
          queuedEvent.domEventName,
          queuedEvent.eventSystemFlags,
          queuedEvent.nativeEvent,
          return_targetInst,
          targetContainer
        );
        resetReplayingEvent();
      }
    } else {
      // We're still blocked. Try again later.
      const fiber = getInstanceFromNode(nextBlockedOn);
      if (fiber !== null) {
        attemptContinuousHydration(fiber);
      }
      queuedEvent.blockedOn = nextBlockedOn;
      return false;
    }
    // This target container was successfully dispatched. Try the next.
    targetContainers.shift();
  }
  return true;
}

function attemptReplayContinuousQueuedEventInMap(
  queuedEvent: QueuedReplayableEvent,
  key: number,
  map: Map<number, QueuedReplayableEvent>
): void {
  if (attemptReplayContinuousQueuedEvent(queuedEvent)) {
    map.delete(key);
  }
}

// 514
function replayUnblockedEvents() {
  hasScheduledReplayAttempt = false;

  // Next replay any continuous events.
  if (queuedFocus !== null && attemptReplayContinuousQueuedEvent(queuedFocus)) {
    queuedFocus = null;
  }
  if (queuedDrag !== null && attemptReplayContinuousQueuedEvent(queuedDrag)) {
    queuedDrag = null;
  }
  if (queuedMouse !== null && attemptReplayContinuousQueuedEvent(queuedMouse)) {
    queuedMouse = null;
  }
  queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
  queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
}

//  579
function scheduleCallbackIfUnblocked(
  queuedEvent: QueuedReplayableEvent,
  unblocked: Container | SuspenseInstance
) {
  if (queuedEvent.blockedOn === unblocked) {
    queuedEvent.blockedOn = null;
    if (!hasScheduledReplayAttempt) {
      hasScheduledReplayAttempt = true;
      // Schedule a callback to attempt replaying as many events as are
      // now unblocked. This first might not actually be unblocked yet.
      // We could check it early to avoid scheduling an unnecessary callback.
      scheduleCallback(PriorityLevel.NormalPriority, replayUnblockedEvents);
    }
  }
}

// 595
export function retryIfBlockedOn(unblocked: Container | SuspenseInstance): void {
  // Mark anything that was blocked on this as no longer blocked
  // and eligible for a replay.
  if (queuedDiscreteEvents.length > 0) {
    scheduleCallbackIfUnblocked(queuedDiscreteEvents[0], unblocked);
    // This is a exponential search for each boundary that commits. I think it's
    // worth it because we expect very few discrete events to queue up and once
    // we are actually fully unblocked it will be fast to replay them.
    for (let i = 1; i < queuedDiscreteEvents.length; i++) {
      const queuedEvent = queuedDiscreteEvents[i];
      if (queuedEvent.blockedOn === unblocked) {
        queuedEvent.blockedOn = null;
      }
    }
  }

  if (queuedFocus !== null) {
    scheduleCallbackIfUnblocked(queuedFocus, unblocked);
  }
  if (queuedDrag !== null) {
    scheduleCallbackIfUnblocked(queuedDrag, unblocked);
  }
  if (queuedMouse !== null) {
    scheduleCallbackIfUnblocked(queuedMouse, unblocked);
  }
  const unblock = (queuedEvent: QueuedReplayableEvent) =>
    scheduleCallbackIfUnblocked(queuedEvent, unblocked);
  queuedPointers.forEach(unblock);
  queuedPointerCaptures.forEach(unblock);

  for (let i = 0; i < queuedExplicitHydrationTargets.length; i++) {
    const queuedTarget = queuedExplicitHydrationTargets[i];
    if (queuedTarget.blockedOn === unblocked) {
      queuedTarget.blockedOn = null;
    }
  }

  while (queuedExplicitHydrationTargets.length > 0) {
    const nextExplicitTarget = queuedExplicitHydrationTargets[0];
    if (nextExplicitTarget.blockedOn !== null) {
      // We're still blocked.
      break;
    } else {
      attemptExplicitHydrationTarget(nextExplicitTarget);
      if (nextExplicitTarget.blockedOn === null) {
        // We're unblocked.
        queuedExplicitHydrationTargets.shift();
      }
    }
  }
}
