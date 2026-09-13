import { test, expect } from '@playwright/test';
import { createAttempt } from '../../public/js/generators.js';
import { STORAGE_KEY } from '../../public/js/config.js';
const input=page=>page.locator('#answer-input');
async function play(page){await page.goto('/');await page.getByRole('button',{name:'Начать экспедицию'}).click();await expect(input(page)).toBeFocused();}
async function progress(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);}
async function currentTasks(page,id=1){return createAttempt(id,(await progress(page)).lastAttemptSeedByLevel[id]);}
async function enter(page,p){if(p.choices){await page.locator(`[data-choice="${p.answer}"]`).click();await page.locator('#submit-answer').click();}else{await input(page).fill(String(p.kind==='remainder'?p.answer.quotient:p.answer));if(p.kind==='remainder')await page.locator('#remainder-input').fill(String(p.answer.remainder));await input(page).press('Enter');}}

test('keyboard regression: 15 / 153, deletion, clearing, forbidden symbols, one submit',async({page})=>{
  await play(page);await input(page).pressSequentially('1');await input(page).pressSequentially('5');await expect(input(page)).toHaveValue('15');
  await input(page).pressSequentially('3');await expect(input(page)).toHaveValue('153');await input(page).press('Backspace');await expect(input(page)).toHaveValue('15');
  await input(page).press('Backspace');await expect(input(page)).toHaveValue('1');await input(page).press('Delete');await expect(input(page)).toHaveValue('');
  await input(page).pressSequentially('e+-.,abc');await expect(input(page)).toHaveValue('');
  await input(page).pressSequentially('15');await input(page).press('Escape');await expect(input(page)).toHaveValue('');
  const tasks=await currentTasks(page);await input(page).fill(String(tasks[0].answer));await input(page).press('Enter');await page.keyboard.press('Enter');
  await expect(page.locator('#task-counter')).toHaveText('Задача 2 из 8');await expect(input(page)).toHaveValue('');await expect(input(page)).toBeFocused();
  expect((await progress(page)).skillStats.multiply.correct).toBe(1);
});
test('keypad regression, mixed input, stale caret and keyboard focus',async({page})=>{
  await play(page);await page.getByRole('button',{name:'Цифра 1',exact:true}).click();await page.getByRole('button',{name:'Цифра 5',exact:true}).click();await expect(input(page)).toHaveValue('15');
  await input(page).press('Home');await page.getByRole('button',{name:'Цифра 3',exact:true}).click();await expect(input(page)).toHaveValue('153');
  await page.getByRole('button',{name:'Удалить последнюю цифру'}).click();await expect(input(page)).toHaveValue('15');
  await page.getByRole('button',{name:'Очистить ответ',exact:true}).click();await expect(input(page)).toHaveValue('');
  await input(page).pressSequentially('1');await page.getByRole('button',{name:'Цифра 5',exact:true}).click();await expect(input(page)).toHaveValue('15');
});
test('Numpad digits follow native order',async({page,browserName})=>{
  test.skip(browserName==='webkit','Physical NumPad mapping is tested in Chromium; WebKit uses host keyboard mapping.');
  // Playwright's physical US layout maps unmodified Numpad1/5 to End/Clear.
  // Shift selects their numeric mapping while preserving the Numpad codes/location.
  await play(page);await page.keyboard.press('Shift+Numpad1');await page.keyboard.press('Shift+Numpad5');await expect(input(page)).toHaveValue('15');
});
test('a wrong answer costs one heart; retry keeps the task; third error fails',async({page})=>{
  await play(page);const prompt=await page.locator('#expression').textContent();
  for(let i=0;i<3;i++){await input(page).fill('999');await input(page).press('Enter');if(i<2){await expect(page.locator('#hearts')).toHaveAttribute('aria-label',`Осталось сердец: ${2-i} из 3`);await expect(page.locator('#expression')).toHaveText(prompt);await page.locator('#retry-answer').click();}}
  await expect(page.locator('#results-title')).toHaveText('Попробуем ещё раз?');expect((await progress(page)).bestStarsByLevel).toEqual({});
  await page.locator('#replay-level').click();await expect(page.locator('#hearts')).toHaveAttribute('aria-label','Осталось сердец: 3 из 3');
});
test('full level, reload, better/worse replay, new seeds and reset',async({page})=>{
  await play(page);const before=await progress(page),tasks=await currentTasks(page);
  for(let i=0;i<tasks.length;i++){await expect(page.locator('#task-counter')).toHaveText(`Задача ${i+1} из 8`);await enter(page,tasks[i]);}
  await expect(page.locator('#results-title')).toHaveText('Звёзды — твои!');expect((await progress(page)).bestStarsByLevel[1]).toBe(3);
  await page.reload();await expect(page.locator('#star-total')).toHaveText('3');await expect(page.locator('[data-level="2"]')).toBeEnabled();
  await page.locator('[data-level="1"]').click();const after=await progress(page);expect(after.lastAttemptSeedByLevel[1]).not.toBe(before.lastAttemptSeedByLevel[1]);expect(after.lastAttemptSignatureByLevel[1]).not.toBe(before.lastAttemptSignatureByLevel[1]);
  const replay=await currentTasks(page);await input(page).fill('999');await input(page).press('Enter');await page.locator('#retry-answer').click();
  for(let i=0;i<replay.length;i++){await expect(page.locator('#task-counter')).toHaveText(`Задача ${i+1} из 8`);await enter(page,replay[i]);}
  await expect(page.locator('#results-title')).toHaveText('Звёзды — твои!');expect((await progress(page)).bestStarsByLevel[1]).toBe(3);
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Сбросить игру',exact:true}).click();await page.getByRole('button',{name:'Отмена',exact:true}).click();expect((await progress(page)).bestStarsByLevel[1]).toBe(3);
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Сбросить игру',exact:true}).click();await page.getByRole('button',{name:'Да, сбросить',exact:true}).click();
  await page.reload();await expect(page.locator('#star-total')).toHaveText('0');await expect(page.locator('[data-level="2"]')).toBeDisabled();
  const cleared=await progress(page);expect(cleared.unlockedLevel).toBe(1);expect(cleared.lastAttemptSeedByLevel).toEqual({});expect(cleared.skillStats).toEqual({});expect(cleared.records).toEqual({});
});
test('remainder: Tab, Enter, focused keypad, empty field does not cost lives',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({schemaVersion:2,bestStarsByLevel:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,3]))})),STORAGE_KEY);
  await page.goto('/');await page.locator('[data-level="21"]').click();const tasks=await currentTasks(page,21),p=tasks[0];
  await expect(input(page)).toBeFocused();await input(page).fill(String(p.answer.quotient));await input(page).press('Enter');await expect(page.locator('#remainder-input')).toBeFocused();
  await expect(page.locator('#hearts')).toHaveAttribute('aria-label','Осталось сердец: 3 из 3');
  await page.getByRole('button',{name:`Цифра ${p.answer.remainder}`,exact:true}).click();await expect(page.locator('#remainder-input')).toHaveValue(String(p.answer.remainder));
  await page.locator('#remainder-input').press('Enter');await expect(page.locator('#task-counter')).toHaveText('Задача 2 из 8');await expect(input(page)).toBeFocused();
  await input(page).press('Tab');await expect(page.locator('#remainder-input')).toBeFocused();await page.locator('#remainder-input').press('Tab');await expect(page.locator('#submit-answer')).toBeFocused();
});
test('reference and free training preserve story progress',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Таблица',exact:true}).click();await page.locator('[data-factor="7"]').click();await page.locator('[data-mode="divide"]').click();
  await expect(page.locator('#fact-list')).toContainText('56 : 7');await page.locator('#start-practice').click();await input(page).fill('999');await input(page).press('Enter');
  await expect(page.locator('#hearts')).toHaveAttribute('aria-label','Тренировка без потери жизней');await page.reload();await expect(page.locator('#star-total')).toHaveText('0');await expect(page.locator('[data-level="2"]')).toBeDisabled();
});
test('table pauses auto transition and returns to the same attempt',async({page})=>{
  await play(page);const tasks=await currentTasks(page);await enter(page,tasks[0]);await page.locator('#table-button').click();await expect(page.locator('#screen-table')).toBeVisible();
  await page.locator('#table-back').click();await expect(page.locator('#task-counter')).toHaveText('Задача 2 из 8');await expect(input(page)).toBeFocused();
});
test('bad storage recovers; author link and no auth screen',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,'{oops'),STORAGE_KEY);await page.goto('/');await expect(page.getByRole('button',{name:'Начать экспедицию'})).toBeVisible();
  await expect(page.getByRole('link',{name:'@ZGennadiy'})).toHaveAttribute('href','https://t.me/ZGennadiy');await expect(page.locator('input[type=password]')).toHaveCount(0);
});
for(const width of [320,390,768,1024,1440])test(`responsive ${width}px: screens fit, targets visible, no console errors`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:900});await play(page);
  await expect(page.locator('#expression')).toBeVisible();await expect(page.locator('#submit-answer')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Таблица',exact:true}).click();await page.locator('[data-mode="divide"]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.getByRole('dialog',{name:'Настройки экспедиции'})).toBeVisible();expect(errors).toEqual([]);
});
test('long expressions at a 640px reflow viewport',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({schemaVersion:2,bestStarsByLevel:Object.fromEntries(Array.from({length:29},(_,i)=>[i+1,3]))})),STORAGE_KEY);
  await page.setViewportSize({width:640,height:900});await page.goto('/');await page.locator('[data-level="30"]').click();
  const tasks=await currentTasks(page,30);for(let i=0;i<tasks.length;i++){await expect(page.locator('#task-counter')).toHaveText(`Задача ${i+1} из 10`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await enter(page,tasks[i]);}
  await expect(page.locator('#results-title')).toHaveText('Вся экспедиция пройдена!');
});
test('200% text scaling keeps the primary controls usable',async({page})=>{
  await page.setViewportSize({width:768,height:1024});await play(page);await page.addStyleTag({content:':root { font-size: 32px !important; }'});
  await expect(input(page)).toBeVisible();await expect(page.locator('#submit-answer')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
