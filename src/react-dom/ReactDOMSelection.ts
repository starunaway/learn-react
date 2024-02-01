import getNodeForCharacterOffset from './getNodeForCharacterOffset';

/**
 * In modern non-IE browsers, we can support both forward and backward
 * selections.
 *
 * Note: IE10+ supports the Selection object, but it does not support
 * the `extend` method, which means that even in modern IE, it's not possible
 * to programmatically create a backward selection. Thus, for all IE
 * versions, we use the old IE API to create our selections.
 *
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
export function setOffsets(node: any, offsets: any) {
  const doc = node.ownerDocument || document;
  const win = (doc && doc.defaultView) || window;

  // Edge fails with "Object expected" in some scenarios.
  // (For instance: TinyMCE editor used in a list component that supports pasting to add more,
  // fails when pasting 100+ items)
  if (!win.getSelection) {
    return;
  }

  const selection = win.getSelection();
  const length = node.textContent.length;
  let start = Math.min(offsets.start, length);
  let end = offsets.end === undefined ? start : Math.min(offsets.end, length);

  // IE 11 uses modern selection, but doesn't support the extend method.
  // Flip backward selections, so we can set with a single range.
  if (!selection.extend && start > end) {
    const temp = end;
    end = start;
    start = temp;
  }

  const startMarker = getNodeForCharacterOffset(node, start);
  const endMarker = getNodeForCharacterOffset(node, end);

  if (startMarker && endMarker) {
    if (
      selection.rangeCount === 1 &&
      selection.anchorNode === startMarker.node &&
      selection.anchorOffset === startMarker.offset &&
      selection.focusNode === endMarker.node &&
      selection.focusOffset === endMarker.offset
    ) {
      return;
    }
    const range = doc.createRange();
    range.setStart(startMarker.node, startMarker.offset);
    selection.removeAllRanges();

    if (start > end) {
      selection.addRange(range);
      selection.extend(endMarker.node, endMarker.offset);
    } else {
      range.setEnd(endMarker.node, endMarker.offset);
      selection.addRange(range);
    }
  }
}
