/**
 * script.js — Income & Expenses Page
 * Each section has its own "Confirm" button that validates inputs
 * before writing that section's data to sessionStorage.
 *
 * SessionStorage keys
 * ───────────────────
 *   "income"    → Array<IncomeEntry>
 *   "expenses"  → { fixed: Array<ExpenseEntry>, variable: Array<ExpenseEntry> }
 *   "savings"   → Array<SavingsEntry>
 *   "summary"   → pre-computed monthly totals
 *
 * Object shapes
 * ─────────────
 *   IncomeEntry   { id, label, amount, frequency, monthlyEquivalent }
 *   ExpenseEntry  { id, name, amount, frequency, monthlyEquivalent }
 *   SavingsEntry  { id, goal, targetPrice, targetDate, weeksToGoal, monthsToGoal }
 */

// ─── Frequency → monthly multiplier ─────────────────────────────────────────
const FREQ_TO_MONTHLY = {
  daily:       365 / 12,
  weekly:      52  / 12,
  biweekly:    26  / 12,
  semimonthly: 2,
  monthly:     1,
  quarterly:   1  / 3,
  annually:    1  / 12,
};

function toMonthly(amount, frequency) {
  const multiplier = FREQ_TO_MONTHLY[frequency];
  return multiplier != null ? parseFloat((amount * multiplier).toFixed(2)) : null;
}

function fmt(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function markInvalid(input, message) {
  input.classList.add('field-error');
  let errEl = input.parentElement.querySelector('.error-msg');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'error-msg';
    input.parentElement.appendChild(errEl);
  }
  errEl.textContent = message;
  return false;
}

function clearInvalid(input) {
  input.classList.remove('field-error');
  const errEl = input.parentElement.querySelector('.error-msg');
  if (errEl) errEl.textContent = '';
}

function clearAllErrors(container) {
  container.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  container.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
}

function validateRow(row, config) {
  let valid = true;

  config.forEach(({ selector, type, label, required }) => {
    const el = row.querySelector(selector);
    if (!el) return;
    clearInvalid(el);

    const val = el.value.trim();

    if (required && !val) {
      markInvalid(el, `${label} is required.`);
      valid = false;
      return;
    }

    if (type === 'number' && val !== '') {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) {
        markInvalid(el, `${label} must be a positive number.`);
        valid = false;
      }
    }

    if (type === 'date' && val !== '') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosen = new Date(val);
      if (chosen < today) {
        markInvalid(el, `${label} must be today or in the future.`);
        valid = false;
      }
    }
  });

  return valid;
}

// ─── Row validation configs ──────────────────────────────────────────────────

const INCOME_ROW_CONFIG = [
  { selector: 'input[type="text"]',   type: 'text',   label: 'Source / Label', required: true  },
  { selector: 'input[type="number"]', type: 'number', label: 'Amount',         required: true  },
  { selector: 'select',               type: 'select', label: 'Frequency',      required: true  },
];

const FIXED_EXP_ROW_CONFIG = [
  { selector: 'input[type="text"]',   type: 'text',   label: 'Expense Name', required: true  },
  { selector: 'input[type="number"]', type: 'number', label: 'Amount',       required: true  },
  { selector: 'select',               type: 'select', label: 'Frequency',    required: true  },
];

const VAR_EXP_ROW_CONFIG = [
  { selector: 'input[type="text"]',   type: 'text',   label: 'Category', required: true  },
  { selector: 'input[type="number"]', type: 'number', label: 'Amount',   required: true  },
  { selector: 'select',               type: 'select', label: 'Per',      required: true  },
];

const SAVINGS_ROW_CONFIG = [
  { selector: 'input[type="text"]',   type: 'text',   label: 'Item / Goal',  required: true  },
  { selector: 'input[type="number"]', type: 'number', label: 'Target Price', required: true  },
  { selector: 'input[type="date"]',   type: 'date',   label: 'Target Date',  required: false },
];

// ─── Section feedback ────────────────────────────────────────────────────────

function showSectionFeedback(section, type, message) {
  let fb = section.querySelector('.section-feedback');
  if (!fb) {
    fb = document.createElement('p');
    fb.className = 'section-feedback';
    const confirmBtn = section.querySelector('.btn-confirm');
    confirmBtn.parentElement.insertBefore(fb, confirmBtn);
  }
  fb.className = `section-feedback feedback-${type}`;
  fb.textContent = message;

  if (type === 'success') {
    setTimeout(() => { fb.textContent = ''; fb.className = 'section-feedback'; }, 4000);
  }
}

// ─── Generic "add row" cloner ────────────────────────────────────────────────

function addRow(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.entry-row');
  const newIndex = rows.length + 1;
  const clone = rows[0].cloneNode(true);

  clone.querySelectorAll('input, select').forEach(el => {
    el.value = '';
    el.classList.remove('field-error');
    if (el.id) el.id = el.id.replace(/-\d+$/, `-${newIndex}`);
  });
  clone.querySelectorAll('label').forEach(label => {
    const forAttr = label.getAttribute('for');
    if (forAttr) label.setAttribute('for', forAttr.replace(/-\d+$/, `-${newIndex}`));
  });
  clone.querySelectorAll('.error-msg').forEach(el => el.remove());

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-row';
  removeBtn.textContent = '✕';
  removeBtn.setAttribute('aria-label', 'Remove row');
  removeBtn.addEventListener('click', () => clone.remove());
  clone.appendChild(removeBtn);

  container.appendChild(clone);
}

// ─── Collectors ──────────────────────────────────────────────────────────────

function collectIncome() {
  return Array.from(document.querySelectorAll('#income-entries .entry-row')).map((row, i) => {
    const label     = row.querySelector('input[type="text"]')?.value.trim()        || '';
    const amount    = parseFloat(row.querySelector('input[type="number"]')?.value) || 0;
    const frequency = row.querySelector('select')?.value                           || '';
    return { id: i + 1, label, amount, frequency, monthlyEquivalent: toMonthly(amount, frequency) };
  });
}

function collectFixedExpenses() {
  return Array.from(document.querySelectorAll('#expense-fixed-entries .entry-row')).map((row, i) => {
    const name      = row.querySelector('input[type="text"]')?.value.trim()        || '';
    const amount    = parseFloat(row.querySelector('input[type="number"]')?.value) || 0;
    const frequency = row.querySelector('select')?.value                           || '';
    return { id: i + 1, name, amount, frequency, monthlyEquivalent: toMonthly(amount, frequency) };
  });
}

function collectVariableExpenses() {
  return Array.from(document.querySelectorAll('#expense-variable-entries .entry-row')).map((row, i) => {
    const name      = row.querySelector('input[type="text"]')?.value.trim()        || '';
    const amount    = parseFloat(row.querySelector('input[type="number"]')?.value) || 0;
    const frequency = row.querySelector('select')?.value                           || '';
    return { id: i + 1, name, amount, frequency, monthlyEquivalent: toMonthly(amount, frequency) };
  });
}

function collectSavings() {
  return Array.from(document.querySelectorAll('#savings-entries .entry-row')).map((row, i) => {
    const goal        = row.querySelector('input[type="text"]')?.value.trim()          || '';
    const targetPrice = parseFloat(row.querySelector('input[type="number"]')?.value)   || 0;
    const targetDate  = row.querySelector('input[type="date"]')?.value                 || null;

    let weeksToGoal = null, monthsToGoal = null;
    if (targetDate) {
      const diffMs = new Date(targetDate) - new Date();
      if (diffMs > 0) {
        const days   = diffMs / (1000 * 60 * 60 * 24);
        weeksToGoal  = parseFloat((days / 7).toFixed(1));
        monthsToGoal = parseFloat((days / 30.44).toFixed(1));
      }
    }
    return { id: i + 1, goal, targetPrice, targetDate, weeksToGoal, monthsToGoal };
  });
}

// ─── Rebuild summary from current storage ────────────────────────────────────

function rebuildSummary() {
  const income   = JSON.parse(sessionStorage.getItem('income')   || '[]');
  const expenses = JSON.parse(sessionStorage.getItem('expenses') || '{"fixed":[],"variable":[]}');
  const savings  = JSON.parse(sessionStorage.getItem('savings')  || '[]');

  const totalMonthlyIncome   = income.reduce((s, e) => s + (e.monthlyEquivalent ?? 0), 0);
  const totalMonthlyFixed    = expenses.fixed.reduce((s, e) => s + (e.monthlyEquivalent ?? 0), 0);
  const totalMonthlyVariable = expenses.variable.reduce((s, e) => s + (e.monthlyEquivalent ?? 0), 0);
  const totalMonthlyExpenses = totalMonthlyFixed + totalMonthlyVariable;
  const netMonthlyCashFlow   = parseFloat((totalMonthlyIncome - totalMonthlyExpenses).toFixed(2));

  const summary = {
    totalMonthlyIncome:   parseFloat(totalMonthlyIncome.toFixed(2)),
    totalMonthlyFixed:    parseFloat(totalMonthlyFixed.toFixed(2)),
    totalMonthlyVariable: parseFloat(totalMonthlyVariable.toFixed(2)),
    totalMonthlyExpenses: parseFloat(totalMonthlyExpenses.toFixed(2)),
    netMonthlyCashFlow,
    lastUpdated: new Date().toISOString(),
  };

  sessionStorage.setItem('summary', JSON.stringify(summary));
  updateSummaryBanner(summary, savings);
}

// ─── Summary banner ──────────────────────────────────────────────────────────

function updateSummaryBanner(summary, savings) {
  const banner = document.getElementById('budget-summary-banner');
  if (!banner) return; // banner is static HTML; nothing to do if missing

  const { netMonthlyCashFlow } = summary;
  const sign     = netMonthlyCashFlow >= 0 ? '+' : '';
  const netClass = netMonthlyCashFlow >= 0 ? 'positive' : 'negative';

  // ── Summary cards ──
  banner.querySelector('#sum-income').textContent  = `$${fmt(summary.totalMonthlyIncome)}`;
  banner.querySelector('#sum-expense').textContent = `$${fmt(summary.totalMonthlyExpenses)}`;  
    `Fixed $${fmt(summary.totalMonthlyFixed)} + Variable $${fmt(summary.totalMonthlyVariable)}`;

  const netEl = banner.querySelector('#sum-net');
  netEl.textContent = `${sign}$${fmt(Math.abs(netMonthlyCashFlow))}/mo`;
  const netCard = banner.querySelector('.card-net');
  netCard.classList.remove('positive', 'negative');
  netCard.classList.add(netClass);

  // ── Savings timeline ──
  const savingsList    = banner.querySelector('#summary-savings-list');
  const savingsSection = banner.querySelector('#summary-savings-section');
  const savingsEmpty   = banner.querySelector('#summary-savings-empty');

  const hints = savings.filter(s => s.targetPrice > 0);

  if (hints.length) {
    savingsSection.hidden = false;
    savingsEmpty.hidden   = true;
    savingsList.innerHTML = hints.map(s => {
      const months = netMonthlyCashFlow > 0
        ? (s.targetPrice / netMonthlyCashFlow).toFixed(1)
        : '∞';
      const dateNote = s.targetDate ? ` · Due ${s.targetDate}` : '';
      return `
        <li>
          <span class="goal-name">${s.goal || 'Unnamed Goal'}</span>
          <span class="goal-meta">$${fmt(s.targetPrice)}${dateNote} — ~${months} mo at current surplus</span>
        </li>`;
    }).join('');
  } else {
    savingsSection.hidden = false;
    savingsEmpty.hidden   = false;
    savingsList.innerHTML = '';
  }

  // ── Last updated ──
  if (summary.lastUpdated) {
    const d = new Date(summary.lastUpdated);
    banner.querySelector('#sum-updated').textContent =
      `Last updated: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

// ─── Per-section confirm handlers ────────────────────────────────────────────

function confirmIncome() {
  const section = document.querySelector('.income-section');
  clearAllErrors(section);

  const rows    = [...document.querySelectorAll('#income-entries .entry-row')];
  const allValid = rows.every(row => validateRow(row, INCOME_ROW_CONFIG));

  if (!allValid) {
    showSectionFeedback(section, 'error', '⚠ Please fix the errors above before saving.');
    return;
  }

  sessionStorage.setItem('income', JSON.stringify(collectIncome()));
  rebuildSummary();
  showSectionFeedback(section, 'success', '✓ Income saved successfully!');
}

function confirmFixed() {
  const section = document.querySelector('.expense-section');
  const fixedRows = [...document.querySelectorAll('#expense-fixed-entries .entry-row')];
  
  // only clear errors inside the fixed sub-group
  fixedRows.forEach(row => clearAllErrors(row));

  const allValid = fixedRows.every(row => validateRow(row, FIXED_EXP_ROW_CONFIG));
  if (!allValid) {
    showSectionFeedback(section, 'error', '⚠ Please fix the errors in Fixed / Recurring before saving.');
    return;
  }

  const current = JSON.parse(sessionStorage.getItem('expenses') || '{"fixed":[],"variable":[]}');
  current.fixed = collectFixedExpenses();
  sessionStorage.setItem('expenses', JSON.stringify(current));
  rebuildSummary();
  showSectionFeedback(section, 'success', '✓ Fixed expenses saved!');
}

function confirmVariable() {
  const section = document.querySelector('.expense-section');
  const variableRows = [...document.querySelectorAll('#expense-variable-entries .entry-row')];

  variableRows.forEach(row => clearAllErrors(row));

  const allValid = variableRows.every(row => validateRow(row, VAR_EXP_ROW_CONFIG));
  if (!allValid) {
    showSectionFeedback(section, 'error', '⚠ Please fix the errors in Variable / Estimated before saving.');
    return;
  }

  const current = JSON.parse(sessionStorage.getItem('expenses') || '{"fixed":[],"variable":[]}');
  current.variable = collectVariableExpenses();
  sessionStorage.setItem('expenses', JSON.stringify(current));
  rebuildSummary();
  showSectionFeedback(section, 'success', '✓ Variable expenses saved!');
}

function confirmSavings() {
  const section = document.querySelector('.savings-section');
  clearAllErrors(section);

  const rows     = [...document.querySelectorAll('#savings-entries .entry-row')];
  const allValid = rows.every(row => validateRow(row, SAVINGS_ROW_CONFIG));

  if (!allValid) {
    showSectionFeedback(section, 'error', '⚠ Please fix the errors above before saving.');
    return;
  }

  sessionStorage.setItem('savings', JSON.stringify(collectSavings()));
  rebuildSummary();
  showSectionFeedback(section, 'success', '✓ Savings goals saved successfully!');
}

// ─── Inject confirm buttons ──────────────────────────────────────────────────

function injectConfirmButtons() {
  // Income confirm
  const incomeBtn = document.createElement('button');
  incomeBtn.type = 'button';
  incomeBtn.className = 'btn-confirm';
  incomeBtn.textContent = 'Confirm Income';
  incomeBtn.addEventListener('click', confirmIncome);
  document.querySelector('.income-section .section-body').appendChild(incomeBtn);

  // Fixed expenses confirm — inserted right after the fixed "add" button
  const fixedBtn = document.createElement('button');
  fixedBtn.type = 'button';
  fixedBtn.className = 'btn-confirm';
  fixedBtn.textContent = 'Confirm Fixed Expenses';
  fixedBtn.addEventListener('click', confirmFixed);
  const divider = document.querySelector('.expense-section .divider');
  divider.parentElement.insertBefore(fixedBtn, divider);

  // Variable expenses confirm — appended at the end of the section
  const varBtn = document.createElement('button');
  varBtn.type = 'button';
  varBtn.className = 'btn-confirm';
  varBtn.textContent = 'Confirm Variable Expenses';
  varBtn.addEventListener('click', confirmVariable);
  document.querySelector('.expense-section .section-body').appendChild(varBtn);

  // Savings confirm
  const savingsBtn = document.createElement('button');
  savingsBtn.type = 'button';
  savingsBtn.className = 'btn-confirm';
  savingsBtn.textContent = 'Confirm Savings Goals';
  savingsBtn.addEventListener('click', confirmSavings);
  document.querySelector('.savings-section .section-body').appendChild(savingsBtn);
}

// ─── Wire "add row" buttons ──────────────────────────────────────────────────

function wireAddRowButtons() {
  const map = [
    { text: '+ Add another income source', id: 'income-entries'            },
    { text: '+ Add fixed expense',          id: 'expense-fixed-entries'    },
    { text: '+ Add variable expense',       id: 'expense-variable-entries' },
    { text: '+ Add savings goal',           id: 'savings-entries'          },
  ];

  document.querySelectorAll('.btn-add-row').forEach(btn => {
    const match = map.find(m => btn.textContent.trim() === m.text);
    if (match) btn.addEventListener('click', () => addRow(match.id));
  });
}

// ─── Restore from sessionStorage ─────────────────────────────────────────────

function restoreRows(containerId, entries, filler) {
  if (!entries.length) return;
  const container = document.getElementById(containerId);

  entries.forEach((entry, i) => {
    if (i > 0) addRow(containerId);
    const rows = container.querySelectorAll('.entry-row');
    filler(rows[i], entry);
  });
}

function restoreFromStorage() {
  const savedIncome   = JSON.parse(sessionStorage.getItem('income')   || '[]');
  const savedExpenses = JSON.parse(sessionStorage.getItem('expenses') || '{"fixed":[],"variable":[]}');
  const savedSavings  = JSON.parse(sessionStorage.getItem('savings')  || '[]');

  restoreRows('income-entries', savedIncome, (row, e) => {
    row.querySelector('input[type="text"]').value   = e.label     || '';
    row.querySelector('input[type="number"]').value = e.amount    || '';
    row.querySelector('select').value               = e.frequency || '';
  });

  restoreRows('expense-fixed-entries', savedExpenses.fixed, (row, e) => {
    row.querySelector('input[type="text"]').value   = e.name      || '';
    row.querySelector('input[type="number"]').value = e.amount    || '';
    row.querySelector('select').value               = e.frequency || '';
  });

  restoreRows('expense-variable-entries', savedExpenses.variable, (row, e) => {
    row.querySelector('input[type="text"]').value   = e.name      || '';
    row.querySelector('input[type="number"]').value = e.amount    || '';
    row.querySelector('select').value               = e.frequency || '';
  });

  restoreRows('savings-entries', savedSavings, (row, e) => {
    row.querySelector('input[type="text"]').value   = e.goal        || '';
    row.querySelector('input[type="number"]').value = e.targetPrice || '';
    row.querySelector('input[type="date"]').value   = e.targetDate  || '';
  });

  rebuildSummary();
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  injectConfirmButtons();
  wireAddRowButtons();
  restoreFromStorage();
});


// ─── Public API (for other pages) ───────────────────────────────────────────
/**
 * Other pages can read budget data like so:
 *
 *   const income   = JSON.parse(sessionStorage.getItem('income')   || '[]');
 *   const expenses = JSON.parse(sessionStorage.getItem('expenses') || '{"fixed":[],"variable":[]}');
 *   const savings  = JSON.parse(sessionStorage.getItem('savings')  || '[]');
 *   const summary  = JSON.parse(sessionStorage.getItem('summary')  || '{}');
 */
