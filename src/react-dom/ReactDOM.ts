// import { COMMENT_NODE } from '../react-dom-bindings/HTMLNodeType';
import { createContainer, updateContainer } from '@/react-reconciler/ReactFiberReconciler';
import { Container, FiberRoot } from '@/react-reconciler/ReactInternalTypes';
import { LegacyRoot } from '../react-reconciler/ReactRootTags';
import { markContainerAsRoot } from './ReactDOMComponentTree';
import { flushSync } from '@/react-reconciler/ReactFiberWorkLoop';

export function createRoot() {}
export function hydrateRoot() {}
export function hydrate() {}

export { flushSync };

export function render(element: any, container: Container) {
  const maybeRoot = container._reactRootContainer;

  let root: FiberRoot;
  if (!maybeRoot) {
    let rootSibling;
    while ((rootSibling = container.lastChild)) {
      container.removeChild(rootSibling);
    }

    root = createContainer(container, LegacyRoot);
    console.log('root', root);
    container._reactRootContainer = root;
    markContainerAsRoot(root.current as unknown as FiberRoot, container);
    // todo 事件监听能力
    // const rootContainerElement =
    //   container.nodeType === COMMENT_NODE ? container.parentNode : container;
    // listenToAllSupportedEvents(rootContainerElement);

    // Initial mount should not be batched.
    flushSync(() => {
      updateContainer(element, root, null);
    });
  } else {
    root = maybeRoot;
    updateContainer(element, root, null);
  }
}
