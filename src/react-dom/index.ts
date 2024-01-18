import { createContainer, updateContainer } from '../react-reconciler/ReactFiberReconciler';
import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { RootTag } from '../react-reconciler/ReactRootTags';
import { ReactNodeList } from '../shared/ReactTypes';
import { mixed } from '../types';
import { markContainerAsRoot } from './ReactDOMComponentTree';
import { listenToAllSupportedEvents } from './events/DOMPluginEventSystem';

export type RootType = {
  render(children: ReactNodeList): void;
  unmount?(): void;
  _internalRoot: FiberRoot | null;
} & mixed;

class ReactDOMRoot {
  _internalRoot: FiberRoot | null;
  constructor(public internalRoot: FiberRoot) {
    this._internalRoot = internalRoot;
  }

  render(children: ReactNodeList): void {
    const root = this._internalRoot;
    if (root === null) {
      throw new Error('Cannot update an unmounted root.');
    }
    updateContainer(children, root);
  }

  // fixme: 目前不需要支持unmount
  //   unmount(): void {
  //     const root = this._internalRoot;
  //     if (root !== null) {
  //       this._internalRoot = null;
  //       const container = root.containerInfo;

  //       flushSync(() => {
  //         updateContainer(null, root, null, null);
  //       });
  //       unmarkContainerAsRoot(container);
  //     }
  //   }
}

export function createRoot(container: Element | Document | DocumentFragment): RootType {
  let isStrictMode = false;
  let concurrentUpdatesByDefaultOverride = false;
  let identifierPrefix = '';
  let onRecoverableError = reportError;
  let transitionCallbacks = null;

  const root = createContainer(
    container,
    RootTag.ConcurrentRoot,
    null,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
    identifierPrefix,
    onRecoverableError,
    transitionCallbacks
  );
  markContainerAsRoot(root.current, container);

  const rootContainerElement =
    container.nodeType === Node.COMMENT_NODE ? container.parentNode : container;
  listenToAllSupportedEvents(rootContainerElement!);

  return new ReactDOMRoot(root);
}
