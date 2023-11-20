import { OffscreenInstance } from './ReactFiberOffscreenComponent';
import { Fiber } from './ReactInternalTypes';

export type SuspenseInfo = { name: string | null };

export type Transition = {
  name: string;
  startTime: number;
};

export type BatchConfigTransition = {
  name?: string;
  startTime?: number;
  _updatedFibers?: Set<Fiber>;
};

export type PendingSuspenseBoundaries = Map<OffscreenInstance, SuspenseInfo>;
