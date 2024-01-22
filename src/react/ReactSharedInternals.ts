/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactCurrentDispatcher from './ReactCurrentDispatcher';
import ReactCurrentBatchConfig from './ReactCurrentBatchConfig';
import ReactCurrentOwner from './ReactCurrentOwner';
import { enableServerContext } from '../shared/ReactFeatureFlags';
// import { ContextRegistry } from './ReactServerContextRegistry';

const ReactSharedInternals = {
  ReactCurrentDispatcher,
  ReactCurrentBatchConfig,
  ReactCurrentOwner,
};

if (enableServerContext) {
  // fixme: 这里是 server 的 Context，应该和 client 无关
  // (ReactSharedInternals as any).ContextRegistry = ContextRegistry;
}

export default ReactSharedInternals;
