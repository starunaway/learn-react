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
    // read: 某个事件处理完成。处理完成的意思是指：1. React 合成事件搜索了是否有 dom 在监听该事件
    // 2. 如果找到了用户注册的函数，则执行
    // 3. 如果用户注册的函数有调用 react 的 Api，比如 setState，则标记更新。并启动一个微任务等待执行(不是调用的 scheduler)
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
