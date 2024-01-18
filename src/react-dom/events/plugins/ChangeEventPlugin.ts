import { Fiber } from '../../../react-reconciler/ReactInternalTypes';
import { getNodeFromInstance } from '../../ReactDOMComponentTree';
import { InputWithWrapperState, setDefaultValue } from '../../ReactDOMInput';
import { updateValueIfChanged } from '../../inputValueTracking';
import isCustomComponent from '../../shared/isCustomComponent';
import { DOMEventName } from '../DOMEventNames';
import { DispatchQueue, accumulateTwoPhaseListeners } from '../DOMPluginEventSystem';
import { registerTwoPhaseEvent } from '../EventRegistry';
import { EventSystemFlags } from '../EventSystemFlags';
import { AnyNativeEvent } from '../PluginModuleType';
import { enqueueStateRestore } from '../ReactDOMControlledComponent';
import { SyntheticEvent } from '../SyntheticEvent';
import isTextInputElement from '../isTextInputElement';

function registerEvents() {
  registerTwoPhaseEvent('onChange', [
    'change',
    'click',
    'focusin',
    'focusout',
    'input',
    'keydown',
    'keyup',
    'selectionchange',
  ]);
}

function createAndAccumulateChangeEvent(
  dispatchQueue: DispatchQueue,
  inst: Fiber,
  nativeEvent: AnyNativeEvent,
  target: EventTarget | null
) {
  // Flag this event loop as needing state restore.
  enqueueStateRestore(target as Node);
  const listeners = accumulateTwoPhaseListeners(inst, 'onChange');
  if (listeners.length > 0) {
    const event = new SyntheticEvent('onChange', 'change', null, nativeEvent, target);
    dispatchQueue.push({ event, listeners });
  }
}

function getInstIfValueChanged(targetInst: Fiber | null) {
  if (!targetInst) return null;

  const targetNode = getNodeFromInstance(targetInst);
  if (updateValueIfChanged(targetNode as HTMLInputElement)) {
    return targetInst;
  }

  return null;
}

function getTargetInstForChangeEvent(
  domEventName: DOMEventName,
  targetInst: Fiber | null
): Fiber | null {
  if (domEventName === 'change') {
    return targetInst;
  }
  return null;
}

function getTargetInstForInputOrChangeEvent(
  domEventName: DOMEventName,
  targetInst: Fiber | null
): Fiber | null {
  if (domEventName === 'input' || domEventName === 'change') {
    return getInstIfValueChanged(targetInst);
  }
  return null;
}

function getTargetInstForClickEvent(
  domEventName: DOMEventName,
  targetInst: Fiber | null
): Fiber | null {
  if (domEventName === 'click') {
    return getInstIfValueChanged(targetInst);
  }
  return null;
}

/**
 * SECTION: handle `change` event
 */
function shouldUseChangeEvent(elem: Element | Text): boolean {
  const nodeName = elem.nodeName && elem.nodeName.toLowerCase();
  return (
    nodeName === 'select' || (nodeName === 'input' && (elem as HTMLInputElement).type === 'file')
  );
}

/**
 * SECTION: handle `click` event
 */
function shouldUseClickEvent(elem: HTMLInputElement) {
  // Use the `click` event to detect changes to checkbox and radio inputs.
  // This approach works across all browsers, whereas `change` does not fire
  // until `blur` in IE8.
  const nodeName = elem.nodeName;
  return (
    nodeName &&
    nodeName.toLowerCase() === 'input' &&
    (elem.type === 'checkbox' || elem.type === 'radio')
  );
}

function handleControlledInputBlur(node: InputWithWrapperState) {
  const state = node._wrapperState;

  if (!state || !state.controlled || node.type !== 'number') {
    return;
  }

  // If controlled, assign the value attribute to the current value on blur
  setDefaultValue(node, 'number', node.value);
}

/**
 * This plugin creates an `onChange` event that normalizes change events
 * across form elements. This event fires at a time when it's possible to
 * change the element's value without seeing a flicker.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - select
 */
function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: null | EventTarget
) {
  // read: getNodeFromInstance 可能会报错?
  const targetNode = targetInst ? getNodeFromInstance(targetInst) : window;

  let getTargetInstFunc:
    | null
    | ((domEventName: DOMEventName, targetInst: Fiber | null) => Fiber | null) = null;

  // read: 这里删除了对 IE9 的支持
  //   let handleEventFunc;
  if (shouldUseChangeEvent(targetNode as Element | Text)) {
    getTargetInstFunc = getTargetInstForChangeEvent;
  } else if (isTextInputElement(targetNode as HTMLElement)) {
    // read: 这里删除了对 IE9 的支持
    getTargetInstFunc = getTargetInstForInputOrChangeEvent;
  } else if (shouldUseClickEvent(targetNode as HTMLInputElement)) {
    getTargetInstFunc = getTargetInstForClickEvent;
  } else if (targetInst && isCustomComponent(targetInst.elementType, targetInst.memoizedProps)) {
    getTargetInstFunc = getTargetInstForChangeEvent;
  }

  if (getTargetInstFunc) {
    const inst = getTargetInstFunc(domEventName, targetInst);
    if (inst) {
      createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, nativeEventTarget);
      return;
    }
  }
  // read: 这里删除了对 IE9 的支持。按照对源码的理解，只有 IE9 才需要处理
  //   if (handleEventFunc) {
  //     handleEventFunc(domEventName, targetNode, targetInst);
  //   }

  // When blurring, set the value attribute for number inputs
  if (domEventName === 'focusout') {
    handleControlledInputBlur(targetNode as any as InputWithWrapperState);
  }
}
export { registerEvents, extractEvents };
