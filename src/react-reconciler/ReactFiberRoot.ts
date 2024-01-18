import type { Cache } from './ReactFiberCacheComponent';
import type { PendingSuspenseBoundaries, Transition } from './ReactFiberTracingMarkerComponent';

export type RootState = {
  element: any;
  isDehydrated: boolean;
  cache: Cache;
  pendingSuspenseBoundaries: PendingSuspenseBoundaries | null;
  transitions: Set<Transition> | null;
};
