import { needsStateRestore, restoreStateIfNeeded } from './ReactDOMControlledComponent';

let isInsideEventHandler = false;

// Used as a way to call batchedUpdates when we don't have a reference to
// the renderer. Such as when we're dispatching events or if third party
// libraries need to call batchedUpdates. Eventually, this API will go away when
// everything is batched by default. We'll then have a similar API to opt-out of
// scheduled work and instead do synchronous work.

// read: 在 web 上应该有真正的实现函数
// Defaults
let batchedUpdatesImpl = function <A, R>(fn: (a: A, b?: any) => R, a: A, b?: any): R {
  return fn(a, b);
};

let discreteUpdatesImpl = function <A, B, C, D, R>(
  fn: (a: A, b: B, c: C, d: D) => R,
  a: A,
  b: B,
  c: C,
  d: D
) {
  return fn(a, b, c, d);
};

let flushSyncImpl = function () {};

function finishEventHandler() {
  // Here we wait until all updates have propagated, which is important
  // when using controlled components within layers:
  // https://github.com/facebook/react/issues/1698
  // Then we restore state of any controlled component.
  const controlledComponentsHavePendingUpdates = needsStateRestore();
  if (controlledComponentsHavePendingUpdates) {
    // If a controlled event was fired, we may need to restore the state of
    // the DOM node back to the controlled value. This is necessary when React
    // bails out of the update without touching the DOM.
    // TODO: Restore state in the microtask, after the discrete updates flush,
    // instead of early flushing them here.
    flushSyncImpl();
    restoreStateIfNeeded();
  }
}

export function batchedUpdates<A, R>(fn: (a?: A, b?: any) => R, a?: A, b?: any) {
  console.log('batchedUpdates here');
  if (isInsideEventHandler) {
    // If we are currently inside another batch, we need to wait until it
    // fully completes before restoring state.
    return fn(a, b);
  }
  isInsideEventHandler = true;
  try {
    return batchedUpdatesImpl(fn, a, b);
  } finally {
    isInsideEventHandler = false;
    console.log('看下这里是最后来处理事件的绑定吗');
    finishEventHandler();
  }
}

export function setBatchingImplementation(
  _batchedUpdatesImpl: typeof batchedUpdatesImpl,
  _discreteUpdatesImpl: typeof discreteUpdatesImpl,
  _flushSyncImpl: typeof flushSyncImpl
) {
  batchedUpdatesImpl = _batchedUpdatesImpl;
  discreteUpdatesImpl = _discreteUpdatesImpl;
  flushSyncImpl = _flushSyncImpl;
}
