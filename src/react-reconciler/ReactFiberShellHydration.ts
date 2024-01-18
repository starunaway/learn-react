import type { RootState } from './ReactFiberRoot';
import type { FiberRoot } from './ReactInternalTypes';

export function isRootDehydrated(root: FiberRoot) {
  const currentState: RootState = root.current.memoizedState;
  return currentState.isDehydrated;
}
