import { RootState } from './ReactFiberRoot';
import { FiberRoot } from './ReactInternalTypes';

// This is imported by the event replaying implementation in React DOM. It's
// in a separate file to break a circular dependency between the renderer and
// the reconciler.
// 放到这里是为了避免循环引用
export function isRootDehydrated(root: FiberRoot) {
  const currentState: RootState = root.current.memoizedState;
  return currentState.isDehydrated;
}
