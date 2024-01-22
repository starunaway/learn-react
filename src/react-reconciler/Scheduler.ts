import * as Scheduler from '../scheduler';

export const getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
// export const ImmediatePriority = Scheduler.PriorityLevel.ImmediatePriority;
// export const UserBlockingPriority = Scheduler.PriorityLevel.UserBlockingPriority;
// export const NormalPriority = Scheduler.PriorityLevel.NormalPriority;
// export const LowPriority = Scheduler.PriorityLevel.LowPriority;
// export const IdlePriority = Scheduler.PriorityLevel.IdlePriority;
export const PriorityLevel = Scheduler.PriorityLevel;

export const scheduleCallback = Scheduler.unstable_scheduleCallback;
export const cancelCallback = Scheduler.unstable_cancelCallback;
export const shouldYield = Scheduler.unstable_shouldYield;
export const requestPaint = Scheduler.unstable_requestPaint;
export const now = Scheduler.unstable_now;

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;
