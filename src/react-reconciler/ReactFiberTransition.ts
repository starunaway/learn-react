import { Lanes } from './ReactFiberLane';
import { Transition } from './ReactFiberTracingMarkerComponent';
import { Fiber, FiberRoot } from './ReactInternalTypes';

export function pushRootTransition(workInProgress: Fiber, root: FiberRoot, renderLanes: Lanes) {
  // if (enableTransitionTracing) {
  //   const rootTransitions = getWorkInProgressTransitions();
  //   push(transitionStack, rootTransitions, workInProgress);
  // }
}

export function popRootTransition(workInProgress: Fiber, root: FiberRoot, renderLanes: Lanes) {
  // if (enableTransitionTracing) {
  //   pop(transitionStack, workInProgress);
  // }
}

export function pushTransition(
  offscreenWorkInProgress: Fiber,
  // prevCachePool: SpawnedCachePool | null,
  prevCachePool: any,
  newTransitions: Array<Transition> | null
): void {
  // if (enableCache) {
  //   if (prevCachePool === null) {
  //     push(resumedCache, resumedCache.current, offscreenWorkInProgress);
  //   } else {
  //     push(resumedCache, prevCachePool.pool, offscreenWorkInProgress);
  //   }
  // }
  // if (enableTransitionTracing) {
  //   if (transitionStack.current === null) {
  //     push(transitionStack, newTransitions, offscreenWorkInProgress);
  //   } else if (newTransitions === null) {
  //     push(transitionStack, transitionStack.current, offscreenWorkInProgress);
  //   } else {
  //     push(
  //       transitionStack,
  //       transitionStack.current.concat(newTransitions),
  //       offscreenWorkInProgress
  //     );
  //   }
  // }
}

export function popTransition(workInProgress: Fiber, current: Fiber | null) {
  if (current !== null) {
    // if (enableCache) {
    //   pop(resumedCache, workInProgress);
    // }
    // if (enableTransitionTracing) {
    //   pop(transitionStack, workInProgress);
    // }
  }
}
