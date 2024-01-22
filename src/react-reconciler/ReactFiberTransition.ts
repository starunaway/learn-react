import ReactCurrentBatchConfig from '../react/ReactCurrentBatchConfig';
import { Transition } from './ReactFiberTracingMarkerComponent';

export const NoTransition = null;

export function requestCurrentTransition(): Transition | null {
  return ReactCurrentBatchConfig.transition as Transition | null;
}
