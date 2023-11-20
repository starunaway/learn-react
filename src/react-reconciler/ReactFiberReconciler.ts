import { ReactNodeList } from '@/shared/ReactTypes';
import { createFiberRoot } from './ReactFiberRoot';
import { Container, FiberRoot } from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';
import { Lane } from './ReactFiberLane';
import { emptyContextObject, findCurrentUnmaskedContext } from './ReactFiberContext';
import { createUpdate, enqueueUpdate, entangleTransitions } from './ReactFiberClassUpdateQueue';
import { requestEventTime, requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop';

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

function getContextForSubtree(parentComponent?: any): Object {
  if (!parentComponent) {
    return emptyContextObject;
  }

  const fiber = parentComponent._reactInternals;
  const parentContext = findCurrentUnmaskedContext(fiber);

  // if (fiber.tag === ClassComponent) {
  //   const Component = fiber.type;
  //   if (isLegacyContextProvider(Component)) {
  //     return processChildContext(fiber, Component, parentContext);
  //   }
  // }

  return parentContext;
}

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot,
  parentComponent?: any,
  callback?: Function | null
): Lane {
  const current = container.current;
  const eventTime = requestEventTime();

  const lane = requestUpdateLane(current);

  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  const update = createUpdate(eventTime, lane);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element };

  // callback = callback === undefined ? null : callback;
  // if (callback !== null) {
  //   update.callback = callback;
  // }

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current, lane, eventTime);
    entangleTransitions(root, current, lane);
  }

  return lane;
}
