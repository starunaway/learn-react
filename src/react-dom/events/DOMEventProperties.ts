import { enableCreateEventHandleAPI } from '../../shared/ReactFeatureFlags';
import type { DOMEventName } from './DOMEventNames';
import { registerTwoPhaseEvent } from './EventRegistry';

export const topLevelEventsToReactNames: Map<DOMEventName, string | null> = new Map();

// NOTE: Capitalization is important in this list!
//
// E.g. it needs "pointerDown", not "pointerdown".
// This is because we derive both React name ("onPointerDown")
// and DOM name ("pointerdown") from the same list.
//
// Exceptions that don't match this convention are listed separately.
//
// prettier-ignore
const simpleEventPluginEvents = [
    'abort',
    'auxClick',
    'cancel',
    'canPlay',
    'canPlayThrough',
    'click',
    'close',
    'contextMenu',
    'copy',
    'cut',
    'drag',
    'dragEnd',
    'dragEnter',
    'dragExit',
    'dragLeave',
    'dragOver',
    'dragStart',
    'drop',
    'durationChange',
    'emptied',
    'encrypted',
    'ended',
    'error',
    'gotPointerCapture',
    'input',
    'invalid',
    'keyDown',
    'keyPress',
    'keyUp',
    'load',
    'loadedData',
    'loadedMetadata',
    'loadStart',
    'lostPointerCapture',
    'mouseDown',
    //read: 这里会在移动时触发一堆事件，现在先不管吧
    // 'mouseMove',
    // 'mouseOut',
    // 'mouseOver',
    'mouseUp',
    'paste',
    'pause',
    'play',
    'playing',
    'pointerCancel',
    'pointerDown',
    //read: 这里会在移动时触发一堆事件，现在先不管吧
    // 'pointerMove',
    // 'pointerOut',
    // 'pointerOver',
    'pointerUp',
    'progress',
    'rateChange',
    'reset',
    'resize',
    'seeked',
    'seeking',
    'stalled',
    'submit',
    'suspend',
    'timeUpdate',
    'touchCancel',
    'touchEnd',
    'touchStart',
    'volumeChange',
    'scroll',
    'toggle',
    'touchMove',
    'waiting',
    'wheel',
  ];

if (enableCreateEventHandleAPI) {
  //read: 这两个暂时不看
  // Special case: these two events don't have on* React handler
  // and are only accessible via the createEventHandle API.
  topLevelEventsToReactNames.set('beforeblur', null);
  topLevelEventsToReactNames.set('afterblur', null);
}

function registerSimpleEvent(domEventName: DOMEventName, reactName: string) {
  topLevelEventsToReactNames.set(domEventName, reactName);
  registerTwoPhaseEvent(reactName, [domEventName]);
}
export function registerSimpleEvents() {
  for (let i = 0; i < simpleEventPluginEvents.length; i++) {
    const eventName = simpleEventPluginEvents[i] as any as string;
    const domEventName = eventName.toLowerCase() as any as DOMEventName;
    const capitalizedEvent = eventName[0].toUpperCase() + eventName.slice(1);
    registerSimpleEvent(domEventName, 'on' + capitalizedEvent);
  }
  // Special cases where event names don't match.
  // fixme: 和动画相关的事件，暂时不看吧
  //   registerSimpleEvent(ANIMATION_END, 'onAnimationEnd');
  //   registerSimpleEvent(ANIMATION_ITERATION, 'onAnimationIteration');
  //   registerSimpleEvent(ANIMATION_START, 'onAnimationStart');
  registerSimpleEvent('dblclick', 'onDoubleClick');
  // fixme: 和交互相关的事件，暂时不看吧
  //   registerSimpleEvent('focusin', 'onFocus');
  //   registerSimpleEvent('focusout', 'onBlur');
  //   registerSimpleEvent(TRANSITION_END, 'onTransitionEnd');
}
