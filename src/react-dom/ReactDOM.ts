// import { COMMENT_NODE } from '../react-dom-bindings/HTMLNodeType';
import { createContainer, updateContainer } from '../react-reconciler/ReactFiberReconciler';
import { Container } from '../react-reconciler/ReactInternalTypes';
import { LegacyRoot } from '../react-reconciler/ReactRootTags';

export function createRoot() {}
export function hydrateRoot() {}
export function flushSync() {}
export function hydrate() {}

export function render(element: any, container: Container) {
  const root = createContainer(
    container,
    LegacyRoot
    // null, // hydrationCallbacks
    // false, // isStrictMode
    // false, // concurrentUpdatesByDefaultOverride,
    // '', // identifierPrefix
    // () => {}, // onRecoverableError
    // null // transitionCallbacks
  );
  container._reactRootContainer = root;

  //   const rootContainerElement =
  //     container.nodeType === COMMENT_NODE ? container.parentNode : container;
  // $FlowFixMe[incompatible-call]
  //   listenToAllSupportedEvents(rootContainerElement);

  // Initial mount should not be batched.
  //   flushSync(() => {
  updateContainer(element, root, null, undefined);
  //   });
}
