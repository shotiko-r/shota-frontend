const API = "/api";
const STATUS_META = {
  pending: { label: "მისაღები", tone: "pending" },
  in_progress: { label: "მიმდინარეობს", tone: "progress" },
  blocked: { label: "დაბლოკილი", tone: "blocked" },
  done: { label: "დასრულებული", tone: "done" }
};
const PRIORITY_LABELS = {
  urgent: "კრიტიკული",
  high: "მაღალი",
  medium: "საშუალო",
  low: "დაბალი"
};

const state = { tasks: [], users: [], dashboard: null, editingId: null };

function getToken() {
  return localStorage.getItem("token");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
    throw new Error("სესია დასრულდა");
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body.message || "მოთხოვნა ვერ შესრულდა");
  return body;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("toast--error", isError);
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function formatDate(date) {
  if (!date) return "ვადა არ არის";
  return new Intl.DateTimeFormat("ka-GE", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function isOverdue(task) {
  return task.due_date && task.status !== "done" && new Date(`${task.due_date}T00:00:00`) < new Date(new Date().toDateString());
}

function renderMetrics(summary) {
  document.getElementById("metricActive").textContent = (summary.total || 0) - (summary.done || 0);
  document.getElementById("metricProgress").textContent = summary.in_progress || 0;
  document.getElementById("metricBlocked").textContent = summary.blocked || 0;
  document.getElementById("metricOverdue").textContent = summary.overdue || 0;
}

function renderWorkload(workload) {
  const target = document.getElementById("workloadList");
  target.innerHTML = workload.length ? workload.map((person) => `
    <div class="workload-row">
      <span class="workload-row__avatar">${escapeHtml(person.username.slice(0, 1).toUpperCase())}</span>
      <span class="workload-row__name">${escapeHtml(person.username)}</span>
      <span class="workload-row__count">${person.active_tasks} აქტიური</span>
    </div>
  `).join("") : '<p class="empty-state">ტექნიკოსები ჯერ არ არის დამატებული.</p>';
}

function renderUpcoming(tasks) {
  const target = document.getElementById("upcomingList");
  target.innerHTML = tasks.length ? tasks.map((task) => `
    <button class="upcoming-row" type="button" data-edit-task="${task.id}">
      <span class="upcoming-row__date ${isOverdue(task) ? "is-overdue" : ""}">${formatDate(task.due_date)}</span>
      <span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.technician_name)}</small></span>
    </button>
  `).join("") : '<p class="empty-state">ახლო ვადებით დავალებები არ არის.</p>';
}

function taskCard(task) {
  const status = STATUS_META[task.status] || STATUS_META.pending;
  const dueLabel = isOverdue(task) ? "ვადა გასულია" : formatDate(task.due_date);
  return `
    <article class="task-card" data-task-id="${task.id}" draggable="true">
      <div class="task-card__topline">
        <span class="priority-badge priority-badge--${task.priority}">${PRIORITY_LABELS[task.priority] || "საშუალო"}</span>
        <button class="task-card__more" type="button" data-edit-task="${task.id}" aria-label="დავალების რედაქტირება">•••</button>
      </div>
      <button class="task-card__body" type="button" data-edit-task="${task.id}">
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      </button>
      <div class="task-card__meta">
        <span title="ტექნიკოსი">◉ ${escapeHtml(task.technician_name)}</span>
        <span class="task-card__due ${isOverdue(task) ? "is-overdue" : ""}" title="საბოლოო ვადა">◷ ${dueLabel}</span>
      </div>
      <select class="task-card__status status-pill status-pill--${status.tone}" data-status-task="${task.id}" aria-label="${escapeHtml(task.title)} სტატუსი">
        ${Object.entries(STATUS_META).map(([value, meta]) => `<option value="${value}" ${task.status === value ? "selected" : ""}>${meta.label}</option>`).join("")}
      </select>
    </article>
  `;
}

function renderBoard() {
  const query = document.getElementById("taskSearch").value.trim().toLowerCase();
  const priority = document.getElementById("priorityFilter").value;
  const technician = document.getElementById("technicianFilter").value;
  const tasks = state.tasks.filter((task) => {
    const haystack = [task.title, task.description, task.location, task.technician_name].filter(Boolean).join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!priority || task.priority === priority) && (!technician || String(task.technician_id) === technician);
  });

  const columns = ["pending", "in_progress", "blocked", "done"];
  document.getElementById("taskBoard").innerHTML = columns.map((status) => {
    const meta = STATUS_META[status];
    const columnTasks = tasks.filter((task) => task.status === status);
    return `
      <section class="kanban-column kanban-column--${meta.tone}" data-kanban-status="${status}">
        <header class="kanban-column__header">
          <span><i></i>${meta.label}</span>
          <b>${columnTasks.length}</b>
        </header>
        <div class="kanban-column__cards">
          ${columnTasks.length ? columnTasks.map(taskCard).join("") : '<p class="kanban-column__empty">ამ ეტაპზე დავალება არ არის</p>'}
        </div>
      </section>
    `;
  }).join("");
}

function fillTechnicianOptions() {
  const technicians = state.users.filter((user) => user.role === "technician");
  const options = technicians.map((user) => `<option value="${user.id}">${escapeHtml(user.username)} · ${user.active_task_count} აქტიური</option>`).join("");
  document.getElementById("taskTechnician").innerHTML = `<option value="" disabled>აირჩიე ტექნიკოსი</option>${options}`;
  document.getElementById("technicianFilter").innerHTML = `<option value="">ყველა ტექნიკოსი</option>${technicians.map((user) => `<option value="${user.id}">${escapeHtml(user.username)}</option>`).join("")}`;
}

function openTaskDialog(task = null) {
  state.editingId = task?.id || null;
  const form = document.getElementById("taskForm");
  form.reset();
  document.getElementById("taskDialogTitle").textContent = task ? "დავალების რედაქტირება" : "დავალების შექმნა";
  document.getElementById("taskDialogKicker").textContent = task ? `დავალება #${task.id}` : "ახალი სამუშაო";
  document.getElementById("saveTaskButton").textContent = task ? "ცვლილებების შენახვა" : "დავალების შექმნა";

  if (task) {
    document.getElementById("taskTitle").value = task.title || "";
    document.getElementById("taskTechnician").value = task.technician_id;
    document.getElementById("taskPriority").value = task.priority || "medium";
    document.getElementById("taskCategory").value = task.category || "maintenance";
    document.getElementById("taskDueDate").value = task.due_date || "";
    document.getElementById("taskLocation").value = task.location || "";
    document.getElementById("taskPhone").value = task.contact_phone || "";
    document.getElementById("taskStatus").value = task.status || "pending";
    document.getElementById("taskDescription").value = task.description || "";
  }
  document.getElementById("taskDialog").showModal();
}

async function refreshWorkspace() {
  const [dashboard, users, tasks] = await Promise.all([
    request("/dashboard"),
    request("/users"),
    request("/tasks")
  ]);
  state.dashboard = dashboard;
  state.users = users;
  state.tasks = tasks;
  renderMetrics(dashboard.summary);
  renderWorkload(dashboard.workload);
  renderUpcoming(dashboard.upcoming);
  fillTechnicianOptions();
  renderBoard();
}

async function saveTask(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const path = state.editingId ? `/tasks/${state.editingId}` : "/tasks";
  const method = state.editingId ? "PATCH" : "POST";
  try {
    await request(path, { method, body: JSON.stringify(data) });
    document.getElementById("taskDialog").close();
    showToast(state.editingId ? "დავალება განახლდა" : "ახალი დავალება დაემატა");
    await refreshWorkspace();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function updateTaskStatus(id, status) {
  try {
    await request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    showToast("სტატუსი განახლდა");
    await refreshWorkspace();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function exportExcel() {
  try {
    const response = await fetch(`${API}/export`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!response.ok) throw new Error("Excel ექსპორტი ვერ მომზადდა");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(await response.blob());
    link.download = "universalcom-tasks.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    showToast(error.message, true);
  }
}

function setupEvents() {
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("ka-GE", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  document.getElementById("createTaskButton").addEventListener("click", () => openTaskDialog());
  document.getElementById("closeDialogButton").addEventListener("click", () => document.getElementById("taskDialog").close());
  document.getElementById("cancelDialogButton").addEventListener("click", () => document.getElementById("taskDialog").close());
  document.getElementById("taskForm").addEventListener("submit", saveTask);
  document.getElementById("exportButton").addEventListener("click", exportExcel);
  document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
  });
  ["taskSearch", "priorityFilter", "technicianFilter"].forEach((id) => document.getElementById(id).addEventListener("input", renderBoard));
  document.getElementById("taskBoard").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-task]");
    if (button) openTaskDialog(state.tasks.find((task) => task.id === Number(button.dataset.editTask)));
  });
  document.getElementById("taskBoard").addEventListener("change", (event) => {
    if (event.target.matches("[data-status-task]")) updateTaskStatus(event.target.dataset.statusTask, event.target.value);
  });
  document.getElementById("taskBoard").addEventListener("dragstart", (event) => {
    const card = event.target.closest(".task-card");
    if (!card) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.taskId);
    card.classList.add("is-dragging");
  });
  document.getElementById("taskBoard").addEventListener("dragend", (event) => {
    const card = event.target.closest(".task-card");
    if (card) card.classList.remove("is-dragging");
    document.querySelectorAll(".kanban-column.is-drop-target").forEach((column) => column.classList.remove("is-drop-target"));
  });
  document.getElementById("taskBoard").addEventListener("dragover", (event) => {
    const column = event.target.closest("[data-kanban-status]");
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".kanban-column.is-drop-target").forEach((target) => {
      if (target !== column) target.classList.remove("is-drop-target");
    });
    column.classList.add("is-drop-target");
  });
  document.getElementById("taskBoard").addEventListener("dragleave", (event) => {
    const column = event.target.closest("[data-kanban-status]");
    if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-drop-target");
  });
  document.getElementById("taskBoard").addEventListener("drop", (event) => {
    const column = event.target.closest("[data-kanban-status]");
    if (!column) return;
    event.preventDefault();
    column.classList.remove("is-drop-target");
    const taskId = Number(event.dataTransfer.getData("text/plain"));
    const task = state.tasks.find((item) => item.id === taskId);
    if (task && task.status !== column.dataset.kanbanStatus) {
      updateTaskStatus(taskId, column.dataset.kanbanStatus);
    }
  });
  document.getElementById("upcomingList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-task]");
    if (button) openTaskDialog(state.tasks.find((task) => task.id === Number(button.dataset.editTask)));
  });
  document.querySelectorAll("[data-scroll-to]").forEach((button) => button.addEventListener("click", () => {
    document.getElementById(button.dataset.scrollTo).scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

if (!getToken()) {
  window.location.href = "index.html";
} else {
  setupEvents();
  refreshWorkspace().catch((error) => showToast(error.message, true));
}
