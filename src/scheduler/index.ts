import { PriorityLevel } from './SchedulerPriorities';
import { push, pop, peek, Heap } from './SchedulerMinHeap';
import { continuousYieldMs, frameYieldMs, maxYieldMs } from './SchedulerFeatureFlags';

// read: 只看主逻辑，先不关注 polyfill
const getCurrentTime = () => performance.now();

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
const maxSigned31BitInt = 1073741823;

// Times out immediately
const IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
const NORMAL_PRIORITY_TIMEOUT = 5000;
const LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

interface Task {
  id: number;
  callback: Function | null; // 假设回调函数无参数
  priorityLevel: number;
  startTime: number;
  expirationTime: number;
  sortIndex: number; // 初始化为-1
}
// Tasks are stored on a min heap
let taskQueue: Heap<Task> = [];
let timerQueue: Heap<Task> = [];

// Incrementing id counter. Used to maintain insertion order.
let taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
let isSchedulerPaused = false;

let currentTask: Task | null = null;
let currentPriorityLevel = PriorityLevel.NormalPriority;

// This is set while performing work, to prevent re-entrance.
let isPerformingWork = false;

let isHostCallbackScheduled = false;
let isHostTimeoutScheduled = false;

// read:实验特性 https://developer.mozilla.org/en-US/docs/Web/API/Scheduling/isInputPending
// const isInputPending =
//   typeof navigator !== 'undefined' &&
//   (navigator as any).scheduling !== undefined &&
//   (navigator as any).scheduling.isInputPending !== undefined
//     ? (navigator as any).scheduling.isInputPending.bind((navigator as any).scheduling)
//     : null;

//read: 源码中默认为 false
// const continuousOptions = { includeContinuous: false };

/**
 *
 * read: 这个函数用于更新定时器的状态，将已过期的定时器转移到任务队列中。
 * read: 先检查定时器队列的头部，如果头部的定时器已经过期，则将其从定时器队列中移除,转移到任务队列中。
 * read: 如果头部的定时器未过期，则不需要做什么了，退出即可
 *
 * @param currentTime
 * @returns
 */
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
    } else {
      // Remaining timers are pending.
      return;
    }
    timer = peek(timerQueue);
  }
}

/**
 * 任务超时
 * 将一堆任务放到 settimeout 里面执行？
 * @param currentTime
 */
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
    // No catch in prod code path.
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

function workLoop(hasTimeRemaining: boolean, initialTime: number) {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
      // This currentTask hasn't expired, and we've reached the deadline.
      break;
    }
    //read: 这个 callback 就是 scheduler 传进来的待执行函数(react 事件)
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;

      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback;
      } else {
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
function unstable_runWithPriority(priorityLevel: PriorityLevel, eventHandler: Function) {
  // read: 如果没有指定优先级，则给一个默认优先级
  switch (priorityLevel) {
    case PriorityLevel.ImmediatePriority:
    case PriorityLevel.UserBlockingPriority:
    case PriorityLevel.NormalPriority:
    case PriorityLevel.LowPriority:
    case PriorityLevel.IdlePriority:
      break;
    default:
      priorityLevel = PriorityLevel.NormalPriority;
  }

  // read: 更新本次执行的优先级
  let previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_wrapCallback(callback: Function) {
  var parentPriorityLevel = currentPriorityLevel;
  return function () {
    // This is a fork of runWithPriority, inlined for performance.
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;

    try {
      // @ts-ignore
      return callback.apply(this, arguments);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

/**
 * 任务调度, 将一个个callback 包装成 Task 放入 Queue 中 ,根据优先级按需执行
 * 业务侧不需要关心优先级是怎么调度的
 * @param priorityLevel
 * @param callback
 * @param options
 * @returns
 */
function unstable_scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Function,
  options?: any
) {
  var currentTime = getCurrentTime();

  // read: 计划什么时候开始执行
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

  // read: 不同优先级的任务，有不同的过期时间
  let timeout: number;
  switch (priorityLevel) {
    case PriorityLevel.ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case PriorityLevel.UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case PriorityLevel.IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case PriorityLevel.LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case PriorityLevel.NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }

  // read: 过期时间是开始时间 + 任务优先级
  var expirationTime = startTime + timeout;

  var newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };

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
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);

    // Schedule a host callback, if needed. If we're already performing work,
    // wait until the next time we yield.
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }

  return newTask;
}

function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

/**
 * 继续执行
 */
function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
}

function unstable_getFirstCallbackNode() {
  return peek(taskQueue);
}

function unstable_cancelCallback(task: Task) {
  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

/**
 * read:这个函数是一个用于控制事件处理程序执行的调度函数。它根据当前的优先级级别将事件处理程序的优先级降低到正常优先级，并在执行完成后将优先级恢复到之前的级别。
 * @param eventHandler
 * @returns
 */
function unstable_next(eventHandler: Function) {
  var priorityLevel;
  switch (currentPriorityLevel) {
    case PriorityLevel.ImmediatePriority:
    case PriorityLevel.UserBlockingPriority:
    case PriorityLevel.NormalPriority:
      // Shift down to normal priority
      priorityLevel = PriorityLevel.NormalPriority;
      break;
    default:
      // Anything lower than normal priority should remain at the current level.
      priorityLevel = currentPriorityLevel;
      break;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

let isMessageLoopRunning = false;
let scheduledHostCallback: Function | null = null;
let taskTimeoutID = -1;

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs;
// const continuousInputInterval = continuousYieldMs;
// const maxInterval = maxYieldMs;
let startTime = -1;

// let needsPaint = false;

/**
 * 这里默认可以执行js 的时间是一帧。(实际上一帧内还可能有其他任务，留给 js 的执行时间是不到这个数的，只不过可以尽快去渲染)
 * @returns
 */
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }

  // read: 这里是依赖了浏览器的特性，如果有更高优的任务(比如绘制 or 用户输入)，需要让渡给主线程
  // read: 源码里暂时没有开启该特性，先不看吧
  // // The main thread has been blocked for a non-negligible amount of time. We
  // // may want to yield control of the main thread, so the browser can perform
  // // high priority tasks. The main ones are painting and user input. If there's
  // // a pending paint or a pending input, then we should yield. But if there's
  // // neither, then we can yield less often while remaining responsive. We'll
  // // eventually yield regardless, since there could be a pending paint that
  // // wasn't accompanied by a call to `requestPaint`, or other main thread tasks
  // // like network events.
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

function requestPaint() {
  // if (
  //   enableIsInputPending &&
  //   navigator !== undefined &&
  //   navigator.scheduling !== undefined &&
  //   navigator.scheduling.isInputPending !== undefined
  // ) {
  //   needsPaint = true;
  // }
  // read: 如果外部需要重绘，只是打个标记, scheduler 会根据这个标记来决定是否要paint
  // read: 鉴于enableIsInputPending没有开启，这里也没啥用了
  // Since we yield every frame regardless, `requestPaint` has no effect.
}

function forceFrameRate(fps: number) {
  // read: 这里的帧率应该可以不限制到 125？ 毕竟有很多高刷显示器
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
        'forcing frame rates higher than 125 fps is not supported'
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    frameInterval = frameYieldMs;
  }
}

/**
 * 只要没过期，该函数就一直执行
 */
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
        schedulePerformWorkUntilDeadline!();
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

  // needsPaint = false;
};

let schedulePerformWorkUntilDeadline: Function | null;
// read: 已经被标记废弃了，虽然还支持，但是不建议使用
// if (typeof setImmediate === 'function') {
//   // Node.js and old IE.
//   // There's a few reasons for why we prefer setImmediate.
//   //
//   // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
//   // (Even though this is a DOM fork of the Scheduler, you could get here
//   // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
//   // https://github.com/facebook/react/issues/20756
//   //
//   // But also, it runs earlier which is the semantic we want.
//   // If other browsers ever implement it, it's better to use it.
//   // Although both of these would be inferior to native scheduling.
//   schedulePerformWorkUntilDeadline = () => {
//     setImmediate(performWorkUntilDeadline);
//   };
// } else

if (typeof MessageChannel !== 'undefined') {
  // DOM and Worker environments.
  // read: setTimeout现在并不是 4ms 的延迟了。需要翻下 v8 源码
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
    setTimeout(performWorkUntilDeadline, 0);
  };
}

function requestHostCallback(callback: Function) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline!();
  }
}

function requestHostTimeout(callback: Function, ms: number) {
  taskTimeoutID = setTimeout(() => {
    callback(getCurrentTime());
  }, ms) as unknown as number;
}

function cancelHostTimeout() {
  clearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

/**
 * @deprecated 现在并不支持该特性，可以不看
 */
const unstable_requestPaint = requestPaint;

export {
  unstable_getCurrentPriorityLevel,
  unstable_runWithPriority,
  unstable_next,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  shouldYieldToHost as unstable_shouldYield,
  unstable_requestPaint,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
  forceFrameRate as unstable_forceFrameRate,
  PriorityLevel,
};

export const unstable_Profiling = null;
