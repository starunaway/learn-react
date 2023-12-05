import {
  COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE,
} from '@/react-dom-bindings/HTMLNodeType';
import { FiberRoot } from './ReactInternalTypes';
import { getChildNamespace } from '@/shared/DOMNamespaces';
export type Container =
  | (Element & { _reactRootContainer?: FiberRoot; [key: string]: any })
  | (Document & { _reactRootContainer?: FiberRoot; [key: string]: any })
  | (DocumentFragment & { _reactRootContainer?: FiberRoot; [key: string]: any });

export const supportsMicrotasks = true;

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
