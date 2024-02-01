// This exists to avoid circular dependency between ReactDOMEventReplaying

import { AnyNativeEvent } from './PluginModuleType';

// and DOMPluginEventSystem.
let currentReplayingEvent = null;

export function setReplayingEvent(event: AnyNativeEvent): void {
  currentReplayingEvent = event;
}

export function resetReplayingEvent(): void {
  currentReplayingEvent = null;
}
