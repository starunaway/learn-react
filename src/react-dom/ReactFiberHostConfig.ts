import { EventPriority } from '../react-reconciler/ReactEventPriorities';
import { Lane } from '../react-reconciler/ReactFiberLane';
import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { enableCreateEventHandleAPI } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import {
  createElement,
  createTextNode,
  diffProperties,
  setInitialProperties,
} from './ReactDOMComponent';
import { precacheFiberNode, updateFiberProps } from './ReactDOMComponentTree';
import { restoreSelection, getSelectionInformation } from './ReactInputSelection';

import { DOMEventName } from './events/DOMEventNames';
import {
  isEnabled as ReactBrowserEventEmitterIsEnabled,
  getEventPriority,
  setEnabled as ReactBrowserEventEmitterSetEnabled,
} from './events/ReactDOMEventListener';
import { getChildNamespace } from './shared/DOMNamespaces';

export type Type = string;
export type Props = {
  autoFocus?: boolean;
  children?: mixed;
  disabled?: boolean;
  hidden?: boolean;
  suppressHydrationWarning?: boolean;
  dangerouslySetInnerHTML?: mixed;
  style?: { display?: string } & mixed;
  bottom?: null | number;
  left?: null | number;
  right?: null | number;
  top?: null | number;
} & mixed;

type TimeoutID = number;

export type TimeoutHandle = TimeoutID;
export type NoTimeout = -1;
type HostContextProd = string;
export type HostContext = HostContextProd;
export type UpdatePayload = Array<mixed>;
export type ChildSet = void; // Unused
export type RendererInspectionConfig = Readonly<{}>;

export type Instance = Element;
export type HydratableInstance = Instance | TextInstance | SuspenseInstance;

export type TextInstance = Text;
/**
 *  read: 此 Suspense 不是 用于用户体验的 Suspense
 *  read: 读到 React 的 Suspense 时候，再来对比一下
 */
export type SuspenseInstance = Comment & { _reactRetry?: () => void } & mixed;

// read: _reactRootContainer 是内部用到的，用户侧应该无感知
export type Container = (Element | Document | DocumentFragment) & {
  _reactRootContainer?: FiberRoot;
} & mixed;

export type SelectionInformation = {
  focusedElem: null | HTMLElement;
  selectionRange: mixed;
};

const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning';

const SUSPENSE_START_DATA = '$';
const SUSPENSE_END_DATA = '/$';
const SUSPENSE_PENDING_START_DATA = '$?';
const SUSPENSE_FALLBACK_START_DATA = '$!';

let eventsEnabled: boolean | null = null;
let selectionInformation: null | SelectionInformation = null;

// 148
export function getRootHostContext(rootContainerInstance: Container): HostContext {
  let type;
  let namespace;
  const nodeType = rootContainerInstance.nodeType;
  switch (nodeType) {
    case Node.DOCUMENT_NODE:
    case Node.DOCUMENT_FRAGMENT_NODE: {
      type = nodeType === Node.DOCUMENT_NODE ? '#document' : '#fragment';
      const root = rootContainerInstance.documentElement;
      namespace = root ? root.namespaceURI : getChildNamespace(null, '');
      break;
    }
    default: {
      const container: any =
        nodeType === Node.COMMENT_NODE ? rootContainerInstance.parentNode : rootContainerInstance;
      const ownNamespace = container.namespaceURI || null;
      type = container.tagName;
      namespace = getChildNamespace(ownNamespace, type);
      break;
    }
  }

  return namespace;
}
// 181
export function getChildHostContext(
  parentHostContext: HostContext,
  type: string,
  rootContainerInstance: Container
): HostContext {
  const parentNamespace = parentHostContext as HostContextProd;
  return getChildNamespace(parentNamespace, type);
}

// 199
// read: 应该干点啥，但啥也没干？
export function getPublicInstance(instance: Instance): any {
  return instance;
}

//203
export function prepareForCommit(containerInfo: Container): null {
  eventsEnabled = ReactBrowserEventEmitterIsEnabled();
  selectionInformation = getSelectionInformation() || null;
  let activeInstance = null;
  ReactBrowserEventEmitterSetEnabled(false);
  return activeInstance;
}

// 236
export function resetAfterCommit(containerInfo: Container): void {
  restoreSelection(selectionInformation);
  ReactBrowserEventEmitterSetEnabled(!!eventsEnabled);
  eventsEnabled = null;
  selectionInformation = null;
}

// 243
export function createInstance(
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object
): Instance {
  let parentNamespace: string;

  parentNamespace = hostContext as HostContextProd;
  const domElement: Instance = createElement(type, props, rootContainerInstance, parentNamespace);
  precacheFiberNode(internalInstanceHandle as any, domElement);
  updateFiberProps(domElement, props);
  return domElement;
}

// 281
export function appendInitialChild(parentInstance: Instance, child: Instance | TextInstance): void {
  parentInstance.appendChild(child);
}

//288
export function finalizeInitialChildren(
  domElement: Instance,
  type: string,
  props: Props,
  rootContainerInstance: Container,
  hostContext: HostContext
): boolean {
  setInitialProperties(domElement, type, props, rootContainerInstance);
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      return !!props.autoFocus;
    case 'img':
      return true;
    default:
      return false;
  }
}

// 309
export function prepareUpdate(
  domElement: Instance,
  type: string,
  oldProps: Props,
  newProps: Props,
  rootContainerInstance: Container,
  hostContext: HostContext
): null | Array<mixed> {
  return diffProperties(domElement, type, oldProps, newProps, rootContainerInstance);
}

export const isPrimaryRenderer = true;

export const noTimeout = -1;

// 341
export function shouldSetTextContent(type: string, props: Props): boolean {
  return (
    type === 'textarea' ||
    type === 'noscript' ||
    typeof props.children === 'string' ||
    typeof props.children === 'number' ||
    (typeof props.dangerouslySetInnerHTML === 'object' &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  );
}

// 353
export function createTextInstance(
  text: string,
  rootContainerInstance: Container,
  hostContext: HostContext,
  internalInstanceHandle: Object
): TextInstance {
  const textNode: TextInstance = createTextNode(text, rootContainerInstance);
  precacheFiberNode(internalInstanceHandle as any, textNode);
  return textNode;
}

// 368
export function getCurrentEventPriority(): Lane {
  const currentEvent = window.event;
  if (currentEvent === undefined) {
    return EventPriority.DefaultEventPriority;
  }
  return getEventPriority(currentEvent.type as DOMEventName);
}

// 391
// -------------------
//     Microtasks
// -------------------
export const supportsMicrotasks = true;
export const scheduleMicrotask: any = queueMicrotask;
export { detachDeletedInstance } from './ReactDOMComponentTree';

// 408
// -------------------
//     Mutation
// -------------------

export const supportsMutation = true;

// 415
// read: autoFocus ？ 是WorkTag.HostComponent 下调用的，需要再看下
export function commitMount(
  domElement: Instance,
  type: string,
  newProps: Props,
  internalInstanceHandle: Object
): void {
  // Despite the naming that might imply otherwise, this method only
  // fires if there is an `Update` effect scheduled during mounting.
  // This happens if `finalizeInitialChildren` returns `true` (which it
  // does to implement the `autoFocus` attribute on the client). But
  // there are also other cases when this might happen (such as patching
  // up text content during hydration mismatch). So we'll check this again.
  switch (type) {
    case 'button':
    case 'input':
    case 'select':
    case 'textarea':
      if (newProps.autoFocus) {
        (
          domElement as
            | HTMLButtonElement
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement
        ).focus();
      }
      return;
    case 'img': {
      if ((newProps as any).src) {
        (domElement as HTMLImageElement).src = (newProps as any).src;
      }
      return;
    }
  }
}

// 671
export function clearContainer(container: Container): void {
  if (container.nodeType === Node.ELEMENT_NODE) {
    (container as Element).textContent = '';
  } else if (container.nodeType === Node.DOCUMENT_NODE) {
    if (container.documentElement) {
      container.removeChild(container.documentElement);
    }
  }
}

//685
// -------------------
//     Hydration
// -------------------

export const supportsHydration = true;

// 921
// Returns the SuspenseInstance if this node is a direct child of a
// SuspenseInstance. I.e. if its previous sibling is a Comment with
// SUSPENSE_x_START_DATA. Otherwise, null.
export function getParentSuspenseInstance(targetInstance: Node): null | SuspenseInstance {
  let node: SuspenseInstance | null = targetInstance.previousSibling as Comment;
  // Skip past all nodes within this suspense boundary.
  // There might be nested nodes so we need to keep track of how
  // deep we are and only break out when we're back on top.
  let depth = 0;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const data = node.data;
      if (
        data === SUSPENSE_START_DATA ||
        data === SUSPENSE_FALLBACK_START_DATA ||
        data === SUSPENSE_PENDING_START_DATA
      ) {
        if (depth === 0) {
          return node;
        } else {
          depth--;
        }
      } else if (data === SUSPENSE_END_DATA) {
        depth++;
      }
    }
    node = node.previousSibling as Comment;
  }
  return null;
}
