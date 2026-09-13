import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { STORAGE_KEY } from '../public/js/config.js';
import { createAttempt } from '../public/js/generators.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
let dom, document, serial=0, registered=[];
async function boot(t,saved){
  dom=new JSDOM(html,{url:'https://example.test/zakhar-teddy/',pretendToBeVisual:true});document=dom.window.document;dom.window.scrollTo=()=>{};
  registered=[];document.modelContext={registerTool:tool=>registered.push(tool)};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('[autofocus]')?.focus();};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  for(const [key,value] of Object.entries({window:dom.window,document,localStorage:dom.window.localStorage}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  if(saved!==undefined)localStorage.setItem(STORAGE_KEY,typeof saved==='string'?saved:JSON.stringify(saved));
  t.mock.timers.enable({apis:['setTimeout']});
  await import(`../public/js/app.js?case=${serial++}`);
  t.after(()=>{t.mock.timers.reset();dom.window.close();});
}
const $=id=>document.getElementById(id);
function key(id,key){const el=$(id);el.focus();el.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));}
function type(id,text){const el=$(id);el.focus();for(const data of text){const ev=new dom.window.InputEvent('beforeinput',{inputType:'insertText',data,bubbles:true,cancelable:true});if(el.dispatchEvent(ev)){el.setRangeText(data,el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new dom.window.InputEvent('input',{inputType:'insertText',data,bubbles:true}));}}}
function value(id,text){const el=$(id);el.value=text;el.dispatchEvent(new dom.window.InputEvent('input',{bubbles:true}));}
function clickKey(key){document.querySelector(`[data-key="${key}"]`).click();}
const saved=()=>JSON.parse(localStorage.getItem(STORAGE_KEY));
const tasks=id=>createAttempt(id,saved().lastAttemptSeedByLevel[id]);

test('DOM: app opens without auth, keyboard digits and keypad use one state',async t=>{
  await boot(t);$('continue-game').click();assert.equal(document.activeElement.id,'answer-input');
  type('answer-input','1');type('answer-input','5');assert.equal($('answer-input').value,'15');
  type('answer-input','3');assert.equal($('answer-input').value,'153');key('answer-input','Delete');assert.equal($('answer-input').value,'');
  clickKey('1');clickKey('5');assert.equal($('answer-input').value,'15');
  $('answer-input').setSelectionRange(0,0);clickKey('3');assert.equal($('answer-input').value,'153');clickKey('backspace');assert.equal($('answer-input').value,'15');clickKey('clear');assert.equal($('answer-input').value,'');
  type('answer-input','1');clickKey('5');assert.equal($('answer-input').value,'15');key('answer-input','Escape');assert.equal($('answer-input').value,'');
  type('answer-input','e+-,.abc');assert.equal($('answer-input').value,'');
  assert.equal(document.querySelector('.author-mark a').href,'https://t.me/ZGennadiy');
});
test('DOM: Enter submits once and restores focus on the next empty question',async t=>{
  await boot(t);$('continue-game').click();const p=tasks(1)[0];type('answer-input',String(p.answer));key('answer-input','Enter');key('answer-input','Enter');
  assert.equal(saved().skillStats.multiply.correct,1);t.mock.timers.tick(900);assert.equal($('task-counter').textContent,'Задача 2 из 8');assert.equal($('answer-input').value,'');assert.equal(document.activeElement.id,'answer-input');
});
test('DOM: incomplete remainder Enter focuses remainder; keypad follows focus',async t=>{
  await boot(t,{schemaVersion:2,bestStarsByLevel:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,3]))});document.querySelector('[data-level="21"]').click();
  const p=tasks(21)[0];type('answer-input',String(p.answer.quotient));key('answer-input','Enter');assert.equal(document.activeElement.id,'remainder-input');
  assert.equal($('hearts').getAttribute('aria-label'),'Осталось сердец: 3 из 3');clickKey(String(p.answer.remainder));assert.equal($('remainder-input').value,String(p.answer.remainder));
  key('remainder-input','Enter');t.mock.timers.tick(900);assert.equal($('task-counter').textContent,'Задача 2 из 8');assert.equal(document.activeElement.id,'answer-input');
});
test('DOM: wrong answer, three hearts, retry and failure are connected',async t=>{
  await boot(t);$('continue-game').click();const prompt=$('expression').textContent;
  for(let i=0;i<3;i++){type('answer-input','999');key('answer-input','Enter');if(i<2){assert.equal($('expression').textContent,prompt);assert.equal($('hearts').getAttribute('aria-label'),`Осталось сердец: ${2-i} из 3`);$('retry-answer').click();}}
  assert.equal($('results-title').textContent,'Попробуем ещё раз?');assert.deepEqual(saved().bestStarsByLevel,{});$('replay-level').click();assert.equal($('hearts').getAttribute('aria-label'),'Осталось сердец: 3 из 3');
});
test('DOM: full level opens next, reference preserves answer, reset clears saved state',async t=>{
  await boot(t);$('continue-game').click();const list=tasks(1);type('answer-input','15');$('table-button').click();$('table-back').click();assert.equal($('answer-input').value,'15');
  for(const p of list){value('answer-input',String(p.answer));key('answer-input','Enter');t.mock.timers.tick(900);}
  assert.equal($('results-title').textContent,'Звёзды — твои!');assert.equal(saved().bestStarsByLevel[1],3);assert.equal(saved().unlockedLevel,2);
  $('settings-button').click();$('reset-game').click();assert.equal($('reset-dialog').open,true);document.querySelector('[data-close="reset-dialog"]').click();assert.equal(saved().bestStarsByLevel[1],3);
  $('settings-button').click();$('reset-game').click();$('confirm-reset').click();assert.equal($('star-total').textContent,'0');assert.equal(saved().unlockedLevel,1);assert.deepEqual(saved().lastAttemptSeedByLevel,{});assert.deepEqual(saved().skillStats,{});assert.equal(document.querySelector('[data-level="2"]').disabled,true);
});
test('DOM: practice selected factor and division do not change story statistics',async t=>{
  await boot(t);$('table-button').click();document.querySelector('[data-factor="7"]').click();document.querySelector('[data-mode="divide"]').click();
  assert.ok($('fact-list').textContent.includes('56 : 7'));$('start-practice').click();assert.equal($('game-title').textContent,'Тренировка :7');
  type('answer-input','999');key('answer-input','Enter');assert.equal($('hearts').getAttribute('aria-label'),'Тренировка без потери жизней');assert.equal(localStorage.getItem(STORAGE_KEY),null);
});
test('DOM: native table and settings dialogs pause pending advance',async t=>{
  await boot(t);$('continue-game').click();type('answer-input',String(tasks(1)[0].answer));key('answer-input','Enter');$('settings-button').click();t.mock.timers.tick(5000);assert.equal($('task-counter').textContent,'Задача 1 из 8');
  document.querySelector('[data-close="settings-dialog"]').click();t.mock.timers.tick(900);assert.equal($('task-counter').textContent,'Задача 2 из 8');
});
test('DOM: WebMCP registers, valid actions share UI state and invalid actions fail',async t=>{
  await boot(t);assert.deepEqual(registered.map(t=>t.name),['read_math_expedition','start_math_level']);const [read,start]=registered;
  assert.equal(read.annotations.readOnlyHint,true);assert.equal(read.execute().screen,'home');assert.throws(()=>start.execute({levelId:31}));assert.throws(()=>start.execute({levelId:2}));
  assert.deepEqual(start.execute({levelId:1}),{levelId:1,screen:'game'});assert.equal(read.execute().task.number,1);assert.equal($('screen-game').hidden,false);assert.throws(()=>start.execute({levelId:1}));
});
