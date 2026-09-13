import { validateAnswer } from './validation.js';
export const currentTask = state => state.tasks[state.index];
export function createGame(level, tasks, seed, practice = false) {
  return { level, tasks, seed, practice, index:0, lives:3, phase:'answer', correct:0, mistakes:0, hints:0, history:[], revision:0 };
}
export function submitAnswer(state, fields) {
  if (state.phase !== 'answer') return { state, ignored:true };
  const validation = validateAnswer(currentTask(state), fields);
  if (!validation.valid) return { state, invalid:validation.field };
  const correct = validation.correct;
  const lives = !correct && !state.practice ? state.lives-1 : state.lives;
  return { correct, state: { ...state, lives,
    correct:state.correct + (correct ? 1 : 0), mistakes:state.mistakes + (correct ? 0 : 1),
    phase:correct ? 'correct' : lives === 0 ? 'failed' : 'wrong', revision:state.revision+1,
    history:[...state.history,{taskId:currentTask(state).id, skill:currentTask(state).skill, correct}] } };
}
export function advance(state) {
  if (state.phase === 'wrong') return { ...state, phase:'answer' };
  if (state.phase !== 'correct') return state;
  if (state.index === state.tasks.length-1) return { ...state, phase:'completed' };
  return { ...state, index:state.index+1, phase:'answer' };
}
export function useHint(state) { return state.phase === 'answer' ? { ...state, hints:state.hints+1 } : state; }
export const starsForGame = state => state.phase === 'completed' && !state.practice ? state.lives : 0;
