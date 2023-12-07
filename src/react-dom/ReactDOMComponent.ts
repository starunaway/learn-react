export function updateProperties(
  domElement: Element,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Record<string | number, any>,
  nextRawProps: Record<string | number, any>
): void {
  // Update checked *before* name.
  // In the middle of an update, it is possible to have multiple checked.
  // When a checked radio tries to change name, browser makes another radio's checked false.
  //   输入框逻辑，暂时先不关注
  //   if (tag === 'input' && nextRawProps.type === 'radio' && nextRawProps.name != null) {
  //     ReactDOMInputUpdateChecked(domElement, nextRawProps);
  //   }
  //   const wasCustomComponentTag = isCustomComponent(tag, lastRawProps);
  //   const isCustomComponentTag = isCustomComponent(tag, nextRawProps);
  //   // Apply the diff.
  //   updateDOMProperties(domElement, updatePayload, wasCustomComponentTag, isCustomComponentTag);
  // TODO: Ensure that an update gets scheduled if any of the special props
  // changed.
  //   switch (tag) {
  //     case 'input':
  //       // Update the wrapper around inputs *after* updating props. This has to
  //       // happen after `updateDOMProperties`. Otherwise HTML5 input validations
  //       // raise warnings and prevent the new value from being assigned.
  //       ReactDOMInputUpdateWrapper(domElement, nextRawProps);
  //       break;
  //     case 'textarea':
  //       ReactDOMTextareaUpdateWrapper(domElement, nextRawProps);
  //       break;
  //     case 'select':
  //       // <select> value update needs to occur after <option> children
  //       // reconciliation
  //       ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps);
  //       break;
  //   }
}
