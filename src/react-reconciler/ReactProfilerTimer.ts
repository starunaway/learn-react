import {
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerTimer,
} from '../shared/ReactFeatureFlags';
import { Fiber } from './ReactInternalTypes';
import { WorkTag } from './ReactWorkTags';
import { now } from './Scheduler';

/**
 * Tracks whether the current update was a nested/cascading update (scheduled from a layout effect).
 *
 * The overall sequence is:
 *   1. render
 *   2. commit (and call `onRender`, `onCommit`)
 *   3. check for nested updates
 *   4. flush passive effects (and call `onPostCommit`)
 *
 * Nested updates are identified in step 3 above,
 * but step 4 still applies to the work that was just committed.
 * We use two flags to track nested updates then:
 * one tracks whether the upcoming update is a nested update,
 * and the other tracks whether the current update was a nested update.
 * The first value gets synced to the second at the start of the render phase.
 */
let currentUpdateIsNested: boolean = false;
let nestedUpdateScheduled: boolean = false;

let commitTime: number = 0;
let layoutEffectStartTime: number = -1;
let profilerStartTime: number = -1;
let passiveEffectStartTime: number = -1;

function resetNestedUpdateFlag(): void {
  if (enableProfilerNestedUpdatePhase) {
    currentUpdateIsNested = false;
    nestedUpdateScheduled = false;
  }
}

function syncNestedUpdateFlag(): void {
  if (enableProfilerNestedUpdatePhase) {
    currentUpdateIsNested = nestedUpdateScheduled;
    nestedUpdateScheduled = false;
  }
}

function recordPassiveEffectDuration(fiber: Fiber): void {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }

  if (passiveEffectStartTime >= 0) {
    const elapsedTime = now() - passiveEffectStartTime;

    passiveEffectStartTime = -1;

    // Store duration on the next nearest Profiler ancestor
    // Or the root (for the DevTools Profiler to read)
    let parentFiber = fiber.return;
    while (parentFiber !== null) {
      switch (parentFiber.tag) {
        case WorkTag.HostRoot:
          const root = parentFiber.stateNode;
          if (root !== null) {
            root.passiveEffectDuration += elapsedTime;
          }
          return;
        case WorkTag.Profiler:
          const parentStateNode = parentFiber.stateNode;
          if (parentStateNode !== null) {
            // Detached fibers have their state node cleared out.
            // In this case, the return pointer is also cleared out,
            // so we won't be able to report the time spent in this Profiler's subtree.
            parentStateNode.passiveEffectDuration += elapsedTime;
          }
          return;
      }
      parentFiber = parentFiber.return;
    }
  }
}

function startProfilerTimer(fiber: Fiber): void {
  if (!enableProfilerTimer) {
    return;
  }

  profilerStartTime = now();

  if ((fiber.actualStartTime || 0) < 0) {
    fiber.actualStartTime = now();
  }
}

function stopProfilerTimerIfRunningAndRecordDelta(fiber: Fiber, overrideBaseTime: boolean): void {
  if (!enableProfilerTimer) {
    return;
  }

  if (profilerStartTime >= 0) {
    const elapsedTime = now() - profilerStartTime;
    console.log(
      'stopProfilerTimerIfRunningAndRecordDelta 这里fiber.actualDuration已经被更新过了,不应该是 NaN 或 undefined',
      fiber.actualDuration
    );
    fiber.actualDuration = (fiber.actualDuration || 0) + elapsedTime;
    if (overrideBaseTime) {
      fiber.selfBaseDuration = elapsedTime;
    }
    profilerStartTime = -1;
  }
}

function startPassiveEffectTimer(): void {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  console.error('startPassiveEffectTimer 走到了函数中，逻辑待实现. 这里的特性都开启了，走不到区别');
  //   passiveEffectStartTime = now();
}

function stopProfilerTimerIfRunning(fiber: Fiber): void {
  if (!enableProfilerTimer) {
    return;
  }
  profilerStartTime = -1;
}

export {
  resetNestedUpdateFlag,
  startProfilerTimer,
  syncNestedUpdateFlag,
  startPassiveEffectTimer,
  recordPassiveEffectDuration,
  stopProfilerTimerIfRunning,
  stopProfilerTimerIfRunningAndRecordDelta,
};
