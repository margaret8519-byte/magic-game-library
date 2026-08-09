(() => {
  'use strict';
  const SIZE = 8;
  const TYPES = 6;
  const symbols = ['', '', 'ϟ', '', '4', ''];
  const boardElement = document.querySelector('#game-board');
  const scoreElement = document.querySelector('#score');
  const trialsElement = document.querySelector('#trials');
  const keysElement = document.querySelector('#keys');
  const comboElement = document.querySelector('#combo');
  const energyCountElement = document.querySelector('#energy-count');
  const portalCrystalElement = document.querySelector('#portal-crystal');
  const trialPathElement = document.querySelector('#trial-path');
  const turnStatusElement = document.querySelector('#turn-status');
  const chargedBadgeElement = document.querySelector('#charged-badge');
  const comboPopElement = document.querySelector('#combo-pop');
  const statusElement = document.querySelector('#game-status');
  const answersElement = document.querySelector('#answers');
  const questionElement = document.querySelector('#question');
  const questionNumberElement = document.querySelector('#question-number');
  const helpDialog = document.querySelector('.help-dialog');
  const resultDialog = document.querySelector('.result-dialog');
  const guardianDialog = document.querySelector('.guardian-dialog');
  const GAME_STATES = Object.freeze({ QUESTION: 'QUESTION', MOVE_UNLOCKED: 'MOVE_UNLOCKED', RESOLVING_MOVE: 'RESOLVING_MOVE', LEVEL_COMPLETE: 'LEVEL_COMPLETE' });
  const TOTAL_TRIALS = 8;
  let board = [];
  let selected = null;
  let locked = false;
  let score = 0;
  let keys = 0;
  let combo = 1;
  let bestCombo = 1;
  let questionNumber = 1;
  let gameState = GAME_STATES.QUESTION;
  let chargedMove = false;
  let trialResults = [];
  let currentAnswer = 0;
  let currentTask = null;
  let questionDeck = [];
  let usedQuestionIds = new Set();
  const previousSessionIds = new Set(readStorageList('mathRecentQuestionIds'));
  let activeBooster = null;
  let pointerStart = null;
  let suppressClickUntil = 0;
  let soundOn = localStorage.getItem('magic-library-sound') !== 'off';
  const boosterCounts = { hammer: 3, shuffle: 2, star: 1 };
  const effectAudio = new Map();

  function readStorageList(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; }
  }
  function readStorageNumber(key) { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) ? value : 0; }
  function saveStorage(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }

  async function playEffect(name) {
    if (!soundOn) return;
    if (effectAudio.has(name)) { const audio = effectAudio.get(name); if (audio) { audio.currentTime = 0; await audio.play().catch(() => {}); } return; }
    effectAudio.set(name, null);
    try {
      const path = `../assets/audio/${name}.mp3`; const response = await fetch(path, { method: 'HEAD', cache: 'force-cache' }); if (!response.ok) return;
      const audio = new Audio(path); audio.volume = .42; effectAudio.set(name, audio); await audio.play().catch(() => {});
    } catch (_) { /* Optional sound asset is not available. */ }
  }

  const indexOf = (row, col) => row * SIZE + col;
  const cellAt = (row, col) => board[indexOf(row, col)];
  const randomCell = () => ({ type: Math.floor(Math.random() * TYPES), special: null });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function tone(frequency, duration = .12) {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext(); const osc = context.createOscillator(); const gain = context.createGain();
      osc.frequency.value = frequency; gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
      osc.connect(gain); gain.connect(context.destination); osc.start(); osc.stop(context.currentTime + duration); osc.onended = () => context.close();
    } catch (_) {}
  }

  function createsMatchAt(row, col) {
    const type = cellAt(row, col).type;
    return (col > 1 && cellAt(row, col - 1).type === type && cellAt(row, col - 2).type === type) ||
      (row > 1 && cellAt(row - 1, col).type === type && cellAt(row - 2, col).type === type);
  }

  function newBoard() {
    board = [];
    for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
      let cell = randomCell(); board.push(cell);
      while (createsMatchAt(row, col)) { cell = randomCell(); board[board.length - 1] = cell; }
    }
    if (!hasAvailableMove()) newBoard();
  }

  function hasAvailableMove() {
    for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
      const current = indexOf(row, col);
      for (const next of [col < SIZE - 1 ? current + 1 : -1, row < SIZE - 1 ? current + SIZE : -1]) {
        if (next < 0) continue;
        swap(current, next); const works = findGroups().length > 0; swap(current, next);
        if (works) return true;
      }
    }
    return false;
  }

  function renderBoard(falling = false) {
    boardElement.replaceChildren();
    board.forEach((cell, index) => {
      const row = Math.floor(index / SIZE); const col = index % SIZE;
      const tile = document.createElement('button'); tile.type = 'button'; tile.className = `tile${falling ? ' falling' : ''}`;
      tile.dataset.index = index; tile.dataset.row = row; tile.dataset.col = col; tile.setAttribute('role', 'gridcell'); tile.setAttribute('aria-label', `Фишка, ряд ${row + 1}, столбец ${col + 1}`);
      const gem = document.createElement('span'); gem.className = `gem gem--${cell.type}${cell.special ? ` special-${cell.special}` : ''}`; gem.textContent = symbols[cell.type]; gem.style.setProperty('--idle-delay', `${-((index * 0.37) % 4.8).toFixed(2)}s`);
      tile.append(gem); boardElement.append(tile);
    });
    if (selected !== null) boardElement.children[selected]?.classList.add('selected');
  }

  function updateHud() {
    scoreElement.textContent = score.toLocaleString('ru-RU'); trialsElement.textContent = `${Math.min(questionNumber, TOTAL_TRIALS)} / ${TOTAL_TRIALS}`; keysElement.textContent = keys; comboElement.textContent = `×${combo}`; energyCountElement.textContent = `${keys} / ${TOTAL_TRIALS}`;
    portalCrystalElement.style.setProperty('--energy', keys / TOTAL_TRIALS); portalCrystalElement.dataset.energy = keys;
  }

  function renderTrialPath() {
    trialPathElement.replaceChildren();
    for (let index = 0; index < TOTAL_TRIALS; index += 1) {
      const crystal = document.createElement('i');
      const result = trialResults[index];
      crystal.className = result === true ? 'passed' : result === false ? 'soft' : index === questionNumber - 1 && gameState !== GAME_STATES.LEVEL_COMPLETE ? 'current' : '';
      crystal.setAttribute('aria-label', result === true ? `Испытание ${index + 1}: верно` : result === false ? `Испытание ${index + 1}: пройдено` : `Испытание ${index + 1}`);
      trialPathElement.append(crystal);
    }
  }

  function setGameState(nextState, message) {
    gameState = nextState; locked = nextState !== GAME_STATES.MOVE_UNLOCKED;
    document.body.dataset.gameState = nextState;
    boardElement.setAttribute('aria-disabled', String(locked));
    if (message) turnStatusElement.textContent = message;
    turnStatusElement.classList.remove('state-flash'); void turnStatusElement.offsetWidth; turnStatusElement.classList.add('state-flash');
    chargedBadgeElement.classList.toggle('visible', nextState === GAME_STATES.MOVE_UNLOCKED && chargedMove);
    document.querySelector('.board-frame').classList.toggle('charged', nextState === GAME_STATES.MOVE_UNLOCKED && chargedMove);
    renderTrialPath();
  }
  function adjacent(a, b) { const ar = Math.floor(a / SIZE), ac = a % SIZE, br = Math.floor(b / SIZE), bc = b % SIZE; return Math.abs(ar - br) + Math.abs(ac - bc) === 1; }
  function swap(a, b) { [board[a], board[b]] = [board[b], board[a]]; }

  async function animateSwap(a, b) {
    const firstTile = boardElement.children[a]; const secondTile = boardElement.children[b];
    if (!firstTile || !secondTile) return;
    const firstGem = firstTile.querySelector('.gem'); const secondGem = secondTile.querySelector('.gem');
    const firstRect = firstTile.getBoundingClientRect(); const secondRect = secondTile.getBoundingClientRect();
    const dx = secondRect.left - firstRect.left; const dy = secondRect.top - firstRect.top;
    firstTile.classList.add('swapping'); secondTile.classList.add('swapping');
    const options = { duration: 210, easing: 'cubic-bezier(.25,.75,.3,1)', fill: 'forwards' };
    if (firstGem.animate && secondGem.animate) {
      const animations = [firstGem.animate([{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: `translate3d(${dx}px,${dy}px,0) scale(1.06)` }], options), secondGem.animate([{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: `translate3d(${-dx}px,${-dy}px,0) scale(1.06)` }], options)];
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    } else {
      firstGem.style.transform = `translate3d(${dx}px,${dy}px,0)`; secondGem.style.transform = `translate3d(${-dx}px,${-dy}px,0)`; await wait(210);
    }
  }

  function findGroups() {
    const groups = [];
    for (let row = 0; row < SIZE; row += 1) {
      let start = 0;
      for (let col = 1; col <= SIZE; col += 1) if (col === SIZE || cellAt(row, col).type !== cellAt(row, start).type) {
        if (col - start >= 3) groups.push(Array.from({ length: col - start }, (_, i) => indexOf(row, start + i))); start = col;
      }
    }
    for (let col = 0; col < SIZE; col += 1) {
      let start = 0;
      for (let row = 1; row <= SIZE; row += 1) if (row === SIZE || cellAt(row, col).type !== cellAt(start, col).type) {
        if (row - start >= 3) groups.push(Array.from({ length: row - start }, (_, i) => indexOf(start + i, col))); start = row;
      }
    }
    return groups;
  }

  function expandedMatches(groups) {
    const matches = new Set(groups.flat());
    [...matches].forEach(index => {
      const cell = board[index]; if (!cell?.special) return;
      const row = Math.floor(index / SIZE), col = index % SIZE;
      if (cell.special === 'row') for (let c = 0; c < SIZE; c += 1) matches.add(indexOf(row, c));
      if (cell.special === 'column') for (let r = 0; r < SIZE; r += 1) matches.add(indexOf(r, col));
      if (cell.special === 'core') board.forEach((other, otherIndex) => { if (other.type === cell.type) matches.add(otherIndex); });
    });
    return matches;
  }

  function showCombo(value) {
    if (value < 2) return;
    comboPopElement.textContent = `КОМБО ×${value}`; comboPopElement.classList.remove('show'); void comboPopElement.offsetWidth; comboPopElement.classList.add('show');
  }

  async function resolveBoard(initialGroups, forcedMatches = null) {
    let groups = initialGroups;
    combo = 1;
    let forced = forcedMatches;
    while (groups.length || forced) {
      const specialPlans = forced ? [] : groups.filter(group => group.length >= 4).map(group => ({ index: group[Math.floor(group.length / 2)], special: group.length >= 5 ? 'core' : Math.abs(group[1] - group[0]) === 1 ? 'row' : 'column', type: board[group[0]].type }));
      const matches = forced || expandedMatches(groups); forced = null; specialPlans.forEach(plan => matches.delete(plan.index));
      matches.forEach(index => boardElement.children[index]?.classList.add('clearing'));
      const moveMultiplier = chargedMove ? 2 : 1; score += matches.size * 70 * combo * moveMultiplier; bestCombo = Math.max(bestCombo, combo); updateHud(); showCombo(combo); tone(480 + combo * 70); playEffect(combo > 1 ? 'combo' : specialPlans.length ? 'special' : 'match'); await wait(300);
      matches.forEach(index => { board[index] = null; }); specialPlans.forEach(plan => { board[plan.index] = { type: plan.type, special: plan.special }; });
      for (let col = 0; col < SIZE; col += 1) {
        const kept = []; for (let row = SIZE - 1; row >= 0; row -= 1) { const cell = cellAt(row, col); if (cell) kept.push(cell); }
        for (let row = SIZE - 1, i = 0; row >= 0; row -= 1, i += 1) board[indexOf(row, col)] = kept[i] || randomCell();
      }
      renderBoard(true); await wait(360); groups = findGroups(); if (groups.length) combo += 1;
    }
    chargedMove = false; updateHud(); statusElement.textContent = combo > 1 ? `Великолепно! Комбо ×${combo}` : 'Кристаллы собраны!';
    await finishTrial();
  }

  async function chooseTile(index) {
    if (gameState !== GAME_STATES.MOVE_UNLOCKED || locked) { turnStatusElement.textContent = '✨ Сначала пройди математическое испытание'; return; }
    if (activeBooster) { useBooster(index); return; }
    if (selected === null) { selected = index; renderBoard(); tone(330, .07); playEffect('select'); return; }
    if (selected === index) { selected = null; renderBoard(); return; }
    if (!adjacent(selected, index)) { selected = index; renderBoard(); return; }
    const first = selected; selected = null; setGameState(GAME_STATES.RESOLVING_MOVE, '🔮 Магия кристаллов пробуждается...'); playEffect('swap'); await animateSwap(first, index); swap(first, index); renderBoard();
    const coreIndex = [first, index].find(position => board[position]?.special === 'core');
    if (coreIndex !== undefined) {
      const otherIndex = coreIndex === first ? index : first; const targetType = board[otherIndex].type; const forced = new Set([coreIndex]); board.forEach((cell, cellIndex) => { if (cell.type === targetType) forced.add(cellIndex); });
      await resolveBoard([], forced); return;
    }
    const groups = findGroups();
    if (!groups.length) { statusElement.textContent = 'Попробуй другую пару кристаллов'; tone(180); await wait(80); await animateSwap(first, index); swap(first, index); renderBoard(); setGameState(GAME_STATES.MOVE_UNLOCKED, chargedMove ? '⚡ Заряженный ход всё ещё открыт!' : '⚡ Магический ход открыт! Собери комбинацию из 3 кристаллов'); return; }
    await resolveBoard(groups);
  }

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = items => items[randomInt(0, items.length - 1)];
  const shuffle = items => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) { const other = randomInt(0, index); [result[index], result[other]] = [result[other], result[index]]; }
    return result;
  };
  const normalized = value => String(value).replace(/\s/g, '').replace(',', '.').toLowerCase();
  const formatted = value => typeof value === 'number' ? value.toLocaleString('ru-RU') : String(value);
  const difficultyRange = difficulty => difficulty === 'easy' ? [10, 999] : difficulty === 'medium' ? [100, 99999] : [1000, 999999];

  function numericAnswers(correct, options = {}) {
    const { suffix = '', min = 0, offsets } = options;
    const magnitude = Math.max(2, Math.round(Math.abs(correct) * .08));
    const candidates = offsets || [1, -1, magnitude, -magnitude, 10, -10, 100, -100];
    const values = new Set([correct]);
    shuffle(candidates).forEach(offset => { if (values.size < 3 && correct + offset >= min) values.add(correct + offset); });
    while (values.size < 3) values.add(correct + values.size + 1);
    return shuffle([...values].map(value => `${formatted(value)}${suffix}`));
  }

  function makeTask(category, template, question, correct, answers, explanation, difficulty) {
    const unique = [...new Set(answers.map(formatted))];
    const correctText = formatted(correct);
    if (!unique.some(answer => normalized(answer) === normalized(correctText))) unique.unshift(correctText);
    while (unique.length < 3) {
      const numericCorrect = Number(correct);
      unique.push(Number.isFinite(numericCorrect) ? formatted(numericCorrect + unique.length + 1) : `Другой ответ ${unique.length}`);
    }
    const finalAnswers = shuffle(unique.slice(0, 3));
    if (new Set(finalAnswers.map(normalized)).size !== finalAnswers.length) throw new Error('Некорректные варианты ответа');
    return { id: `${category}:${template}:${question}`, category, difficulty, question, answers: finalAnswers, correct: correctText, explanation };
  }

  function generateNumberTask(difficulty = 'easy') {
    const mode = randomInt(0, 3); const [min, max] = difficultyRange(difficulty);
    if (mode === 0) { const a = randomInt(min, max); let b = randomInt(min, max); while (b === a) b = randomInt(min, max); const correct = Math.max(a, b); return makeTask('Числа', 'compare', `Какое число больше: ${formatted(a)} или ${formatted(b)}?`, correct, numericAnswers(correct, { min: 1, offsets: [a - correct, b - correct, 10, -10] }), `${formatted(correct)} — большее число.`, difficulty); }
    if (mode === 1) { const place = pick([10, 100, 1000, 10000]); const digit = randomInt(1, 9); const tail = randomInt(0, place - 1); const number = digit * place + tail; return makeTask('Числа', 'place', `Сколько единиц разряда ${formatted(place)} в числе ${formatted(number)}?`, digit, shuffle([digit, Math.max(0, digit - 1), Math.min(9, digit + 1)]), `В разряде ${formatted(place)} стоит цифра ${digit}.`, difficulty); }
    if (mode === 2) { const step = pick(difficulty === 'easy' ? [10, 100] : [10, 100, 1000]); const start = randomInt(2, Math.max(3, Math.floor(max / step) - 3)) * step; const correct = start + step * 3; return makeTask('Числа', 'sequence', `Продолжи: ${formatted(start)}, ${formatted(start + step)}, ${formatted(start + step * 2)}, …`, correct, numericAnswers(correct, { min: 1, offsets: [step, -step, step * 2, -step * 2] }), `Каждое следующее число увеличивается на ${formatted(step)}.`, difficulty); }
    const factor = pick([10, 100, 1000]); const base = randomInt(2, difficulty === 'hard' ? 900 : 90); const correct = base * factor; return makeTask('Числа', 'scale', `Увеличь ${formatted(base)} в ${formatted(factor)} раз.`, correct, numericAnswers(correct, { min: 1, offsets: [factor, -factor, base, -base] }), `${formatted(base)} × ${formatted(factor)} = ${formatted(correct)}.`, difficulty);
  }

  function generateAdditionTask(difficulty = 'easy') {
    const [, max] = difficultyRange(difficulty); const a = randomInt(100, Math.floor(max * .55)); const b = randomInt(100, Math.floor(max * .4));
    if (Math.random() < .35) { const sum = a + b; return makeTask('Сложение', 'unknown', `Найди неизвестное слагаемое: □ + ${formatted(b)} = ${formatted(sum)}`, a, numericAnswers(a, { min: 0 }), `${formatted(sum)} − ${formatted(b)} = ${formatted(a)}.`, difficulty); }
    const correct = a + b; return makeTask('Сложение', 'sum', `${formatted(a)} + ${formatted(b)} = ?`, correct, numericAnswers(correct, { min: 0 }), `Сумма равна ${formatted(correct)}.`, difficulty);
  }

  function generateSubtractionTask(difficulty = 'easy') {
    const [, max] = difficultyRange(difficulty); const b = randomInt(50, Math.floor(max * .35)); const correct = randomInt(50, Math.floor(max * .55)); const a = b + correct;
    if (Math.random() < .35) return makeTask('Вычитание', 'unknown', `□ − ${formatted(b)} = ${formatted(correct)}. Найди уменьшаемое.`, a, numericAnswers(a, { min: 0 }), `${formatted(correct)} + ${formatted(b)} = ${formatted(a)}.`, difficulty);
    return makeTask('Вычитание', 'difference', `${formatted(a)} − ${formatted(b)} = ?`, correct, numericAnswers(correct, { min: 0 }), `Разность равна ${formatted(correct)}.`, difficulty);
  }

  function generateMultiplicationTask(difficulty = 'easy') {
    const mode = randomInt(0, 2);
    if (mode === 0) { const a = randomInt(12, difficulty === 'easy' ? 999 : 9999), b = randomInt(2, 9), correct = a * b; return makeTask('Умножение', 'single', `${formatted(a)} × ${b} = ?`, correct, numericAnswers(correct, { min: 1, offsets: [a, -a, b * 10, -b * 10] }), `${formatted(a)} × ${b} = ${formatted(correct)}.`, difficulty); }
    if (mode === 1) { const a = randomInt(12, difficulty === 'hard' ? 999 : 199), b = randomInt(11, 49), correct = a * b; return makeTask('Умножение', 'double', `${formatted(a)} × ${b} = ?`, correct, numericAnswers(correct, { min: 1, offsets: [a, -a, b, -b] }), `Произведение равно ${formatted(correct)}.`, difficulty); }
    const factor = pick([10, 100, 1000]), a = randomInt(2, 999), correct = a * factor; return makeTask('Умножение', 'power10', `${formatted(a)} × ${formatted(factor)} = ?`, correct, numericAnswers(correct, { min: 1, offsets: [factor, -factor, a, -a] }), `При умножении на ${factor} добавляем ${String(factor).length - 1} нуля.`, difficulty);
  }

  function generateDivisionTask(difficulty = 'easy') {
    const mode = randomInt(0, 2);
    if (mode === 0) { const divisor = randomInt(2, difficulty === 'hard' ? 25 : 9), quotient = randomInt(3, difficulty === 'hard' ? 150 : 50), dividend = divisor * quotient; return makeTask('Деление', 'exact', `${formatted(dividend)} ÷ ${divisor} = ?`, quotient, numericAnswers(quotient, { min: 1 }), `${formatted(dividend)} ÷ ${divisor} = ${formatted(quotient)}.`, difficulty); }
    if (mode === 1) { const divisor = randomInt(3, 12), quotient = randomInt(5, 60), remainder = randomInt(1, divisor - 1), dividend = divisor * quotient + remainder; const correct = `остаток ${remainder}`; const otherRemainders = shuffle([...Array(divisor).keys()].filter(value => value !== remainder)).slice(0, 2); return makeTask('Деление', 'remainder', `Какой остаток получится при делении ${dividend} на ${divisor}?`, correct, shuffle([correct, ...otherRemainders.map(value => `остаток ${value}`)]), `${dividend} = ${divisor} × ${quotient} + ${remainder}.`, difficulty); }
    const divisor = pick([10, 100, 1000]), quotient = randomInt(2, 900), dividend = quotient * divisor; return makeTask('Деление', 'power10', `${formatted(dividend)} ÷ ${formatted(divisor)} = ?`, quotient, numericAnswers(quotient, { min: 1 }), `Убираем ${String(divisor).length - 1} нуля.`, difficulty);
  }

  function generateOrderOfOperationsTask(difficulty = 'medium') {
    const a = randomInt(3, 20), b = randomInt(2, 9), c = randomInt(2, 12), d = randomInt(1, 9); const mode = randomInt(0, 2); let question; let correct;
    if (mode === 0) { question = `${a} + ${b} × ${c}`; correct = a + b * c; }
    else if (mode === 1) { question = `(${a} + ${b}) × ${c}`; correct = (a + b) * c; }
    else { question = `${a * b} ÷ ${b} + ${c} × ${d}`; correct = a + c * d; }
    return makeTask('Выражения', `order${mode}`, `Найди значение: ${question}`, correct, numericAnswers(correct, { min: 0 }), `Сначала выполняем действия в скобках, затем умножение и деление. Ответ: ${correct}.`, difficulty);
  }

  function generateMeasurementTask(difficulty = 'medium') {
    const mode = randomInt(0, 5);
    const configs = [
      ['length', 'Сколько сантиметров в', 'м', 'см', 100], ['mass', 'Сколько килограммов в', 'т', 'кг', 1000],
      ['time', 'Сколько минут в', 'ч', 'мин', 60], ['capacity', 'Сколько миллилитров в', 'л', 'мл', 1000],
      ['area', 'Сколько квадратных сантиметров в', 'дм²', 'см²', 100], ['speed', 'Какой путь за 1 час при скорости', 'км/ч', 'км', 1]
    ];
    const [template, lead, from, to, factor] = configs[mode]; const amount = randomInt(2, difficulty === 'hard' ? 25 : 10); const correct = amount * factor;
    return makeTask('Величины', template, `${lead} ${amount} ${from}?`, `${formatted(correct)} ${to}`, numericAnswers(correct, { suffix: ` ${to}`, min: 1, offsets: [factor, -factor, factor * 10, -factor * 10] }), `${amount} ${from} = ${formatted(correct)} ${to}.`, difficulty);
  }

  function generateFractionTask(difficulty = 'medium') {
    const denominator = pick([2, 3, 4, 5, 8, 10]); const part = randomInt(2, 20); const whole = part * denominator;
    if (Math.random() < .5) return makeTask('Доли', 'part', `Найди 1/${denominator} от числа ${whole}.`, part, numericAnswers(part, { min: 1 }), `${whole} ÷ ${denominator} = ${part}.`, difficulty);
    return makeTask('Доли', 'whole', `1/${denominator} величины равна ${part}. Чему равна вся величина?`, whole, numericAnswers(whole, { min: 1, offsets: [part, -part, denominator, -denominator] }), `${part} × ${denominator} = ${whole}.`, difficulty);
  }

  function generateMovementTask(difficulty = 'medium') {
    const speed = randomInt(3, difficulty === 'hard' ? 90 : 25), time = randomInt(2, 8), distance = speed * time; const mode = randomInt(0, 2);
    if (mode === 0) return makeTask('Задачи', 'movement-distance', `Путешественник шёл ${time} ч со скоростью ${speed} км/ч. Какой путь он прошёл?`, `${distance} км`, numericAnswers(distance, { suffix: ' км', min: 1, offsets: [speed, -speed, time, -time] }), `Путь = скорость × время: ${speed} × ${time} = ${distance} км.`, difficulty);
    if (mode === 1) return makeTask('Задачи', 'movement-speed', `За ${time} ч поезд прошёл ${distance} км. Найди скорость.`, `${speed} км/ч`, numericAnswers(speed, { suffix: ' км/ч', min: 1 }), `Скорость = путь ÷ время: ${distance} ÷ ${time} = ${speed} км/ч.`, difficulty);
    return makeTask('Задачи', 'movement-time', `Сколько часов нужно пройти ${distance} км со скоростью ${speed} км/ч?`, `${time} ч`, numericAnswers(time, { suffix: ' ч', min: 1 }), `Время = путь ÷ скорость: ${distance} ÷ ${speed} = ${time} ч.`, difficulty);
  }

  function generatePriceTask(difficulty = 'medium') {
    const price = randomInt(12, difficulty === 'hard' ? 850 : 250), quantity = randomInt(2, 9), cost = price * quantity;
    if (Math.random() < .5) return makeTask('Задачи', 'price-cost', `Одна книга стоит ${price} ₽. Сколько стоят ${quantity} книг?`, `${formatted(cost)} ₽`, numericAnswers(cost, { suffix: ' ₽', min: 1, offsets: [price, -price, quantity * 10, -quantity * 10] }), `Цена × количество = стоимость: ${price} × ${quantity} = ${cost} ₽.`, difficulty);
    const paid = Math.ceil((cost + randomInt(20, 200)) / 100) * 100, change = paid - cost; return makeTask('Задачи', 'price-change', `За ${quantity} товаров по ${price} ₽ заплатили ${paid} ₽. Сколько сдачи?`, `${change} ₽`, numericAnswers(change, { suffix: ' ₽', min: 0 }), `Стоимость ${cost} ₽, сдача: ${paid} − ${cost} = ${change} ₽.`, difficulty);
  }

  function generateTimeTask(difficulty = 'medium') {
    const startHour = randomInt(7, 17), startMinute = pick([0, 10, 15, 20, 30, 40, 45, 50]), duration = pick([30, 40, 45, 60, 75, 90, 120]); const total = startHour * 60 + startMinute + duration; const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; const start = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
    return makeTask('Задачи', 'time-end', `Экскурсия началась в ${start} и длилась ${duration} мин. Когда она закончилась?`, end, shuffle([end, `${String(Math.floor((total + 30) / 60)).padStart(2, '0')}:${String((total + 30) % 60).padStart(2, '0')}`, `${String(Math.floor((total - 15) / 60)).padStart(2, '0')}:${String((total - 15) % 60).padStart(2, '0')}`]), `К ${start} прибавляем ${duration} минут и получаем ${end}.`, difficulty);
  }

  function generateWorkTask(difficulty = 'hard') {
    const rate = randomInt(4, 18), time = randomInt(2, 9), total = rate * time;
    return makeTask('Задачи', 'work', `Мастер делает ${rate} деталей в час. Сколько деталей он сделает за ${time} ч?`, `${total} деталей`, numericAnswers(total, { suffix: ' деталей', min: 1, offsets: [rate, -rate, time, -time] }), `Производительность × время = работа: ${rate} × ${time} = ${total}.`, difficulty);
  }

  function generateGeometryTask(difficulty = 'medium') {
    const mode = randomInt(0, 4); const a = randomInt(3, 25), b = randomInt(2, 20);
    if (mode === 0) { const correct = 2 * (a + b); return makeTask('Геометрия', 'perimeter', `Периметр прямоугольника со сторонами ${a} см и ${b} см равен…`, `${correct} см`, numericAnswers(correct, { suffix: ' см', min: 1, offsets: [a, -a, b, -b] }), `P = 2 × (${a} + ${b}) = ${correct} см.`, difficulty); }
    if (mode === 1) { const correct = a * b; return makeTask('Геометрия', 'area', `Площадь прямоугольника ${a} см × ${b} см равна…`, `${correct} см²`, numericAnswers(correct, { suffix: ' см²', min: 1, offsets: [a, -a, b, -b] }), `S = ${a} × ${b} = ${correct} см².`, difficulty); }
    if (mode === 2) { const radius = randomInt(2, 18), correct = radius * 2; return makeTask('Геометрия', 'diameter', `Радиус окружности ${radius} см. Чему равен диаметр?`, `${correct} см`, numericAnswers(correct, { suffix: ' см', min: 1 }), `Диаметр вдвое больше радиуса: ${radius} × 2 = ${correct} см.`, difficulty); }
    if (mode === 3) return makeTask('Геометрия', 'solid', 'Какое тело имеет два круглых основания?', 'Цилиндр', ['Конус', 'Цилиндр', 'Пирамида'], 'У цилиндра два равных круглых основания.', difficulty);
    return makeTask('Геометрия', 'symmetry', 'У какой фигуры четыре оси симметрии?', 'Квадрат', ['Прямоугольник', 'Квадрат', 'Круг с отмеченным радиусом'], 'У квадрата четыре оси симметрии.', difficulty);
  }

  function generateLogicTask(difficulty = 'medium') {
    const mode = randomInt(0, 2);
    if (mode === 0) { const start = randomInt(2, 20), step = randomInt(2, 12), correct = start + step * 4; return makeTask('Логика', 'algorithm', `Алгоритм: прибавляй ${step}. ${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, …`, correct, numericAnswers(correct, { min: 0, offsets: [step, -step, step * 2] }), `Следующее число: ${start + step * 3} + ${step} = ${correct}.`, difficulty); }
    if (mode === 1) { const a = randomInt(10, 99), b = randomInt(10, 99); const statement = a + b === b + a; return makeTask('Логика', 'truth', `Верно ли: ${a} + ${b} = ${b} + ${a}?`, statement ? 'Верно' : 'Неверно', ['Верно', 'Неверно', 'Недостаточно данных'], 'От перестановки слагаемых сумма не меняется.', difficulty); }
    const first = randomInt(2, 8), correct = first * 16; return makeTask('Логика', 'doubling', `Найди следующее число: ${first}, ${first * 2}, ${first * 4}, ${first * 8}, …`, correct, numericAnswers(correct, { min: 1, offsets: [first, -first, first * 2] }), 'Каждое число вдвое больше предыдущего.', difficulty);
  }

  function generateTableTask(difficulty = 'medium') {
    const mon = randomInt(12, 35); let tue = randomInt(12, 35); while (tue === mon) tue = randomInt(12, 35); let wed = randomInt(12, 35); while (wed === mon || wed === tue) wed = randomInt(12, 35); const mode = randomInt(0, 2);
    const table = `Таблица: Пн — ${mon}, Вт — ${tue}, Ср — ${wed}.`;
    if (mode === 0) { const correct = mon + tue + wed; return makeTask('Информация', 'table-total', `${table} Сколько всего книг прочитано?`, correct, numericAnswers(correct, { min: 0 }), `${mon} + ${tue} + ${wed} = ${correct}.`, difficulty); }
    if (mode === 1) { const values = { Пн: mon, Вт: tue, Ср: wed }; const correct = Object.entries(values).sort((a, b) => b[1] - a[1])[0][0]; return makeTask('Информация', 'table-max', `${table} В какой день значение наибольшее?`, correct, ['Пн', 'Вт', 'Ср'], `Наибольшее значение — ${Math.max(mon, tue, wed)}.`, difficulty); }
    const correct = Math.abs(wed - mon); return makeTask('Информация', 'chart-difference', `Столбчатая диаграмма показывает: Пн — ${mon}, Ср — ${wed}. На сколько отличаются столбцы?`, correct, numericAnswers(correct, { min: 0 }), `Разность значений равна ${correct}.`, difficulty);
  }

  const arithmeticGenerators = [generateAdditionTask, generateSubtractionTask, generateMultiplicationTask, generateDivisionTask, generateOrderOfOperationsTask];
  const wordGenerators = [generateMovementTask, generatePriceTask, generateTimeTask, generateWorkTask];
  const allGenerators = [generateNumberTask, ...arithmeticGenerators, generateMeasurementTask, generateFractionTask, ...wordGenerators, generateGeometryTask, generateLogicTask, generateTableTask];

  function buildQuestionDeck() {
    usedQuestionIds.forEach(id => previousSessionIds.add(id)); usedQuestionIds = new Set();
    const plan = shuffle([generateNumberTask, pick(arithmeticGenerators.slice(0, 4)), generateOrderOfOperationsTask, generateMeasurementTask, pick(wordGenerators), generateFractionTask, generateGeometryTask, pick([generateLogicTask, generateTableTask])]);
    const deck = [];
    plan.forEach((generator, index) => {
      const difficulty = index < 3 ? pick(['easy', 'medium']) : index < 7 ? 'medium' : pick(['medium', 'hard']);
      let task; let attempts = 0;
      do { task = generator(difficulty); attempts += 1; } while ((usedQuestionIds.has(task.id) || previousSessionIds.has(task.id)) && attempts < 30);
      usedQuestionIds.add(task.id); deck.push(task);
    });
    saveStorage('mathRecentQuestionIds', JSON.stringify([...previousSessionIds, ...usedQuestionIds].slice(-80)));
    return deck;
  }

  function nextTask() {
    if (!questionDeck.length) questionDeck = buildQuestionDeck();
    return questionDeck.shift();
  }

  function generateQuestion() {
    currentTask = nextTask(); currentAnswer = currentTask.correct;
    questionElement.textContent = currentTask.question; answersElement.replaceChildren();
    currentTask.answers.forEach(value => { const button = document.createElement('button'); button.type = 'button'; button.className = 'answer'; button.textContent = value; button.addEventListener('click', () => answerQuestion(button, value)); answersElement.append(button); });
    questionNumberElement.textContent = questionNumber;
  }

  function answerQuestion(button, value) {
    if (gameState !== GAME_STATES.QUESTION || answersElement.dataset.locked === 'true') return; answersElement.dataset.locked = 'true';
    const correct = normalized(value) === normalized(currentAnswer); trialResults.push(correct);
    if (correct) {
      button.classList.add('correct'); keys += 1; chargedMove = true; score += 500; statusElement.textContent = `Верно! Магический ход заряжен ×2. ${currentTask.explanation}`; document.body.classList.add('correct-burst'); setTimeout(() => document.body.classList.remove('correct-burst'), 650); tone(740, .2); playEffect('correct'); playEffect('crystal-energy');
      if (Math.random() < .24) { const available = Object.keys(boosterCounts).filter(type => boosterCounts[type] < (type === 'hammer' ? 5 : 3)); if (available.length) { const gift = pick(available); boosterCounts[gift] += 1; refreshBoosters(); } }
    } else {
      button.classList.add('wrong'); [...answersElement.children].find(item => normalized(item.textContent) === normalized(currentAnswer))?.classList.add('correct'); chargedMove = false; statusElement.textContent = `Почти! Правильный ответ: ${currentAnswer}. ${currentTask.explanation}`; tone(230, .16); playEffect('wrong');
    }
    updateHud(); renderTrialPath();
    setTimeout(() => setGameState(GAME_STATES.MOVE_UNLOCKED, correct ? '⚡ Магический ход открыт! Заряд ×2' : '⚡ Магический ход открыт! Собери комбинацию из 3 кристаллов'), 850);
  }

  async function finishTrial() {
    setGameState(GAME_STATES.RESOLVING_MOVE, '🔮 Отлично! Следующее испытание...');
    await wait(650);
    if (questionNumber >= TOTAL_TRIALS) { completeLevel(); return; }
    questionNumber += 1; answersElement.dataset.locked = 'false'; generateQuestion(); updateHud(); setGameState(GAME_STATES.QUESTION, '✨ Сначала пройди математическое испытание');
  }

  function useBooster(index) {
    const type = activeBooster; if (!type || boosterCounts[type] <= 0) return;
    boosterCounts[type] -= 1; activeBooster = null;
    if (type === 'hammer') board[index] = randomCell();
    if (type === 'star') { const target = board[index].type; board = board.map(cell => cell.type === target ? randomCell() : cell); score += 400; }
    document.querySelectorAll('.booster').forEach(button => button.classList.remove('active')); refreshBoosters(); renderBoard(true); updateHud(); tone(620, .18); statusElement.textContent = 'Бустер применён!';
  }

  function refreshBoosters() { document.querySelectorAll('.booster').forEach(button => { button.querySelector('b').textContent = boosterCounts[button.dataset.booster]; button.disabled = boosterCounts[button.dataset.booster] <= 0; }); }
  function openResult(won, reward, shards) {
    document.querySelector('#result-title').textContent = won ? 'Портал чисел открыт!' : 'Порталу пока не хватает энергии';
    document.querySelector('#result-copy').textContent = won ? 'Кристалл Портала пробудился благодаря твоим знаниям!' : 'Ты уже собрал часть магической энергии. Попробуй ещё раз — новые испытания уже ждут!';
    document.querySelector('#result-correct').textContent = `${keys} / ${TOTAL_TRIALS}`; document.querySelector('#result-score').textContent = score.toLocaleString('ru-RU'); document.querySelector('#result-combo').textContent = `×${bestCombo}`;
    document.querySelector('#reward-name').textContent = reward || ''; document.querySelector('#shard-count').textContent = shards > 0 ? `Осколки знаний: ${shards}` : '';
    document.querySelector('#reward-crystal').dataset.reward = keys === 8 ? 'legendary' : keys === 7 ? 'shining' : won ? 'bronze' : 'dormant'; resultDialog.showModal();
  }

  function completeLevel() {
    setGameState(GAME_STATES.LEVEL_COMPLETE, 'Кристалл Портала завершил испытание');
    const won = keys >= 5;
    saveStorage('mathBestCorrectAnswers', Math.max(keys, readStorageNumber('mathBestCorrectAnswers')));
    saveStorage('mathBestScore', Math.max(score, readStorageNumber('mathBestScore')));
    saveStorage('mathBestCombo', Math.max(bestCombo, readStorageNumber('mathBestCombo')));
    let reward = ''; let shards = readStorageNumber('mathCrystalShards');
    if (won) reward = keys === 8 ? 'ЛЕГЕНДАРНЫЙ КРИСТАЛЛ ЗНАНИЙ' : keys === 7 ? 'СИЯЮЩИЙ КРИСТАЛЛ ЗНАНИЙ' : 'БРОНЗОВЫЙ КРИСТАЛЛ ЗНАНИЙ';
    const guardianUnlocked = localStorage.getItem('mathGuardianUnlocked') === 'true';
    if (won && !guardianUnlocked) {
      saveStorage('mathGuardianUnlocked', 'true');
      playEffect('guardian-unlock');
      window.setTimeout(() => guardianDialog.showModal(), 450);
    } else {
      if (won) { shards += 1; saveStorage('mathCrystalShards', shards); }
      if (won) playEffect('victory');
      window.setTimeout(() => openResult(won, reward, shards), 450);
    }
  }

  function resetGame() {
    score = 0; keys = 0; combo = 1; bestCombo = 1; questionNumber = 1; selected = null; chargedMove = false; trialResults = []; activeBooster = null; answersElement.dataset.locked = 'false'; questionDeck = buildQuestionDeck();
    Object.assign(boosterCounts, { hammer: 3, shuffle: 2, star: 1 }); newBoard(); renderBoard(); updateHud(); refreshBoosters(); generateQuestion(); statusElement.textContent = 'Реши задачу, чтобы пробудить магический ход'; setGameState(GAME_STATES.QUESTION, '✨ Сначала пройди математическое испытание');
    if (resultDialog.open) resultDialog.close(); if (guardianDialog.open) guardianDialog.close();
  }

  document.querySelectorAll('.booster').forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.booster; if (gameState !== GAME_STATES.MOVE_UNLOCKED || locked || boosterCounts[type] <= 0) return;
    if (type === 'shuffle') { boosterCounts.shuffle -= 1; newBoard(); renderBoard(true); refreshBoosters(); tone(560); statusElement.textContent = 'Поле перемешано!'; return; }
    activeBooster = activeBooster === type ? null : type; document.querySelectorAll('.booster').forEach(item => item.classList.toggle('active', item.dataset.booster === activeBooster)); statusElement.textContent = activeBooster ? 'Выбери фишку на поле' : 'Бустер отменён';
  }));
  boardElement.addEventListener('click', event => {
    const tile = event.target.closest('.tile'); if (!tile || !boardElement.contains(tile)) return;
    if (performance.now() < suppressClickUntil) return;
    chooseTile(Number(tile.dataset.index));
  });
  boardElement.addEventListener('pointerdown', event => {
    const tile = event.target.closest('.tile'); if (!tile || locked) return;
    pointerStart = { index: Number(tile.dataset.index), row: Number(tile.dataset.row), col: Number(tile.dataset.col), x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    tile.setPointerCapture?.(event.pointerId);
  });
  boardElement.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId || locked) { pointerStart = null; return; }
    const start = pointerStart; pointerStart = null;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) < 18) return;
    let row = start.row; let col = start.col;
    if (Math.abs(dx) > Math.abs(dy)) col += dx > 0 ? 1 : -1; else row += dy > 0 ? 1 : -1;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    suppressClickUntil = performance.now() + 320; selected = start.index; renderBoard(); chooseTile(indexOf(row, col));
  });
  boardElement.addEventListener('pointercancel', () => { pointerStart = null; });
  document.querySelector('.help-button').addEventListener('click', () => helpDialog.showModal());
  document.querySelector('.dialog-close').addEventListener('click', () => helpDialog.close());
  document.querySelector('.dialog-action').addEventListener('click', () => helpDialog.close());
  document.querySelector('.replay-button').addEventListener('click', resetGame);
  document.querySelector('.guardian-continue').addEventListener('click', () => { guardianDialog.close(); openResult(true, keys === 8 ? 'ЛЕГЕНДАРНЫЙ КРИСТАЛЛ ЗНАНИЙ' : keys === 7 ? 'СИЯЮЩИЙ КРИСТАЛЛ ЗНАНИЙ' : 'БРОНЗОВЫЙ КРИСТАЛЛ ЗНАНИЙ', readStorageNumber('mathCrystalShards')); });
  guardianDialog.addEventListener('cancel', event => event.preventDefault());
  resultDialog.addEventListener('cancel', event => event.preventDefault());
  document.querySelector('.sound-button').addEventListener('click', event => { soundOn = !soundOn; localStorage.setItem('magic-library-sound', soundOn ? 'on' : 'off');AdventureMusic.syncWithSoundSetting(); event.currentTarget.textContent = soundOn ? '🔊' : '🔇'; event.currentTarget.setAttribute('aria-pressed', String(soundOn)); event.currentTarget.setAttribute('aria-label', soundOn ? 'Выключить звук' : 'Включить звук'); tone(650); });
  helpDialog.addEventListener('click', event => { if (event.target === helpDialog) helpDialog.close(); });
  const soundButton = document.querySelector('.sound-button');
  soundButton.textContent = soundOn ? '🔊' : '🔇';
  soundButton.setAttribute('aria-pressed', String(soundOn));
  soundButton.setAttribute('aria-label', soundOn ? 'Выключить звук' : 'Включить звук');
  AdventureMusic.configure(.11);resetGame();
  window.showMagicTransition?.('math');
})();
