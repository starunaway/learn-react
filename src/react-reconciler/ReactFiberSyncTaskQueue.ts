import { SchedulerCallback } from './Scheduler';

let includesLegacySyncCallbacks: boolean = false;
let syncQueue: Array<SchedulerCallback> | null = null;
let isFlushingSyncQueue: boolean = false;

export function scheduleSyncCallback(callback: SchedulerCallback) {
  // Push this callback into an internal queue. We'll flush these either in
  // the next tick, or earlier if something calls `flushSyncCallbackQueue`.
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    // Push onto existing queue. Don't need to schedule a callback because
    // we already scheduled one when we created the queue.
    syncQueue.push(callback);
  }
}

export function scheduleLegacySyncCallback(callback: SchedulerCallback) {
  includesLegacySyncCallbacks = true;
  scheduleSyncCallback(callback);
}

export function flushSyncCallbacks() {
  // todo 首次渲染流程，暂时用不到这个函数，先 hold，后续补充
  return;
}
