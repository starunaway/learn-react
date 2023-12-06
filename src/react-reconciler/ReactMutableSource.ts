import { MutableSource } from '@/shared/ReactTypes';

const workInProgressSources: Array<MutableSource<any>> = [];

// react dom  rn ssr 状态都不一样
const isPrimaryRenderer = true;
export function resetWorkInProgressVersions(): void {
  for (let i = 0; i < workInProgressSources.length; i++) {
    const mutableSource = workInProgressSources[i];
    if (isPrimaryRenderer) {
      mutableSource._workInProgressVersionPrimary = null;
    } else {
      mutableSource._workInProgressVersionSecondary = null;
    }
  }
  workInProgressSources.length = 0;
}
