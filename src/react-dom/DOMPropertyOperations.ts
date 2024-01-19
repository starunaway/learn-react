import {
  getPropertyInfo,
  shouldIgnoreAttribute,
  shouldRemoveAttribute,
  isAttributeNameSafe,
  PropertyType,
} from './shared/DOMProperty';
import sanitizeURL from './shared/sanitizeURL';
import { getFiberCurrentPropsFromNode } from './ReactDOMComponentTree';
/**
 * Sets the value for a property on a node.
 *
 * @param {DOMElement} node
 * @param {string} name
 * @param {*} value
 */
export function setValueForProperty(
  node: Element,
  name: string,
  value: any,
  isCustomComponentTag: boolean
) {
  const propertyInfo = getPropertyInfo(name);
  if (shouldIgnoreAttribute(name, propertyInfo, isCustomComponentTag)) {
    return;
  }

  if (isCustomComponentTag && name[0] === 'o' && name[1] === 'n') {
    let eventName = name.replace(/Capture$/, '');
    const useCapture = name !== eventName;
    eventName = eventName.slice(2);

    const prevProps = getFiberCurrentPropsFromNode(node);
    const prevValue = prevProps != null ? prevProps[name] : null;
    if (typeof prevValue === 'function') {
      node.removeEventListener(eventName, prevValue, useCapture);
    }
    if (typeof value === 'function') {
      if (typeof prevValue !== 'function' && prevValue !== null) {
        // If we previously assigned a non-function type into this node, then
        // remove it when switching to event listener mode.
        if (name in node) {
          (node as any)[name] = null;
        } else if (node.hasAttribute(name)) {
          node.removeAttribute(name);
        }
      }

      // $FlowFixMe value can't be casted to EventListener.
      node.addEventListener(eventName, value, useCapture);
      return;
    }
  }

  if (isCustomComponentTag && name in node) {
    (node as any)[name] = value;
    return;
  }

  if (shouldRemoveAttribute(name, value, propertyInfo, isCustomComponentTag)) {
    value = null;
  }
  if (isCustomComponentTag && value === true) {
    value = '';
  }

  // If the prop isn't in the special list, treat it as a simple attribute.
  if (isCustomComponentTag || propertyInfo === null) {
    if (isAttributeNameSafe(name)) {
      const attributeName = name;
      if (value === null) {
        node.removeAttribute(attributeName);
      } else {
        node.setAttribute(attributeName, '' + value);
      }
    }
    return;
  }
  const { mustUseProperty } = propertyInfo;
  if (mustUseProperty) {
    const { propertyName } = propertyInfo;
    if (value === null) {
      const { type } = propertyInfo;
      (node as any)[propertyName] = type === PropertyType.BOOLEAN ? false : '';
    } else {
      // Contrary to `setAttribute`, object properties are properly
      // `toString`ed by IE8/9.
      (node as any)[propertyName] = value;
    }
    return;
  }
  // The rest are treated as attributes with special cases.
  const { attributeName, attributeNamespace } = propertyInfo;
  if (value === null) {
    node.removeAttribute(attributeName);
  } else {
    const { type } = propertyInfo;
    let attributeValue;
    if (
      type === PropertyType.BOOLEAN ||
      (type === PropertyType.OVERLOADED_BOOLEAN && value === true)
    ) {
      // If attribute type is boolean, we know for sure it won't be an execution sink
      // and we won't require Trusted Type here.
      attributeValue = '';
    } else {
      // `setAttribute` with objects becomes only `[object]` in IE8/9,
      // ('' + value) makes it output the correct toString()-value.
      // read: 不支持 ie9
      attributeValue = '' + value;

      if (propertyInfo.sanitizeURL) {
        sanitizeURL(attributeValue.toString());
      }
    }
    if (attributeNamespace) {
      node.setAttributeNS(attributeNamespace, attributeName, attributeValue);
    } else {
      node.setAttribute(attributeName, attributeValue);
    }
  }
}
