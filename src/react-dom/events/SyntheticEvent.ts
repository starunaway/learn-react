// This is intentionally a factory so that we have different returned constructors.

import { Fiber } from '../../react-reconciler/ReactInternalTypes';
import { AnyNativeEvent } from './PluginModuleType';

type EventInterfaceValue = 0 | ((event: any) => any);

type EventInterfaceType = {
  [propName: string]: EventInterfaceValue;
};

function functionThatReturnsTrue() {
  return true;
}

function functionThatReturnsFalse() {
  return false;
}

// If we had a single constructor, it would be megamorphic and engines would deopt.
function createSyntheticEvent(Interface: EventInterfaceType) {
  /**
   * Synthetic events are dispatched by event plugins, typically in response to a
   * top-level event delegation handler.
   *
   * These systems should generally use pooling to reduce the frequency of garbage
   * collection. The system should check `isPersistent` to determine whether the
   * event should be released into the pool after being dispatched. Users that
   * need a persisted event should invoke `persist`.
   *
   * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
   * normalizing browser quirks. Subclasses do not necessarily have to implement a
   * DOM interface; custom application-specific events can also subclass this.
   */
  //   function SyntheticBaseEvent(
  //     reactName: string | null,
  //     reactEventType: string,
  //     targetInst: Fiber,
  //     nativeEvent: mixed,
  //     nativeEventTarget: null | EventTarget
  //   ) {
  //     this._reactName = reactName;
  //     this._targetInst = targetInst;
  //     this.type = reactEventType;
  //     this.nativeEvent = nativeEvent;
  //     this.target = nativeEventTarget;
  //     this.currentTarget = null;

  //     for (const propName in Interface) {
  //       if (!Interface.hasOwnProperty(propName)) {
  //         continue;
  //       }
  //       const normalize = Interface[propName];
  //       if (normalize) {
  //         this[propName] = normalize(nativeEvent);
  //       } else {
  //         this[propName] = nativeEvent[propName];
  //       }
  //     }

  //     const defaultPrevented =
  //       nativeEvent.defaultPrevented != null
  //         ? nativeEvent.defaultPrevented
  //         : nativeEvent.returnValue === false;
  //     if (defaultPrevented) {
  //       this.isDefaultPrevented = functionThatReturnsTrue;
  //     } else {
  //       this.isDefaultPrevented = functionThatReturnsFalse;
  //     }
  //     this.isPropagationStopped = functionThatReturnsFalse;
  //     return this;
  //   }

  //   Object.assign(SyntheticBaseEvent.prototype, {
  //     preventDefault: function () {
  //       this.defaultPrevented = true;
  //       const event = this.nativeEvent;
  //       if (!event) {
  //         return;
  //       }

  //       if (event.preventDefault) {
  //         event.preventDefault();
  //         // $FlowFixMe - flow is not aware of `unknown` in IE
  //       } else if (typeof event.returnValue !== 'unknown') {
  //         event.returnValue = false;
  //       }
  //       this.isDefaultPrevented = functionThatReturnsTrue;
  //     },

  //     stopPropagation: function () {
  //       const event = this.nativeEvent;
  //       if (!event) {
  //         return;
  //       }

  //       if (event.stopPropagation) {
  //         event.stopPropagation();
  //         // $FlowFixMe - flow is not aware of `unknown` in IE
  //       } else if (typeof event.cancelBubble !== 'unknown') {
  //         // The ChangeEventPlugin registers a "propertychange" event for
  //         // IE. This event does not support bubbling or cancelling, and
  //         // any references to cancelBubble throw "Member not found".  A
  //         // typeof check of "unknown" circumvents this issue (and is also
  //         // IE specific).
  //         event.cancelBubble = true;
  //       }

  //       this.isPropagationStopped = functionThatReturnsTrue;
  //     },

  //     /**
  //      * We release all dispatched `SyntheticEvent`s after each event loop, adding
  //      * them back into the pool. This allows a way to hold onto a reference that
  //      * won't be added back into the pool.
  //      */
  //     persist: function () {
  //       // Modern event system doesn't use pooling.
  //     },

  //     /**
  //      * Checks if this event should be released back into the pool.
  //      *
  //      * @return {boolean} True if this should not be released, false otherwise.
  //      */
  //     isPersistent: functionThatReturnsTrue,
  //   });

  class SyntheticBaseEvent {
    _reactName: string | null;
    _targetInst: Fiber | null;
    type: string;
    nativeEvent: AnyNativeEvent;
    target: EventTarget | null;
    currentTarget: null;
    isDefaultPrevented: any;
    isPropagationStopped: any;
    defaultPrevented: boolean | undefined;
    constructor(
      reactName: string | null,
      reactEventType: string,
      // read: 这里可以传 null 进来，感觉很奇怪
      targetInst: Fiber | null,
      nativeEvent: AnyNativeEvent,
      nativeEventTarget: null | EventTarget
    ) {
      this._reactName = reactName;
      this._targetInst = targetInst;
      this.type = reactEventType;
      this.nativeEvent = nativeEvent;
      this.target = nativeEventTarget;
      this.currentTarget = null;

      for (const propName in Interface) {
        if (!Interface.hasOwnProperty(propName)) {
          continue;
        }
        const normalize = Interface[propName];
        if (normalize) {
          this[propName as keyof this] = normalize(nativeEvent);
        } else {
          this[propName as keyof this] = nativeEvent[propName as keyof AnyNativeEvent] as any;
        }
      }

      const defaultPrevented =
        nativeEvent.defaultPrevented != null
          ? nativeEvent.defaultPrevented
          : nativeEvent.returnValue === false;
      if (defaultPrevented) {
        this.isDefaultPrevented = functionThatReturnsTrue;
      } else {
        this.isDefaultPrevented = functionThatReturnsFalse;
      }
      this.isPropagationStopped = functionThatReturnsFalse;
      return this;
    }

    preventDefault() {
      this.defaultPrevented = true;
      const event = this.nativeEvent;
      if (!event) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      } else {
        event.returnValue = false;
      }
      this.isDefaultPrevented = functionThatReturnsTrue;
    }

    stopPropagation() {
      const event = this.nativeEvent;
      if (!event) {
        return;
      }

      if (event.stopPropagation) {
        event.stopPropagation();
        // $FlowFixMe - flow is not aware of `unknown` in IE
      } else {
        event.cancelBubble = true;
      }

      this.isPropagationStopped = functionThatReturnsTrue;
    }

    /**
     * We release all dispatched `SyntheticEvent`s after each event loop, adding
     * them back into the pool. This allows a way to hold onto a reference that
     * won't be added back into the pool.
     */
    persist() {
      // Modern event system doesn't use pooling.
    }

    /**
     * Checks if this event should be released back into the pool.
     *
     * @return {boolean} True if this should not be released, false otherwise.
     */
    isPersistent = functionThatReturnsTrue;
  }
  return SyntheticBaseEvent;
}

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const EventInterface: EventInterfaceType = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function (event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: 0,
  isTrusted: 0,
};
export const SyntheticEvent = createSyntheticEvent(EventInterface);

const UIEventInterface: EventInterfaceType = {
  ...EventInterface,
  view: 0,
  detail: 0,
};

// fixme: 后续需要补齐该类型的事件
// SyntheticKeyboardEvent,
// SyntheticFocusEvent,

let lastMovementX: number;
let lastMovementY: number;
let lastMouseEvent: MouseEvent | null = null;

function updateMouseMovementPolyfillState(event: MouseEvent) {
  if (event !== lastMouseEvent) {
    if (lastMouseEvent && event.type === 'mousemove') {
      lastMovementX = event.screenX - lastMouseEvent.screenX;
      lastMovementY = event.screenY - lastMouseEvent.screenY;
    } else {
      lastMovementX = 0;
      lastMovementY = 0;
    }
    lastMouseEvent = event;
  }
}

/**
 * @interface MouseEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const MouseEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  pageX: 0,
  pageY: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  // read: 这里是获取修饰符。后面不考虑兼容性，直接干掉
  // getModifierState: getEventModifierState,
  button: 0,
  buttons: 0,
  relatedTarget: function (event) {
    if (event.relatedTarget === undefined)
      return event.fromElement === event.srcElement ? event.toElement : event.fromElement;

    return event.relatedTarget;
  },
  movementX: function (event: MouseEvent) {
    if ('movementX' in event) {
      return event.movementX;
    }
    updateMouseMovementPolyfillState(event);
    return lastMovementX;
  },
  movementY: function (event: MouseEvent) {
    if ('movementY' in event) {
      return event.movementY;
    }
    // Don't need to call updateMouseMovementPolyfillState() here
    // because it's guaranteed to have already run when movementX
    // was copied.
    return lastMovementY;
  },
};
export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);

// fixme: 后续需要补齐该类型的事件
// SyntheticDragEvent,
// SyntheticTouchEvent,
// SyntheticAnimationEvent,
// SyntheticTransitionEvent,
// SyntheticUIEvent,
// SyntheticWheelEvent,
// SyntheticClipboardEvent,
// SyntheticPointerEvent,

// Older browsers (Safari <= 10, iOS Safari <= 10.2) do not support
// getModifierState. If getModifierState is not supported, we map it to a set of
// modifier keys exposed by the event. In this case, Lock-keys are not supported.
// function modifierStateGetter(this: any, keyArg: any) {
//   const syntheticEvent = this;
//   const nativeEvent = syntheticEvent.nativeEvent;
//   if (nativeEvent.getModifierState) {
//     return nativeEvent.getModifierState(keyArg);
//   }
//   return false;
// }

// function getEventModifierState() {
//   return modifierStateGetter;
// }
