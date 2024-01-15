import { PriorityLevel } from './SchedulerPriorities';

let currentPriorityLevel = PriorityLevel.NormalPriority;

function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

export { unstable_getCurrentPriorityLevel, PriorityLevel };
