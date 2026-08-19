// views/board.js — the task board (kanban) with filters, create/edit dialogs,
// status changes, drag & drop and export. Uses only verified task endpoints:
// GET/POST /tasks, PATCH /tasks/:id, PUT /tasks/:id/complete, GET /export.

const BoardView = {
  tasks: [],
  users: [],
  editingId: null,
  canCreate: false,
  canManage: false,
  loaded: false,

  async init(options = {}) {
    this.canCreate = Boolean(options.canCreate);
    this.canManage = Boolean(options.canManage);
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    this.applyRoleVisibility();
    this.bindEvents();
    await this.refresh();
  },

  applyRoleVisibility() {
    const toggle = (element, visible) => {
      if (element) element.classList.toggle("is-hidden", !visible);
    };
    toggle(document.getElementById("createTaskButton"), this.canCreate);
    toggle(document.getElementById("createTaskButtonBoard"), this.canCreate);
    toggle(document.getElementById("technicianFilter"), this.canManage);
  },

  bindEvents() {
    const createButtons = [
      document.getElementById("createTaskButton"),
      document.getElementById("createTaskButtonBoard")
    ];
    createButtons.forEach((button) => {
      if (button) button.addEventListener("click", () => this.openCreateDialog());
    });

    const form = document.getElementById("taskForm");
    if (form) form.addEventListener("submit", (event) => this.saveTask(event));

    const exportButton = document.getElementById("exportButton");
    if (exportButton) exportButton.addEventListener("click", () => this.exportExcel());

    ["taskSearch", "priorityFilter", "technicianFilter"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("input", () => this.renderBoard());
    });

    const board = document.getElementById("taskBoard");
    if (!board) return;

    board.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-task]");
      if (editButton) {
        const id = Number(editButton.dataset.editTask);
        this.openTask(id);
      }
    });

    board.addEventListener("change", (event) => {
      const statusSelect = event.target.closest("[data-status-task]");
      if (statusSelect) this.handleStatusChange(statusSelect);
    });

    board.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".task-card");
      if (!card) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.taskId);
      card.classList.add("is-dragging");
    });

    board.addEventListener("dragend", (event) => {
      const card = event.target.closest(".task-card");
      if (card) card.classList.remove("is-dragging");
      document.querySelectorAll(".kanban-column.is-drop-target").forEach((column) => {
        column.classList.remove("is-drop-target");
      });
    });

    board.addEventListener("dragover", (event) => {
      const column = event.target.closest("[data-kanban-status]");
      if (!column) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".kanban-column.is-drop-target").forEach((target) => {
        if (target !== column) target.classList.remove("is-drop-target");
      });
      column.classList.add("is-drop-target");
    });

    board.addEventListener("dragleave", (event) => {
      const column = event.target.closest("[data-kanban-status]");
      if (column && !column.contains(event.relatedTarget)) {
        column.classList.remove("is-drop-target");
      }
    });

    board.addEventListener("drop", (event) => {
      const column = event.target.closest("[data-kanban-status]");
      if (!column) return;
      event.preventDefault();
      column.classList.remove("is-drop-target");
      const taskId = Number(event.dataTransfer.getData("text/plain"));
      const task = this.tasks.find((item) => item.id === taskId);
      if (task && task.status !== column.dataset.kanbanStatus) {
        this.moveTask(task, column.dataset.kanbanStatus);
      }
    });
  },

  async refresh() {
    const target = document.getElementById("taskBoard");
    if (target) setLoading(target, true);
    try {
      const requests = [apiGet("/tasks")];
      if (this.canManage) requests.push(apiGet("/users"));
      const [tasks, users] = await Promise.all(requests);
      this.tasks = tasks || [];
      this.users = users || [];
      this.fillTechnicianOptions();
      this.renderBoard();
    } catch (error) {
      if (target) target.innerHTML = errorState(error.message);
      showToast(error.message, true);
    }
  },

  fillTechnicianOptions() {
    const technicians = this.users.filter((user) => user.role === "technician");
    const techSelect = document.getElementById("taskTechnician");
    if (techSelect) {
      techSelect.innerHTML = `<option value="" disabled>აირჩიე ტექნიკოსი</option>${technicians
        .map((user) => `<option value="${user.id}">${esc(user.username)}${user.active_task_count ? ` · ${user.active_task_count} აქტიური` : ""}</option>`)
        .join("")}`;
    }
    const filterSelect = document.getElementById("technicianFilter");
    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">ყველა ტექნიკოსი</option>${technicians
        .map((user) => `<option value="${user.id}">${esc(user.username)}</option>`)
        .join("")}`;
    }
  },

  filteredTasks() {
    const query = (document.getElementById("taskSearch")?.value || "").trim().toLowerCase();
    const priority = document.getElementById("priorityFilter")?.value || "";
    const technician = document.getElementById("technicianFilter")?.value || "";
    return this.tasks.filter((task) => {
      const haystack = [task.title, task.description, task.location, task.technician_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (!priority || task.priority === priority) &&
        (!technician || String(task.technician_id) === technician)
      );
    });
  },

  renderBoard() {
    const board = document.getElementById("taskBoard");
    if (!board) return;
    board.removeAttribute("aria-busy");
    const tasks = this.filteredTasks();

    board.innerHTML = STATUS_ORDER.map((status) => {
      const meta = STATUS_META[status] || STATUS_META.pending;
      const columnTasks = tasks.filter((task) => task.status === status);
      return `
        <section class="kanban-column kanban-column--${meta.tone}" data-kanban-status="${status}">
          <header class="kanban-column__header">
            <span><i></i>${meta.label}</span>
            <b>${columnTasks.length}</b>
          </header>
          <div class="kanban-column__cards">
            ${columnTasks.length ? columnTasks.map((task) => this.taskCard(task)).join("") : '<p class="kanban-column__empty">ამ ეტაპზე დავალება არ არის</p>'}
          </div>
        </section>
      `;
    }).join("");
  },

  taskCard(task) {
    const status = STATUS_META[task.status] || STATUS_META.pending;
    const dueLabel = isOverdue(task) ? "ვადა გასულია" : formatDate(task.due_date);
    const statusOptions = STATUS_ORDER.map(
      (value) =>
        `<option value="${value}" ${task.status === value ? "selected" : ""}>${STATUS_META[value].label}</option>`
    ).join("");

    return `
      <article class="task-card" data-task-id="${task.id}" draggable="true">
        <div class="task-card__topline">
          <span class="priority-badge priority-badge--${esc(task.priority || "medium")}">${PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.medium}</span>
          ${this.canManage ? `<button class="task-card__more" type="button" data-edit-task="${task.id}" aria-label="დავალების რედაქტირება">•••</button>` : `<span class="task-card__more" aria-hidden="true">◉</span>`}
        </div>
        <button class="task-card__body" type="button" data-edit-task="${task.id}">
          <h3>${esc(task.title)}</h3>
          ${task.description ? `<p>${esc(task.description)}</p>` : ""}
        </button>
        <div class="task-card__meta">
          <span title="ტექნიკოსი">◉ ${esc(task.technician_name || "")}</span>
          <span class="task-card__due ${isOverdue(task) ? "is-overdue" : ""}" title="საბოლოო ვადა">◷ ${esc(dueLabel)}</span>
        </div>
        <select class="task-card__status status-pill status-pill--${status.tone}" data-status-task="${task.id}" aria-label="დავალების სტატუსი">
          ${statusOptions}
        </select>
      </article>
    `;
  },

  findTask(id) {
    return this.tasks.find((task) => task.id === Number(id));
  },

  openTask(id) {
    const task = this.findTask(id);
    if (!task) return;
    if (this.canManage) {
      this.openEditDialog(task);
    } else {
      this.openTechnicianDialog(task);
    }
  },

  openCreateDialog() {
    this.openTaskDialog(null);
  },

  openEditDialog(task) {
    this.openTaskDialog(task);
  },

  openTaskDialog(task) {
    this.editingId = task?.id || null;
    const form = document.getElementById("taskForm");
    if (!form) return;
    form.reset();
    const imageInput = document.getElementById("taskImage");
    if (imageInput) imageInput.value = "";

    document.getElementById("taskDialogTitle").textContent = task ? "დავალების რედაქტირება" : "დავალების შექმნა";
    document.getElementById("taskDialogKicker").textContent = task ? `დავალება #${task.id}` : "ახალი სამუშაო";
    document.getElementById("saveTaskButton").textContent = task ? "ცვლილებების შენახვა" : "დავალების შექმნა";

    if (task) {
      document.getElementById("taskTitle").value = task.title || "";
      const techSelect = document.getElementById("taskTechnician");
      if (techSelect) {
        techSelect.value = task.technician_id;
        // A department-scoped manager may have a task whose technician is not
        // in their scoped users list (legacy departmentless technician).
        if (!techSelect.value && task.technician_id) {
          const option = document.createElement("option");
          option.value = task.technician_id;
          option.textContent = task.technician_name || `ტექნიკოსი #${task.technician_id}`;
          techSelect.appendChild(option);
          techSelect.value = task.technician_id;
        }
      }
      document.getElementById("taskPriority").value = task.priority || "medium";
      document.getElementById("taskCategory").value = task.category || "maintenance";
      document.getElementById("taskDueDate").value = task.due_date || "";
      document.getElementById("taskLocation").value = task.location || "";
      document.getElementById("taskPhone").value = task.contact_phone || "";
      document.getElementById("taskStatus").value = task.status || "pending";
      document.getElementById("taskDescription").value = task.description || "";
    }
    openDialog("taskDialog");
  },

  collectTaskFields() {
    const value = (id) => document.getElementById(id)?.value;
    const data = {
      title: value("taskTitle")?.trim(),
      description: value("taskDescription")?.trim() || null,
      technician_id: Number(value("taskTechnician")),
      priority: value("taskPriority") || "medium",
      status: value("taskStatus") || "pending",
      category: value("taskCategory") || "maintenance",
      due_date: value("taskDueDate") || null,
      location: value("taskLocation")?.trim() || null,
      contact_phone: value("taskPhone")?.trim() || null
    };
    for (const key of ["description", "due_date", "location", "contact_phone"]) {
      if (data[key] === null) delete data[key];
    }
    return data;
  },

  async saveTask(event) {
    event.preventDefault();
    const imageInput = document.getElementById("taskImage");
    const hasImage = imageInput && imageInput.files && imageInput.files.length > 0;
    const fields = this.collectTaskFields();

    if (!fields.title) {
      showToast("სათაური სავალდებულოა.", true);
      return;
    }

    const saveButton = document.getElementById("saveTaskButton");
    if (saveButton) saveButton.disabled = true;

    try {
      if (this.editingId) {
        await apiPatch(`/tasks/${this.editingId}`, fields);
      } else if (hasImage) {
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined && value !== null) formData.append(key, value);
        });
        formData.append("image", imageInput.files[0]);
        await apiPost("/tasks", formData);
      } else {
        await apiPost("/tasks", fields);
      }

      closeDialog("taskDialog");
      showToast(this.editingId ? "დავალება განახლდა" : "ახალი დავალება დაემატა");
      await this.refresh();
      if (OverviewView.loaded) OverviewView.refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  },

  async handleStatusChange(select) {
    const taskId = Number(select.dataset.statusTask);
    const nextStatus = select.value;
    const task = this.findTask(taskId);
    if (!task) return;

    if (!this.canManage && nextStatus === "done") {
      this.openTechnicianDialog(task, true);
      return;
    }
    await this.updateTaskStatus(taskId, nextStatus);
  },

  async updateTaskStatus(id, status) {
    try {
      await apiPatch(`/tasks/${id}`, { status });
      showToast("სტატუსი განახლდა");
      await this.refresh();
      if (OverviewView.loaded) OverviewView.refresh();
    } catch (error) {
      showToast(error.message, true);
      await this.refresh();
    }
  },

  async moveTask(task, nextStatus) {
    if (!this.canManage && nextStatus === "done") {
      this.openTechnicianDialog(task, true);
      return;
    }
    await this.updateTaskStatus(task.id, nextStatus);
  },

  openTechnicianDialog(task, focusComplete = false) {
    const dialog = document.getElementById("entityDialog");
    const body = document.getElementById("entityBody");
    if (!dialog || !body) return;

    document.getElementById("entityKicker").textContent = `დავალება #${task.id}`;
    document.getElementById("entityTitle").textContent = task.title;
    document.getElementById("entitySaveButton").textContent = "დასრულების დადასტურება";
    this._technicianTaskId = task.id;

    const status = STATUS_META[task.status] || STATUS_META.pending;
    body.innerHTML = `
      <div class="task-detail">
        <div class="task-detail__row">
          <span class="task-detail__label">სტატუსი</span>
          <span class="status-pill status-pill--${status.tone}">${status.label}</span>
        </div>
        <div class="task-detail__row">
          <span class="task-detail__label">პრიორიტეტი</span>
          <span class="priority-badge priority-badge--${esc(task.priority || "medium")}">${PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.medium}</span>
        </div>
        <div class="task-detail__row"><span class="task-detail__label">კატეგორია</span><span>${esc(CATEGORY_LABELS[task.category] || task.category || "—")}</span></div>
        <div class="task-detail__row"><span class="task-detail__label">ტექნიკოსი</span><span>${esc(task.technician_name || "—")}</span></div>
        <div class="task-detail__row"><span class="task-detail__label">საბოლოო ვადა</span><span>${esc(formatDate(task.due_date))}</span></div>
        <div class="task-detail__row"><span class="task-detail__label">მისამართი</span><span>${esc(task.location || "—")}</span></div>
        <div class="task-detail__row"><span class="task-detail__label">კონტაქტი</span><span>${esc(task.contact_phone || "—")}</span></div>
        <div class="task-detail__row task-detail__row--block"><span class="task-detail__label">აღწერა</span><span>${esc(task.description || "—")}</span></div>
        ${task.work_description ? `<div class="task-detail__row task-detail__row--block"><span class="task-detail__label">შესრულების კომენტარი</span><span>${esc(task.work_description)}</span></div>` : ""}
      </div>

      <div class="form-section modal__wide task-detail__actions">
        <h3 class="form-section__title">დასრულების კომენტარი</h3>
        <div class="form-section__fields">
          <label class="form-group">
            <textarea class="input modal__textarea" id="completionComment" placeholder="მოკლე აღწერა შესრულებული სამუშაოს შესახებ"></textarea>
          </label>
          <label class="form-group">
            <span>სურათი (სურვილისამებრ)</span>
            <input class="input" id="completionImage" type="file" accept="image/jpeg,image/png,image/webp">
          </label>
        </div>
      </div>
    `;

    const form = document.getElementById("entityForm");
    form.onsubmit = (event) => {
      event.preventDefault();
      this.completeTask();
    };
    openDialog("entityDialog");
    if (focusComplete) {
      const comment = document.getElementById("completionComment");
      if (comment) window.setTimeout(() => comment.focus(), 60);
    }
  },

  async completeTask() {
    const id = this._technicianTaskId;
    if (!id) return;
    const comment = document.getElementById("completionComment")?.value?.trim() || null;
    const imageInput = document.getElementById("completionImage");
    const hasImage = imageInput && imageInput.files && imageInput.files.length > 0;

    const saveButton = document.getElementById("entitySaveButton");
    if (saveButton) saveButton.disabled = true;

    try {
      if (hasImage) {
        const formData = new FormData();
        if (comment) formData.append("comment", comment);
        formData.append("image", imageInput.files[0]);
        await apiPut(`/tasks/${id}/complete`, formData);
      } else {
        await apiPut(`/tasks/${id}/complete`, { comment });
      }
      closeDialog("entityDialog");
      showToast("დავალება დასრულდა");
      await this.refresh();
      if (OverviewView.loaded) OverviewView.refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  },

  async exportExcel() {
    try {
      const blob = await apiDownload("/export");
      downloadBlob(blob, STRINGS.exportFileName);
    } catch (error) {
      showToast(error.message, true);
    }
  }
};