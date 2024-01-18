import { Fiber } from '../../react-reconciler/ReactInternalTypes';
import { WorkTag } from '../../react-reconciler/ReactWorkTags';
import { mixed } from '../../types';
import { getClosestInstanceFromNode } from '../ReactDOMComponentTree';
import { DOMEventName } from './DOMEventNames';
import { batchedUpdates } from './ReactDOMUpdateBatching';
import getEventTarget from './getEventTarget';

import {
  addEventBubbleListener,
  addEventBubbleListenerWithPassiveFlag,
  addEventCaptureListener,
  addEventCaptureListenerWithPassiveFlag,
} from './EventListener';
import { allNativeEvents } from './EventRegistry';
import { EventSystemFlags, SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS } from './EventSystemFlags';
import { AnyNativeEvent } from './PluginModuleType';
import type { ReactSyntheticEvent } from './ReactSyntheticEventType';
import { createEventListenerWrapperWithPriority } from './ReactDOMEventListener';

// import * as BeforeInputEventPlugin from './plugins/BeforeInputEventPlugin';
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin';
// import * as EnterLeaveEventPlugin from './plugins/EnterLeaveEventPlugin';
// import * as SelectEventPlugin from './plugins/SelectEventPlugin';
import * as SimpleEventPlugin from './plugins/SimpleEventPlugin';
import {
  invokeGuardedCallbackAndCatchFirstError,
  rethrowCaughtError,
} from '../../shared/ReactErrorUtils';
import getListener from './getListener';

type DispatchListener = {
  instance: null | Fiber;
  listener: Function;
  currentTarget: EventTarget;
};

type DispatchEntry = {
  event: ReactSyntheticEvent;
  listeners: Array<DispatchListener>;
};

export type DispatchQueue = Array<DispatchEntry>;

// List of events that need to be individually attached to media elements.
export const mediaEventTypes: Array<DOMEventName> = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'resize',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
];

// We should not delegate these events to the container, but rather
// set them on the actual target element itself. This is primarily
// because these events do not consistently bubble in the DOM.
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'toggle',
  // In order to reduce bytes, we insert the above array of media events
  // into this Set. Note: the "error" event isn't an exclusive media event,
  // and can occur on other elements too. Rather than duplicate that event,
  // we just take it from the media events array.
  ...mediaEventTypes,
] as Array<DOMEventName>);

// TODO: remove top-level side effect.
// fixme: 优先看这两种类型的事件是怎么处理的，其他类型的合成事件先不看
SimpleEventPlugin.registerEvents();
// EnterLeaveEventPlugin.registerEvents();
// fixme: 优先看这两种类型的事件是怎么处理的，其他类型的合成事件先不看
ChangeEventPlugin.registerEvents();
// SelectEventPlugin.registerEvents();
// BeforeInputEventPlugin.registerEvents();

/**
 * 这里按事件类型，构建了dispatchQueue
 * @param dispatchQueue
 * @param domEventName
 * @param targetInst
 * @param nativeEvent
 * @param nativeEventTarget
 * @param eventSystemFlags
 * @param targetContainer
 */
function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
) {
  // TODO: we should remove the concept of a "SimpleEventPlugin".
  // This is the basic functionality of the event system. All
  // the other plugins are essentially polyfills. So the plugin
  // should probably be inlined somewhere and have its logic
  // be core the to event system. This would potentially allow
  // us to ship builds of React without the polyfilled plugins below.
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );
  const shouldProcessPolyfillPlugins =
    (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0;
  // We don't process these events unless we are in the
  // event's native "bubble" phase, which means that we're
  // not in the capture phase. That's because we emulate
  // the capture phase here still. This is a trade-off,
  // because in an ideal world we would not emulate and use
  // the phases properly, like we do with the SimpleEvent
  // plugin. However, the plugins below either expect
  // emulation (EnterLeave) or use state localized to that
  // plugin (BeforeInput, Change, Select). The state in
  // these modules complicates things, as you'll essentially
  // get the case where the capture phase event might change
  // state, only for the following bubble event to come in
  // later and not trigger anything as the state now
  // invalidates the heuristics of the event plugin. We
  // could alter all these plugins to work in such ways, but
  // that might cause other unknown side-effects that we
  // can't foresee right now.
  if (shouldProcessPolyfillPlugins) {
    // fixme: 优先点击/input事件是怎么处理的，其他类型的合成事件先不看
    // EnterLeaveEventPlugin.extractEvents(
    //   dispatchQueue,
    //   domEventName,
    //   targetInst,
    //   nativeEvent,
    //   nativeEventTarget,
    //   eventSystemFlags,
    //   targetContainer
    // );
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer
    );
    // fixme: 优先点击/input事件是怎么处理的，其他类型的合成事件先不看
    // SelectEventPlugin.extractEvents(
    //   dispatchQueue,
    //   domEventName,
    //   targetInst,
    //   nativeEvent,
    //   nativeEventTarget,
    //   eventSystemFlags,
    //   targetContainer
    // );
    // fixme: 优先点击/input事件是怎么处理的，其他类型的合成事件先不看
    // BeforeInputEventPlugin.extractEvents(
    //   dispatchQueue,
    //   domEventName,
    //   targetInst,
    //   nativeEvent,
    //   nativeEventTarget,
    //   eventSystemFlags,
    //   targetContainer
    // );
  }
}

const listeningMarker = '_reactListening' + Math.random().toString(36).slice(2);

export function listenToAllSupportedEvents(rootContainerElement: EventTarget & mixed) {
  if (!rootContainerElement[listeningMarker]) {
    rootContainerElement[listeningMarker] = true;
    allNativeEvents.forEach((domEventName) => {
      // We handle selectionchange separately because it
      // doesn't bubble and needs to be on the document.
      if (domEventName !== 'selectionchange') {
        if (!nonDelegatedEvents.has(domEventName)) {
          listenToNativeEvent(domEventName, false, rootContainerElement);
        }
        listenToNativeEvent(domEventName, true, rootContainerElement);
      }
    });
    const ownerDocument =
      rootContainerElement.nodeType === Node.DOCUMENT_NODE
        ? rootContainerElement
        : rootContainerElement.ownerDocument;
    if (ownerDocument !== null) {
      // The selectionchange event also needs deduplication
      // but it is attached to the document.
      if (!ownerDocument[listeningMarker]) {
        ownerDocument[listeningMarker] = true;
        listenToNativeEvent('selectionchange', false, ownerDocument);
      }
    }
  }
}

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget
): void {
  const type = event.type || 'unknown-event';
  event.currentTarget = currentTarget;
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
  event.currentTarget = null;
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean
): void {
  let previousInstance;
  //read: React 管理了注册事件的顺序。冒泡和捕获阶段虽然在一个数组里，但已经通过下标区分了，不需要循环两次
  if (inCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}

export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags
): void {
  const inCapturePhase = (eventSystemFlags & EventSystemFlags.IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i];
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
    //  event system doesn't use pooling.
  }
  // This would be a good time to rethrow if any of the event handlers threw.
  rethrowCaughtError();
}

function dispatchEventsForPlugins(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget
): void {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const dispatchQueue: DispatchQueue = [];
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

/**
 * read: react 合成事件，不同类型的事件有不同的触发优先级
 * read: react 监听了所有类型的事件，在具体的 dom 元素上再做 dispatchEvent，以达到优先级控制的目的
 * @param domEventName
 * @param isCapturePhaseListener
 * @param target
 */
export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget
): void {
  let eventSystemFlags = 0;
  if (isCapturePhaseListener) {
    eventSystemFlags |= EventSystemFlags.IS_CAPTURE_PHASE;
  }
  addTrappedEventListener(target, domEventName, eventSystemFlags, isCapturePhaseListener);
}

function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean
) {
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );
  // If passive option is not supported, then the event will be
  // active and not passive.
  let isPassiveListener = undefined;
  if (true) {
    // Browsers introduced an intervention, making these events
    // passive by default on document. React doesn't bind them
    // to document anymore, but changing this now would undo
    // the performance wins from the change. So we emulate
    // the existing behavior manually on the roots now.
    // https://github.com/facebook/react/issues/19651
    if (domEventName === 'touchstart' || domEventName === 'touchmove' || domEventName === 'wheel') {
      isPassiveListener = true;
    }
  }

  // TODO: There are too many combinations here. Consolidate them.
  // read: 确实，感觉可以合并一下参数列表，本质上都是调用的 addEventListener
  if (isCapturePhaseListener) {
    // 捕获阶段
    if (isPassiveListener !== undefined) {
      addEventCaptureListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener
      );
    } else {
      addEventCaptureListener(targetContainer, domEventName, listener);
    }
  } else {
    // 冒泡阶段
    if (isPassiveListener !== undefined) {
      addEventBubbleListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener
      );
    } else {
      addEventBubbleListener(targetContainer, domEventName, listener);
    }
  }
}

function isMatchingRootContainer(grandContainer: Element, targetContainer: EventTarget): boolean {
  return (
    grandContainer === targetContainer ||
    (grandContainer.nodeType === Node.COMMENT_NODE && grandContainer.parentNode === targetContainer)
  );
}

export function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget
): void {
  let ancestorInst = targetInst;
  if (
    (eventSystemFlags & EventSystemFlags.IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
    (eventSystemFlags & EventSystemFlags.IS_NON_DELEGATED) === 0
  ) {
    const targetContainerNode = targetContainer;

    // fixme: 这里有 FB support flag，web 下先不关注
    // If we are using the legacy FB support flag, we
    // defer the event to the null with a one
    // time event listener so we can defer the event.
    // if (
    //   enableLegacyFBSupport &&
    //   // If our event flags match the required flags for entering
    //   // FB legacy mode and we are processing the "click" event,
    //   // then we can defer the event to the "document", to allow
    //   // for legacy FB support, where the expected behavior was to
    //   // match React < 16 behavior of delegated clicks to the doc.
    //   domEventName === 'click' &&
    //   (eventSystemFlags & SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE) === 0 &&
    //   !isReplayingEvent(nativeEvent)
    // ) {
    //   deferClickToDocumentForLegacyFBSupport(domEventName, targetContainer);
    //   return;
    // }
    if (targetInst !== null) {
      // The below logic attempts to work out if we need to change
      // the target fiber to a different ancestor. We had similar logic
      // in the legacy event system, except the big difference between
      // systems is that the modern event system now has an event listener
      // attached to each React Root and React Portal Root. Together,
      // the DOM nodes representing these roots are the "rootContainer".
      // To figure out which ancestor instance we should use, we traverse
      // up the fiber tree from the target instance and attempt to find
      // root boundaries that match that of our current "rootContainer".
      // If we find that "rootContainer", we find the parent fiber
      // sub-tree for that root and make that our ancestor instance.
      let node: Fiber | null = targetInst;

      mainLoop: while (true) {
        if (node === null) {
          return;
        }
        const nodeTag: WorkTag = node.tag;
        if (nodeTag === WorkTag.HostRoot || nodeTag === WorkTag.HostPortal) {
          let container: Element = node.stateNode.containerInfo;
          if (isMatchingRootContainer(container, targetContainerNode)) {
            break;
          }
          if (nodeTag === WorkTag.HostPortal) {
            // The target is a portal, but it's not the rootContainer we're looking for.
            // Normally portals handle their own events all the way down to the root.
            // So we should be able to stop now. However, we don't know if this portal
            // was part of *our* root.
            let grandNode = node.return;
            while (grandNode !== null) {
              const grandTag = grandNode.tag;
              if (grandTag === WorkTag.HostRoot || grandTag === WorkTag.HostPortal) {
                const grandContainer = grandNode.stateNode.containerInfo;
                if (isMatchingRootContainer(grandContainer, targetContainerNode)) {
                  // This is the rootContainer we're looking for and we found it as
                  // a parent of the Portal. That means we can ignore it because the
                  // Portal will bubble through to us.
                  return;
                }
              }
              grandNode = grandNode.return;
            }
          }
          // Now we need to find it's corresponding host fiber in the other
          // tree. To do this we can use getClosestInstanceFromNode, but we
          // need to validate that the fiber is a host instance, otherwise
          // we need to traverse up through the DOM till we find the correct
          // node that is from the other tree.
          while (container !== null) {
            const parentNode = getClosestInstanceFromNode(container);
            if (parentNode === null) {
              return;
            }
            const parentTag = parentNode.tag;
            if (parentTag === WorkTag.HostComponent || parentTag === WorkTag.HostText) {
              node = ancestorInst = parentNode;
              continue mainLoop;
            }
            container = container.parentNode as Element;
          }
        }
        node = node.return;
      }
    }
  }

  batchedUpdates(() =>
    dispatchEventsForPlugins(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      ancestorInst,
      targetContainer
    )
  );
}

// We should only use this function for:
// - BeforeInputEventPlugin
// - ChangeEventPlugin
// - SelectEventPlugin
// This is because we only process these plugins
// in the bubble phase, so we need to accumulate two
// phase event listeners (via emulation).
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string
): Array<DispatchListener> {
  const captureName = reactName + 'Capture';
  const listeners: Array<DispatchListener> = [];
  let instance = targetFiber;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const { stateNode, tag } = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === WorkTag.HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      const captureListener = getListener(instance, captureName);
      if (captureListener != null) {
        listeners.unshift(createDispatchListener(instance, captureListener, currentTarget));
      }
      const bubbleListener = getListener(instance, reactName);
      if (bubbleListener != null) {
        listeners.push(createDispatchListener(instance, bubbleListener, currentTarget));
      }
    }
    instance = instance.return;
  }
  return listeners;
}
function createDispatchListener(
  instance: null | Fiber,
  listener: Function,
  currentTarget: EventTarget
): DispatchListener {
  return {
    instance,
    listener,
    currentTarget,
  };
}
export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + 'Capture' : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  let listeners: Array<DispatchListener> = [];

  let instance = targetFiber;
  let lastHostComponent = null;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const { stateNode, tag } = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === WorkTag.HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      // Standard React on* listeners, i.e. onClick or onClickCapture
      if (reactEventName !== null) {
        const listener = getListener(instance, reactEventName);
        if (listener != null) {
          listeners.push(createDispatchListener(instance, listener, lastHostComponent));
        }
      }
    }
    // If we are only accumulating events for the target, then we don't
    // continue to propagate through the React fiber tree to find other
    // listeners.
    if (accumulateTargetOnly) {
      break;
    }

    instance = instance.return;
  }
  return listeners;
}
