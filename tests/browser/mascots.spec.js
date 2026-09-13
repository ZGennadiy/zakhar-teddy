import { test, expect } from '@playwright/test';
import { createAttempt } from '../../public/js/generators.js';
import { STORAGE_KEY } from '../../public/js/config.js';

async function checkImage(page, selector, reaction, testInfo, attachment) {
  const container = page.locator(selector), image = container.locator('img');
  await expect(image).toHaveAttribute('src', `./assets/mascots/${reaction}.png`);
  await image.evaluate(element => element.decode());
  expect(await image.evaluate(element => ({ width: element.naturalWidth, height: element.naturalHeight,
    fit: getComputedStyle(element).objectFit, before: getComputedStyle(element.parentElement, '::before').content,
    background: getComputedStyle(element.parentElement).backgroundImage,
  }))).toEqual({ width: 512, height: 384, fit: 'contain', before: 'none', background: 'none' });
  const bounds = await image.boundingBox();
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (attachment) await testInfo.attach(attachment, {
    body: await container.screenshot({ animations: 'disabled' }), contentType: 'image/png',
  });
}

for (const width of [320, 390, 768, 1440]) test(`whole mascot poses at ${width}px through an actual level`, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 });
  // Hold the short success feedback for image inspection, without changing game state.
  await page.clock.install({ time: new Date('2026-09-13T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-13T10:00:01Z'));
  await page.goto('/');
  await checkImage(page, '.mascot-home', 'neutral', testInfo, `home-${width}`);
  await page.getByRole('button', { name: 'Начать экспедицию' }).click();
  await checkImage(page, '.mascot-game', 'neutral', testInfo);
  const seed = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).lastAttemptSeedByLevel[1], STORAGE_KEY);
  const tasks = createAttempt(1, seed), input = page.locator('#answer-input');
  await input.fill('999'); await input.press('Enter');
  await checkImage(page, '.mascot-game', 'wrong', testInfo, `thinking-${width}`);
  await page.locator('#retry-answer').click();
  await checkImage(page, '.mascot-game', 'neutral', testInfo);
  for (const [index, task] of tasks.entries()) {
    await input.fill(String(task.answer)); await input.press('Enter');
    await checkImage(page, '.mascot-game', 'correct', testInfo, index === 0 ? `correct-${width}` : undefined);
    await page.clock.runFor(900);
  }
  await expect(page.locator('#results-title')).toHaveText('Звёзды — твои!');
  await checkImage(page, '.mascot-result', 'complete', testInfo, `complete-${width}`);
  expect(errors).toEqual([]);
});
