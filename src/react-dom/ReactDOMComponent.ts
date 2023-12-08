import { DOCUMENT_NODE } from '@/react-dom-bindings/HTMLNodeType';
import { HTML_NAMESPACE, getIntrinsicNamespace } from '@/shared/DOMNamespaces';

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

const DANGEROUSLY_SET_INNER_HTML = 'dangerouslySetInnerHTML';
const SUPPRESS_CONTENT_EDITABLE_WARNING = 'suppressContentEditableWarning';
const SUPPRESS_HYDRATION_WARNING = 'suppressHydrationWarning';
const AUTOFOCUS = 'autoFocus';
const CHILDREN = 'children';
const STYLE = 'style';
const HTML = '__html';

export function diffHydratedText(textNode: Text, text: string, isConcurrentMode: boolean): boolean {
  const isDifferent = textNode.nodeValue !== text;
  return isDifferent;
}

export function checkForUnmatchedText(
  serverText: string,
  clientText: string | number,
  isConcurrentMode: boolean,
  shouldWarnDev: boolean
) {
  return;
  // const normalizedClientText = normalizeMarkupForTextOrAttribute(clientText);
  // const normalizedServerText = normalizeMarkupForTextOrAttribute(serverText);
  // if (normalizedServerText === normalizedClientText) {
  //   return;
  // }

  if (shouldWarnDev) {
    //   if (__DEV__) {
    //     if (!didWarnInvalidHydration) {
    //       didWarnInvalidHydration = true;
    //       console.error(
    //         'Text content did not match. Server: "%s" Client: "%s"',
    //         normalizedServerText,
    //         normalizedClientText,
    //       );
    //     }
    //   }
  }

  // if (isConcurrentMode && enableClientRenderFallbackOnTextMismatch) {
  //   // In concurrent roots, we throw when there's a text mismatch and revert to
  //   // client rendering, up to the nearest Suspense boundary.
  //   throw new Error('Text content does not match server-rendered HTML.');
  // }
}

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  return rootContainerElement.nodeType === DOCUMENT_NODE
    ? (rootContainerElement as Document)
    : rootContainerElement.ownerDocument!;
}

function noop() {}

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

export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object,
  rootContainerElement: Element | Document | DocumentFragment
): null | Array<any> {
  // if (__DEV__) {
  //   validatePropertiesInDevelopment(tag, nextRawProps);
  // }

  let updatePayload: null | Array<any> = null;

  let lastProps: Record<string, any>;
  let nextProps: Record<string, any>;
  switch (tag) {
    //   case 'input':
    //     lastProps = ReactDOMInputGetHostProps(domElement, lastRawProps);
    //     nextProps = ReactDOMInputGetHostProps(domElement, nextRawProps);
    //     updatePayload = [];
    //     break;
    //   case 'select':
    //     lastProps = ReactDOMSelectGetHostProps(domElement, lastRawProps);
    //     nextProps = ReactDOMSelectGetHostProps(domElement, nextRawProps);
    //     updatePayload = [];
    //     break;
    //   case 'textarea':
    //     lastProps = ReactDOMTextareaGetHostProps(domElement, lastRawProps);
    //     nextProps = ReactDOMTextareaGetHostProps(domElement, nextRawProps);
    //     updatePayload = [];
    //     break;
    default:
      lastProps = lastRawProps;
      nextProps = nextRawProps;
      if (typeof lastProps.onClick !== 'function' && typeof nextProps.onClick === 'function') {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        trapClickOnNonInteractiveElement(domElement as HTMLElement);
      }
      break;
  }

  // assertValidProps(tag, nextProps);

  let propKey;
  let styleName;
  let styleUpdates: Record<string, any> | null = null;
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
    }
    //  else if (registrationNameDependencies.hasOwnProperty(propKey)) {
    //   // This is a special case. If any listener updates we need to ensure
    //   // that the "current" fiber pointer gets updated so we need a commit
    //   // to update this element.
    //   if (!updatePayload) {
    //     updatePayload = [];
    //   }
    // }
    else {
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
      //   if (__DEV__) {
      //     if (nextProp) {
      //       // Freeze the next style object so that we can assume it won't be
      //       // mutated. We have already warned for this in the past.
      //       Object.freeze(nextProp);
      //     }
      //   }
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
    }
    // else if (registrationNameDependencies.hasOwnProperty(propKey)) {
    //   if (nextProp != null) {
    //     // We eagerly listen to this even though we haven't committed yet.
    //     // if (__DEV__ && typeof nextProp !== 'function') {
    //     //   warnForInvalidEventListener(propKey, nextProp);
    //     // }
    //     if (propKey === 'onScroll') {
    //       listenToNonDelegatedEvent('scroll', domElement);
    //     }
    //   }
    //   if (!updatePayload && lastProp !== nextProp) {
    //     // This is a special case. If any listener updates we need to ensure
    //     // that the "current" props pointer gets updated so we need a commit
    //     // to update this element.
    //     updatePayload = [];
    //   }
    // }
    else {
      // For any other property we always add it to the queue and then we
      // filter it out using the allowed property list during the commit.
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }
  if (styleUpdates) {
    // if (__DEV__) {
    //   validateShorthandPropertyCollisionInDev(styleUpdates, nextProps[STYLE]);
    // }
    (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
  }
  return updatePayload;
}

export function createElement(
  type: string,
  props: Record<string, any>,
  rootContainerElement: Element | Document | DocumentFragment,
  parentNamespace: string
): Element {
  let isCustomComponentTag;

  // We create tags in the namespace of their parent container, except HTML
  // tags get no namespace.
  const ownerDocument: Document = getOwnerDocumentFromRootContainer(rootContainerElement);
  let domElement: Element;
  let namespaceURI = parentNamespace;
  if (namespaceURI === HTML_NAMESPACE) {
    namespaceURI = getIntrinsicNamespace(type);
  }
  if (namespaceURI === HTML_NAMESPACE) {
    //   if (__DEV__) {
    //     isCustomComponentTag = isCustomComponent(type, props);
    //     // Should this check be gated by parent namespace? Not sure we want to
    //     // allow <SVG> or <mATH>.
    //     if (!isCustomComponentTag && type !== type.toLowerCase()) {
    //       console.error(
    //         '<%s /> is using incorrect casing. ' +
    //           'Use PascalCase for React components, ' +
    //           'or lowercase for HTML elements.',
    //         type,
    //       );
    //     }
    //   }

    if (type === 'script') {
      // Create the script via .innerHTML so its "parser-inserted" flag is
      // set to true and it does not execute
      const div = ownerDocument.createElement('div');
      // if (__DEV__) {
      //   if (enableTrustedTypesIntegration && !didWarnScriptTags) {
      //     console.error(
      //       'Encountered a script tag while rendering React component. ' +
      //         'Scripts inside React components are never executed when rendering ' +
      //         'on the client. Consider using template tag instead ' +
      //         '(https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template).',
      //     );
      //     didWarnScriptTags = true;
      //   }
      // }
      div.innerHTML = '<script><' + '/script>'; // eslint-disable-line
      // This is guaranteed to yield a script element.
      const firstChild = div.firstChild as HTMLScriptElement;
      domElement = div.removeChild(firstChild);
    } else if (typeof props.is === 'string') {
      // $FlowIssue `createElement` should be updated for Web Components
      domElement = ownerDocument.createElement(type, { is: props.is });
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

  // if (__DEV__) {
  //   if (namespaceURI === HTML_NAMESPACE) {
  //     if (
  //       !isCustomComponentTag &&
  //       Object.prototype.toString.call(domElement) ===
  //         '[object HTMLUnknownElement]' &&
  //       !hasOwnProperty.call(warnedUnknownTags, type)
  //     ) {
  //       warnedUnknownTags[type] = true;
  //       console.error(
  //         'The tag <%s> is unrecognized in this browser. ' +
  //           'If you meant to render a React component, start its name with ' +
  //           'an uppercase letter.',
  //         type,
  //       );
  //     }
  //   }
  // }

  return domElement;
}

export function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document | DocumentFragment
): void {
  //  todo 暂时不考虑特殊属性
  return;
  // const isCustomComponentTag = isCustomComponent(tag, rawProps);
  // // if (__DEV__) {
  // //   validatePropertiesInDevelopment(tag, rawProps);
  // // }

  // // TODO: Make sure that we check isMounted before firing any of these events.
  // let props: Object;
  // switch (tag) {
  //   case 'dialog':
  //     listenToNonDelegatedEvent('cancel', domElement);
  //     listenToNonDelegatedEvent('close', domElement);
  //     props = rawProps;
  //     break;
  //   case 'iframe':
  //   case 'object':
  //   case 'embed':
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the load event.
  //     listenToNonDelegatedEvent('load', domElement);
  //     props = rawProps;
  //     break;
  //   case 'video':
  //   case 'audio':
  //     // We listen to these events in case to ensure emulated bubble
  //     // listeners still fire for all the media events.
  //     for (let i = 0; i < mediaEventTypes.length; i++) {
  //       listenToNonDelegatedEvent(mediaEventTypes[i], domElement);
  //     }
  //     props = rawProps;
  //     break;
  //   case 'source':
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the error event.
  //     listenToNonDelegatedEvent('error', domElement);
  //     props = rawProps;
  //     break;
  //   case 'img':
  //   case 'image':
  //   case 'link':
  //     // We listen to these events in case to ensure emulated bubble
  //     // listeners still fire for error and load events.
  //     listenToNonDelegatedEvent('error', domElement);
  //     listenToNonDelegatedEvent('load', domElement);
  //     props = rawProps;
  //     break;
  //   case 'details':
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the toggle event.
  //     listenToNonDelegatedEvent('toggle', domElement);
  //     props = rawProps;
  //     break;
  //   case 'input':
  //     ReactDOMInputInitWrapperState(domElement, rawProps);
  //     props = ReactDOMInputGetHostProps(domElement, rawProps);
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the invalid event.
  //     listenToNonDelegatedEvent('invalid', domElement);
  //     break;
  //   case 'option':
  //     ReactDOMOptionValidateProps(domElement, rawProps);
  //     props = rawProps;
  //     break;
  //   case 'select':
  //     ReactDOMSelectInitWrapperState(domElement, rawProps);
  //     props = ReactDOMSelectGetHostProps(domElement, rawProps);
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the invalid event.
  //     listenToNonDelegatedEvent('invalid', domElement);
  //     break;
  //   case 'textarea':
  //     ReactDOMTextareaInitWrapperState(domElement, rawProps);
  //     props = ReactDOMTextareaGetHostProps(domElement, rawProps);
  //     // We listen to this event in case to ensure emulated bubble
  //     // listeners still fire for the invalid event.
  //     listenToNonDelegatedEvent('invalid', domElement);
  //     break;
  //   default:
  //     props = rawProps;
  // }

  // assertValidProps(tag, props);

  // setInitialDOMProperties(
  //   tag,
  //   domElement,
  //   rootContainerElement,
  //   props,
  //   isCustomComponentTag,
  // );

  // switch (tag) {
  //   case 'input':
  //     // TODO: Make sure we check if this is still unmounted or do any clean
  //     // up necessary since we never stop tracking anymore.
  //     track((domElement: any));
  //     ReactDOMInputPostMountWrapper(domElement, rawProps, false);
  //     break;
  //   case 'textarea':
  //     // TODO: Make sure we check if this is still unmounted or do any clean
  //     // up necessary since we never stop tracking anymore.
  //     track((domElement: any));
  //     ReactDOMTextareaPostMountWrapper(domElement, rawProps);
  //     break;
  //   case 'option':
  //     ReactDOMOptionPostMountWrapper(domElement, rawProps);
  //     break;
  //   case 'select':
  //     ReactDOMSelectPostMountWrapper(domElement, rawProps);
  //     break;
  //   default:
  //     if (typeof props.onClick === 'function') {
  //       // TODO: This cast may not be sound for SVG, MathML or custom elements.
  //       trapClickOnNonInteractiveElement(((domElement: any): HTMLElement));
  //     }
  //     break;
  // }
}

export function createTextNode(
  text: string,
  rootContainerElement: Element | Document | DocumentFragment
): Text {
  return getOwnerDocumentFromRootContainer(rootContainerElement).createTextNode(text);
}
