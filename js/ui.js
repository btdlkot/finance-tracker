const MONTHS_UA = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') element.className = val;
    else if (key === 'textContent') element.textContent = val;
    else if (key === 'innerHTML') element.innerHTML = val;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') Object.assign(element.style, val);
    else element.setAttribute(key, val);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

export function formatMoney(n) {
  const num = Math.round(Number(n) || 0);
  const formatted = Math.abs(num).toLocaleString('uk-UA');
  return `${num < 0 ? '-' : ''}${formatted} \u20B4`;
}

export function formatPercent(ratio) {
  return `${Math.round(ratio * 1000) / 10}%`;
}

export function formatDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

export function formatDateShort(isoStr) {
  if (!isoStr) return '';
  const [, m, d] = isoStr.split('-');
  return `${d}.${m}`;
}

export function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  return `${MONTHS_UA[Number(m) - 1]} ${y}`;
}

export function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getProgressClass(spent, limit) {
  if (limit === 0) return 'progress--ok';
  const ratio = spent / limit;
  if (ratio >= 1) return 'progress--exceeded';
  if (ratio >= 0.9) return 'progress--danger';
  if (ratio >= 0.75) return 'progress--warning';
  return 'progress--ok';
}

export function clearChildren(element) {
  element.innerHTML = '';
}
