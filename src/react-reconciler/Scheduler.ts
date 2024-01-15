import * as Scheduler from '../scheduler';

export const getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;
export const ImmediatePriority = Scheduler.PriorityLevel.ImmediatePriority;
export const UserBlockingPriority = Scheduler.PriorityLevel.UserBlockingPriority;
export const NormalPriority = Scheduler.PriorityLevel.NormalPriority;
export const LowPriority = Scheduler.PriorityLevel.LowPriority;
export const IdlePriority = Scheduler.PriorityLevel.IdlePriority;
