// Work in progress version numbers only apply to a single render,
// and should be reset before starting a new render.

import { isPrimaryRenderer } from '../react-dom/ReactFiberHostConfig';
import { MutableSource } from '../shared/ReactTypes';

// This tracks which mutable sources need to be reset after a render.
const workInProgressSources: Array<MutableSource<any>> = [];

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
