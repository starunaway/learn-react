import { Lane, Lanes } from './ReactFiberLane';

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
  dispatch: (a: A) => any | null;
  lastRenderedReducer: (s: S, a: A) => S | null;
  lastRenderedState: S | null;
};
