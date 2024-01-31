import { disableInputAttributeSyncing } from '../shared/ReactFeatureFlags';
import { mixed } from '../types';
import { setValueForProperty } from './DOMPropertyOperations';
import { getFiberCurrentPropsFromNode } from './ReactDOMComponentTree';
import { Props } from './ReactFiberHostConfig';
import type { ToStringValue } from './ToStringValue';
import { getToStringValue, toString } from './ToStringValue';
import getActiveElement from './getActiveElement';
import { updateValueIfChanged } from './inputValueTracking';

function isControlled(props: any) {
  const usesChecked = props.type === 'checkbox' || props.type === 'radio';
  return usesChecked ? props.checked != null : props.value != null;
}

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

// read: 这里应该是获取 Input 类型的 dom 属性？范围有点大
// 还是说不管什么类型的 dom，都塞了默认的这几个属性？
export function getHostProps(element: Element, props: any) {
  const node = element as InputWithWrapperState;
  const checked = props.checked;

  const hostProps = Object.assign({}, props, {
    defaultChecked: undefined,
    defaultValue: undefined,
    value: undefined,
    checked: checked != null ? checked : node._wrapperState.initialChecked,
  });

  return hostProps;
}

export function postMountWrapper(element: Element, props: any, isHydrating: boolean) {
  const node = element as InputWithWrapperState;

  // Do not assign value if it is already set. This prevents user text input
  // from being lost during SSR hydration.
  if (props.hasOwnProperty('value') || props.hasOwnProperty('defaultValue')) {
    const type = props.type;
    const isButton = type === 'submit' || type === 'reset';

    // Avoid setting value attribute on submit/reset inputs as it overrides the
    // default value provided by the browser. See: #12872
    if (isButton && (props.value === undefined || props.value === null)) {
      return;
    }

    const initialValue = toString(node._wrapperState.initialValue);

    // Do not assign value if it is already set. This prevents user text input
    // from being lost during SSR hydration.
    if (!isHydrating) {
      if (disableInputAttributeSyncing) {
        const value = getToStringValue(props.value);

        // When not syncing the value attribute, the value property points
        // directly to the React prop. Only assign it if it exists.
        if (value != null) {
          // Always assign on buttons so that it is possible to assign an
          // empty string to clear button text.
          //
          // Otherwise, do not re-assign the value property if is empty. This
          // potentially avoids a DOM write and prevents Firefox (~60.0.1) from
          // prematurely marking required inputs as invalid. Equality is compared
          // to the current value in case the browser provided value is not an
          // empty string.
          if (isButton || value !== node.value) {
            node.value = toString(value);
          }
        }
      } else {
        // When syncing the value attribute, the value property should use
        // the wrapperState._initialValue property. This uses:
        //
        //   1. The value React property when present
        //   2. The defaultValue React property when present
        //   3. An empty string
        if (initialValue !== node.value) {
          node.value = initialValue;
        }
      }
    }

    if (disableInputAttributeSyncing) {
      // When not syncing the value attribute, assign the value attribute
      // directly from the defaultValue React property (when present)
      const defaultValue = getToStringValue(props.defaultValue);
      if (defaultValue != null) {
        node.defaultValue = toString(defaultValue);
      }
    } else {
      // Otherwise, the value attribute is synchronized to the property,
      // so we assign defaultValue to the same thing as the value property
      // assignment step above.
      node.defaultValue = initialValue;
    }
  }

  // Normally, we'd just do `node.checked = node.checked` upon initial mount, less this bug
  // this is needed to work around a chrome bug where setting defaultChecked
  // will sometimes influence the value of checked (even after detachment).
  // Reference: https://bugs.chromium.org/p/chromium/issues/detail?id=608416
  // We need to temporarily unset name to avoid disrupting radio button groups.
  const name = node.name;
  if (name !== '') {
    node.name = '';
  }

  if (disableInputAttributeSyncing) {
    // When not syncing the checked attribute, the checked property
    // never gets assigned. It must be manually set. We don't want
    // to do this when hydrating so that existing user input isn't
    // modified
    if (!isHydrating) {
      updateChecked(element as HTMLInputElement, props);
    }

    // Only assign the checked attribute if it is defined. This saves
    // a DOM write when controlling the checked attribute isn't needed
    // (text inputs, submit/reset)
    if (props.hasOwnProperty('defaultChecked')) {
      node.defaultChecked = !node.defaultChecked;
      node.defaultChecked = !!props.defaultChecked;
    }
  } else {
    // When syncing the checked attribute, both the checked property and
    // attribute are assigned at the same time using defaultChecked. This uses:
    //
    //   1. The checked React property when present
    //   2. The defaultChecked React property when present
    //   3. Otherwise, false
    node.defaultChecked = !node.defaultChecked;
    node.defaultChecked = !!node._wrapperState.initialChecked;
  }

  if (name !== '') {
    node.name = name;
  }
}

export function initWrapperState(element: Element, props: any) {
  const node = element as InputWithWrapperState;
  const defaultValue = props.defaultValue == null ? '' : props.defaultValue;

  node._wrapperState = {
    initialChecked: props.checked != null ? props.checked : props.defaultChecked,
    initialValue: getToStringValue(props.value != null ? props.value : defaultValue),
    controlled: isControlled(props),
  };
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
