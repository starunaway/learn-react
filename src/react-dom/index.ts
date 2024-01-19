import { createContainer, updateContainer } from '../react-reconciler/ReactFiberReconciler';
import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { RootTag } from '../react-reconciler/ReactRootTags';
import { ReactNodeList } from '../shared/ReactTypes';
import { mixed } from '../types';
import { markContainerAsRoot } from './ReactDOMComponentTree';
import { listenToAllSupportedEvents } from './events/DOMPluginEventSystem';

import {
  setAttemptSynchronousHydration,
  setAttemptDiscreteHydration,
  setAttemptContinuousHydration,
  setAttemptHydrationAtCurrentPriority,
  setGetCurrentUpdatePriority,
  setAttemptHydrationAtPriority,
} from './events/ReactDOMEventReplaying';
import { setBatchingImplementation } from './events/ReactDOMUpdateBatching';
import { setRestoreImplementation } from './events/ReactDOMControlledComponent';

import {
  batchedUpdates,
  discreteUpdates,
  flushSync as flushSyncWithoutWarningIfAlreadyRendering,
  attemptSynchronousHydration,
  attemptDiscreteHydration,
  attemptContinuousHydration,
  attemptHydrationAtCurrentPriority,
} from '../react-reconciler/ReactFiberReconciler';
import {
  runWithPriority,
  getCurrentUpdatePriority,
} from '../react-reconciler/ReactEventPriorities';

import { restoreControlledState } from './ReactDOMComponent';

// read: 这里提前注入了一堆 effect 方法。在不同的平台下可能不同，这里是 dom 环境
// read: 这里有很多和 ssr 相关的逻辑。分散到了具体逻辑里
// read: 因为 dom 的事件处理和 react 的更新相关，所有 [dom事件]<->[react更新]需要互相通知对方状态，就是这里的 effect
setAttemptSynchronousHydration(attemptSynchronousHydration);
setAttemptDiscreteHydration(attemptDiscreteHydration);
setAttemptContinuousHydration(attemptContinuousHydration);
setAttemptHydrationAtCurrentPriority(attemptHydrationAtCurrentPriority);
setGetCurrentUpdatePriority(getCurrentUpdatePriority);
setAttemptHydrationAtPriority(runWithPriority);

setRestoreImplementation(restoreControlledState);
setBatchingImplementation(
  batchedUpdates,
  discreteUpdates,
  flushSyncWithoutWarningIfAlreadyRendering
);

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
