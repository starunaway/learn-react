// A null SuspenseState represents an unsuspended normal Suspense boundary.
// A non-null SuspenseState means that it is blocked for one reason or another.
// - A non-null dehydrated field means it's blocked pending hydration.
//   - A non-null dehydrated field can use isSuspenseInstancePending or
//     isSuspenseInstanceFallback to query the reason for being dehydrated.
// - A null dehydrated field means it's blocked by something suspending and

import { SuspenseInstance } from '../react-dom/ReactFiberHostConfig';
import { Lane } from './ReactFiberLane';
import type { TreeContext } from './ReactFiberTreeContext';

//   we're currently showing a fallback instead.
export type SuspenseState = {
  // If this boundary is still dehydrated, we store the SuspenseInstance
  // here to indicate that it is dehydrated (flag) and for quick access
  // to check things like isSuspenseInstancePending.
  dehydrated: null | SuspenseInstance;
  treeContext: null | TreeContext;
  // Represents the lane we should attempt to hydrate a dehydrated boundary at.
  // OffscreenLane is the default for dehydrated boundaries.
  // NoLane is the default for normal boundaries, which turns into "normal" pri.
  retryLane: Lane;
};
