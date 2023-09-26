import { createFiberRoot } from './ReactFiberRoot';
import { Container, FiberRoot } from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';

export function createContainer(
  containerInfo: Container,
  tag: RootTag
  // hydrationCallbacks: null | SuspenseHydrationCallbacks,
  // isStrictMode: boolean,
  // concurrentUpdatesByDefaultOverride: null | boolean,
  // identifierPrefix: string,
  // onRecoverableError: (error: mixed) => void,
  // transitionCallbacks: null | TransitionTracingCallbacks,
): FiberRoot {
  // const hydrate = false;
  // const initialChildren = null;
  return createFiberRoot(
    containerInfo,
    tag
    //   hydrate,
    //   initialChildren,
    //   hydrationCallbacks,
    //   isStrictMode,
    //   concurrentUpdatesByDefaultOverride,
    //   identifierPrefix,
    //   onRecoverableError,
    //   transitionCallbacks,
  );
}

export function updateContainer(
  element: ReactElement,
  container: FiberRoot,
  parentComponent?: any,
  callback?: Function | null
): Lane {
  const current = container.current;
  //   const lane = requestUpdateLane(current);

  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  const update = createUpdate(lane);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element };

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    update.callback = callback;
  }

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current, lane);
    entangleTransitions(root, current, lane);
  }

  return lane;
}
