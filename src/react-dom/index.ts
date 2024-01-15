import { createContainer } from '../react-reconciler/ReactFiberReconciler';
import { RootTag } from '../react-reconciler/ReactRootTags';

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
    container.nodeType === COMMENT_NODE ? container.parentNode : container;
  listenToAllSupportedEvents(rootContainerElement);

  return new ReactDOMRoot(root);
}
