import { enableCache } from '../shared/ReactFeatureFlags';
import { ReactContext } from '../shared/ReactTypes';
import { Lanes } from './ReactFiberLane';
import { Fiber, FiberRoot } from './ReactInternalTypes';
import { WorkTag } from './ReactWorkTags';
import { popTreeContext } from './ReactFiberTreeContext';
import { popCacheProvider } from './ReactFiberCacheComponent';
import { popProvider } from './ReactFiberNewContext';
import { popHostContainer, popHostContext } from './ReactFiberHostContext';
import { popRootTransition } from './ReactFiberTransition';
import { popTopLevelContextObject as popTopLevelLegacyContextObject } from './ReactFiberContext';
import { resetWorkInProgressVersions as resetMutableSourceWorkInProgressVersions } from './ReactMutableSource';
import type { Cache } from './ReactFiberCacheComponent';

/**
 * 处理中断的工作
 * 对于不同的类型，可能会调用不同的函数来恢复中断前的状态
 * @param current
 * @param interruptedWork
 * @param renderLanes
 */
function unwindInterruptedWork(current: Fiber | null, interruptedWork: Fiber, renderLanes: Lanes) {
  // Note: This intentionally doesn't check if we're hydrating because comparing
  // to the current tree provider fiber is just as fast and less error-prone.
  // Ideally we would have a special version of the work loop only
  // for hydration.
  popTreeContext(interruptedWork);
  // read: 这里按需实现吧
  switch (interruptedWork.tag) {
    case WorkTag.ClassComponent: {
      console.error('unwindInterruptedWork WorkTag.ClassComponent 待实现');
      //   const childContextTypes = interruptedWork.type.childContextTypes;
      //   if (childContextTypes !== null && childContextTypes !== undefined) {
      //     popLegacyContext(interruptedWork);
      //   }
      break;
    }
    case WorkTag.HostRoot: {
      const root: FiberRoot = interruptedWork.stateNode;
      if (enableCache) {
        const cache: Cache = interruptedWork.memoizedState.cache;
        popCacheProvider(interruptedWork, cache);
      }
      // read: 特性不支持，先不看了
      //   popRootTransition(interruptedWork, root, renderLanes);
      popHostContainer(interruptedWork);
      popTopLevelLegacyContextObject(interruptedWork);
      resetMutableSourceWorkInProgressVersions();
      break;
    }
    case WorkTag.HostComponent: {
      popHostContext(interruptedWork);
      break;
    }
    case WorkTag.HostPortal:
      console.error('unwindInterruptedWork WorkTag.HostPortal 待实现');
      //   popHostContainer(interruptedWork);
      break;
    case WorkTag.SuspenseComponent:
      console.error('unwindInterruptedWork WorkTag.SuspenseComponent 待实现');

      //   popSuspenseContext(interruptedWork);
      break;
    case WorkTag.SuspenseListComponent:
      console.error('unwindInterruptedWork WorkTag.SuspenseListComponent 待实现');

      //   popSuspenseContext(interruptedWork);
      break;
    case WorkTag.ContextProvider:
      const context: ReactContext<any> = interruptedWork.type._context;
      popProvider(context, interruptedWork);
      break;
    case WorkTag.OffscreenComponent:
    case WorkTag.LegacyHiddenComponent:
      console.error(
        'unwindInterruptedWork WorkTag.OffscreenComponent  WorkTag.LegacyHiddenComponent待实现'
      );

      //   popRenderLanes(interruptedWork);
      //   popTransition(interruptedWork, current);
      break;
    case WorkTag.CacheComponent:
      console.error('unwindInterruptedWork WorkTag.HostPortal 待实现');

      //   if (enableCache) {
      //     const cache: Cache = interruptedWork.memoizedState.cache;
      //     popCacheProvider(interruptedWork, cache);
      //   }
      break;
    default:
      break;
  }
}

export { unwindInterruptedWork };
