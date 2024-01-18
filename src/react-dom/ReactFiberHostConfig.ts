import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { mixed } from '../types';

type TimeoutID = number;

export type TimeoutHandle = TimeoutID;
export type NoTimeout = -1;

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
