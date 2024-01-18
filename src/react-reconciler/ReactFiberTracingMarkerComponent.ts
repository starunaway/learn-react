import { Fiber } from './ReactInternalTypes';
import type { OffscreenInstance } from './ReactFiberOffscreenComponent';

export type SuspenseInfo = { name: string | null };

export type Transition = {
  name: string;
  startTime: number;
};

export type PendingSuspenseBoundaries = Map<OffscreenInstance, SuspenseInfo>;

export type BatchConfigTransition = {
  name?: string;
  startTime?: number;
  _updatedFibers?: Set<Fiber>;
};
