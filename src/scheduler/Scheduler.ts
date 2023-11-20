import {
  enableSchedulerDebugging,
  enableProfiling,
  enableIsInputPending,
  enableIsInputPendingContinuous,
  frameYieldMs,
  continuousYieldMs,
  maxYieldMs,
} from './SchedulerFeatureFlags';

import { peek, push, Node, pop } from './SchedulerMinHeap';
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  PriorityLevel,
  UserBlockingPriority,
} from './SchedulerPriorities';

let getCurrentTime: () => number;
const hasPerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;
}

let maxSigned31BitInt = 1073741823;

// Times out immediately
let IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
let USER_BLOCKING_PRIORITY_TIMEOUT = 250;
let NORMAL_PRIORITY_TIMEOUT = 5000;
let LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
let IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// Tasks are stored on a min heap
let taskQueue: Node[] = [];
let timerQueue: Node[] = [];

// This is set while performing work, to prevent re-entrance.
let isPerformingWork = false;

let isHostCallbackScheduled = false;
let isHostTimeoutScheduled = false;

// Incrementing id counter. Used to maintain insertion order.
let taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
let isSchedulerPaused = false;

let currentTask: Node | null = null;
let currentPriorityLevel = NormalPriority;

// Capture local references to native APIs, in case a polyfill overrides them.
const localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;
const localClearTimeout = typeof clearTimeout === 'function' ? clearTimeout : null;
const localSetImmediate = typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom

// This is set while performing work, to prevent re-entrance.

function unstable_cancelCallback(task: any) {
  // todo 特性暂时都不开启
  // if (enableProfiling) {
  //   if (task.isQueued) {
  //     const currentTime = getCurrentTime();
  //     markTaskCanceled(task, currentTime);
  //     task.isQueued = false;
  //   }
  // }

  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function advanceTimers(currentTime: number) {
  // Check for tasks that are no longer delayed and add them to the queue.
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      // Timer was cancelled.
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      // Timer fired. Transfer to the task queue.
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      // 和特性想过的，都先关掉
      // if (enableProfiling) {
      //   markTaskStart(timer, currentTime);
      //   timer.isQueued = true;
      // }
    } else {
      // Remaining timers are pending.
      return;
    }
    timer = peek(timerQueue);
  }
}

function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

function flushWork(hasTimeRemaining: boolean, initialTime: number) {
  // if (enableProfiling) {
  //   markSchedulerUnsuspended(initialTime);
  // }

  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    // We scheduled a timeout but it's no longer needed. Cancel it.
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;
  try {
    if (enableProfiling) {
      // 特性暂时不看
      // try {
      //   return workLoop(hasTimeRemaining, initialTime);
      // } catch (error) {
      //   if (currentTask !== null) {
      //     const currentTime = getCurrentTime();
      //     markTaskErrored(currentTask, currentTime);
      //     currentTask.isQueued = false;
      //   }
      //   throw error;
      // }
    } else {
      // No catch in prod code path.
      return workLoop(hasTimeRemaining, initialTime);
    }
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
    // 特性暂时不看
    // if (enableProfiling) {
    //   const currentTime = getCurrentTime();
    //   markSchedulerSuspended(currentTime);
    // }
  }
}

function workLoop(hasTimeRemaining: boolean, initialTime: number) {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);
  while (currentTask !== null && !(enableSchedulerDebugging && isSchedulerPaused)) {
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
      // This currentTask hasn't expired, and we've reached the deadline.
      break;
    }
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      // 特性暂时不看
      // if (enableProfiling) {
      //   markTaskRun(currentTask, currentTime);
      // }
      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback;
        // 特性暂时不看
        // if (enableProfiling) {
        //   markTaskYield(currentTask, currentTime);
        // }
      } else {
        // 特性暂时不看
        // if (enableProfiling) {
        //   markTaskCompleted(currentTask, currentTime);
        //   currentTask.isQueued = false;
        // }
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      advanceTimers(currentTime);
    } else {
      pop(taskQueue);
    }
    currentTask = peek(taskQueue);
  }
  // Return whether there's additional work
  if (currentTask !== null) {
    return true;
  } else {
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false;
  }
}

function unstable_scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Function | null,
  options: Record<string | 'delay', any> | null
) {
  var currentTime = getCurrentTime();

  var startTime;
  if (typeof options === 'object' && options !== null) {
    var delay = options.delay;
    if (typeof delay === 'number' && delay > 0) {
      startTime = currentTime + delay;
    } else {
      startTime = currentTime;
    }
  } else {
    startTime = currentTime;
  }

  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }

  var expirationTime = startTime + timeout;

  var newTask: Node = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };
  // todo 特性暂时不开启
  // if (enableProfiling) {
  //   newTask.isQueued = false;
  // }

  if (startTime > currentTime) {
    // This is a delayed task.
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      // All tasks are delayed, and this is the task with the earliest delay.
      if (isHostTimeoutScheduled) {
        // Cancel an existing timeout.
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      // Schedule a timeout.
      setTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    // todo 特性暂时不开启
    // if (enableProfiling) {
    //   markTaskStart(newTask, currentTime);
    //   newTask.isQueued = true;
    // }
    // Schedule a host callback, if needed. If we're already performing work,
    // wait until the next time we yield.
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }

  return newTask;
}

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs;
const continuousInputInterval = continuousYieldMs;
const maxInterval = maxYieldMs;
let startTime = -1;

let needsPaint = false;

function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }

  // The main thread has been blocked for a non-negligible amount of time. We
  // may want to yield control of the main thread, so the browser can perform
  // high priority tasks. The main ones are painting and user input. If there's
  // a pending paint or a pending input, then we should yield. But if there's
  // neither, then we can yield less often while remaining responsive. We'll
  // eventually yield regardless, since there could be a pending paint that
  // wasn't accompanied by a call to `requestPaint`, or other main thread tasks
  // like network events.
  // 特性相关，暂时都不看
  // if (enableIsInputPending) {
  //   if (needsPaint) {
  //     // There's a pending paint (signaled by `requestPaint`). Yield now.
  //     return true;
  //   }
  //   if (timeElapsed < continuousInputInterval) {
  //     // We haven't blocked the thread for that long. Only yield if there's a
  //     // pending discrete input (e.g. click). It's OK if there's pending
  //     // continuous input (e.g. mouseover).
  //     if (isInputPending !== null) {
  //       return isInputPending();
  //     }
  //   } else if (timeElapsed < maxInterval) {
  //     // Yield if there's either a pending discrete or continuous input.
  //     if (isInputPending !== null) {
  //       return isInputPending(continuousOptions);
  //     }
  //   } else {
  //     // We've blocked the thread for a long time. Even if there's no pending
  //     // input, there may be some other scheduled work that we don't know about,
  //     // like a network event. Yield now.
  //     return true;
  //   }
  // }

  // `isInputPending` isn't available. Yield now.
  return true;
}

const performWorkUntilDeadline = () => {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    // Keep track of the start time so we can measure how long the main thread
    // has been blocked.
    startTime = currentTime;
    const hasTimeRemaining = true;

    // If a scheduler task throws, exit the current browser task so the
    // error can be observed.
    //
    // Intentionally not using a try-catch, since that makes some debugging
    // techniques harder. Instead, if `scheduledHostCallback` errors, then
    // `hasMoreWork` will remain true, and we'll continue the work loop.
    let hasMoreWork = true;
    try {
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        schedulePerformWorkUntilDeadline?.();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
  // Yielding to the browser will give it a chance to paint, so we can
  // reset this.
  needsPaint = false;
};

let isMessageLoopRunning = false;
let taskTimeoutID = -1;
let scheduledHostCallback: null | Function = null;

function cancelHostTimeout() {
  clearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

function requestHostCallback(callback?: null | Function) {
  scheduledHostCallback = callback || null;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline?.();
  }
}

export function requestPaint() {
  // if (
  //   enableIsInputPending &&
  //   navigator !== undefined &&
  //   navigator.scheduling !== undefined &&
  //   navigator.scheduling.isInputPending !== undefined
  // ) {
  //   needsPaint = true;
  // }
  // Since we yield every frame regardless, `requestPaint` has no effect.
}

function requestHostTimeout(callback: (v: number) => void, ms: number) {
  taskTimeoutID = setTimeout(() => {
    callback(getCurrentTime());
  }, ms) as unknown as number;
}

let schedulePerformWorkUntilDeadline: (() => void) | undefined;
if (typeof localSetImmediate === 'function') {
  // Node.js and old IE.
  // There's a few reasons for why we prefer setImmediate.
  //
  // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
  // (Even though this is a DOM fork of the Scheduler, you could get here
  // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
  // https://github.com/facebook/react/issues/20756
  //
  // But also, it runs earlier which is the semantic we want.
  // If other browsers ever implement it, it's better to use it.
  // Although both of these would be inferior to native scheduling.
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  // DOM and Worker environments.
  // We prefer MessageChannel because of the 4ms setTimeout clamping.
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);
  };
} else {
  // We should only fallback here in non-browser environments.
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout?.(performWorkUntilDeadline, 0);
  };
}

export {
  getCurrentTime as now,
  unstable_cancelCallback as cancelCallback,
  unstable_scheduleCallback as scheduleCallback,
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  // PriorityLevel,
  UserBlockingPriority,
  shouldYieldToHost as shouldYield,
};
