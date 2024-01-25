import { EventPriority } from '../react-reconciler/ReactEventPriorities';
import { Lane } from '../react-reconciler/ReactFiberLane';
import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { mixed } from '../types';
import { DOMEventName } from './events/DOMEventNames';
import { getEventPriority } from './events/ReactDOMEventListener';
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

const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning';

const SUSPENSE_START_DATA = '$';
const SUSPENSE_END_DATA = '/$';
const SUSPENSE_PENDING_START_DATA = '$?';
const SUSPENSE_FALLBACK_START_DATA = '$!';

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

export function getChildHostContext(
  parentHostContext: HostContext,
  type: string,
  rootContainerInstance: Container
): HostContext {
  const parentNamespace = parentHostContext as HostContextProd;
  return getChildNamespace(parentNamespace, type);
}

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

export const isPrimaryRenderer = true;

export const noTimeout = -1;

// -------------------
//     Hydration
// -------------------

export const supportsHydration = true;

export function getCurrentEventPriority(): Lane {
  const currentEvent = window.event;
  if (currentEvent === undefined) {
    return EventPriority.DefaultEventPriority;
  }
  return getEventPriority(currentEvent.type as DOMEventName);
}

// -------------------
//     Microtasks
// -------------------
export const supportsMicrotasks = true;
export const scheduleMicrotask: any = queueMicrotask;
export { detachDeletedInstance } from './ReactDOMComponentTree';
