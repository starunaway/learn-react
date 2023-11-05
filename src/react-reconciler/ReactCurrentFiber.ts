import { Fiber } from './ReactInternalTypes';

export function resetCurrentFiber() {
  // if (__DEV__) {
  //   ReactDebugCurrentFrame.getCurrentStack = null;
  //   current = null;
  //   isRendering = false;
  // }
}

export function setCurrentFiber(fiber: Fiber | null) {
  // if (__DEV__) {
  //   ReactDebugCurrentFrame.getCurrentStack =
  //     fiber === null ? null : getCurrentFiberStackInDev;
  //   current = fiber;
  //   isRendering = false;
  // }
}

export function getCurrentFiber(): Fiber | null {
  //   if (__DEV__) {
  //     return current;
  //   }
  return null;
}
