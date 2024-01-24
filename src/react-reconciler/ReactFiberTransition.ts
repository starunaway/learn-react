import ReactCurrentBatchConfig from '../react/ReactCurrentBatchConfig';
import { enableTransitionTracing } from '../shared/ReactFeatureFlags';
import { Transition } from './ReactFiberTracingMarkerComponent';

export const NoTransition = null;

export function requestCurrentTransition(): Transition | null {
  return ReactCurrentBatchConfig.transition as Transition | null;
}

/**
 * @deprecated 特性并不支持，可以删了
 * @param workInProgress
 * @param root
 * @param renderLanes
 */
export function popRootTransition(...args: any[]) {
  if (enableTransitionTracing) {
  }
}
