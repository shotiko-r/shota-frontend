// views/overview.js — dashboard overview (metrics, workload, upcoming).
// Uses GET /dashboard. Admin: full scope; manager: department scope.
// Technicians never call /dashboard (backend denies reports.read).

const OverviewView = {
  loaded: false,

  async init() {
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    this.bindUpcoming();
    await this.refresh();
  },

  bindUpcoming() {
    const list = document.getElementById("upcomingList");
    if (list) {
      list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-edit-task]");
        if (button) {
          const id = Number(button.dataset.editTask);
          BoardView.openTask(id);
        }
      });
    }
  },

  async refresh() {
    try {
      const dashboard = await apiGet("/dashboard");
      if (dashboard && dashboard.summary) renderMetrics(dashboard.summary);
      if (dashboard && dashboard.workload) renderWorkload(dashboard.workload);
      if (dashboard && dashboard.upcoming) renderUpcoming(dashboard.upcoming);
    } catch (error) {
      showToast(error.message, true);
    }
  }
};

function renderMetrics(summary) {
  const active = document.getElementById("metricActive");
  const progress = document.getElementById("metricProgress");
  const blocked = document.getElementById("metricBlocked");
  const overdue = document.getElementById("metricOverdue");
  if (active) active.textContent = String((summary.total || 0) - (summary.done || 0));
  if (progress) progress.textContent = String(summary.in_progress || 0);
  if (blocked) blocked.textContent = String(summary.blocked || 0);
  if (overdue) overdue.textContent = String(summary.overdue || 0);
}

function renderWorkload(workload) {
  const target = document.getElementById("workloadList");
  if (!target) return;
  if (!workload || !workload.length) {
    target.innerHTML = emptyState("ტექნიკოსები ჯერ არ არის დამატებული.");
    return;
  }
  target.innerHTML = workload
    .map(
      (person) => `
        <div class="workload-row">
          <span class="workload-row__avatar">${esc((person.username || "?").slice(0, 1).toUpperCase())}</span>
          <span class="workload-row__name">${esc(person.username)}</span>
          <span class="workload-row__count">${person.active_tasks || 0} აქტიური</span>
        </div>
      `
    )
    .join("");
}

function renderUpcoming(tasks) {
  const target = document.getElementById("upcomingList");
  if (!target) return;
  if (!tasks || !tasks.length) {
    target.innerHTML = emptyState("ახლო ვადებით დავალებები არ არის.");
    return;
  }
  target.innerHTML = tasks
    .map((task) => `
        <button class="upcoming-row" type="button" data-edit-task="${task.id}">
          <span class="upcoming-row__date ${isOverdue(task) ? "is-overdue" : ""}">${esc(formatDate(task.due_date))}</span>
          <span><strong>${esc(task.title)}</strong><small>${esc(task.technician_name || "")}</small></span>
        </button>
      `)
    .join("");
}