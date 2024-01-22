export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): Function {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, false);
  return listener;
}

export function addEventCaptureListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
): Function {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, {
    capture: true,
    // read:设置为 true 时，表示 listener 永远不会调用 preventDefault()
    passive,
  });
  return listener;
}

export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): Function {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, true);
  return listener;
}

export function addEventBubbleListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
) {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, {
    // read: true 时，表示 listener 永远不会调用 preventDefault()
    passive,
  });
  return listener;
}
