import { Fiber } from '../../../react-reconciler/ReactInternalTypes';
import { enableCreateEventHandleAPI } from '../../../shared/ReactFeatureFlags';
import { DOMEventName } from '../DOMEventNames';
import { registerSimpleEvents, topLevelEventsToReactNames } from '../DOMEventProperties';
import {
  DispatchQueue,
  accumulateEventHandleNonManagedNodeListeners,
  accumulateSinglePhaseListeners,
} from '../DOMPluginEventSystem';
import { EventSystemFlags } from '../EventSystemFlags';
import { AnyNativeEvent } from '../PluginModuleType';

import {
  SyntheticEvent,
  //   SyntheticKeyboardEvent,
  //   SyntheticFocusEvent,
  SyntheticMouseEvent,
  //   SyntheticDragEvent,
  //   SyntheticTouchEvent,
  //   SyntheticAnimationEvent,
  //   SyntheticTransitionEvent,
  //   SyntheticUIEvent,
  //   SyntheticWheelEvent,
  //   SyntheticClipboardEvent,
  //   SyntheticPointerEvent,
} from '../SyntheticEvent';

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return;
  }
  let SyntheticEventCtor = SyntheticEvent;
  let reactEventType: string = domEventName;

  // fixme: 优先看 click 事件就可以了, 其他事件暂时不关心
  switch (domEventName) {
    // case 'keypress':
    //   // Firefox creates a keypress event for function keys too. This removes
    //   // the unwanted keypress events. Enter is however both printable and
    //   // non-printable. One would expect Tab to be as well (but it isn't).
    //   if (getEventCharCode(nativeEvent as any as KeyboardEvent) === 0) {
    //     return;
    //   }
    // /* falls through */
    // case 'keydown':
    // case 'keyup':
    //   SyntheticEventCtor = SyntheticKeyboardEvent;
    //   break;
    // case 'focusin':
    //   reactEventType = 'focus';
    //   SyntheticEventCtor = SyntheticFocusEvent;
    //   break;
    // case 'focusout':
    //   reactEventType = 'blur';
    //   SyntheticEventCtor = SyntheticFocusEvent;
    //   break;
    // case 'beforeblur':
    // case 'afterblur':
    //   SyntheticEventCtor = SyntheticFocusEvent;
    //   break;
    case 'click':
      // Firefox creates a click event on right mouse clicks. This removes the
      // unwanted click events.
      // @ts-ignore
      if (nativeEvent.button === 2) {
        return;
      }
      /* falls through */
      // case 'auxclick':
      // case 'dblclick':
      // case 'mousedown':
      // case 'mousemove':
      // case 'mouseup':
      // // TODO: Disabled elements should not respond to mouse events
      // /* falls through */
      // case 'mouseout':
      // case 'mouseover':
      // case 'contextmenu':
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
    // case 'drag':
    // case 'dragend':
    // case 'dragenter':
    // case 'dragexit':
    // case 'dragleave':
    // case 'dragover':
    // case 'dragstart':
    // case 'drop':
    //   SyntheticEventCtor = SyntheticDragEvent;
    //   break;
    // case 'touchcancel':
    // case 'touchend':
    // case 'touchmove':
    // case 'touchstart':
    //   SyntheticEventCtor = SyntheticTouchEvent;
    //   break;
    // case ANIMATION_END:
    // case ANIMATION_ITERATION:
    // case ANIMATION_START:
    //   SyntheticEventCtor = SyntheticAnimationEvent;
    //   break;
    // case TRANSITION_END:
    //   SyntheticEventCtor = SyntheticTransitionEvent;
    //   break;
    // case 'scroll':
    //   SyntheticEventCtor = SyntheticUIEvent;
    //   break;
    // case 'wheel':
    //   SyntheticEventCtor = SyntheticWheelEvent;
    //   break;
    // case 'copy':
    // case 'cut':
    // case 'paste':
    //   SyntheticEventCtor = SyntheticClipboardEvent;
    //   break;
    // case 'gotpointercapture':
    // case 'lostpointercapture':
    // case 'pointercancel':
    // case 'pointerdown':
    // case 'pointermove':
    // case 'pointerout':
    // case 'pointerover':
    // case 'pointerup':
    //   SyntheticEventCtor = SyntheticPointerEvent;
    //   break;
    default:
      // Unknown event. This is used by createEventHandle.
      break;
  }

  const inCapturePhase = (eventSystemFlags & EventSystemFlags.IS_CAPTURE_PHASE) !== 0;

  if (
    enableCreateEventHandleAPI &&
    eventSystemFlags & EventSystemFlags.IS_EVENT_HANDLE_NON_MANAGED_NODE
  ) {
    const listeners = accumulateEventHandleNonManagedNodeListeners(
      // TODO: this cast may not make sense for events like
      // "focus" where React listens to e.g. "focusin".
      reactEventType as DOMEventName,
      targetContainer,
      inCapturePhase
    );
    if (listeners.length > 0) {
      // Intentionally create event lazily.
      const event = new SyntheticEventCtor(
        reactName,
        reactEventType,
        null,
        nativeEvent,
        nativeEventTarget
      );
      dispatchQueue.push({ event, listeners });
    }
  } else {
    // Some events don't bubble in the browser.
    // In the past, React has always bubbled them, but this can be surprising.
    // We're going to try aligning closer to the browser behavior by not bubbling
    // them in React either. We'll start by not bubbling onScroll, and then expand.
    const accumulateTargetOnly =
      !inCapturePhase &&
      // TODO: ideally, we'd eventually add all events from
      // nonDelegatedEvents list in DOMPluginEventSystem.
      // Then we can remove this special list.
      // This is a breaking change that can wait until React 18.
      domEventName === 'scroll';

    const listeners = accumulateSinglePhaseListeners(
      targetInst,
      reactName,
      nativeEvent.type,
      inCapturePhase,
      accumulateTargetOnly,
      nativeEvent
    );
    if (listeners.length > 0) {
      // Intentionally create event lazily.
      const event = new SyntheticEventCtor(
        reactName,
        reactEventType,
        null,
        nativeEvent,
        nativeEventTarget
      );
      dispatchQueue.push({ event, listeners });
    }
  }
}

export { registerSimpleEvents as registerEvents, extractEvents };
