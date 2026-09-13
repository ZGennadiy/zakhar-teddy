import { MAX_ANSWER_LENGTH } from './config.js';
export function normalizeAnswer(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok:false, error:'empty' };
  if (!/^[0-9]+$/.test(s) || s.length > MAX_ANSWER_LENGTH) return { ok:false, error:'integer' };
  return { ok:true, value:Number(s) };
}
export function validateAnswer(task, fields) {
  if (task.choices) return fields.choice ? { valid:true, correct:fields.choice === task.answer } : { valid:false, field:'choice' };
  const n = normalizeAnswer(fields.answer);
  if (!n.ok) return { valid:false, field:'answer' };
  if (task.kind === 'remainder') {
    const r = normalizeAnswer(fields.remainder);
    if (!r.ok) return { valid:false, field:'remainder' };
    return { valid:true, correct:n.value === task.answer.quotient && r.value === task.answer.remainder };
  }
  return { valid:true, correct:n.value === task.answer };
}
// Physical input and touch buttons update the same string state. No caret offset is
// carried from a blurred input: keypad digits always append to the current value.
export function editAnswer(previous, action) {
  if (action.type === 'clear') return '';
  if (action.type === 'backspace') return previous.slice(0,-1);
  if (action.type === 'append') return /^[0-9]$/.test(action.digit) ? (previous + action.digit).slice(0,MAX_ANSWER_LENGTH) : previous;
  if (action.type === 'native') return /^[0-9]*$/.test(action.value) && action.value.length <= MAX_ANSWER_LENGTH ? action.value : previous;
  return previous;
}
