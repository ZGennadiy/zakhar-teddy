import { WORLDS, LEVELS, getLevel } from './config.js';
import { currentTask } from './game-state.js';
import { totalStars } from './storage.js';
import { renderMascot } from './mascots.js';
export const $ = id => document.getElementById(id);
export const show = (id, visible) => { $(id).hidden = !visible; };
const paths = {
  arrow:'M5 12h14m-6-6 6 6-6 6',back:'M19 12H5m6-6-6 6 6 6',check:'m5 12 4 4L19 6',close:'m6 6 12 12M18 6 6 18',
  book:'M12 6v15M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  bulb:'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2',
  keyboard:'M3 5h18v14H3zM6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 13h.1M10 13h.1M14 13h.1M18 13h.1M8 16h8',
  lock:'M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3',backspace:'m9 5-7 7 7 7h12V5z m4 4 5 6m0-6-5 6'
};
export const icon = (name, extra='') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.star}"/></svg>`;
export function initIcons() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML=icon(el.dataset.icon); }); }
const stars = (n) => Array.from({length:3},(_,i)=>`<span class="${i<n?'earned':'unearned'}" aria-hidden="true">★</span>`).join('');
export function setScreen(screen) {
  for(const name of ['home','game','table','results']) show(`screen-${name}`,name===screen);
  document.body.dataset.screen=screen;
}
export function wallet(progress) { $('star-total').textContent=totalStars(progress); $('wallet').setAttribute('aria-label',`Собрано ${totalStars(progress)} звёзд из 90`); }
export function renderHome(progress) {
  wallet(progress);
  const next=getLevel(progress.currentLevel), world=WORLDS[next.chapter-1], first=progress.completedLevels.length===0;
  $('mission-label').textContent=`МИР ${world.id} · ${world.title.toLocaleUpperCase('ru-RU')}`;
  $('launch-title').innerHTML=first?'Всё начинается<br>с маленькой звезды.':progress.completedLevels.length===30?'Все миры открыты.<br>Продолжим открытия?':`Следующая остановка:<br>${next.title}`;
  $('launch-description').textContent=first?'Тедди уже готов! Решай примеры, открывай новые миры и собирай звёзды.':'Новые примеры уже ждут. Пройди уровень или вернись за недостающими звёздами.';
  $('continue-game').innerHTML=`${first?'Начать экспедицию':'Продолжить экспедицию'} ${icon('arrow')}`;
  $('mission-meta').textContent=`Уровень ${next.id} · ${next.problemCount} задач · 3 сердца`;
  $('map-progress').textContent=`Пройдено ${progress.completedLevels.length} из 30 уровней`;
  $('world-map').innerHTML=WORLDS.map(w=>{
    const levels=LEVELS.filter(l=>l.chapter===w.id), unlocked=levels.some(l=>l.id<=progress.unlockedLevel), active=next.chapter===w.id;
    const collected=levels.reduce((sum,l)=>sum+(progress.bestStarsByLevel[l.id]??0),0);
    return `<article class="world-card ${w.color} ${active?'active-world':''} ${!unlocked?'locked-world':''}"><div class="world-top"><span class="world-symbol" aria-hidden="true">${w.symbol}</span><span class="world-index">МИР ${w.id.toString().padStart(2,'0')}</span><span class="world-status">${collected?`${collected} / 15 ★`:active?'ТЫ ЗДЕСЬ':unlocked?'ОТКРЫТ':icon('lock')}</span></div><h3>${w.title}</h3><p>${w.subtitle}</p><div class="level-path">${levels.map(l=>{
      const locked=l.id>progress.unlockedLevel, n=progress.bestStarsByLevel[l.id]??0;
      return `<div class="level-stop"><button type="button" class="level-button ${n?'completed':''} ${l.id===progress.currentLevel?'current':''} ${l.isBoss?'boss':''}" data-level="${l.id}" ${locked?'disabled':''} aria-label="Уровень ${l.id}: ${l.title}. ${locked?'Закрыт. Пройди предыдущий уровень.':n?`Лучший результат: ${n} из 3 звёзд.`:'Начать.'}" ${l.id===progress.currentLevel?'aria-current="step"':''}>${locked?icon('lock'):`<span>${l.id}</span>`}</button><span class="level-stars" aria-hidden="true">${n?stars(n):l.isBoss?'✦':'·'}</span></div>`;
    }).join('')}</div></article>`;
  }).join('');
}
export function renderGame(state) {
  const task=currentTask(state), active=state.phase==='answer', remainder=task.kind==='remainder', choice=!!task.choices;
  $('game-title').textContent=state.level.title;
  $('game-eyebrow').textContent=state.practice?'СВОБОДНАЯ ТРЕНИРОВКА':`МИР ${state.level.chapter} · УРОВЕНЬ ${state.level.id}`;
  $('task-counter').textContent=`Задача ${state.index+1} из ${state.tasks.length}`;
  $('task-progress').max=state.tasks.length;$('task-progress').value=state.index+(state.phase==='correct'?1:0);
  $('game-badge').textContent=state.practice?'БЕЗ СЕРДЕЦ':state.level.isSiriusPlus?'СИРИУС+':state.level.isBoss?'ИСПЫТАНИЕ':'ЭКСПЕДИЦИЯ';
  $('hearts').innerHTML=state.practice?'<span class="practice-heart">∞ <small>пробуй смело</small></span>':Array.from({length:3},(_,i)=>icon('heart',i<state.lives?'filled':'spent')).join('');
  $('hearts').setAttribute('aria-label',state.practice?'Тренировка без потери жизней':`Осталось сердец: ${state.lives} из 3`);
  const labels={numericAnswer:'РЕШИ ЗАДАЧУ',expression:'ПО ПОРЯДКУ',missingNumber:'НАЙДИ НЕИЗВЕСТНОЕ',remainder:'ЧАСТНОЕ И ОСТАТОК',trueFalse:'КТО ПРАВ?',chooseCorrect:'ВЫБЕРИ ОТВЕТ'};
  $('task-kind').textContent=task.skill==='findError'?'НАЙДИ ОШИБКУ ТЕДДИ':labels[task.kind];
  $('task-number').textContent=String(state.index+1).padStart(2,'0');
  $('expression').textContent=task.prompt;
  $('expression').classList.toggle('word-problem',task.prompt.length>38);
  $('expression').classList.toggle('long-expression',task.prompt.length>19&&task.prompt.length<=38);
  show('number-fields',!choice);show('remainder-wrap',remainder);show('choice-fields',choice);show('input-help',!choice);
  $('answer-label').textContent=remainder?'Частное':task.kind==='missingNumber'?'Пропущенное число':'Твой ответ';
  $('input-help').textContent=remainder?'Введи частное и остаток. Tab — следующее поле.':'Введи число. Enter — проверить.';
  for(const id of ['answer-input','remainder-input']) {$(id).disabled=!active;$(id).removeAttribute('aria-invalid');}
  if(choice) $('choice-fields').innerHTML=task.choices.map(c=>`<button class="choice-button" type="button" data-choice="${c.value}" aria-pressed="false" ${!active?'disabled':''}>${c.label}</button>`).join('');
  $('keypad').closest('aside').hidden=choice;
  document.querySelectorAll('#keypad button').forEach(button=>button.disabled=!active);
  show('submit-answer',active);$('submit-answer').disabled=!active;
  show('retry-answer',state.phase==='wrong');
  $('hint-button').disabled=!active;
  const feedback=$('feedback');feedback.dataset.type=state.phase;
  feedback.textContent=state.phase==='correct'?'✓ Точно! Отличная работа.':state.phase==='wrong'?`Попробуем ещё раз. ${task.hint}`:'';
  const reaction=state.phase==='correct'?'correct':state.phase==='wrong'?'wrong':'neutral';
  renderMascot(document.querySelector('.mascot-game'),reaction);
  $('companion-title').textContent=reaction==='correct'?'Ещё одна маленькая победа!':reaction==='wrong'?'Давай разберёмся вместе.':'Мы с тобой!';
  $('companion-message').textContent=reaction==='correct'?'Тедди рад твоему открытию.':reaction==='wrong'?'Ошибки помогают понять, что потренировать.':'Не спеши. У тебя всё получится.';
}
export function renderReference(mode, factor) {
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode)));
  const numbers=Array.from({length:8},(_,i)=>i+2), sym=mode==='multiply'?'×':':';
  $('factor-buttons').innerHTML=numbers.map(n=>`<button type="button" data-factor="${n}" aria-pressed="${n===factor}" aria-label="Тренировать ${sym}${n}">${n}</button>`).join('');
  $('times-grid').innerHTML=`<caption>${mode==='multiply'?'Таблица умножения: строка × столбец':'Таблица деления: в ячейке делимое : столбец = строка'}</caption><thead><tr><th scope="col">${sym}</th>${numbers.map(n=>`<th scope="col" class="${n===factor?'highlight':''}">${n}</th>`).join('')}</tr></thead><tbody>${numbers.map(row=>`<tr><th scope="row">${row}</th>${numbers.map(col=>`<td class="${col===factor?'highlight':''}">${mode==='multiply'?row*col:`<span>${row*col} : ${col}</span><b>= ${row}</b>`}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('times-grid').classList.toggle('division-grid',mode==='divide');
  $('table-legend').textContent=`Выделен столбец ${sym}${factor}`;
  const names={2:'двойкой',3:'тройкой',4:'четвёркой',5:'пятёркой',6:'шестёркой',7:'семёркой',8:'восьмёркой',9:'девяткой'};
  $('practice-title').textContent=`Дружим с ${names[factor]}`;
  $('fact-list').innerHTML=numbers.map(n=>`<div>${mode==='multiply'?`${factor} × ${n}`:`${factor*n} : ${factor}`} <span>= <b>${mode==='multiply'?factor*n:n}</b></span></div>`).join('');
  $('start-practice').innerHTML=`Тренировать ${sym}${factor} ${icon('arrow')}`;
}
export function renderResults(state) {
  const complete=state.phase==='completed', n=complete&&!state.practice?state.lives:0;
  $('result-eyebrow').textContent=state.practice?'ТРЕНИРОВКА ЗАВЕРШЕНА':complete?`УРОВЕНЬ ${state.level.id} ПРОЙДЕН`:'ЕЩЁ ОДНА ПОПЫТКА — ЕЩЁ ОДНО ОТКРЫТИЕ';
  renderMascot(document.querySelector('.mascot-result'),complete?'complete':'wrong');
  $('result-stars').innerHTML=state.practice?'':stars(n);$('result-stars').setAttribute('aria-label',`${n} из 3 звёзд`);
  $('results-title').textContent=state.practice?'Отлично потренировались!':complete?state.level.id===30?'Вся экспедиция пройдена!':'Звёзды — твои!':'Попробуем ещё раз?';
  $('result-description').textContent=state.practice?'Каждый знакомый пример делает тебя увереннее.':complete?state.level.id===30?'Захар и Тедди открыли все миры. Можно вернуться за недостающими звёздами.':'Следующая остановка уже открыта. Захар и Тедди готовы идти дальше!':'Сердца закончились, но открытия впереди. В новой попытке будут другие примеры и снова три сердца.';
  $('result-stats').innerHTML=`<div><b>${state.correct} / ${state.tasks.length}</b><span>решено задач</span></div><div><b>${state.mistakes}</b><span>ошибок</span></div><div><b>${state.hints}</b><span>подсказок</span></div>`;
  const wrongIds=new Set(state.history.filter(h=>!h.correct).map(h=>h.taskId));
  const review=state.tasks.filter(t=>wrongIds.has(t.id));show('review-problems',review.length>0);
  $('review-problems').innerHTML=review.length?`<h2>Возьмём с собой</h2>${review.map(p=>`<p><strong>${p.prompt}</strong><span>${p.explanation}</span></p>`).join('')}`:'';
  show('next-level',complete&&!state.practice&&state.level.id<30);
  $('replay-level').textContent=state.practice?'Ещё тренировка':complete?'Пройти ещё раз':'Попробовать ещё раз';
}
let toastTimer;
export function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;show('toast',true);toastTimer=setTimeout(()=>show('toast',false),5500); }
