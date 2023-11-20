import { CapturedValue } from './ReactCapturedValue';
import { CaptureUpdate, Update, createUpdate } from './ReactFiberClassUpdateQueue';
import { Lane, NoTimestamp } from './ReactFiberLane';
import { onUncaughtError } from './ReactFiberWorkLoop';
import { Fiber } from './ReactInternalTypes';

export function createRootErrorUpdate(
  fiber: Fiber,
  errorInfo: CapturedValue<any>,
  lane: Lane
): Update<any> {
  const update = createUpdate(NoTimestamp, lane);
  // Unmount the root by rendering null.
  update.tag = CaptureUpdate;
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element: null };
  const error = errorInfo.value;
  update.callback = () => {
    onUncaughtError(error);
    // logCapturedError(fiber, errorInfo);
  };
  return update;
}
