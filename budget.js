var entries = [];

var incomeCategories = ["Salary", "Freelance", "Other Income"];
var pieColors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c"];

function isIncome(category) {
  for (var i = 0; i < incomeCategories.length; i++) {
    if (incomeCategories[i] === category) {
      return true;
    }
  }
  return false;
}

function formatMoney(amount) {
  return "$" + amount.toFixed(2);
}

function updateSummary() {
  var totalIncome = 0;
  var totalExpenses = 0;

  for (var i = 0; i < entries.length; i++) {
    if (isIncome(entries[i].category)) {
      totalIncome = totalIncome + entries[i].amount;
    } else {
      totalExpenses = totalExpenses + entries[i].amount;
    }
  }

  var balance = totalIncome - totalExpenses;

  document.querySelector(".amount.income").textContent = formatMoney(totalIncome);
  document.querySelector(".amount.expense").textContent = formatMoney(totalExpenses);

  var balanceEl = document.querySelector(".amount.balance");
  balanceEl.textContent = formatMoney(balance);

  if (balance < 0) {
    balanceEl.style.color = "#c0392b";
  } else {
    balanceEl.style.color = "#2980b9";
  }
}


function updateTable() {
  var tbody = document.querySelector("table tbody");

  if (entries.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6' class='empty'>No entries yet. Add one above to get started.</td></tr>";
    return;
  }

  var html = "";
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var type = isIncome(e.category) ? "Income" : "Expense";
    var cls  = isIncome(e.category) ? "income" : "expense";
    var sign = isIncome(e.category) ? "+" : "-";

    html = html + "<tr>";
    html = html + "<td>" + e.date + "</td>";
    html = html + "<td>" + e.description + "</td>";
    html = html + "<td>" + e.category + "</td>";
    html = html + "<td class='" + cls + "'>" + type + "</td>";
    html = html + "<td class='" + cls + "'>" + sign + formatMoney(e.amount) + "</td>";
    html = html + "<td><button class='delete-btn' onclick='deleteEntry(" + i + ")'>Delete</button></td>";
    html = html + "</tr>";
  }

  tbody.innerHTML = html;

  var thead = document.querySelector("table thead tr");
  if (thead.children.length === 5) {
    thead.innerHTML = thead.innerHTML + "<th>Delete</th>";
  }
}

function deleteEntry(index) {
  entries.splice(index, 1);
  updateTable();
  updateSummary();
  updateCharts();
}


function drawPie(canvasId, labels, amounts, colors) {
  var canvas = document.getElementById(canvasId);
  var ctx = canvas.getContext("2d");
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var radius = cx - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var total = 0;
  for (var i = 0; i < amounts.length; i++) {
    total = total + amounts[i];
  }

  var startAngle = -Math.PI / 2;
  for (var i = 0; i < amounts.length; i++) {
    var sliceAngle = (amounts[i] / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    startAngle = startAngle + sliceAngle;
  }
}

function buildLegend(labels, amounts, colors) {
  var html = "<div class='pie-legend'>";
  for (var i = 0; i < labels.length; i++) {
    html = html + "<div class='legend-row'>";
    html = html + "<span class='legend-swatch' style='background:" + colors[i] + ";'></span>";
    html = html + "<span class='legend-label'>" + labels[i] + "</span>";
    html = html + "<span class='legend-value'>" + formatMoney(amounts[i]) + "</span>";
    html = html + "</div>";
  }
  html = html + "</div>";
  return html;
}

function updateCategoryChart() {
  var box = document.getElementById("category-chart-box");

  var categoryNames  = [];
  var categoryTotals = [];

  for (var i = 0; i < entries.length; i++) {
    if (!isIncome(entries[i].category)) {
      var cat = entries[i].category;
      var found = false;

      for (var j = 0; j < categoryNames.length; j++) {
        if (categoryNames[j] === cat) {
          categoryTotals[j] = categoryTotals[j] + entries[i].amount;
          found = true;
          break;
        }
      }

      if (!found) {
        categoryNames.push(cat);
        categoryTotals.push(entries[i].amount);
      }
    }
  }

  if (categoryNames.length === 0) {
    box.innerHTML = "<h3>Spending by Category</h3><p class='empty'>Chart will be populated by JS when expense entries are added.</p>";
    return;
  }

  var colors = [];
  for (var k = 0; k < categoryNames.length; k++) {
    colors.push(pieColors[k % pieColors.length]);
  }

  box.innerHTML = "<h3>Spending by Category</h3>"
    + "<canvas id='cat-canvas' width='160' height='160'></canvas>"
    + buildLegend(categoryNames, categoryTotals, colors);

  drawPie("cat-canvas", categoryNames, categoryTotals, colors);
}

function updateIncomeExpenseChart() {
  var box = document.getElementById("income-expense-chart-box");

  var totalIncome = 0;
  var totalExpenses = 0;
  for (var i = 0; i < entries.length; i++) {
    if (isIncome(entries[i].category)) {
      totalIncome = totalIncome + entries[i].amount;
    } else {
      totalExpenses = totalExpenses + entries[i].amount;
    }
  }

  if (totalIncome === 0 && totalExpenses === 0) {
    box.innerHTML = "<h3>Income vs. Expenses</h3><p class='empty'>Chart will be populated by JS when entries are added.</p>";
    return;
  }

  var labels = ["Income", "Expenses"];
  var amounts = [totalIncome, totalExpenses];
  var colors = ["#27ae60", "#c0392b"];

  
  if (totalIncome === 0) {
    amounts = [0.001, totalExpenses];
  }
  if (totalExpenses === 0) {
    amounts = [totalIncome, 0.001];
  }

  box.innerHTML = "<h3>Income vs. Expenses</h3>"
    + "<canvas id='inc-canvas' width='160' height='160'></canvas>"
    + buildLegend(["Income", "Expenses"], [totalIncome, totalExpenses], colors);

  drawPie("inc-canvas", labels, amounts, colors);
}

function updateCharts() {
  updateCategoryChart();
  updateIncomeExpenseChart();
}

document.getElementById("entry-form").addEventListener("submit", function(event) {
  event.preventDefault();

  var description = document.getElementById("description").value;
  var amount      = document.getElementById("amount").value;
  var category    = document.getElementById("category").value;
  var date        = document.getElementById("date").value;

  if (description === "") { alert("Please enter a description."); return; }
  if (amount === "" || parseFloat(amount) <= 0) { alert("Please enter a valid amount."); return; }
  if (category === "") { alert("Please select a category."); return; }
  if (date === "") { alert("Please select a date."); return; }

  entries.push({
    description: description,
    amount: parseFloat(amount),
    category: category,
    date: date
  });

  updateTable();
  updateSummary();
  updateCharts();

  document.getElementById("entry-form").reset();
});