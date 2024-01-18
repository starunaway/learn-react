import { registerTwoPhaseEvent } from '../EventRegistry';

function registerEvents() {
  registerTwoPhaseEvent('onBeforeInput', ['compositionend', 'keypress', 'textInput', 'paste']);
  registerTwoPhaseEvent('onCompositionEnd', [
    'compositionend',
    'focusout',
    'keydown',
    'keypress',
    'keyup',
    'mousedown',
  ]);
  registerTwoPhaseEvent('onCompositionStart', [
    'compositionstart',
    'focusout',
    'keydown',
    'keypress',
    'keyup',
    'mousedown',
  ]);
  registerTwoPhaseEvent('onCompositionUpdate', [
    'compositionupdate',
    'focusout',
    'keydown',
    'keypress',
    'keyup',
    'mousedown',
  ]);
}

export { registerEvents };
