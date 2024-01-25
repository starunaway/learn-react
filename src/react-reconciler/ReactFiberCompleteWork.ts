import { Lanes } from './ReactFiberLane';
import { Fiber } from './ReactInternalTypes';

function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  console.error('completeWork 逻辑待实现！');
  return null;
}

export { completeWork };
