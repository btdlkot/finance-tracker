import * as store from './store.js';
import { el, formatMoney, formatPercent, getProgressClass, clearChildren } from './ui.js';

const view = document.getElementById('view-statistics');

export function render() {
  clearChildren(view);

  const month = store.getCurrentMonth();
  const income = store.getIncome(month);
  const categories = store.getCategories();
  const totalSpent = store.getTotalSpent(month);
  const remaining = income - totalSpent;

  if (income === 0) {
    view.append(
      el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-state__icon', textContent: '\uD83D\uDCC8' }),
        el('p', { className: 'empty-state__text', textContent: 'Вкажіть дохід та додайте витрати, щоб побачити статистику' }),
      ])
    );
    return;
  }

  // Overview boxes
  view.append(renderOverview(income, totalSpent, remaining));

  // Donut chart
  if (categories.length > 0) {
    view.append(renderDonut(income, categories, month));
  }

  // Detail table
  view.append(renderDetailTable(income, categories, month));
}

function renderOverview(income, totalSpent, remaining) {
  return el('div', { className: 'stat-overview' }, [
    el('div', { className: 'stat-box' }, [
      el('div', { className: 'stat-box__label', textContent: 'Дохід' }),
      el('div', { className: 'stat-box__value', textContent: formatMoney(income) }),
    ]),
    el('div', { className: 'stat-box' }, [
      el('div', { className: 'stat-box__label', textContent: 'Витрачено' }),
      el('div', {
        className: `stat-box__value${totalSpent > income ? ' stat-box__value--danger' : ''}`,
        textContent: formatMoney(totalSpent),
      }),
    ]),
    el('div', { className: 'stat-box' }, [
      el('div', { className: 'stat-box__label', textContent: 'Залишок' }),
      el('div', {
        className: `stat-box__value${remaining >= 0 ? ' stat-box__value--success' : ' stat-box__value--danger'}`,
        textContent: formatMoney(remaining),
      }),
    ]),
  ]);
}

function renderDonut(income, categories, month) {
  const segments = [];
  let totalPercent = 0;

  for (const cat of categories) {
    const spent = store.getCategorySpent(cat.id, month);
    if (spent <= 0) continue;
    const pct = income > 0 ? (spent / income) * 100 : 0;
    segments.push({ name: cat.name, color: cat.color, percent: pct, spent });
    totalPercent += pct;
  }

  // Remaining segment
  const remainingPct = Math.max(0, 100 - totalPercent);
  if (remainingPct > 0) {
    segments.push({ name: 'Залишок', color: '#E0E0E0', percent: remainingPct, spent: 0 });
  }

  // Build conic gradient
  let gradient;
  if (segments.length === 0 || totalPercent === 0) {
    gradient = 'conic-gradient(#E0E0E0 0% 100%)';
  } else {
    const stops = [];
    let cumulative = 0;
    for (const seg of segments) {
      stops.push(`${seg.color} ${cumulative}% ${cumulative + seg.percent}%`);
      cumulative += seg.percent;
    }
    gradient = `conic-gradient(${stops.join(', ')})`;
  }

  const totalSpent = store.getTotalSpent(month);
  const spentRatio = income > 0 ? totalSpent / income : 0;

  const donut = el('div', { className: 'donut', style: { background: gradient } }, [
    el('div', { className: 'donut__hole' }, [
      el('span', { className: 'donut__hole-value', textContent: formatPercent(spentRatio) }),
      el('span', { className: 'donut__hole-label', textContent: 'витрачено' }),
    ]),
  ]);

  // Legend
  const legendItems = segments.filter(s => s.spent > 0).map(seg =>
    el('div', { className: 'legend-item' }, [
      el('span', { className: 'legend-dot', style: { background: seg.color } }),
      `${seg.name} \u2022 ${formatMoney(seg.spent)} \u2022 ${formatPercent(seg.percent / 100)}`,
    ])
  );

  const legend = el('div', { className: 'donut-legend' }, legendItems);

  return el('div', { className: 'card' }, [
    el('div', { className: 'card__header' }, [
      el('span', { className: 'card__title', textContent: 'Розподіл витрат' }),
    ]),
    el('div', { className: 'donut-container' }, [donut, legend]),
  ]);
}

function renderDetailTable(income, categories, month) {
  const rows = [];

  for (const cat of categories) {
    const spent = store.getCategorySpent(cat.id, month);
    const ratio = cat.limit > 0 ? spent / cat.limit : 0;
    const incomeRatio = income > 0 ? spent / income : 0;
    const progressClass = getProgressClass(spent, cat.limit);

    rows.push(
      el('div', { className: 'stats-row' }, [
        el('div', { className: 'stats-row__name' }, [
          el('span', { className: 'legend-dot', style: { background: cat.color } }),
          cat.name,
        ]),
        el('div', { className: 'stats-row__amounts' }, [
          `${formatMoney(spent)} / ${formatMoney(cat.limit)}`,
        ]),
        el('div', { className: 'stats-row__percent', textContent: formatPercent(incomeRatio) }),
        el('div', { className: 'stats-row__bar' }, [
          el('div', {
            className: `stats-row__bar-fill`,
            style: {
              width: `${Math.min(ratio * 100, 100)}%`,
              background: ratio >= 1 ? 'var(--color-danger)' : ratio >= 0.75 ? 'var(--color-warning)' : cat.color,
            },
          }),
        ]),
      ])
    );
  }

  // Unallocated row
  const unallocated = store.getUnallocatedBudget(month);
  if (unallocated > 0) {
    const unallocatedSpent = income - store.getTotalSpent(month) - categories.reduce((s, c) => {
      return s + Math.max(0, c.limit - store.getCategorySpent(c.id, month));
    }, 0);

    rows.push(
      el('div', { className: 'stats-row' }, [
        el('div', { className: 'stats-row__name' }, [
          el('span', { className: 'legend-dot', style: { background: 'var(--color-unallocated)' } }),
          'Нерозподілено',
        ]),
        el('div', { className: 'stats-row__amounts', textContent: formatMoney(unallocated) }),
        el('div', {
          className: 'stats-row__percent',
          textContent: income > 0 ? formatPercent(unallocated / income) : '0%',
        }),
      ])
    );
  }

  if (rows.length === 0) {
    return el('div');
  }

  return el('div', { className: 'card' }, [
    el('div', { className: 'card__header' }, [
      el('span', { className: 'card__title', textContent: 'Деталі по категоріях' }),
    ]),
    el('div', { className: 'stats-table' }, rows),
  ]);
}
