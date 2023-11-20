import * as Scheduler from '../scheduler/Scheduler';

export const scheduleCallback = Scheduler.scheduleCallback;
export const cancelCallback = Scheduler.cancelCallback;
// export const shouldYield = Scheduler.unstable_shouldYield;
// export const requestPaint = Scheduler.unstable_requestPaint;
export const now = Scheduler.now;
// export const getCurrentPriorityLevel =
//   Scheduler.unstable_getCurrentPriorityLevel;
export const ImmediatePriority = Scheduler.ImmediatePriority;
export const UserBlockingPriority = Scheduler.UserBlockingPriority;
export const NormalPriority = Scheduler.NormalPriority;
export const LowPriority = Scheduler.LowPriority;
export const IdlePriority = Scheduler.IdlePriority;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;

export const requestPaint = Scheduler.requestPaint;
export const shouldYield = Scheduler.shouldYield;
