export const WORLDS = [
  { id: 1, title: 'Разминка Тедди', subtitle: 'Таблица умножения', symbol: '×', color: 'violet' },
  { id: 2, title: 'Орбита деления', subtitle: 'Таблица деления', symbol: ':', color: 'blue' },
  { id: 3, title: 'Математический следопыт', subtitle: 'Ищем неизвестное', symbol: '?', color: 'mint' },
  { id: 4, title: 'Большие числа', subtitle: 'Разбираем на простые части', symbol: '100', color: 'orange' },
  { id: 5, title: 'Экспедиция Остаток', subtitle: 'Когда делится не поровну', symbol: '…', color: 'rose' },
  { id: 6, title: 'Лаборатория Сириус+', subtitle: 'Думаем на несколько шагов', symbol: '+', color: 'indigo' },
];
const defs = [
  ['Дважды два', ['multiply'], { factors: [2, 3] }],
  ['Дай пять!', ['multiply'], { factors: [4, 5] }],
  ['На шесть и семь', ['multiply'], { factors: [6, 7] }],
  ['Высший пилотаж', ['multiply'], { factors: [8, 9] }],
  ['Испытание Тедди', ['multiply']],
  ['Делим на два и три', ['divide'], { factors: [2, 3] }],
  ['Четыре и пять', ['divide'], { factors: [4, 5] }],
  ['Шесть и семь', ['divide'], { factors: [6, 7] }],
  ['Восемь и девять', ['divide'], { factors: [8, 9] }],
  ['Секрет обратного действия', ['divide', 'missingFactor', 'missingDivisor']],
  ['Туда и обратно', ['multiply', 'divide']],
  ['Потерянный множитель', ['missingFactor']],
  ['Пропавшее число', ['missingDividend', 'missingDivisor']],
  ['Магия нуля и единицы', ['special']],
  ['Испытание следопыта', ['multiply', 'divide', 'missingFactor', 'missingDividend', 'missingDivisor', 'special', 'trueFalse']],
  ['Делим по частям', ['outside']],
  ['Умножаем десятки', ['largeMultiply']],
  ['Считаем десятками', ['roundDivision']],
  ['Большое открытие', ['bigDivision']],
  ['Миссия «Большие числа»', ['outside', 'largeMultiply', 'roundDivision', 'bigDivision']],
  ['Осталось чуть-чуть', ['remainderSmall']],
  ['Остаток до ста', ['remainder']],
  ['Поровну или с остатком?', ['remainder', 'divide']],
  ['Какой остаток возможен?', ['remainderProperty']],
  ['Испытание Остатка', ['remainderSmall', 'remainder', 'divide', 'remainderProperty']],
  ['Два шага вперёд', ['twoSteps']],
  ['Цепочка открытий', ['threeSteps']],
  ['Секрет скобок', ['parentheses']],
  ['Найди неизвестное', ['equation']],
  ['Главная экспедиция', ['multiply', 'divide', 'remainder', 'missingFactor', 'twoSteps', 'threeSteps', 'parentheses', 'equation', 'findError', 'missingSign']],
];
export const LEVELS = defs.map(([title, allowedProblemKinds, generatorConfig = {}], index) => {
  const id = index + 1;
  return Object.freeze({ id, title, chapter: Math.ceil(id / 5), problemCount: id % 5 === 0 ? 10 : 8, lives: 3,
    difficulty: Math.ceil(id / 5), allowedProblemKinds, generatorConfig, isBoss: id % 5 === 0, isSiriusPlus: id === 19 || id >= 26 });
});
export const getLevel = id => LEVELS.find(level => level.id === Number(id));
export const MAX_ANSWER_LENGTH = 4;
export const STORAGE_KEY = 'zakhar-teddy-game:v2';
