import { mixed } from '../types';
import { Lane, Lanes } from './ReactFiberLane';
import type { HookFlags } from './ReactHookEffectTags';

export type Update<S, A> = {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A>;
};

export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null;
  interleaved: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => any) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
};

export type Effect = {
  tag: HookFlags;
  create: () => (() => void) | void;
  destroy: (() => void) | void;
  deps: Array<mixed> | null;
  next: Effect;
};

type StoreInstance<T> = {
  value: T;
  getSnapshot: () => T;
};

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
};
