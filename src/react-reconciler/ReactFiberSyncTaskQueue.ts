import {
  EventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from './ReactEventPriorities';
import {
  // Aliased because `act` will override and push to an internal queue
  scheduleCallback,
  shouldYield,
  requestPaint,
  now,
  //   ImmediatePriority as ImmediateSchedulerPriority,
  //   UserBlockingPriority as UserBlockingSchedulerPriority,
  //   NormalPriority as NormalSchedulerPriority,
  //   IdlePriority as IdleSchedulerPriority,
  PriorityLevel,
  SchedulerCallback,
} from './Scheduler';

let syncQueue: Array<SchedulerCallback> | null = null;
let includesLegacySyncCallbacks: boolean = false;
let isFlushingSyncQueue: boolean = false;

export function scheduleSyncCallback(callback: SchedulerCallback) {
  console.log('ReactFiberSyncTaskQueue:scheduleSyncCallback 这里先将 callback 放入 queue');
  console.log(' 应该是 performSyncWorkOnRoot');
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

export function flushSyncCallbacksOnlyInLegacyMode() {
  // Only flushes the queue if there's a legacy sync callback scheduled.
  // TODO: There's only a single type of callback: performSyncOnWorkOnRoot. So
  // it might make more sense for the queue to be a list of roots instead of a
  // list of generic callbacks. Then we can have two: one for legacy roots, one
  // for concurrent roots. And this method would only flush the legacy ones.
  if (includesLegacySyncCallbacks) {
    console.info('flushSyncCallbacksOnlyInLegacyMode -> flushSyncCallbacks');
    flushSyncCallbacks();
  }
}

/**
 * 同步回调队列的处理。它通过循环遍历回调队列，并逐个执行回调函数。
 * 如果执行过程中发生错误，会将剩余的回调保留在队列中，并在下一次调用时重新执行
 * @returns
 */
export function flushSyncCallbacks() {
  console.log('ReactFiberSyncTaskQueue:flushSyncCallbacks 这里将 callback 拿出，执行');

  if (!isFlushingSyncQueue && syncQueue !== null) {
    // Prevent re-entrance.
    isFlushingSyncQueue = true;
    let i = 0;
    const previousUpdatePriority = getCurrentUpdatePriority();
    try {
      const isSync = true;
      const queue = syncQueue;
      // TODO: Is this necessary anymore? The only user code that runs in this
      // queue is in the render or commit phases.
      setCurrentUpdatePriority(EventPriority.DiscreteEventPriority);
      for (; i < queue.length; i++) {
        let callback: SchedulerCallback | null = queue[i];
        do {
          callback = callback(isSync);
        } while (callback !== null);
      }
      syncQueue = null;
      includesLegacySyncCallbacks = false;
    } catch (error) {
      // If something throws, leave the remaining callbacks on the queue.
      if (syncQueue !== null) {
        syncQueue = syncQueue.slice(i + 1);
      }
      // Resume flushing in the next tick
      scheduleCallback(PriorityLevel.ImmediatePriority, flushSyncCallbacks);
      throw error;
    } finally {
      setCurrentUpdatePriority(previousUpdatePriority);
      isFlushingSyncQueue = false;
    }
  }
  return null;
}
