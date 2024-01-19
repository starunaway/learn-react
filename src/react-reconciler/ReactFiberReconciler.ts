import { Container } from '../react-dom/ReactFiberHostConfig';
import { ReactNodeList } from '../shared/ReactTypes';
import { Lane } from './ReactFiberLane';

import {
  FiberRoot,
  SuspenseHydrationCallbacks,
  TransitionTracingCallbacks,
} from './ReactInternalTypes';
import { RootTag } from './ReactRootTags';

export function createContainer(
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onRecoverableError: (error: any) => void,
  transitionCallbacks: null | TransitionTracingCallbacks
): FiberRoot {
  const hydrate = false;
  const initialChildren = null;
  return createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
    identifierPrefix,
    onRecoverableError,
    transitionCallbacks
  );
}

export function updateContainer(
  element: ReactNodeList,
  container: FiberRoot,
  //   fixme: 18.2 版本都是 createRoot().render 和 FC，原来的 Legacy 和 ClassComponent 都不需要看，因此不需要在parentComponent参数
  parentComponent?: null,
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

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    update.callback = callback;
  }

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    console.log('这里是入口,react 更新从此处开始');
    console.log(
      '如果是后续渲染,应该在其他地方，可以在合成事件 / setState/ useEffect 等事件内打断点'
    );
    scheduleUpdateOnFiber(root, current, lane, eventTime);
    entangleTransitions(root, current, lane);
  }

  return lane;
}
