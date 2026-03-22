import * as store from './store.js';
import { el, formatMoney, formatDateShort, formatPercent, getProgressClass, clearChildren } from './ui.js';

const view = document.getElementById('view-dashboard');

// Track which inline panels are open
let editingIncome = false;
let addingCategory = false;
let editingCategoryId = null;
let deletingCategoryId = null;

export function render() {
  clearChildren(view);

  const month = store.getCurrentMonth();
  const income = store.getIncome(month);
  const hasIncome = store.hasIncomeForMonth(month);
  const categories = store.getCategories();
  const monthProgress = store.getMonthProgress(month);

  // Income section
  if (!hasIncome || editingIncome) {
    view.append(renderIncomeForm(income, !hasIncome));
  } else {
    view.append(renderIncomeCard(income));
  }

  if (hasIncome) {
    // Month progress
    view.append(renderMonthProgress(monthProgress, month));

    // Unallocated
    view.append(renderUnallocatedCard(income, categories, month));

    // Categories
    if (categories.length > 0) {
      for (const cat of categories) {
        if (editingCategoryId === cat.id) {
          view.append(renderCategoryForm(cat));
        } else if (deletingCategoryId === cat.id) {
          view.append(renderDeleteConfirm(cat));
        } else {
          view.append(renderCategoryCard(cat, month, monthProgress));
        }
      }
    } else {
      view.append(
        el('div', { className: 'empty-state' }, [
          el('div', { className: 'empty-state__icon', textContent: '\uD83D\uDCCA' }),
          el('p', { className: 'empty-state__text', textContent: 'Додайте категорії, щоб розподілити бюджет' }),
        ])
      );
    }

    // Add category
    if (addingCategory) {
      view.append(renderCategoryForm(null));
    } else {
      view.append(
        el('button', {
          className: 'btn btn--outline btn--block btn--lg',
          textContent: '+ Додати категорію',
          onClick: () => { addingCategory = true; render(); },
        })
      );
    }
  }
}

// ── Income ──

function renderIncomeCard(income) {
  return el('div', { className: 'card card--income' }, [
    el('div', { className: 'card__header' }, [
      el('span', { className: 'card__title', textContent: 'Дохід за місяць' }),
      el('button', {
        className: 'btn btn--ghost',
        textContent: 'Змінити',
        onClick: () => { editingIncome = true; render(); },
      }),
    ]),
    el('div', { className: 'card__amount', textContent: formatMoney(income) }),
  ]);
}

function renderIncomeForm(currentIncome, isFirstTime) {
  const input = el('input', {
    className: 'inline-input inline-input--lg',
    type: 'number',
    min: '1',
    step: '1',
    value: currentIncome > 0 ? String(currentIncome) : '',
    placeholder: 'Сума доходу...',
  });

  const form = el('form', {
    className: isFirstTime ? 'card card--income card--income-empty' : 'card card--income',
  });

  const title = el('div', { className: 'card__header' }, [
    el('span', { className: 'card__title', textContent: isFirstTime ? 'Скільки ви заробили цього місяця?' : 'Змінити дохід' }),
  ]);

  const row = el('div', { className: 'inline-row' }, [
    el('span', { className: 'inline-row__prefix', textContent: '₴' }),
    input,
    el('button', { className: 'btn btn--primary', type: 'submit', textContent: 'Зберегти' }),
  ]);

  if (!isFirstTime) {
    row.append(
      el('button', {
        className: 'btn btn--ghost',
        type: 'button',
        textContent: 'Скасувати',
        onClick: () => { editingIncome = false; render(); },
      })
    );
  }

  form.append(title, row);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = Number(input.value);
    if (!val || val <= 0) { input.focus(); return; }
    const month = store.getCurrentMonth();
    const isNew = !store.hasIncomeForMonth(month);
    store.setIncome(val, month);
    if (isNew && store.getCategories().length === 0) {
      store.seedDefaultCategories();
    }
    editingIncome = false;
  });

  setTimeout(() => input.focus(), 30);
  return form;
}

// ── Month Progress ──

function renderMonthProgress(progress, month) {
  const day = store.getCurrentDayOfMonth(month);
  const total = store.getDaysInMonth(month);
  const pct = Math.round(progress * 100);

  return el('div', { className: 'month-progress' }, [
    el('div', { className: 'month-progress__header' }, [
      el('span', { className: 'month-progress__label', textContent: `День ${day} з ${total}` }),
      el('span', { className: 'month-progress__pct', textContent: `${pct}% місяця` }),
    ]),
    el('div', { className: 'month-progress__bar' }, [
      el('div', { className: 'month-progress__fill', style: { width: `${pct}%` } }),
    ]),
  ]);
}

// ── Unallocated ──

function renderUnallocatedCard(income, categories, month) {
  const unallocated = store.getUnallocatedBudget(month);
  const isOverBudget = unallocated < 0;
  const cardClass = isOverBudget ? 'card card--warning-budget' : 'card card--unallocated';
  const ratio = income > 0 ? Math.max(0, unallocated) / income : 0;

  const content = [
    el('div', { className: 'card__header' }, [
      el('span', { className: 'card__title', textContent: 'Нерозподілено' }),
    ]),
    el('div', {
      className: 'card__amount',
      textContent: formatMoney(unallocated),
      style: isOverBudget ? { color: 'var(--color-danger)' } : {},
    }),
  ];

  if (isOverBudget) {
    content.push(
      el('div', {
        className: 'card__subtitle',
        textContent: `Бюджет перевищує дохід на ${formatMoney(Math.abs(unallocated))}`,
        style: { color: 'var(--color-danger)', fontWeight: '600' },
      })
    );
  } else if (categories.length > 0) {
    content.push(
      el('div', { className: 'card__subtitle', textContent: `${formatPercent(ratio)} доходу` })
    );
  }

  return el('div', { className: cardClass }, content);
}

// ── Category Card ──

function renderCategoryCard(cat, month, monthProgress) {
  const spent = store.getCategorySpent(cat.id, month);
  const ratio = cat.limit > 0 ? spent / cat.limit : 0;
  const pacing = store.getCategoryPacing(cat.id, month);
  const isExceeded = pacing.status === 'exceeded';
  const isFast = pacing.status === 'fast';
  const isAhead = pacing.status === 'ahead';

  let cardClass = 'card category';
  if (isExceeded) cardClass += ' card--exceeded';
  else if (isFast) cardClass += ' card--pacing-fast';
  else if (isAhead) cardClass += ' card--pacing-ahead';

  const expenses = store.getExpensesByCategory(cat.id, month);
  const paceMarkerPct = Math.round(monthProgress * 100);

  const children = [
    // Header
    el('div', { className: 'category__header' }, [
      el('div', { className: 'category__name' }, [
        el('span', { className: 'category__color-dot', style: { background: cat.color } }),
        cat.name,
        isExceeded ? el('span', { className: 'badge-exceeded', textContent: 'Перевищено!' }) : null,
      ]),
      el('div', { className: 'category__actions' }, [
        el('button', {
          className: 'icon-btn',
          innerHTML: '&#9998;',
          title: 'Редагувати',
          onClick: () => { editingCategoryId = cat.id; render(); },
        }),
        el('button', {
          className: 'icon-btn icon-btn--danger',
          textContent: '\u2715',
          title: 'Видалити',
          onClick: () => { deletingCategoryId = cat.id; render(); },
        }),
      ]),
    ]),

    // Spent info + progress (only if limit > 0)
    ...(cat.limit > 0 ? [
      el('div', { className: 'category__spent-info' }, [
        el('strong', { textContent: formatMoney(spent) }),
        ` / ${formatMoney(cat.limit)}`,
        `  \u2022  ${formatPercent(ratio)}`,
      ]),
      el('div', { className: 'progress-wrapper' }, [
        el('div', { className: `progress ${getProgressClassWithPacing(pacing.status, ratio)}` }, [
          el('div', {
            className: 'progress__bar',
            style: { width: `${Math.min(ratio * 100, 100)}%` },
          }),
        ]),
        monthProgress > 0 && monthProgress < 1
          ? el('div', {
              className: 'pace-marker',
              style: { left: `${paceMarkerPct}%` },
              title: `Очікуваний темп: ${paceMarkerPct}%`,
            }, [
              el('div', { className: 'pace-marker__line' }),
              el('div', { className: 'pace-marker__label', textContent: `${paceMarkerPct}%` }),
            ])
          : null,
      ]),
    ] : [
      el('div', { className: 'category__no-limit' }, [
        spent > 0
          ? el('span', { textContent: `Витрачено: ${formatMoney(spent)}` })
          : null,
        el('button', {
          className: 'btn btn--outline btn--sm',
          textContent: 'Вказати ліміт',
          onClick: () => { editingCategoryId = cat.id; render(); },
        }),
      ]),
    ]),
  ];

  // Pacing warning
  if (pacing.message) {
    const alertClass = isFast ? 'pace-alert pace-alert--fast' : isAhead ? 'pace-alert pace-alert--ahead' : 'pace-alert pace-alert--exceeded';
    const icon = isFast ? '\u26A0\uFE0F' : isAhead ? '\u23F1\uFE0F' : '\uD83D\uDED1';
    children.push(
      el('div', { className: alertClass }, [
        el('span', { className: 'pace-alert__icon', textContent: icon }),
        el('span', { className: 'pace-alert__text', textContent: pacing.message }),
      ])
    );
  }

  // Expenses
  children.push(...renderExpenseList(expenses, cat.id));

  return el('div', { className: cardClass }, children);
}

function getProgressClassWithPacing(pacingStatus, ratio) {
  if (pacingStatus === 'exceeded') return 'progress--exceeded';
  if (pacingStatus === 'fast') return 'progress--pacing-fast';
  if (pacingStatus === 'ahead') return 'progress--pacing-ahead';
  if (ratio >= 0.9) return 'progress--danger';
  if (ratio >= 0.75) return 'progress--warning';
  return 'progress--ok';
}

// ── Category Inline Form ──

function renderCategoryForm(existing) {
  const colors = store.getCategoryColors();
  let selectedColor = existing?.color || colors[store.getCategories().length % colors.length];

  const nameInput = el('input', {
    className: 'inline-input',
    type: 'text',
    value: existing?.name || '',
    placeholder: 'Назва категорії',
    maxlength: '30',
  });

  const limitInput = el('input', {
    className: 'inline-input',
    type: 'number',
    min: '1',
    step: '1',
    value: existing?.limit ? String(existing.limit) : '',
    placeholder: 'Ліміт ₴',
  });

  const colorContainer = el('div', { className: 'color-options color-options--sm' });
  for (const c of colors) {
    const dot = el('button', {
      className: `color-option color-option--sm${c === selectedColor ? ' color-option--selected' : ''}`,
      type: 'button',
      style: { background: c },
      onClick: () => {
        colorContainer.querySelectorAll('.color-option').forEach(d => d.classList.remove('color-option--selected'));
        dot.classList.add('color-option--selected');
        selectedColor = c;
      },
    });
    colorContainer.append(dot);
  }

  const form = el('form', { className: 'card card--form' });

  const title = el('div', { className: 'card__header' }, [
    el('span', { className: 'card__title', textContent: existing ? 'Редагувати категорію' : 'Нова категорія' }),
  ]);

  const fields = el('div', { className: 'form-fields' }, [
    el('div', { className: 'form-row' }, [nameInput, limitInput]),
    colorContainer,
  ]);

  const actions = el('div', { className: 'form-actions' }, [
    el('button', { className: 'btn btn--primary', type: 'submit', textContent: 'Зберегти' }),
    el('button', {
      className: 'btn btn--ghost',
      type: 'button',
      textContent: 'Скасувати',
      onClick: () => {
        addingCategory = false;
        editingCategoryId = null;
        render();
      },
    }),
  ]);

  form.append(title, fields, actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const limit = Number(limitInput.value);
    if (!name) { nameInput.focus(); return; }
    if (!limit || limit <= 0) { limitInput.focus(); return; }

    if (existing) {
      store.updateCategory(existing.id, { name, limit, color: selectedColor });
      editingCategoryId = null;
    } else {
      store.addCategory(name, limit, selectedColor);
      addingCategory = false;
    }
  });

  setTimeout(() => nameInput.focus(), 30);
  return form;
}

// ── Delete Confirm (inline) ──

function renderDeleteConfirm(cat) {
  return el('div', { className: 'card card--delete-confirm' }, [
    el('div', { className: 'delete-confirm' }, [
      el('span', { className: 'delete-confirm__text' }, [
        `Видалити `,
        el('strong', { textContent: cat.name }),
        ` та всі витрати?`,
      ]),
      el('div', { className: 'delete-confirm__actions' }, [
        el('button', {
          className: 'btn btn--danger',
          textContent: 'Видалити',
          onClick: () => { deletingCategoryId = null; store.deleteCategory(cat.id); },
        }),
        el('button', {
          className: 'btn btn--ghost',
          textContent: 'Ні',
          onClick: () => { deletingCategoryId = null; render(); },
        }),
      ]),
    ]),
  ]);
}

// ── Expenses ──

function renderExpenseList(expenses, categoryId) {
  const items = [];

  if (expenses.length > 0) {
    const list = el('ul', { className: 'expense-list' });
    for (const exp of expenses.sort((a, b) => b.date.localeCompare(a.date))) {
      list.append(
        el('li', { className: 'expense-item' }, [
          el('div', { className: 'expense-item__info' }, [
            el('span', { className: 'expense-item__desc', textContent: exp.description || 'Витрата' }),
            el('span', { className: 'expense-item__date', textContent: formatDateShort(exp.date) }),
          ]),
          el('div', { className: 'expense-item__right' }, [
            el('span', { className: 'expense-item__amount', textContent: formatMoney(exp.amount) }),
            el('button', {
              className: 'icon-btn icon-btn--danger',
              textContent: '\u2715',
              title: 'Видалити',
              onClick: () => store.deleteExpense(exp.id),
            }),
          ]),
        ])
      );
    }
    items.push(list);
  }

  items.push(renderAddExpenseForm(categoryId));
  return items;
}

function renderAddExpenseForm(categoryId) {
  const descInput = el('input', {
    type: 'text',
    placeholder: 'Опис витрати',
    maxlength: '50',
  });
  const amountInput = el('input', {
    type: 'number',
    placeholder: 'Сума',
    min: '1',
    step: '1',
  });

  const form = el('form', { className: 'add-expense-row' }, [
    descInput,
    amountInput,
    el('button', { className: 'btn btn--primary', type: 'submit', textContent: '+' }),
  ]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) { amountInput.focus(); return; }
    store.addExpense(categoryId, amount, descInput.value.trim());
  });

  return form;
}
