export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): void {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, false);
}

export function addEventCaptureListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
): void {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, {
    capture: true,
    // read:设置为 true 时，表示 listener 永远不会调用 preventDefault()
    passive,
  });
}

export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function
): void {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, true);
}

export function addEventBubbleListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
): void {
  target.addEventListener(eventType, listener as EventListenerOrEventListenerObject, {
    // read: true 时，表示 listener 永远不会调用 preventDefault()
    passive,
  });
}
