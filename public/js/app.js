import { getLevel } from './config.js';
import { createFreshAttempt, practiceConfig } from './generators.js';
import { createGame, currentTask, submitAnswer, advance, useHint, starsForGame } from './game-state.js';
import { loadProgress, saveProgress, recordAttempt, recordAnswer, completeLevel, resetProgress } from './storage.js';
import { editAnswer } from './validation.js';
import { $, show, icon, initIcons, setScreen, renderHome, renderGame, renderReference, renderResults, wallet, toast } from './ui.js';
import { playTone } from './audio.js';
import { registerGameTools } from './webmcp.js';

let progress=loadProgress(), game=null, screen='home', fields={answer:'',remainder:'',choice:''}, focusedField='answer';
let tableMode='multiply', tableFactor=2, tableReturn='home', transitionTimer=null, warnedStorage=false, practicePrevious=null;
const openDialog=()=>[...document.querySelectorAll('dialog')].some(d=>d.open);
function persist() { if(!saveProgress(progress)&&!warnedStorage) {warnedStorage=true;toast('Браузер не даёт сохранить прогресс. Сейчас можно играть, но после закрытия страницы он может потеряться.');} }
function cancelTransition(){clearTimeout(transitionTimer);transitionTimer=null;}
function applySettings(){document.body.classList.toggle('reduce-motion',!progress.settings.animations);$('setting-animations').checked=progress.settings.animations;$('setting-sound').checked=progress.settings.sound;}
function changeScreen(next){screen=next;setScreen(next);window.scrollTo({top:0,behavior:'instant'});}
function focusAnswer(field='answer') {
  if(screen!=='game'||!game||game.phase!=='answer'||openDialog()) return;
  const target=currentTask(game).choices?$('choice-fields').querySelector('button'):$(field==='remainder'?'remainder-input':'answer-input');
  target?.focus({preventScroll:true});
}
function clearFields(){fields={answer:'',remainder:'',choice:''};focusedField='answer';$('answer-input').value='';$('remainder-input').value='';show('hint-text',false);}
function drawGame(newQuestion=false){if(newQuestion) clearFields();renderGame(game);if(game.phase==='answer'&&fields.choice){document.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===fields.choice)));}}
function home(){cancelTransition();game=null;changeScreen('home');renderHome(progress);$('continue-game').focus({preventScroll:true});}
function startLevel(id) {
  const level=getLevel(id);if(!level||id>progress.unlockedLevel)return;
  const attempt=createFreshAttempt(level,progress.lastAttemptSeedByLevel[id],progress.lastAttemptSignatureByLevel[id]);
  cancelTransition();progress=recordAttempt(progress,id,attempt.seed,attempt.signature);persist();
  game=createGame(level,attempt.tasks,attempt.seed);changeScreen('game');drawGame(true);focusAnswer();
}
function startPractice() {
  const level=practiceConfig(tableMode,tableFactor), attempt=createFreshAttempt(level,practicePrevious?.seed,practicePrevious?.signature);
  practicePrevious=attempt;cancelTransition();game=createGame(level,attempt.tasks,attempt.seed,true);changeScreen('game');drawGame(true);focusAnswer();
}
function finish() {
  cancelTransition();
  if(game.phase==='completed'&&!game.practice){progress=completeLevel(progress,game.level.id,starsForGame(game));persist();}
  wallet(progress);changeScreen('results');renderResults(game);playTone(game.phase==='completed'?'complete':'wrong',progress.settings.sound);
  $('results-title').tabIndex=-1;$('results-title').focus({preventScroll:true});
}
function nextQuestion() {
  transitionTimer=null;
  if(screen!=='game'||openDialog())return;
  game=advance(game);
  if(game.phase==='completed')finish();else {drawGame(true);focusAnswer();}
}
function scheduleNext() {cancelTransition();if(game?.phase==='correct'&&screen==='game'&&!openDialog()) transitionTimer=setTimeout(nextQuestion,850);}
function submit() {
  if(screen!=='game'||!game||openDialog())return;
  const task=currentTask(game), transition=submitAnswer(game,fields);
  if(transition.ignored)return;
  if(transition.invalid){$('feedback').dataset.type='invalid';$('feedback').textContent=transition.invalid==='remainder'?'Осталось ввести остаток.':transition.invalid==='choice'?'Выбери один из ответов.':'Сначала введи число.';focusAnswer(transition.invalid);return;}
  game=transition.state;
  if(!game.practice){progress=recordAnswer(progress,task.skill,transition.correct);persist();}
  playTone(transition.correct?'correct':'wrong',progress.settings.sound);
  if(game.phase==='failed'){finish();return;}
  drawGame();
  if(transition.correct)scheduleNext();else $('retry-answer').focus({preventScroll:true});
}
function changeField(field, action) {
  if(game?.phase!=='answer'||screen!=='game'||openDialog())return;
  fields={...fields,[field]:editAnswer(fields[field],action)};
  const input=$(field==='remainder'?'remainder-input':'answer-input');input.value=fields[field];input.removeAttribute('aria-invalid');
  if($('feedback').dataset.type==='invalid')$('feedback').textContent='';
}
function openTable(){if(screen==='table')return;tableReturn=screen;cancelTransition();changeScreen('table');renderReference(tableMode,tableFactor);$('table-back-label').textContent=tableReturn==='game'?'К задаче':tableReturn==='results'?'К результату':'К карте';$('table-back').focus({preventScroll:true});}
function closeTable(){changeScreen(tableReturn);if(tableReturn==='game'&&game){drawGame();focusAnswer(focusedField);scheduleNext();}else if(tableReturn==='results'&&game){renderResults(game);}else renderHome(progress);}
function askLeave(){if(game&&['game','table'].includes(screen)&&game.phase!=='completed'&&game.phase!=='failed'){$('leave-dialog').showModal();cancelTransition();}else home();}

initIcons();
$('keypad').innerHTML=['1','2','3','4','5','6','7','8','9','clear','0','backspace'].map(key=>`<button type="button" data-key="${key}" ${key==='clear'?'aria-label="Очистить ответ"':key==='backspace'?'aria-label="Удалить последнюю цифру"':`aria-label="Цифра ${key}"`} class="${/^[0-9]$/.test(key)?'digit':'utility-key'}">${key==='clear'?'C':key==='backspace'?icon('backspace'):key}</button>`).join('');
for(const field of ['answer','remainder']){
  const input=$(field==='answer'?'answer-input':'remainder-input');
  input.addEventListener('focus',()=>{focusedField=field;});
  input.addEventListener('beforeinput',event=>{if(event.data!==null&&!/^[0-9]*$/.test(event.data))event.preventDefault();});
  input.addEventListener('input',()=>changeField(field,{type:'native',value:input.value}));
  input.addEventListener('paste',event=>{const text=event.clipboardData?.getData('text')??'';if(!/^[0-9]+$/.test(text))event.preventDefault();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();if(event.repeat)return;if(currentTask(game).kind==='remainder'&&fields.answer&&!fields.remainder){focusAnswer('remainder');return;}submit();}
    else if(event.key==='Escape'||event.key==='Delete'){event.preventDefault();changeField(field,{type:'clear'});}
    // Digits, NumPad, Backspace, caret editing, and Tab remain entirely native.
  });
}
$('keypad').addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.preventDefault();});
$('keypad').addEventListener('click',event=>{const key=event.target.closest('[data-key]')?.dataset.key;if(!key)return;
  changeField(focusedField,/^[0-9]$/.test(key)?{type:'append',digit:key}:{type:key});
  // Focus without relying on selectionStart from before the button click.
  focusAnswer(focusedField);const input=$(focusedField==='remainder'?'remainder-input':'answer-input');input.setSelectionRange(input.value.length,input.value.length);
});
$('choice-fields').addEventListener('click',event=>{const button=event.target.closest('[data-choice]');if(!button||game.phase!=='answer')return;fields={...fields,choice:button.dataset.choice};document.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
$('answer-form').addEventListener('submit',event=>{event.preventDefault();submit();});
$('retry-answer').addEventListener('click',()=>{game=advance(game);drawGame(true);focusAnswer();});
$('hint-button').addEventListener('click',()=>{if(game.phase!=='answer')return;if($('hint-text').hidden){game=useHint(game);$('hint-text').textContent=currentTask(game).hint;show('hint-text',true);}else show('hint-text',false);});
$('continue-game').addEventListener('click',()=>startLevel(progress.currentLevel));
$('world-map').addEventListener('click',event=>{const button=event.target.closest('[data-level]');if(button&&!button.disabled)startLevel(Number(button.dataset.level));});
$('game-back').addEventListener('click',askLeave);
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();askLeave();});
$('confirm-leave').addEventListener('click',()=>{$('leave-dialog').close();home();});
$('table-button').addEventListener('click',openTable);$('table-back').addEventListener('click',closeTable);
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{tableMode=button.dataset.mode;renderReference(tableMode,tableFactor);}));
$('factor-buttons').addEventListener('click',event=>{const button=event.target.closest('[data-factor]');if(button){tableFactor=Number(button.dataset.factor);renderReference(tableMode,tableFactor);$('factor-buttons').querySelector(`[data-factor="${tableFactor}"]`).focus({preventScroll:true});}});
$('start-practice').addEventListener('click',()=>{if(game&&tableReturn==='game'){$('practice-dialog').showModal();}else startPractice();});
$('confirm-practice').addEventListener('click',()=>{$('practice-dialog').close();startPractice();});
$('next-level').addEventListener('click',()=>startLevel(game.level.id+1));
$('replay-level').addEventListener('click',()=>{if(game.practice)startPractice();else startLevel(game.level.id);});
$('results-map').addEventListener('click',home);
$('settings-button').addEventListener('click',()=>{applySettings();cancelTransition();$('settings-dialog').showModal();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{scheduleNext();}));
for(const key of ['animations','sound'])$(`setting-${key}`).addEventListener('change',event=>{progress={...progress,settings:{...progress.settings,[key]:event.target.checked}};applySettings();persist();if(key==='sound')playTone('correct',progress.settings.sound);});
$('reset-game').addEventListener('click',()=>{$('settings-dialog').close();cancelTransition();$('reset-dialog').showModal();});
$('confirm-reset').addEventListener('click',()=>{cancelTransition();const result=resetProgress();progress=result.progress;practicePrevious=null;warnedStorage=false;$('reset-dialog').close();applySettings();home();toast(result.saved?'Новая экспедиция начинается!':'Игра сброшена. Браузер не разрешил сохранить сброс — старый прогресс может вернуться после обновления.');});
// No document-level digit handler: native input can never receive a digit twice.
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.repeat)event.preventDefault();});
window.addEventListener('pageshow',()=>{if(screen==='home'){progress=loadProgress();applySettings();renderHome(progress);}});
applySettings();setScreen('home');renderHome(progress);
registerGameTools({
  read:()=>({screen,unlockedLevel:progress.unlockedLevel,stars:progress.bestStarsByLevel,
    task:screen==='game'&&game?{prompt:currentTask(game).prompt,number:game.index+1,total:game.tasks.length,lives:game.practice?null:game.lives,phase:game.phase}:null}),
  start:id=>{if(openDialog()||!['home','results'].includes(screen))throw new Error('Return to the map first');if(id>progress.unlockedLevel)throw new Error('Level is locked');startLevel(id);return {levelId:id,screen};}
});
