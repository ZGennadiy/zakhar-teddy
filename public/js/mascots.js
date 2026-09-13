// Each reaction is a complete, independently cropped RGBA image, not an atlas cell.
export const MASCOTS = Object.freeze({
  neutral: { src: './assets/mascots/neutral.png', label: 'Захар машет рукой, пёс Тедди приветствует тебя' },
  correct: { src: './assets/mascots/correct.png', label: 'Захар улыбается и показывает большой палец, Тедди поднимает лапу' },
  wrong: { src: './assets/mascots/wrong.png', label: 'Захар и Тедди задумались и помогают разобраться' },
  complete: { src: './assets/mascots/complete.png', label: 'Захар обнимает Тедди после завершения уровня' },
});

export function renderMascot(element, reaction) {
  const name = Object.hasOwn(MASCOTS, reaction) ? reaction : 'neutral';
  const mascot = MASCOTS[name];
  const image = element.querySelector('img');
  element.dataset.reaction = name;
  element.setAttribute('aria-label', mascot.label);
  if (image.getAttribute('src') !== mascot.src) image.setAttribute('src', mascot.src);
}
