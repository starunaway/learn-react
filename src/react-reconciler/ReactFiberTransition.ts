import { Lanes } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';

export function pushRootTransition(workInProgress: Fiber, root: FiberRoot, renderLanes: Lanes) {
  // if (enableTransitionTracing) {
  //   const rootTransitions = getWorkInProgressTransitions();
  //   push(transitionStack, rootTransitions, workInProgress);
  // }
}
