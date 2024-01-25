import { Lanes } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';

function throwException(
  root: FiberRoot,
  returnFiber: Fiber,
  sourceFiber: Fiber,
  value: any,
  rootRenderLanes: Lanes
) {
  console.error('throwException 没有实现，需要做！');
}

export { throwException };
