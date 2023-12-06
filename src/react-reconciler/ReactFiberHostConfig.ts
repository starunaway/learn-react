import {
  COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
} from '@/react-dom-bindings/HTMLNodeType';
import { FiberRoot } from './ReactInternalTypes';
import { getChildNamespace } from '@/shared/DOMNamespaces';
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
export type Instance = Element;
export type TextInstance = Text;
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
