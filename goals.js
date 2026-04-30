function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

let goals = [];
let budgetHistory = [];
let budgetLimits = [];

function saveGoals() {
  localStorage.setItem('goals_goals', JSON.stringify(goals));
}

function saveHistory() {
  localStorage.setItem('goals_history', JSON.stringify(budgetHistory));
}

function saveLimits() {
  localStorage.setItem('goals_limits', JSON.stringify(budgetLimits));
}

function renderGoals() {
  const container = document.getElementById('goals-container');
  container.innerHTML = '';

  if (goals.length === 0) {
    container.innerHTML = '<p class="no-goals">No goals yet. Add one above!</p>';
    return;
  }

  goals.forEach((g, idx) => {
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    const remaining = Math.max(0, g.target - g.saved);

    const card = document.createElement('div');
    card.className = 'box goal-card';
    card.innerHTML = `
      <div class="goal-card-header">
        <h4>${escapeHTML(g.name)}</h4>
        <button class="delete-btn" data-index="${idx}" aria-label="Delete goal">✕</button>
      </div>
      <p>$${g.saved.toLocaleString()} / $${g.target.toLocaleString()}</p>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
      <p>${pct}% &mdash; $${remaining.toLocaleString()} remaining</p>
      <div class="update-row">
        <label for="add-amount-${idx}" class="sr-only">Add savings</label>
        <input type="number" id="add-amount-${idx}" class="add-input" placeholder="Add $" min="0" step="0.01">
        <button class="add-btn" data-index="${idx}">+ Add</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      goals.splice(idx, 1);
      saveGoals();
      renderGoals();
      showToast('Goal deleted.');
    });
  });

  container.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const input = document.getElementById(`add-amount-${idx}`);
      const amount = parseFloat(input.value);
      if (isNaN(amount) || amount <= 0) {
        showToast('Enter a positive amount.', 'error');
        return;
      }
      const goalName = goals[idx].name;
      goals[idx].saved = Math.min(goals[idx].target, goals[idx].saved + amount);
      input.value = '';
      saveGoals();
      renderGoals();
      showToast(`Added $${amount.toFixed(2)} to "${goalName}".`);
    });
  });
}

function renderHistory(data) {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';
  data.forEach(row => {
    const balance = row.income - row.expenses;
    const balanceClass = balance >= 0 ? 'income' : 'expense';
    const balanceLabel = balance >= 0
      ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `-$${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(row.month)}</td>
      <td class="income">$${row.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="expense">$${row.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="${balanceClass}">${balanceLabel}</td>
      <td>$${row.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(tr);
  });
}

function applyHistoryFilter(val) {
  let filtered = [...budgetHistory];
  if (val === 'positive') {
    filtered = filtered.filter(r => r.income - r.expenses >= 0);
  } else if (val === 'negative') {
    filtered = filtered.filter(r => r.income - r.expenses < 0);
  } else if (val === 'savings') {
    filtered = [...filtered].sort((a, b) => b.savings - a.savings);
  }
  renderHistory(filtered);
}

function initHistoryFilter() {
  const filterSelect = document.getElementById('history-filter');
  filterSelect.addEventListener('change', () => {
    applyHistoryFilter(filterSelect.value);
  });
}

function renderLimits() {
  const display = document.getElementById('budget-limit-display');
  display.innerHTML = '';
  budgetLimits.forEach((limit, idx) => {
    const card = document.createElement('div');
    card.className = 'limit-card';
    card.innerHTML = `
      <span class="limit-badge">${escapeHTML(limit.category)}</span>
      <strong>${escapeHTML(limit.monthLabel)}</strong>: $${limit.amount.toFixed(2)} limit
      <button class="delete-limit-btn" aria-label="Remove limit">✕</button>
    `;
    card.querySelector('.delete-limit-btn').addEventListener('click', () => {
      budgetLimits.splice(idx, 1);
      saveLimits();
      renderLimits();
    });
    display.appendChild(card);
  });
}

function initGoalForm() {
  const form = document.getElementById('goal-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();
    const nameEl     = document.getElementById('goal-name');
    const targetEl   = document.getElementById('target-amount');
    const savedEl    = document.getElementById('saved-so-far');
    const priorityEl = document.getElementById('goal-priority');
    const name   = nameEl.value.trim();
    const target = parseFloat(targetEl.value);
    const saved  = parseFloat(savedEl.value) || 0;
    let valid = true;
    if (!name) {
      showError(nameEl, 'Goal name is required.');
      valid = false;
    } else if (name.length > 50) {
      showError(nameEl, 'Name must be 50 characters or fewer.');
      valid = false;
    }
    if (isNaN(target) || target <= 0) {
      showError(targetEl, 'Enter a positive target amount.');
      valid = false;
    }
    if (saved < 0) {
      showError(savedEl, 'Saved amount cannot be negative.');
      valid = false;
    }
    if (!isNaN(target) && saved > target) {
      showError(savedEl, 'Saved amount cannot exceed target.');
      valid = false;
    }
    if (!valid) return;
    const priority = priorityEl.value;
    const newGoal = { name, saved, target };
    if (priority === 'high') {
      goals.unshift(newGoal);
    } else {
      goals.push(newGoal);
    }
    form.reset();
    saveGoals();
    renderGoals();
    showToast(`Goal "${escapeHTML(name)}" added!`);
  });
  const resetBtn = document.getElementById('form-reset');
  resetBtn.addEventListener('click', () => {
    clearErrors();
  });
}

function showError(inputEl, message) {
  inputEl.classList.add('input-error');
  const errSpan = document.createElement('span');
  errSpan.className = 'error-msg';
  errSpan.textContent = message;
  inputEl.parentNode.appendChild(errSpan);
}

function clearErrors() {
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-msg').forEach(el => el.remove());
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function initBudgetLimitForm() {
  const form = document.getElementById('budget-limit-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const monthEl    = document.getElementById('budget-month');
    const limitEl    = document.getElementById('monthly-limit');
    const categoryEl = document.getElementById('limit-category');
    const month    = monthEl.value;
    const limit    = parseFloat(limitEl.value);
    const category = categoryEl.value;
    let valid = true;
    clearBudgetErrors();
    if (!month) {
      showBudgetError(monthEl, 'Select a month.');
      valid = false;
    }
    if (isNaN(limit) || limit <= 0) {
      showBudgetError(limitEl, 'Enter a positive limit.');
      valid = false;
    }
    if (!valid) return;
    const monthLabel = new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
    budgetLimits.push({ category, monthLabel, amount: limit });
    saveLimits();
    renderLimits();
    form.reset();
    showToast(`Budget limit set for ${monthLabel}.`);
  });
}

function initHistoryForm() {
  const form = document.getElementById('history-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const monthEl    = document.getElementById('history-month');
    const incomeEl   = document.getElementById('history-income');
    const expensesEl = document.getElementById('history-expenses');
    const savingsEl  = document.getElementById('history-savings');
    const month    = monthEl.value.trim();
    const income   = parseFloat(incomeEl.value);
    const expenses = parseFloat(expensesEl.value);
    const savings  = parseFloat(savingsEl.value) || 0;
    let valid = true;
    document.querySelectorAll('#history-form .input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('#history-form .error-msg').forEach(el => el.remove());
    if (!month) {
      showBudgetError(monthEl, 'Month is required.');
      valid = false;
    }
    if (isNaN(income) || income < 0) {
      showBudgetError(incomeEl, 'Enter a valid income.');
      valid = false;
    }
    if (isNaN(expenses) || expenses < 0) {
      showBudgetError(expensesEl, 'Enter a valid expense amount.');
      valid = false;
    }
    if (savings < 0) {
      showBudgetError(savingsEl, 'Savings cannot be negative.');
      valid = false;
    }
    if (!valid) return;
    budgetHistory.push({ month, income, expenses, savings });
    saveHistory();
    form.reset();
    renderHistory(budgetHistory);
    showToast(`Entry for "${escapeHTML(month)}" added!`);
  });
}

function showBudgetError(el, msg) {
  el.classList.add('input-error');
  const s = document.createElement('span');
  s.className = 'error-msg';
  s.textContent = msg;
  el.parentNode.appendChild(s);
}

function clearBudgetErrors() {
  document.querySelectorAll('#budget-limit-form .input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('#budget-limit-form .error-msg').forEach(el => el.remove());
}

document.addEventListener('DOMContentLoaded', () => {
  const storedGoals = localStorage.getItem('goals_goals');
  if (storedGoals) {
    goals = JSON.parse(storedGoals);
  } else {
    const savedSavings = JSON.parse(sessionStorage.getItem('savings') || '[]');
    savedSavings.forEach(s => {
      if (!s.goal || s.targetPrice <= 0) return;
      const alreadyExists = goals.some(g => g.name === s.goal);
      if (!alreadyExists) {
        goals.push({ name: s.goal, saved: 0, target: s.targetPrice });
      }
    });
  }

  const storedHistory = localStorage.getItem('goals_history');
  if (storedHistory) {
    budgetHistory = JSON.parse(storedHistory);
  }

  const storedLimits = localStorage.getItem('goals_limits');
  if (storedLimits) {
    budgetLimits = JSON.parse(storedLimits);
  }

  renderGoals();
  renderHistory(budgetHistory);
  renderLimits();
  initGoalForm();
  initHistoryFilter();
  initHistoryForm();
  initBudgetLimitForm();
});
