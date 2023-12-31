import type { BatchConfigTransition } from '@/react-reconciler/ReactFiberTracingMarkerComponent';

type BatchConfig = {
  transition: BatchConfigTransition | null;
};
/**
 * Keeps track of the current batch's configuration such as how long an update
 * should suspend for if it needs to.
 */
const ReactCurrentBatchConfig: BatchConfig = {
  transition: null,
};

export default ReactCurrentBatchConfig;
