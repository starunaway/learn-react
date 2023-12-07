import {
  COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
} from '@/react-dom-bindings/HTMLNodeType';
import { FiberRoot } from './ReactInternalTypes';
import { getChildNamespace } from '@/shared/DOMNamespaces';
import { updateProperties } from '@/react-dom/ReactDOMComponent';
import { updateFiberProps } from '@/react-dom/ReactDOMComponentTree';
export type Container =
  | (Element & { _reactRootContainer?: FiberRoot; [key: string]: any })
  | (Document & { _reactRootContainer?: FiberRoot; [key: string]: any })
  | (DocumentFragment & { _reactRootContainer?: FiberRoot; [key: string]: any });

export type Props = {
  autoFocus?: boolean;
  children?: any;
  disabled?: boolean;
  hidden?: boolean;
  suppressHydrationWarning?: boolean;
  dangerouslySetInnerHTML?: any;
  style?: { display?: string; [key: string]: any };
  bottom?: null | number;
  left?: null | number;
  right?: null | number;
  top?: null | number;
  [key: string]: any;
};
export type Instance = Element & { [key: string]: any };
export type TextInstance = Text & { [key: string]: any };
export type SuspenseInstance = Comment & { _reactRetry?: () => void; [key: string]: any };
export type HydratableInstance = Instance | TextInstance | SuspenseInstance;

export const supportsMicrotasks = true;

const SUSPENSE_START_DATA = '$';
const SUSPENSE_END_DATA = '/$';
const SUSPENSE_PENDING_START_DATA = '$?';
const SUSPENSE_FALLBACK_START_DATA = '$!';

type SelectionInformation = {
  focusedElem: null | HTMLElement;
  selectionRange: any;
};

let eventsEnabled: boolean | null = null;
let selectionInformation: null | SelectionInformation = null;

const localPromise = typeof Promise === 'function' ? Promise : undefined;

export const scheduleTimeout: any = typeof setTimeout === 'function' ? setTimeout : undefined;

export const scheduleMicrotask: any =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof localPromise !== 'undefined'
    ? (callback: (value: any) => PromiseLike<null> | null) =>
        localPromise.resolve(null).then(callback).catch(handleErrorInNextTick)
    : scheduleTimeout; // TODO: Determine the best fallback here.

function handleErrorInNextTick(error: any) {
  setTimeout(() => {
    throw error;
  });
}

export const noTimeout = -1;

export const cancelTimeout = clearTimeout;

export function resetAfterCommit(containerInfo: Container): void {
  // 重置选中
  // restoreSelection(selectionInformation);
  //  官方也不确定是否有用
  // ReactBrowserEventEmitterSetEnabled(eventsEnabled);
  eventsEnabled = null;
  selectionInformation = null;
}

export const isPrimaryRenderer = true;

export const supportsHydration = true;

type HostContextDev = {
  namespace: string;
  ancestorInfo: any;
};
type HostContextProd = string;
export type HostContext = HostContextDev | HostContextProd;

export type UpdatePayload = Array<any>;

export function getRootHostContext(rootContainerInstance: Container): HostContext {
  let type;
  let namespace;
  const nodeType = rootContainerInstance.nodeType;
  switch (nodeType) {
    case DOCUMENT_NODE:
    case DOCUMENT_FRAGMENT_NODE: {
      type = nodeType === DOCUMENT_NODE ? '#document' : '#fragment';
      const root = rootContainerInstance.documentElement;
      namespace = root ? root.namespaceURI : getChildNamespace(null, '');
      break;
    }
    default: {
      const container: any =
        nodeType === COMMENT_NODE ? rootContainerInstance.parentNode : rootContainerInstance;
      const ownNamespace = container.namespaceURI || null;
      type = container.tagName;
      namespace = getChildNamespace(ownNamespace, type);
      break;
    }
  }
  // if (__DEV__) {
  //   const validatedTag = type.toLowerCase();
  //   const ancestorInfo = updatedAncestorInfo(null, validatedTag);
  //   return {namespace, ancestorInfo};
  // }
  return namespace;
}

export function getChildHostContext(
  parentHostContext: HostContext,
  type: string,
  rootContainerInstance: Container
): HostContext {
  // if (__DEV__) {
  //   const parentHostContextDev = ((parentHostContext: any): HostContextDev);
  //   const namespace = getChildNamespace(parentHostContextDev.namespace, type);
  //   const ancestorInfo = updatedAncestorInfo(
  //     parentHostContextDev.ancestorInfo,
  //     type,
  //   );
  //   return {namespace, ancestorInfo};
  // }
  const parentNamespace = parentHostContext;
  if (typeof parentNamespace !== 'string') {
    throw Error('ReactFiberHostConfig.getChildHostContext: parentNamespace is not string');
  }
  return getChildNamespace(parentNamespace as string, type);
}
function getNextHydratable(node: ChildNode | null) {
  // Skip non-hydratable nodes.
  for (; node != null; node = node.nextSibling) {
    const nodeType = node.nodeType;
    if (nodeType === ELEMENT_NODE || nodeType === TEXT_NODE) {
      break;
    }
    if (nodeType === COMMENT_NODE) {
      const nodeData = (node as any).data;
      if (
        nodeData === SUSPENSE_START_DATA ||
        nodeData === SUSPENSE_FALLBACK_START_DATA ||
        nodeData === SUSPENSE_PENDING_START_DATA
      ) {
        break;
      }
      if (nodeData === SUSPENSE_END_DATA) {
        return null;
      }
    }
  }
  return node as any;
}

export function getFirstHydratableChildWithinContainer(
  parentContainer: Container
): null | HydratableInstance {
  return getNextHydratable(parentContainer.firstChild);
}

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

export function getPublicInstance(instance: Instance): Instance {
  return instance;
}

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
        (domElement as any as HTMLImageElement).src = newProps.src;
      }
      return;
    }
  }
}

export const supportsMutation = true;

export function commitUpdate(
  domElement: Instance,
  updatePayload: Array<any>,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object
): void {
  // Apply the diff to the DOM node.
  updateProperties(domElement, updatePayload, type, oldProps, newProps);
  // Update the props handle so that we know which props are the ones with
  // with current event handlers.
  updateFiberProps(domElement, newProps);
}

export function resetTextContent(domElement: Instance): void {
  // todo 暂时不看
  // setTextContent(domElement, '');
}

export function commitTextUpdate(
  textInstance: TextInstance,
  oldText: string,
  newText: string
): void {
  textInstance.nodeValue = newText;
}

export function appendChild(parentInstance: Instance, child: Instance | TextInstance): void {
  parentInstance.appendChild(child);
}

export function appendChildToContainer(container: Container, child: Instance | TextInstance): void {
  let parentNode;
  if (container.nodeType === COMMENT_NODE) {
    parentNode = container.parentNode;
    parentNode?.insertBefore(child, container);
  } else {
    parentNode = container;
    parentNode.appendChild(child);
  }
  // This container might be used for a portal.
  // If something inside a portal is clicked, that click should bubble
  // through the React tree. However, on Mobile Safari the click would
  // never bubble through the *DOM* tree unless an ancestor with onclick
  // event exists. So we wouldn't see it and dispatch it.
  // This is why we ensure that non React root containers have inline onclick
  // defined.
  // https://github.com/facebook/react/issues/11918
  const reactRootContainer = container._reactRootContainer;
  if (
    (reactRootContainer === null || reactRootContainer === undefined) &&
    (parentNode as HTMLElement)?.onclick === null
  ) {
    // TODO: This cast may not be sound for SVG, MathML or custom elements.
    //  todo 暂时不看
    // trapClickOnNonInteractiveElement(parentNode as HTMLElement);
  }
}

export function commitHydratedContainer(container: Container): void {
  // Retry if any event replaying was blocked on this.
  // retryIfBlockedOn(container);
}

export function insertBefore(
  parentInstance: Instance,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance | SuspenseInstance
): void {
  parentInstance?.insertBefore(child, beforeChild);
}

export function insertInContainerBefore(
  container: Container,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance | SuspenseInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.insertBefore(child, beforeChild);
  } else {
    container.insertBefore(child, beforeChild);
  }
}

// dom 下为 false
export const supportsPersistence = false;

export function removeChild(
  parentInstance: Instance,
  child: Instance | TextInstance | SuspenseInstance
): void {
  parentInstance.removeChild(child);
}

export function removeChildFromContainer(
  container: Container,
  child: Instance | TextInstance | SuspenseInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.removeChild(child);
  } else {
    container.removeChild(child);
  }
}
