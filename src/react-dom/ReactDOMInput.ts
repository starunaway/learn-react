import { mixed } from '../types';
import type { ToStringValue } from './ToStringValue';
import { toString } from './ToStringValue';
import getActiveElement from './getActiveElement';

export type InputWithWrapperState = HTMLInputElement & {
  _wrapperState: {
    initialValue: ToStringValue;
    initialChecked?: boolean;
    controlled?: boolean;
  } & mixed;
};

// In Chrome, assigning defaultValue to certain input types triggers input validation.
// For number inputs, the display value loses trailing decimal points. For email inputs,
// Chrome raises "The specified value <x> is not a valid email address".
//
// Here we check to see if the defaultValue has actually changed, avoiding these problems
// when the user is inputting text
//
// https://github.com/facebook/react/issues/7253
export function setDefaultValue(node: InputWithWrapperState, type?: string, value?: any) {
  if (
    // Focused number inputs synchronize on blur. See ChangeEventPlugin.js
    type !== 'number' ||
    getActiveElement(node.ownerDocument) !== node
  ) {
    if (value == null) {
      node.defaultValue = toString(node._wrapperState.initialValue);
    } else if (node.defaultValue !== toString(value)) {
      node.defaultValue = toString(value);
    }
  }
}
