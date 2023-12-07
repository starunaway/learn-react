import {
  Instance,
  Props,
  SuspenseInstance,
  TextInstance,
} from '@/react-reconciler/ReactFiberHostConfig';

const randomKey = Math.random().toString(36).slice(2);

const internalInstanceKey = '__reactFiber$' + randomKey;
const internalPropsKey = '__reactProps$' + randomKey;
const internalContainerInstanceKey = '__reactContainer$' + randomKey;
const internalEventHandlersKey = '__reactEvents$' + randomKey;
const internalEventHandlerListenersKey = '__reactListeners$' + randomKey;
const internalEventHandlesSetKey = '__reactHandles$' + randomKey;

export function updateFiberProps(
  node: Instance | TextInstance | SuspenseInstance,
  props: Props
): void {
  node[internalPropsKey] = props;
}

export function detachDeletedInstance(node: Instance): void {
  // TODO: This function is only called on host components. I don't think all of
  // these fields are relevant.
  delete node[internalInstanceKey];
  delete node[internalPropsKey];
  delete node[internalEventHandlersKey];
  delete node[internalEventHandlerListenersKey];
  delete node[internalEventHandlesSetKey];
}
