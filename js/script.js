/**
 * Expense & Budget Visualizer
 * js/script.js — State, business logic, rendering, event listeners
 *
 * Architecture: unidirectional data flow
 *   User Action → mutate state → saveState() → render()
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY          = 'ebt_transactions';
const CUSTOM_CATEGORIES_KEY = 'ebt_custom_categories';

/** Category metadata: emoji + CSS class */
const CATEGORY_META = {
  'Food':       { emoji: '🍔', cls: 'cat-food' },
  'Transport':  { emoji: '🚗', cls: 'cat-transport' },
  'Fun':        { emoji: '🎉', cls: 'cat-fun' },
  'Education':  { emoji: '📚', cls: 'cat-education' },
  'Health':     { emoji: '🏥', cls: 'cat-health' },
};

/** Chart.js colour palette per category */
const CATEGORY_COLORS = {
  'Food':       '#FF6B35',
  'Transport':  '#1976D2',
  'Fun':        '#7B1FA2',
  'Education':  '#00897B',
  'Health':     '#E53935',
};

const FALLBACK_COLORS = [
  '#FF6B35','#F7C948','#1976D2','#7B1FA2','#00897B',
  '#E53935','#0288D1','#F57C00','#388E3C','#5D4037',
];

/* ═══════════════════════════════════════════════════════════════
   2. STATE
   ═══════════════════════════════════════════════════════════════ */

/** @type {Array<{id:number, date:string, name:string, amount:number, category:string}>} */
let state = [];

/** Current sort mode */
let sortMode = 'default';

/** Currently selected month for filtering ("YYYY-MM" or null = show all) */
let selectedMonth = null;

/** Chart.js instances */
let pieChartInstance  = null;
let lineChartInstance = null;

/* ═══════════════════════════════════════════════════════════════
   3. LOCALSTORAGE HELPERS
   ═══════════════════════════════════════════════════════════════ */

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* quota exceeded or private mode — continue in-memory */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (_) {
    return [];
  }
}

/* ── Custom Categories ── */

function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => typeof c === 'string' && c.trim() !== '');
  } catch (_) {
    return [];
  }
}

function saveCustomCategories(categories) {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  } catch (_) { /* quota exceeded or private mode — continue in-memory */ }
}

/* ═══════════════════════════════════════════════════════════════
   4. UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Format number as Indonesian Rupiah using Intl.NumberFormat.
 * e.g. 1500000 → "Rp 1.500.000"
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format ISO date string → "15 Jul 2025"
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) { return ''; }
}

/**
 * ISO string → "YYYY-MM" key for monthly grouping.
 * @param {string} isoString
 * @returns {string}
 */
function getMonthKey(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "YYYY-MM" → "Jul 2025"
 * @param {string} key
 * @returns {string}
 */
function monthKeyToLabel(key) {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get category emoji, fallback to 💸
 * @param {string} category
 * @returns {string}
 */
function getCategoryEmoji(category) {
  return (CATEGORY_META[category] || {}).emoji || '💸';
}

/**
 * Get category CSS class, fallback to cat-other
 * @param {string} category
 * @returns {string}
 */
function getCategoryClass(category) {
  return (CATEGORY_META[category] || {}).cls || 'cat-other';
}

/* ═══════════════════════════════════════════════════════════════
   5. DERIVED DATA HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns a filtered view of state for the selected month.
 * Does NOT mutate the global state array.
 * @returns {Array}
 */
function getFilteredState() {
  if (!selectedMonth) return state;
  return state.filter((t) => getMonthKey(t.date) === selectedMonth);
}

function calcTotal() {
  return getFilteredState().reduce((sum, t) => sum + t.amount, 0);
}

function groupByCategory() {
  return getFilteredState().reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}

/**
 * Group amounts by "YYYY-MM", sorted chronologically.
 * @returns {Array<[string, number]>}
 */
function groupByMonth() {
  const map = state.reduce((acc, t) => {
    const key = getMonthKey(t.date);
    acc[key] = (acc[key] || 0) + t.amount;
    return acc;
  }, {});
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Calculate month-over-month variance %.
 * Returns { current, previous, pct, direction } or null if < 2 months.
 */
function calcMoMVariance() {
  const entries = groupByMonth();
  if (entries.length < 2) return null;
  const prev    = entries[entries.length - 2][1];
  const current = entries[entries.length - 1][1];
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return {
    current,
    previous: prev,
    pct: Math.abs(pct).toFixed(1),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

function getSortedState() {
  const copy = [...getFilteredState()];
  switch (sortMode) {
    case 'amount-desc':   return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':    return copy.sort((a, b) => a.amount - b.amount);
    case 'category-az':   return copy.sort((a, b) => a.category.localeCompare(b.category));
    default:              return copy.reverse(); // newest first
  }
}

/* ═══════════════════════════════════════════════════════════════
   6. VALIDATION
   ═══════════════════════════════════════════════════════════════ */

function validateForm(name, amountRaw, category) {
  const errors = {};

  if (!name || name.trim() === '') {
    errors.name = 'Nama item wajib diisi.';
  }

  const amount = parseFloat(amountRaw);
  if (amountRaw === '' || amountRaw === null || amountRaw === undefined) {
    errors.amount = 'Jumlah wajib diisi.';
  } else if (isNaN(amount) || amount <= 0) {
    errors.amount = 'Jumlah harus berupa angka positif.';
  }

  if (!category || category.trim() === '') {
    errors.category = 'Pilih kategori terlebih dahulu.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/* ═══════════════════════════════════════════════════════════════
   7. FORM ERROR DISPLAY
   ═══════════════════════════════════════════════════════════════ */

function clearFormErrors() {
  ['item-name', 'amount', 'category'].forEach((field) => {
    const errorEl = document.getElementById(`error-${field}`);
    if (field === 'category') {
      const customSelect = document.getElementById('custom-category-select');
      if (customSelect) customSelect.classList.remove('is-invalid');
    } else {
      const input = document.getElementById(field);
      if (input) input.classList.remove('is-invalid');
    }
    if (errorEl) errorEl.textContent = '';
  });
}

function showFormErrors(errors) {
  const fieldMap = { name: 'item-name', amount: 'amount', category: 'category' };
  let firstInvalid = null;

  Object.entries(fieldMap).forEach(([key, fieldId]) => {
    const errorEl = document.getElementById(`error-${fieldId}`);
    if (errors[key]) {
      if (fieldId === 'category') {
        const customSelect = document.getElementById('custom-category-select');
        if (customSelect) {
          customSelect.classList.add('is-invalid');
          if (!firstInvalid) firstInvalid = customSelect;
        }
      } else {
        const input = document.getElementById(fieldId);
        if (input) {
          input.classList.add('is-invalid');
          if (!firstInvalid) firstInvalid = input;
        }
      }
      if (errorEl) errorEl.textContent = errors[key];
    }
  });

  if (firstInvalid) firstInvalid.focus();
}

/* ═══════════════════════════════════════════════════════════════
   8. TRANSACTION OPERATIONS
   ═══════════════════════════════════════════════════════════════ */

function addTransaction(name, amount, category) {
  state.push({
    id:       Date.now(),
    date:     new Date().toISOString(),
    name:     name.trim(),
    amount:   parseFloat(amount),
    category: category.trim(),
  });
  saveState();
  render();
}

function deleteTransaction(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  state = state.filter((t) => t.id !== id);
  saveState();
  render();
}

/* ═══════════════════════════════════════════════════════════════
   9. CHART RENDERING
   ═══════════════════════════════════════════════════════════════ */

function renderPieChart() {
  const canvas   = document.getElementById('pie-chart');
  const emptyMsg = document.getElementById('pie-empty');
  if (!canvas) return;

  const byCategory = groupByCategory();
  const labels     = Object.keys(byCategory);
  const data       = Object.values(byCategory);
  const hasData    = labels.length > 0;

  if (emptyMsg) emptyMsg.style.display = hasData ? 'none' : 'block';
  canvas.style.display = hasData ? 'block' : 'none';

  if (!hasData) {
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    return;
  }

  if (typeof Chart === 'undefined') {
    canvas.style.display = 'none';
    if (emptyMsg) { emptyMsg.textContent = 'Chart tidak tersedia (CDN gagal dimuat).'; emptyMsg.style.display = 'block'; }
    return;
  }

  const bgColors = labels.map((l, i) => CATEGORY_COLORS[l] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);

  if (pieChartInstance) {
    pieChartInstance.data.labels                    = labels;
    pieChartInstance.data.datasets[0].data          = data;
    pieChartInstance.data.datasets[0].backgroundColor = bgColors;
    pieChartInstance.update();
    return;
  }

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: 'transparent',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#555770',
            font: { size: 11 },
            padding: 10,
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/**
 * Line chart — monthly spending curve with MoM comparison.
 */
function renderLineChart() {
  const canvas   = document.getElementById('line-chart');
  const emptyMsg = document.getElementById('line-empty');
  if (!canvas) return;

  const monthlyEntries = groupByMonth();
  const hasData        = monthlyEntries.length > 0;

  if (emptyMsg) emptyMsg.style.display = hasData ? 'none' : 'block';
  canvas.style.display = hasData ? 'block' : 'none';

  if (!hasData) {
    if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }
    return;
  }

  if (typeof Chart === 'undefined') {
    canvas.style.display = 'none';
    if (emptyMsg) { emptyMsg.textContent = 'Chart tidak tersedia (CDN gagal dimuat).'; emptyMsg.style.display = 'block'; }
    return;
  }

  const labels = monthlyEntries.map(([key]) => monthKeyToLabel(key));
  const data   = monthlyEntries.map(([, val]) => val);

  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#555770';

  if (lineChartInstance) {
    lineChartInstance.data.labels            = labels;
    lineChartInstance.data.datasets[0].data  = data;
    lineChartInstance.update();
    return;
  }

  lineChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Pengeluaran',
        data,
        borderColor: '#FF6B35',
        backgroundColor: 'rgba(255,107,53,0.10)',
        borderWidth: 2.5,
        pointBackgroundColor: '#FF6B35',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 10 } },
          grid:  { color: 'rgba(0,0,0,0.05)' },
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 10 },
            callback: (val) => formatCurrency(val),
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   10. MONTHLY SUMMARY RENDERING
   ═══════════════════════════════════════════════════════════════ */

function renderMonthlySummary() {
  const body = document.getElementById('monthly-summary-body');
  if (!body) return;

  // Use filtered state for the summary
  const filtered = getFilteredState();

  if (filtered.length === 0) {
    const msg = selectedMonth
      ? 'Tidak ada pengeluaran untuk bulan ini.'
      : 'Belum ada data. Tambah pengeluaran untuk melihat ringkasan bulanan.';
    body.innerHTML = `<p class="monthly-empty">${msg}</p>`;
    return;
  }

  // Group filtered state by month
  const map = filtered.reduce((acc, t) => {
    const key = getMonthKey(t.date);
    acc[key] = (acc[key] || 0) + t.amount;
    return acc;
  }, {});
  const monthlyEntries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));

  const rows = [...monthlyEntries].reverse().map(([key, total]) => {
    const count = filtered.filter((t) => getMonthKey(t.date) === key).length;
    return `
      <tr>
        <td>${escapeHtml(monthKeyToLabel(key))}</td>
        <td>${count} transaksi</td>
        <td>${formatCurrency(total)}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <table class="monthly-table" aria-label="Ringkasan pengeluaran bulanan">
      <thead>
        <tr>
          <th>Bulan</th>
          <th>Transaksi</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   11. CUSTOM CATEGORIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Add a new custom category: validate, persist, update the select and custom dropdown.
 */
function addCustomCategory(name) {
  const errorEl = document.getElementById('error-custom-category');
  const input   = document.getElementById('custom-category-input');

  // Clear previous error
  if (errorEl) errorEl.textContent = '';
  if (input)   input.classList.remove('is-invalid');

  const trimmed = (name || '').trim();
  if (!trimmed) {
    if (errorEl) errorEl.textContent = 'Nama kategori tidak boleh kosong.';
    if (input)   input.classList.add('is-invalid');
    if (input)   input.focus();
    return;
  }

  const select = document.getElementById('category');

  // Check for duplicate (case-insensitive)
  if (select) {
    const existing = Array.from(select.options).map((o) => o.value.toLowerCase());
    if (existing.includes(trimmed.toLowerCase())) {
      if (errorEl) errorEl.textContent = 'Kategori ini sudah ada.';
      if (input)   input.classList.add('is-invalid');
      if (input)   input.focus();
      return;
    }
  }

  // Persist
  const saved = loadCustomCategories();
  saved.push(trimmed);
  saveCustomCategories(saved);

  // Append option to hidden native select
  if (select) {
    const option = document.createElement('option');
    option.value       = trimmed;
    option.textContent = trimmed;
    select.appendChild(option);
  }

  // Append option to custom dropdown
  addOptionToCustomDropdown(trimmed, trimmed);

  // Clear input
  if (input) { input.value = ''; input.focus(); }
}

/**
 * Append a new option to the custom dropdown UI.
 */
function addOptionToCustomDropdown(value, label) {
  const dropdown = document.querySelector('#custom-category-select .custom-select-dropdown');
  if (!dropdown) return;
  const li = document.createElement('li');
  li.className = 'custom-select-option';
  li.setAttribute('role', 'option');
  li.setAttribute('data-value', value);
  li.textContent = label;
  dropdown.appendChild(li);
  // Wire hover/click for the new option
  wireCustomSelectOption(li);
}

/**
 * Wire click event for a single custom-select option.
 */
function wireCustomSelectOption(li) {
  li.addEventListener('click', () => {
    const wrapper = li.closest('.custom-select');
    selectCustomOption(wrapper, li.dataset.value, li.textContent);
  });
}

/* ═══════════════════════════════════════════════════════════════
   11b. CUSTOM SELECT INITIALISATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Set the selected value on a custom dropdown and sync the hidden native select.
 */
function selectCustomOption(wrapper, value, label) {
  if (!wrapper) return;

  const display    = wrapper.querySelector('.custom-select-value');
  const nativeSelect = document.getElementById('category');
  const dropdown   = wrapper.querySelector('.custom-select-dropdown');

  // Update display text
  if (display) {
    display.textContent = label;
    display.classList.toggle('placeholder', value === '');
  }

  // Sync hidden native select
  if (nativeSelect) nativeSelect.value = value;

  // Update aria-selected on options
  if (dropdown) {
    dropdown.querySelectorAll('.custom-select-option').forEach((opt) => {
      opt.setAttribute('aria-selected', opt.dataset.value === value ? 'true' : 'false');
    });
  }

  // Close dropdown
  wrapper.setAttribute('aria-expanded', 'false');
}

/**
 * Initialise the custom category dropdown: open/close, keyboard nav, outside-click.
 */
function initCustomSelect() {
  const wrapper  = document.getElementById('custom-category-select');
  if (!wrapper) return;

  const trigger  = wrapper.querySelector('.custom-select-trigger');
  const dropdown = wrapper.querySelector('.custom-select-dropdown');

  // Open / close on trigger click
  trigger.addEventListener('click', () => {
    const isOpen = wrapper.getAttribute('aria-expanded') === 'true';
    wrapper.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  // Wire existing options
  dropdown.querySelectorAll('.custom-select-option').forEach((li) => {
    wireCustomSelectOption(li);
  });

  // Keyboard navigation
  wrapper.addEventListener('keydown', (e) => {
    const isOpen = wrapper.getAttribute('aria-expanded') === 'true';
    const options = [...dropdown.querySelectorAll('.custom-select-option')];
    const current = dropdown.querySelector('[aria-selected="true"]');
    const idx     = options.indexOf(current);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          wrapper.setAttribute('aria-expanded', 'true');
        } else if (current) {
          selectCustomOption(wrapper, current.dataset.value, current.textContent);
        }
        break;
      case 'Escape':
        wrapper.setAttribute('aria-expanded', 'false');
        wrapper.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) { wrapper.setAttribute('aria-expanded', 'true'); break; }
        if (idx < options.length - 1) options[idx + 1].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (idx > 0) options[idx - 1].focus();
        break;
      case 'Tab':
        wrapper.setAttribute('aria-expanded', 'false');
        break;
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Reset the custom dropdown to its placeholder state.
 */
function resetCustomSelect() {
  const wrapper  = document.getElementById('custom-category-select');
  if (!wrapper) return;
  selectCustomOption(wrapper, '', '— Pilih kategori —');
  const display = wrapper.querySelector('.custom-select-value');
  if (display) display.classList.add('placeholder');
}



/** IntersectionObserver instance for active-month detection */
let monthObserver = null;

function renderMonthSelector() {
  const nav = document.getElementById('month-selector');
  if (!nav) return;

  // Disconnect previous observer
  if (monthObserver) { monthObserver.disconnect(); monthObserver = null; }

  // Derive distinct months from full state (not filtered)
  const months = [...new Set(state.map((t) => getMonthKey(t.date)))].sort();

  if (months.length === 0) {
    nav.innerHTML = '';
    nav.style.display = 'none';
    return;
  }

  nav.style.display = '';

  nav.innerHTML = months.map((key) => {
    const isActive = key === selectedMonth;
    return `<button
      class="month-label${isActive ? ' active-month' : ''}"
      data-month="${escapeHtml(key)}"
      aria-pressed="${isActive}"
      type="button"
    >${escapeHtml(monthKeyToLabel(key))}</button>`;
  }).join('');

  // Wire click listeners
  nav.querySelectorAll('.month-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      const month = btn.dataset.month;
      // Toggle: clicking the active month deselects it (show all)
      selectedMonth = (selectedMonth === month) ? null : month;
      render();
      // Scroll the active button into center view
      if (selectedMonth) {
        const activeBtn = nav.querySelector('.month-label.active-month');
        if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  });

  // IntersectionObserver to highlight the centered button
  const observerOptions = {
    root: nav,
    rootMargin: '0px -40% 0px -40%', // only the center 20% of the nav
    threshold: 0.5,
  };

  monthObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Only update visual highlight via observer when no month is explicitly selected
        if (!selectedMonth) {
          nav.querySelectorAll('.month-label').forEach((b) => b.classList.remove('active-month'));
          entry.target.classList.add('active-month');
        }
      }
    });
  }, observerOptions);

  nav.querySelectorAll('.month-label').forEach((btn) => monthObserver.observe(btn));
}

/* ═══════════════════════════════════════════════════════════════
   13. VARIANCE DISPLAY
   ═══════════════════════════════════════════════════════════════ */

function renderVariance() {
  const el = document.getElementById('variance-row');
  if (!el) return;

  const v = calcMoMVariance();
  if (!v) { el.innerHTML = ''; return; }

  const arrow = v.direction === 'up' ? '↑' : v.direction === 'down' ? '↓' : '→';
  const cls   = `variance-${v.direction}`;
  const label = v.direction === 'up'
    ? `${arrow} Naik ${v.pct}% dari bulan lalu`
    : v.direction === 'down'
    ? `${arrow} Turun ${v.pct}% dari bulan lalu`
    : `→ Sama dengan bulan lalu`;

  el.innerHTML = `<span class="${cls}">${label}</span>`;
}

/* ═══════════════════════════════════════════════════════════════
   14. MAIN RENDER FUNCTION
   ═══════════════════════════════════════════════════════════════ */

function render() {
  const sorted   = getSortedState();
  const filtered = getFilteredState();

  // ── Month Selector ──
  renderMonthSelector();

  // ── Total Balance (filtered) ──
  const totalEl = document.getElementById('total-balance');
  if (totalEl) totalEl.textContent = formatCurrency(calcTotal());

  // ── Transaction Count (filtered) ──
  const countEl = document.getElementById('transaction-count');
  if (countEl) countEl.textContent = filtered.length;

  // ── Variance (always uses full state) ──
  renderVariance();

  // ── Transaction List ──
  const listEl = document.getElementById('transaction-list');
  if (listEl) {
    if (sorted.length === 0) {
      const msg = selectedMonth
        ? 'Tidak ada pengeluaran untuk bulan ini.'
        : 'Belum ada pengeluaran.<br>Tambah pengeluaran pertama Anda di atas.';
      listEl.innerHTML = `
        <li class="empty-state" role="status">
          <span class="empty-state-icon" aria-hidden="true">💸</span>
          ${msg}
        </li>
      `;
    } else {
      listEl.innerHTML = sorted.map((t) => `
        <li class="transaction-item" data-id="${t.id}">
          <div class="category-icon ${getCategoryClass(t.category)}" aria-hidden="true">
            ${getCategoryEmoji(t.category)}
          </div>
          <div class="transaction-details">
            <div class="transaction-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
            <div class="transaction-meta">${escapeHtml(t.category)} · ${formatDate(t.date)}</div>
          </div>
          <span class="transaction-amount">-${formatCurrency(t.amount)}</span>
          <button
            class="btn-delete"
            data-id="${t.id}"
            aria-label="Hapus: ${escapeHtml(t.name)}"
            title="Hapus"
          >✕</button>
        </li>
      `).join('');
    }
  }

  // ── Charts ──
  renderPieChart();
  renderLineChart();

  // ── Monthly Summary ──
  renderMonthlySummary();
}

/* ═══════════════════════════════════════════════════════════════
   15. EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // Init state
  state = loadState();

  // Init custom category dropdown
  initCustomSelect();

  // Load and populate custom categories into the hidden select and custom dropdown
  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    loadCustomCategories().forEach((name) => {
      const option = document.createElement('option');
      option.value       = name;
      option.textContent = name;
      categorySelect.appendChild(option);
      // Also add to custom dropdown UI
      addOptionToCustomDropdown(name, name);
    });
  }

  render();

  // Form submit
  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFormErrors();

      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('amount');
      const categoryInput = document.getElementById('category');

      const name      = nameInput     ? nameInput.value     : '';
      const amountRaw = amountInput   ? amountInput.value   : '';
      const category  = categoryInput ? categoryInput.value : '';

      const { valid, errors } = validateForm(name, amountRaw, category);
      if (!valid) { showFormErrors(errors); return; }

      addTransaction(name, parseFloat(amountRaw), category);
      form.reset();
      resetCustomSelect();
      if (nameInput) nameInput.focus();
    });
  }

  // Delete (event delegation)
  const listEl = document.getElementById('transaction-list');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!isNaN(id)) deleteTransaction(id);
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortMode = sortSelect.value;
      render();
    });
  }

  // Custom category
  const addCatBtn = document.getElementById('add-custom-category-btn');
  if (addCatBtn) {
    addCatBtn.addEventListener('click', () => {
      const input = document.getElementById('custom-category-input');
      addCustomCategory(input ? input.value : '');
    });
  }

  // Allow pressing Enter in the custom category input
  const customCatInput = document.getElementById('custom-category-input');
  if (customCatInput) {
    customCatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomCategory(customCatInput.value);
      }
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon   = document.getElementById('theme-icon');
  const html        = document.documentElement;

  // Restore saved theme
  const savedTheme = (() => {
    try { return localStorage.getItem('ebt_theme'); } catch (_) { return null; }
  })();
  if (savedTheme === 'dark') {
    html.setAttribute('data-theme', 'dark');
    if (themeIcon) themeIcon.textContent = '☀';
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      if (themeIcon) themeIcon.textContent = next === 'dark' ? '☀' : '☾';
      try { localStorage.setItem('ebt_theme', next); } catch (_) { /* ignore */ }

      // Recreate charts for new theme colours
      if (pieChartInstance)  { pieChartInstance.destroy();  pieChartInstance  = null; }
      if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }
      render();
    });
  }

});
