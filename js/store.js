const STORAGE_KEY = 'financeApp';

const CATEGORY_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
  '#00BCD4', '#E91E63', '#795548', '#607D8B',
  '#FF5722', '#3F51B5', '#8BC34A', '#FFC107',
];

export const DEFAULT_CATEGORIES = [
  { name: 'Житло' },
  { name: 'Продукти' },
  { name: 'Транспорт' },
  { name: 'Комунальні' },
  { name: 'Здоров\'я' },
  { name: 'Одяг' },
  { name: 'Розваги' },
  { name: 'Накопичення' },
];

function getDefaultState() {
  const now = new Date();
  return {
    monthlyIncome: {},
    categories: [],
    expenses: [],
    currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

function migrate(s) {
  // Migrate old single income → per-month
  if ('income' in s && !('monthlyIncome' in s)) {
    s.monthlyIncome = {};
    if (s.income > 0) {
      s.monthlyIncome[s.currentMonth] = s.income;
    }
    delete s.income;
  }
  if (!s.monthlyIncome) s.monthlyIncome = {};
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* corrupted — reset */ }
  return getDefaultState();
}

let state = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.dispatchEvent(new CustomEvent('stateChanged'));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Getters ──

export function getState() { return state; }
export function getCurrentMonth() { return state.currentMonth; }
export function getCategories() { return state.categories; }
export function getCategoryColors() { return CATEGORY_COLORS; }

export function getIncome(month) {
  const m = month || state.currentMonth;
  return state.monthlyIncome[m] || 0;
}

export function hasIncomeForMonth(month) {
  const m = month || state.currentMonth;
  return (state.monthlyIncome[m] || 0) > 0;
}

export function getExpensesForMonth(month) {
  return state.expenses.filter(e => e.date.startsWith(month));
}

export function getExpensesByCategory(categoryId, month) {
  const m = month || state.currentMonth;
  return state.expenses.filter(e => e.categoryId === categoryId && e.date.startsWith(m));
}

export function getCategorySpent(categoryId, month) {
  return getExpensesByCategory(categoryId, month).reduce((s, e) => s + e.amount, 0);
}

export function getTotalAllocated() {
  return state.categories.reduce((s, c) => s + c.limit, 0);
}

export function getUnallocatedBudget(month) {
  return getIncome(month) - getTotalAllocated();
}

export function getTotalSpent(month) {
  return getExpensesForMonth(month || state.currentMonth).reduce((s, e) => s + e.amount, 0);
}

// ── Pacing / Dynamic Warnings ──

export function getDaysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function getCurrentDayOfMonth(monthStr) {
  const now = new Date();
  const [y, m] = monthStr.split('-').map(Number);
  if (now.getFullYear() === y && now.getMonth() + 1 === m) {
    return now.getDate();
  }
  // Past month → treat as fully elapsed; future month → day 0
  const monthDate = new Date(y, m - 1, 1);
  return now > monthDate ? getDaysInMonth(monthStr) : 0;
}

export function getMonthProgress(monthStr) {
  const m = monthStr || state.currentMonth;
  const day = getCurrentDayOfMonth(m);
  const total = getDaysInMonth(m);
  return total > 0 ? day / total : 0;
}

/**
 * Returns pacing status for a category:
 *   'ok'       — spending on pace or under
 *   'ahead'    — spending 20%+ ahead of calendar pace (soft yellow)
 *   'fast'     — spending 50%+ ahead of calendar pace (orange warning)
 *   'exceeded' — hard limit exceeded (existing red)
 */
export function getCategoryPacing(categoryId, monthStr) {
  const m = monthStr || state.currentMonth;
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat || cat.limit <= 0) return { status: 'ok', message: '' };

  const spent = getCategorySpent(categoryId, m);
  const spendRatio = spent / cat.limit;

  // Hard limit exceeded — always top priority
  if (spendRatio >= 1) {
    return {
      status: 'exceeded',
      message: `Перевищено на ${formatNum(spent - cat.limit)} ₴`,
    };
  }

  const monthProgress = getMonthProgress(m);
  if (monthProgress <= 0) return { status: 'ok', message: '' };

  // How far ahead of calendar pace
  // e.g. spent 60% of budget but only 30% of month passed → pace = 2.0
  const pace = spendRatio / monthProgress;

  if (pace >= 1.5) {
    const dayLeft = getDaysInMonth(m) - getCurrentDayOfMonth(m);
    const remaining = cat.limit - spent;
    const perDay = dayLeft > 0 ? Math.round(remaining / dayLeft) : 0;
    return {
      status: 'fast',
      message: `Темп занадто швидкий! Залишилось ~${formatNum(perDay)} ₴/день на ${dayLeft} дн.`,
    };
  }

  if (pace >= 1.2) {
    const expectedSpent = Math.round(cat.limit * monthProgress);
    const overBy = spent - expectedSpent;
    return {
      status: 'ahead',
      message: `Випереджаєте графік на ${formatNum(overBy)} ₴`,
    };
  }

  return { status: 'ok', message: '' };
}

function formatNum(n) {
  return Math.abs(Math.round(n)).toLocaleString('uk-UA');
}

// ── Mutations ──

export function setIncome(amount, month) {
  const m = month || state.currentMonth;
  state.monthlyIncome[m] = Math.max(0, Number(amount) || 0);
  save();
}

export function seedDefaultCategories() {
  if (state.categories.length > 0) return;
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const def = DEFAULT_CATEGORIES[i];
    state.categories.push({
      id: uid('cat'),
      name: def.name,
      limit: 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    });
  }
  save();
}

export function setCurrentMonth(month) {
  state.currentMonth = month;
  save();
}

export function addCategory(name, limit, color) {
  state.categories.push({
    id: uid('cat'),
    name,
    limit: Math.max(0, Number(limit) || 0),
    color: color || CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length],
  });
  save();
}

export function updateCategory(id, updates) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  if (updates.name !== undefined) cat.name = updates.name;
  if (updates.limit !== undefined) cat.limit = Math.max(0, Number(updates.limit) || 0);
  if (updates.color !== undefined) cat.color = updates.color;
  save();
}

export function deleteCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id);
  state.expenses = state.expenses.filter(e => e.categoryId !== id);
  save();
}

export function addExpense(categoryId, amount, description) {
  const today = new Date();
  const m = state.currentMonth.split('-');
  const year = Number(m[0]);
  const month = Number(m[1]);
  let date;
  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    date = today.toISOString().slice(0, 10);
  } else {
    date = `${state.currentMonth}-01`;
  }

  state.expenses.push({
    id: uid('exp'),
    categoryId,
    amount: Math.max(0, Number(amount) || 0),
    description: description || '',
    date,
  });
  save();
}

export function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
}

export function onStateChanged(fn) {
  document.addEventListener('stateChanged', fn);
  return () => document.removeEventListener('stateChanged', fn);
}
