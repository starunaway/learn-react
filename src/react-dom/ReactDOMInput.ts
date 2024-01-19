import { mixed } from '../types';
import { setValueForProperty } from './DOMPropertyOperations';
import { getFiberCurrentPropsFromNode } from './ReactDOMComponentTree';
import { Props } from './ReactFiberHostConfig';
import type { ToStringValue } from './ToStringValue';
import { getToStringValue, toString } from './ToStringValue';
import getActiveElement from './getActiveElement';
import { updateValueIfChanged } from './inputValueTracking';

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

export function updateChecked(element: HTMLInputElement, props: Props) {
  const node = element;
  const checked = props.checked;
  if (checked != null) {
    setValueForProperty(node, 'checked', checked, false);
  }
}

export function updateWrapper(element: HTMLInputElement, props: Props) {
  const node = element;

  updateChecked(element, props);

  const value = getToStringValue(props.value);
  const type = props.type;

  if (value != null) {
    if (type === 'number') {
      if (
        (value === 0 && node.value === '') ||
        // We explicitly want to coerce to number here if possible.
        // eslint-disable-next-line
        node.value != value
      ) {
        node.value = toString(value);
      }
    } else if (node.value !== toString(value)) {
      node.value = toString(value);
    }
  } else if (type === 'submit' || type === 'reset') {
    // Submit/reset inputs need the attribute removed completely to avoid
    // blank-text buttons.
    node.removeAttribute('value');
    return;
  }

  // When syncing the value attribute, the value comes from a cascade of
  // properties:
  //  1. The value React property
  //  2. The defaultValue React property
  //  3. Otherwise there should be no change
  if (props.hasOwnProperty('value')) {
    setDefaultValue(node as InputWithWrapperState, props.type, value);
  } else if (props.hasOwnProperty('defaultValue')) {
    setDefaultValue(
      node as InputWithWrapperState,
      props.type,
      getToStringValue(props.defaultValue)
    );
  }

  // When syncing the checked attribute, it only changes when it needs
  // to be removed, such as transitioning from a checkbox into a text input
  if (props.checked == null && props.defaultChecked != null) {
    node.defaultChecked = !!props.defaultChecked;
  }
}

export function restoreControlledState(element: HTMLInputElement, props: Props) {
  const node = element;
  updateWrapper(node, props);
  updateNamedCousins(node, props);
}

function updateNamedCousins(rootNode: HTMLInputElement, props: Props) {
  const name = props.name;
  if (props.type === 'radio' && name != null) {
    let queryRoot: Node = rootNode;

    while (queryRoot.parentNode) {
      queryRoot = queryRoot.parentNode;
    }

    // If `rootNode.form` was non-null, then we could try `form.elements`,
    // but that sometimes behaves strangely in IE8. We could also try using
    // `form.getElementsByName`, but that will only return direct children
    // and won't include inputs that use the HTML5 `form=` attribute. Since
    // the input might not even be in a form. It might not even be in the
    // document. Let's just use the local `querySelectorAll` to ensure we don't
    // miss anything.

    const group = (queryRoot as ParentNode).querySelectorAll(
      'input[name=' + JSON.stringify('' + name) + '][type="radio"]'
    );

    for (let i = 0; i < group.length; i++) {
      const otherNode = group[i];
      if (otherNode === rootNode || (otherNode as HTMLInputElement).form !== rootNode.form) {
        continue;
      }
      // This will throw if radio buttons rendered by different copies of React
      // and the same name are rendered into the same form (same as #1939).
      // That's probably okay; we don't support it just as we don't support
      // mixing React radio buttons with non-React ones.
      const otherProps = getFiberCurrentPropsFromNode(otherNode);

      if (!otherProps) {
        throw new Error(
          'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
            'same `name` is not supported.'
        );
      }

      // We need update the tracked value on the named cousin since the value
      // was changed but the input saw no event or value set
      updateValueIfChanged(otherNode as HTMLInputElement);

      // If this is a controlled radio button group, forcing the input that
      // was previously checked to update will cause it to be come re-checked
      // as appropriate.
      updateWrapper(otherNode as HTMLInputElement, otherProps);
    }
  }
}
