import {
  restoreControlledState as ReactDOMInputRestoreControlledState,
  getHostProps as ReactDOMInputGetHostProps,
  postMountWrapper as ReactDOMInputPostMountWrapper,
  initWrapperState as ReactDOMInputInitWrapperState,
} from './ReactDOMInput';
import { listenToNonDelegatedEvent } from './events/DOMPluginEventSystem';
import { registrationNameDependencies } from './events/EventRegistry';
import { track } from './inputValueTracking';
import setTextContent from './setTextContent';
import { setValueForStyles } from './CSSPropertyOperations';

import { setValueForProperty } from './DOMPropertyOperations';

import { HTML_NAMESPACE, getIntrinsicNamespace } from './shared/DOMNamespaces';
import isCustomComponent from './shared/isCustomComponent';

const DANGEROUSLY_SET_INNER_HTML = 'dangerouslySetInnerHTML';
const SUPPRESS_CONTENT_EDITABLE_WARNING = 'suppressContentEditableWarning';
const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning';
const AUTOFOCUS = 'autoFocus';
const CHILDREN = 'children';
const STYLE = 'style';
const HTML = '__html';

/**
 * 处理用户输入类型
 * @param domElement
 * @param tag
 * @param props
 * @returns
 */
export function restoreControlledState(domElement: Element, tag: string, props: Object): void {
  switch (tag) {
    case 'input':
      ReactDOMInputRestoreControlledState(domElement as HTMLInputElement, props);
      return;
    // fixme: 先看 input 就够了
    // case 'textarea':
    //   ReactDOMTextareaRestoreControlledState(domElement, props);
    //   return;
    // case 'select':
    //   ReactDOMSelectRestoreControlledState(domElement, props);
    //   return;
  }
}

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  return rootContainerElement.nodeType === Node.DOCUMENT_NODE
    ? (rootContainerElement as Document)
    : (rootContainerElement.ownerDocument! as Document);
}

function noop() {}

// 270
export function trapClickOnNonInteractiveElement(node: HTMLElement) {
  // Mobile Safari does not fire properly bubble click events on
  // non-interactive elements, which means delegated click listeners do not
  // fire. The workaround for this bug involves attaching an empty click
  // listener on the target node.
  // https://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
  // Just set it using the onclick property so that we don't have to manage any
  // bookkeeping for it. Not sure if we need to clear it when the listener is
  // removed.
  // TODO: Only do this for the relevant Safaris maybe?
  node.onclick = noop;
}

function setInitialDOMProperties(
  tag: string,
  domElement: Element,
  rootContainerElement: Element | Document | DocumentFragment,
  nextProps: any,
  isCustomComponentTag: boolean
): void {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    const nextProp = nextProps[propKey];
    if (propKey === STYLE) {
      // Relies on `updateStylesByID` not mutating `styleUpdates`.
      setValueForStyles(domElement, nextProp);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      console.error('setInitialDOMProperties：dangerous html 属性，需要实现');

      // const nextHtml = nextProp ? nextProp[HTML] : undefined;
      // if (nextHtml != null) {
      //   setInnerHTML(domElement, nextHtml);
      // }
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === 'string') {
        // Avoid setting initial textContent when the text is empty. In IE11 setting
        // textContent on a <textarea> will cause the placeholder to not
        // show within the <textarea> until it has been focused and blurred again.
        // https://github.com/facebook/react/issues/6731#issuecomment-254874553
        const canSetTextContent = tag !== 'textarea' || nextProp !== '';
        if (canSetTextContent) {
          setTextContent(domElement, nextProp);
        }
      } else if (typeof nextProp === 'number') {
        setTextContent(domElement, '' + nextProp);
      }
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (propKey === AUTOFOCUS) {
      // We polyfill it separately on the client during commit.
      // We could have excluded it in the property list instead of
      // adding a special case here, but then it wouldn't be emitted
      // on server rendering (but we *do* want to emit it in SSR).
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        if (propKey === 'onScroll') {
          listenToNonDelegatedEvent('scroll', domElement);
        }
      }
    } else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag);
    }
  }
}

function updateDOMProperties(
  domElement: Element,
  updatePayload: Array<any>,
  wasCustomComponentTag: boolean,
  isCustomComponentTag: boolean
): void {
  // TODO: Handle wasCustomComponentTag
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      console.error('updateDOMProperties：dangerous html 属性，需要实现');
      // setInnerHTML(domElement, propValue);
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue, isCustomComponentTag);
    }
  }
}

export function createElement(
  type: string,
  props: any,
  rootContainerElement: Element | Document | DocumentFragment,
  parentNamespace: string
): Element {
  // We create tags in the namespace of their parent container, except HTML
  // tags get no namespace.
  const ownerDocument: Document = getOwnerDocumentFromRootContainer(rootContainerElement);
  let domElement: Element;
  let namespaceURI = parentNamespace;
  if (namespaceURI === HTML_NAMESPACE) {
    namespaceURI = getIntrinsicNamespace(type);
  }
  if (namespaceURI === HTML_NAMESPACE) {
    if (type === 'script') {
      console.error('目前不会创建script标签，先不关注');
      // // Create the script via .innerHTML so its "parser-inserted" flag is
      // // set to true and it does not execute
      // const div = ownerDocument.createElement('div');

      // div.innerHTML = '<script><' + '/script>'; // eslint-disable-line
      // // This is guaranteed to yield a script element.
      // const firstChild = div.firstChild as HTMLScriptElement;
      // domElement = div.removeChild(firstChild);
    } else if (typeof props.is === 'string') {
      //  read: 这里是给 Web Components 用的
      // $FlowIssue `createElement` should be updated for Web Components
      // domElement = ownerDocument.createElement(type, { is: props.is });
    } else {
      // Separate else branch instead of using `props.is || undefined` above because of a Firefox bug.
      // See discussion in https://github.com/facebook/react/pull/6896
      // and discussion in https://bugzilla.mozilla.org/show_bug.cgi?id=1276240
      domElement = ownerDocument.createElement(type);
      // Normally attributes are assigned in `setInitialDOMProperties`, however the `multiple` and `size`
      // attributes on `select`s needs to be added before `option`s are inserted.
      // This prevents:
      // - a bug where the `select` does not scroll to the correct option because singular
      //  `select` elements automatically pick the first item #13222
      // - a bug where the `select` set the first item as selected despite the `size` attribute #14239
      // See https://github.com/facebook/react/issues/13222
      // and https://github.com/facebook/react/issues/14239
      if (type === 'select') {
        const node = domElement as HTMLSelectElement;
        if (props.multiple) {
          node.multiple = true;
        } else if (props.size) {
          // Setting a size greater than 1 causes a select to behave like `multiple=true`, where
          // it is possible that no option is selected.
          //
          // This is only necessary when a select in "single selection mode".
          node.size = props.size;
        }
      }
    }
  } else {
    domElement = ownerDocument.createElementNS(namespaceURI, type);
  }

  return domElement!;
}

// 477
export function createTextNode(
  text: string,
  rootContainerElement: Element | Document | DocumentFragment
): Text {
  return getOwnerDocumentFromRootContainer(rootContainerElement).createTextNode(text);
}

export function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document | DocumentFragment
): void {
  const isCustomComponentTag = isCustomComponent(tag, rawProps as any);

  // TODO: Make sure that we check isMounted before firing any of these events.
  let props: any;
  switch (tag) {
    case 'dialog':
      console.error('setInitialProperties dialog 未实现 ');
      // listenToNonDelegatedEvent('cancel', domElement);
      // listenToNonDelegatedEvent('close', domElement);
      // props = rawProps;
      break;
    case 'iframe':
    case 'object':
    case 'embed':
      // We listen to this event in case to ensure emulated bubble
      // listeners still fire for the load event.
      // listenToNonDelegatedEvent('load', domElement);
      // props = rawProps;
      console.error('setInitialProperties iframe 、object、embed 未实现 ');

      break;
    case 'video':
    case 'audio':
      // We listen to these events in case to ensure emulated bubble
      // listeners still fire for all the media events.
      // for (let i = 0; i < mediaEventTypes.length; i++) {
      //   listenToNonDelegatedEvent(mediaEventTypes[i], domElement);
      // }
      // props = rawProps;
      console.error('setInitialProperties video、audio 未实现 ');

      break;
    case 'source':
      // We listen to this event in case to ensure emulated bubble
      // listeners still fire for the error event.
      // listenToNonDelegatedEvent('error', domElement);
      // props = rawProps;
      console.error('setInitialProperties source 未实现 ');

      break;
    case 'img':
    case 'image':
    case 'link':
      // We listen to these events in case to ensure emulated bubble
      // listeners still fire for error and load events.
      // listenToNonDelegatedEvent('error', domElement);
      // listenToNonDelegatedEvent('load', domElement);
      // props = rawProps;
      console.error('setInitialProperties img、image、link、 未实现 ');

      break;
    case 'details':
      // We listen to this event in case to ensure emulated bubble
      // listeners still fire for the toggle event.
      // listenToNonDelegatedEvent('toggle', domElement);
      // props = rawProps;
      console.error('setInitialProperties details 未实现 ');

      break;
    case 'input':
      ReactDOMInputInitWrapperState(domElement, rawProps);
      props = ReactDOMInputGetHostProps(domElement, rawProps);
      // We listen to this event in case to ensure emulated bubble
      // listeners still fire for the invalid event.
      listenToNonDelegatedEvent('invalid', domElement);
      break;
    case 'option':
      // ReactDOMOptionValidateProps(domElement, rawProps);
      // props = rawProps;
      console.error('setInitialProperties option 未实现 ');
      break;
    case 'select':
      console.error('setInitialProperties select 未实现 ');
      // ReactDOMSelectInitWrapperState(domElement, rawProps);
      // props = ReactDOMSelectGetHostProps(domElement, rawProps);
      // // We listen to this event in case to ensure emulated bubble
      // // listeners still fire for the invalid event.
      // listenToNonDelegatedEvent('invalid', domElement);
      break;
    case 'textarea':
      console.error('setInitialProperties textarea 未实现 ');
      // ReactDOMTextareaInitWrapperState(domElement, rawProps);
      // props = ReactDOMTextareaGetHostProps(domElement, rawProps);
      // // We listen to this event in case to ensure emulated bubble
      // // listeners still fire for the invalid event.
      // listenToNonDelegatedEvent('invalid', domElement);
      break;
    default:
      props = rawProps;
  }

  // assertValidProps(tag, props);

  setInitialDOMProperties(tag, domElement, rootContainerElement, props!, isCustomComponentTag);

  switch (tag) {
    case 'input':
      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      track(domElement as any);
      ReactDOMInputPostMountWrapper(domElement, rawProps, false);
      break;
    case 'textarea':
      console.error('setInitialProperties textarea 未实现 ');

      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      // track((domElement));
      // ReactDOMTextareaPostMountWrapper(domElement, rawProps);
      break;
    case 'option':
      console.error('setInitialProperties option 未实现 ');
      // ReactDOMOptionPostMountWrapper(domElement, rawProps);
      break;
    case 'select':
      console.error('setInitialProperties select 未实现 ');
      // ReactDOMSelectPostMountWrapper(domElement, rawProps);
      break;
    default:
      if (typeof (props! as any).onClick === 'function') {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        trapClickOnNonInteractiveElement(domElement as HTMLElement);
      }
      break;
  }
}

// 661
// Calculate the diff between the two objects.
export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: any,
  nextRawProps: any,
  rootContainerElement: Element | Document | DocumentFragment
): null | Array<any> {
  let updatePayload: null | Array<any> = null;

  let lastProps: any;
  let nextProps: any;
  switch (tag) {
    case 'input':
      lastProps = ReactDOMInputGetHostProps(domElement, lastRawProps);
      nextProps = ReactDOMInputGetHostProps(domElement, nextRawProps);
      updatePayload = [];
      break;
    case 'select':
      console.error('select 的 dom 属性处理逻辑需要实现');
      // lastProps = ReactDOMSelectGetHostProps(domElement, lastRawProps);
      // nextProps = ReactDOMSelectGetHostProps(domElement, nextRawProps);
      // updatePayload = [];
      break;
    case 'textarea':
      console.error('textarea 的 dom 属性处理逻辑需要实现');
      // lastProps = ReactDOMTextareaGetHostProps(domElement, lastRawProps);
      // nextProps = ReactDOMTextareaGetHostProps(domElement, nextRawProps);
      // updatePayload = [];
      break;
    default:
      lastProps = lastRawProps;
      nextProps = nextRawProps;
      if (typeof lastProps.onClick !== 'function' && typeof nextProps.onClick === 'function') {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        trapClickOnNonInteractiveElement(domElement as HTMLElement);
      }
      break;
  }

  // read: 判断 dom 的属性是否合法，先不关注
  // assertValidProps(tag, nextProps);

  let propKey;
  let styleName;
  let styleUpdates: any = null;
  for (propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] == null
    ) {
      continue;
    }
    if (propKey === STYLE) {
      const lastStyle = lastProps[propKey];
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = '';
        }
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN) {
      // Noop. This is handled by the clear text mechanism.
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (propKey === AUTOFOCUS) {
      // Noop. It doesn't work on updates anyway.
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      // This is a special case. If any listener updates we need to ensure
      // that the "current" fiber pointer gets updated so we need a commit
      // to update this element.
      if (!updatePayload) {
        updatePayload = [];
      }
    } else {
      // For all other deleted properties we add it to the queue. We use
      // the allowed property list in the commit phase instead.
      (updatePayload = updatePayload || []).push(propKey, null);
    }
  }
  for (propKey in nextProps) {
    const nextProp = nextProps[propKey];
    const lastProp = lastProps != null ? lastProps[propKey] : undefined;
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue;
    }
    if (propKey === STYLE) {
      if (lastProp) {
        // Unset styles on `lastProp` but not on `nextProp`.
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = '';
          }
        }
        // Update styles that changed since `lastProp`.
        for (styleName in nextProp) {
          if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
            if (!styleUpdates) {
              styleUpdates = {};
            }
            styleUpdates[styleName] = nextProp[styleName];
          }
        }
      } else {
        // Relies on `updateStylesByID` not mutating `styleUpdates`.
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = [];
          }
          updatePayload.push(propKey, styleUpdates);
        }
        styleUpdates = nextProp;
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined;
      const lastHtml = lastProp ? lastProp[HTML] : undefined;
      if (nextHtml != null) {
        if (lastHtml !== nextHtml) {
          (updatePayload = updatePayload || []).push(propKey, nextHtml);
        }
      } else {
        // TODO: It might be too late to clear this if we have children
        // inserted already.
      }
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === 'string' || typeof nextProp === 'number') {
        (updatePayload = updatePayload || []).push(propKey, '' + nextProp);
      }
    } else if (
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (registrationNameDependencies.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        // read: 先不关注滚动事件
        // if (propKey === 'onScroll') {
        //   listenToNonDelegatedEvent('scroll', domElement);
        // }
      }
      if (!updatePayload && lastProp !== nextProp) {
        // This is a special case. If any listener updates we need to ensure
        // that the "current" props pointer gets updated so we need a commit
        // to update this element.
        updatePayload = [];
      }
    } else {
      // For any other property we always add it to the queue and then we
      // filter it out using the allowed property list during the commit.
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }
  if (styleUpdates) {
    (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
  }
  return updatePayload;
}
