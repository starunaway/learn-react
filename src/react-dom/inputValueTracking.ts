import { mixed } from '../types';

type ValueTracker = {
  getValue(): string;
  setValue(value: string): void;
  stopTracking(): void;
};
type WrapperState = { _valueTracker?: ValueTracker } & mixed;
type ElementWithValueTracker = HTMLInputElement & WrapperState;

function isCheckable(elem: HTMLInputElement) {
  const type = elem.type;
  const nodeName = elem.nodeName;
  return (
    nodeName && nodeName.toLowerCase() === 'input' && (type === 'checkbox' || type === 'radio')
  );
}
function getTracker(node: ElementWithValueTracker) {
  return node._valueTracker;
}

function detachTracker(node: ElementWithValueTracker) {
  node._valueTracker = undefined;
}

function getValueFromNode(node: HTMLInputElement): string {
  let value = '';
  if (!node) {
    return value;
  }

  if (isCheckable(node)) {
    value = node.checked ? 'true' : 'false';
  } else {
    value = node.value;
  }

  return value;
}

export function updateValueIfChanged(node: ElementWithValueTracker) {
  if (!node) {
    return false;
  }

  const tracker = getTracker(node);
  // if there is no tracker at this point it's unlikely
  // that trying again will succeed
  if (!tracker) {
    return true;
  }

  const lastValue = tracker.getValue();
  const nextValue = getValueFromNode(node);
  if (nextValue !== lastValue) {
    tracker.setValue(nextValue);
    return true;
  }
  return false;
}
