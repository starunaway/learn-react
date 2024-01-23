import { PriorityLevel, scheduleCallback } from './Scheduler';
import { enableCache } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';

// In environments without AbortController (e.g. tests)
// replace it with a lightweight shim that only has the features we use.
// fixme: 源码里面有个AbortControllerLocal，添加了 polyfill，比如 RN
// read: 浏览器端用原生的方法就可以了
// const AbortControllerLocal = AbortController;

export type Cache = {
  controller: AbortController;
  data: Map<() => mixed, mixed>;
  refCount: number;
};

// Creates a new empty Cache instance with a ref-count of 0. The caller is responsible
// for retaining the cache once it is in use (retainCache), and releasing the cache
// once it is no longer needed (releaseCache).
export function createCache(): Cache | null {
  if (!enableCache) {
    return null;
  }
  const cache: Cache = {
    controller: new AbortController(),
    data: new Map(),
    refCount: 0,
  };

  return cache;
}

export function retainCache(cache: Cache) {
  if (!enableCache) {
    return;
  }
  cache.refCount++;
}

export function releaseCache(cache: Cache) {
  if (!enableCache) {
    return;
  }
  cache.refCount--;

  if (cache.refCount === 0) {
    scheduleCallback(PriorityLevel.NormalPriority, () => {
      cache.controller.abort();
    });
  }
}
