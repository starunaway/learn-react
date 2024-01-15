import { createContainer } from '../react-reconciler/ReactFiberReconciler';
import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { RootTag } from '../react-reconciler/ReactRootTags';
import { ReactNodeList } from '../shared/ReactTypes';
import { mixed } from '../types';
import { markContainerAsRoot } from './ReactDOMComponentTree';
import { listenToAllSupportedEvents } from './events/DOMPluginEventSystem';

export type RootType = {
  render(children: ReactNodeList): void;
  unmount(): void;
  _internalRoot: FiberRoot | null;
} & mixed;

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
