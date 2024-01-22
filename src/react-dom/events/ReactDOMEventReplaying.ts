import { Lane } from '../../react-reconciler/ReactFiberLane';
import { Fiber } from '../../react-reconciler/ReactInternalTypes';
import { Container, SuspenseInstance } from '../ReactFiberHostConfig';
import { DOMEventName } from './DOMEventNames';
import { EventSystemFlags } from './EventSystemFlags';
import { AnyNativeEvent } from './PluginModuleType';

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
