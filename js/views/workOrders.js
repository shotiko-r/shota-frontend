// views/workOrders.js — work order management (Phase 11).
//
// Surfaces the verified Phase 7/9/10 contract:
//   GET  /work-orders                     list (server-scoped)
//   POST /work-orders                     create (manager/admin)
//   GET  /work-orders/:id                 detail
//   PATCH /work-orders/:id                edit
//   PATCH /work-orders/:id/status         transitions (workflowService)
//   PATCH /work-orders/:id/assign         assign technician
//   GET  /work-orders/:id/tasks|parts|attachments|sla
//   POST /work-orders/:id/tasks|parts|attachments
//   PATCH /work-orders/:id/parts/:partId  (+ reserve), DELETE part
//   PATCH /work-order-tasks/:id|status|assign, PUT .../complete
//   GET /attachments/:id, DELETE /attachments/:id
// Role-guarded actions; the backend remains authoritative.

const WorkOrdersView = {
  role: "employee",
  canManage: false,
  isAdmin: false,
  currentUserId: null,
  state: { page: 1, status: "", priority: "", technician_id: "", q: "", myOnly: false },
  detailId: null,
  detailTab: "tasks",
  users: [],

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = capability(this.role, "workOrders");
    this.isAdmin = this.role === "admin";
    this.currentUserId = (Workspace.user && Workspace.user.id) || null;
    this.detailId = null;

    const createButton = document.getElementById("createWorkOrderButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
    }
    const exportButton = document.getElementById("workOrdersExportButton");
    if (exportButton) {
      exportButton.hidden = !(this.canManage || this.role === "technician");
      exportButton.onclick = () => this.exportWorkOrders();
    }

    if (this.canManage) {
      try {
        this.users = await apiGet("/users");
      } catch (error) {
        this.users = [];
      }
    }

    await this.refresh();
  },

  async exportWorkOrders() {
    try {
      showToast("ექსპორტი მზადდება…");
      const blob = await apiDownload("/export");
      downloadBlob(blob, STRINGS.exportFileName);
      showToast(STRINGS.success);
    } catch (error) {
      showToast(error.message, true);
    }
  },

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async refresh() {
    const target = document.getElementById("workOrdersContent");
    if (!target) return;
    setLoading(target);

    const params = new URLSearchParams();
    if (this.state.status) params.set("status", this.state.status);
    if (this.state.priority) params.set("priority", this.state.priority);
    if (this.state.technician_id) params.set("technician_id", this.state.technician_id);
    if (this.state.q) params.set("q", this.state.q);
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const workOrders = await apiGet(`/work-orders${query}`);
      this.renderList(target, workOrders || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  renderList(target, workOrders) {
    const rows = workOrders
      .filter((wo) => !this.state.myOnly || (wo.assignee && wo.assignee.id === this.currentUserId))
      .map((wo) => `
        <tr data-action="open-wo" data-id="${wo.id}" class="clickable-row">
          <td><b>${esc(wo.work_order_number)}</b></td>
          <td>
            <div class="row-title">${esc(wo.title)}</div>
            <small class="row-sub">${esc(WORK_ORDER_CATEGORY_LABELS[wo.category] || wo.category || "—")}</small>
          </td>
          <td>${statusPill(wo.status, WORK_ORDER_STATUS_META)}</td>
          <td>${priorityBadge(wo.priority)}</td>
          <td>${esc(wo.assignee ? wo.assignee.username : "—")}</td>
          <td>${esc(wo.department ? wo.department.name : "—")}</td>
          <td>${esc(formatDateTime(wo.due_at))}</td>
        </tr>`)
      .join("");

    const toolbar = `
      <div class="view-toolbar" aria-label="სამუშაო ბრძანებების ფილტრები">
        <label class="search-field">
          <span aria-hidden="true">⌕</span>
          <input id="workOrderSearch" type="search" placeholder="მოძებნე ნომრით ან სათაურით…" value="${esc(this.state.q)}">
        </label>
        <select class="input view-toolbar__select" id="workOrderStatusFilter" aria-label="სტატუსის ფილტრი">
          <option value="">ყველა სტატუსი</option>
          ${WORK_ORDER_STATUS_ORDER.map((s) => `<option value="${s}" ${this.state.status === s ? "selected" : ""}>${esc(WORK_ORDER_STATUS_META[s].label)}</option>`).join("")}
        </select>
        <select class="input view-toolbar__select" id="workOrderPriorityFilter" aria-label="პრიორიტეტის ფილტრი">
          <option value="">ყველა პრიორიტეტი</option>
          ${Object.entries(PRIORITY_LABELS).map(([v, l]) => `<option value="${v}" ${this.state.priority === v ? "selected" : ""}>${esc(l)}</option>`).join("")}
        </select>
        ${this.canManage ? `
        <select class="input view-toolbar__select" id="workOrderTechnicianFilter" aria-label="ტექნიკოსის ფილტრი">
          <option value="">ყველა ტექნიკოსი</option>
          ${this.users.filter((u) => u.role === "technician" || (u.roles && u.roles.some((r) => r.name === "technician"))).map((u) => `<option value="${u.id}" ${String(this.state.technician_id) === String(u.id) ? "selected" : ""}>${esc(displayName(u))}</option>`).join("")}
        </select>` : ""}
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-filters">ფილტრი</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="reset-filters">გასუფთავება</button>
        ${this.canManage ? `
        <label class="checkbox-inline" title="მხოლოდ ჩემზე დანიშნული">
          <input type="checkbox" data-action="toggle-my" ${this.state.myOnly ? "checked" : ""}> ჩემი
        </label>` : ""}
      </div>
    `;

    target.innerHTML = `
      ${toolbar}
      ${dataTable(
        ["ნომერი", "სათაური", "სტატუსი", "პრიორიტეტი", "ტექნიკოსი", "დეპარტამენტი", "ვადა"],
        rows,
        "სამუშაო ბრძანებები არ არის"
      )}
    `;
  },

  // ---------------------------------------------------------------------------
  // List toolbar events (delegated on the content container).
  // ---------------------------------------------------------------------------

  async handleListAction(action, target) {
    switch (action) {
      case "open-wo":
        await this.openDetail(Number(target.dataset.id));
        break;
      case "apply-filters":
        this.state.q = document.getElementById("workOrderSearch").value.trim();
        this.state.status = document.getElementById("workOrderStatusFilter").value;
        this.state.priority = document.getElementById("workOrderPriorityFilter").value;
        this.state.technician_id = document.getElementById("workOrderTechnicianFilter")
          ? document.getElementById("workOrderTechnicianFilter").value
          : "";
        this.state.page = 1;
        await this.refresh();
        break;
      case "reset-filters":
        this.state = { page: 1, status: "", priority: "", technician_id: "", q: "", myOnly: false };
        await this.refresh();
        break;
      case "toggle-my":
        this.state.myOnly = target.checked;
        await this.refresh();
        break;
      default:
        break;
    }
  },

  // ---------------------------------------------------------------------------
  // Create / edit
  // ---------------------------------------------------------------------------

  withEmpty(items) {
    return [{ value: "", label: "—" }, ...items];
  },

  technicianOptions() {
    const technicians = this.users.filter((u) => u.role === "technician" || (u.roles && u.roles.some((r) => r.name === "technician")));
    return this.withEmpty(technicians.map((u) => ({ value: u.id, label: displayName(u) })));
  },

  async assetOptions() {
    const assets = await apiGet("/assets").catch(() => []);
    return this.withEmpty(assets.map((a) => ({
      value: a.id,
      label: `${a.terminal_number || a.asset_code || `#${a.id}`}${a.location ? ` · ${a.location.name}` : ""}`
    })));
  },

  async locationOptions() {
    const locations = await apiGet("/locations").catch(() => []);
    return this.withEmpty(locations.map((l) => ({ value: l.id, label: l.name })));
  },

  async openCreate() {
    const commonFields = [
      { name: "title", label: "სათაური", type: "text", required: true, placeholder: "მაგ. ტერმინალის შეკეთება" },
      {
        name: "priority", label: "პრიორიტეტი", type: "select", value: "medium",
        options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
      },
      {
        name: "category", label: "კატეგორია", type: "select", value: "maintenance",
        options: Object.entries(WORK_ORDER_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))
      },
      { name: "assigned_to", label: "ტექნიკოსი", type: "select", placeholder: "—", options: () => this.technicianOptions() },
    ];
    const adminFields = this.isAdmin
      ? [
          { name: "asset_id", label: "აქტივი", type: "select", placeholder: "—", options: () => this.assetOptions() },
          { name: "location_id", label: "მომსახურების ადგილი", type: "select", placeholder: "—", options: () => this.locationOptions() },
        ]
      : [];
    const tailFields = [
      { name: "scheduled_at", label: "დაგეგმილი დრო", type: "datetime-local" },
      { name: "due_at", label: "ვადა", type: "datetime-local" },
      { name: "description", label: "აღწერა", type: "textarea", placeholder: "დეტალები სამუშაოს შესახებ…" }
    ];

    openEntityDialog({
      kicker: "ოპერაციები",
      title: "ახალი სამუშაო ბრძანება",
      fields: [...commonFields, ...adminFields, ...tailFields],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        const payload = {
          title: values.title,
          priority: values.priority || "medium",
          category: values.category || null,
          assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
          scheduled_at: values.scheduled_at || null,
          due_at: values.due_at || null,
          description: values.description || null
        };
        if (this.isAdmin) {
          payload.asset_id = values.asset_id ? Number(values.asset_id) : null;
          payload.location_id = values.location_id ? Number(values.location_id) : null;
        }
        await apiPost("/work-orders", payload);
        await this.refresh();
      }
    });
  },

  async openEdit(wo) {
    const commonFields = [
      { name: "title", label: "სათაური", type: "text", required: true, value: wo.title },
      {
        name: "priority", label: "პრიორიტეტი", type: "select", value: wo.priority,
        options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
      },
      {
        name: "category", label: "კატეგორია", type: "select", value: wo.category || "maintenance",
        options: Object.entries(WORK_ORDER_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))
      },
      { name: "description", label: "აღწერა", type: "textarea", value: wo.description || "" }
    ];
    const adminFields = this.isAdmin
      ? [
          { name: "asset_id", label: "აქტივი", type: "select", value: wo.asset ? wo.asset.id : "", placeholder: "—", options: () => this.assetOptions() },
          { name: "location_id", label: "მომსახურების ადგილი", type: "select", value: wo.location ? wo.location.id : "", placeholder: "—", options: () => this.locationOptions() },
        ]
      : [];
    const tailFields = [
      { name: "scheduled_at", label: "დაგეგმილი დრო", type: "datetime-local", value: wo.scheduled_at || "" },
      { name: "due_at", label: "ვადა", type: "datetime-local", value: wo.due_at || "" }
    ];

    openEntityDialog({
      kicker: `სამუშაო ბრძანება ${wo.work_order_number}`,
      title: "რედაქტირება",
      fields: [...commonFields, ...adminFields, ...tailFields],
      onSave: async (values) => {
        const payload = {
          title: values.title,
          priority: values.priority || "medium",
          category: values.category || null,
          scheduled_at: values.scheduled_at || null,
          due_at: values.due_at || null,
          description: values.description || null
        };
        if (this.isAdmin) {
          payload.asset_id = values.asset_id ? Number(values.asset_id) : null;
          payload.location_id = values.location_id ? Number(values.location_id) : null;
        }
        await apiPatch(`/work-orders/${wo.id}`, payload);
        await this.refreshDetail();
      }
    });
  },

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async openDetail(id) {
    this.detailId = id;
    this.detailTab = "tasks";
    await this.refreshDetail();
  },

  async backToList() {
    this.detailId = null;
    await this.refresh();
  },

  async refreshDetail() {
    const target = document.getElementById("workOrdersContent");
    if (!target) return;
    setLoading(target);
    try {
      const wo = await apiGet(`/work-orders/${this.detailId}`);
      this.renderDetailShell(target, wo);
      await this.loadDetailTab(target, wo);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  renderDetailShell(target, wo) {
    const transitions = this.canManage ? allowedTransitions("work_order", wo.status) : [];
    const transitionButtons = transitions
      .filter((s) => s !== "assigned")
      .map((s) => {
        const meta = WORK_ORDER_STATUS_META[s];
        return `<button type="button" class="btn btn--ghost btn--compact" data-action="transition-wo" data-status="${s}">→ ${esc(meta.label)}</button>`;
      })
      .join("");

    const assignButton = this.canManage
      ? `<button type="button" class="btn btn--ghost btn--compact" data-action="assign-wo">${wo.assignee ? "გადანიშვნა" : "დანიშვნა"}</button>`
      : "";

    const actions = [
      assignButton,
      this.canManage ? `<button type="button" class="btn btn--ghost btn--compact" data-action="edit-wo">რედაქტირება</button>` : "",
      transitionButtons
    ].filter(Boolean).join(" ");

    target.innerHTML = `
      <div class="detail">
        <div class="detail__top">
          <button type="button" class="btn btn--ghost btn--compact" data-action="back">← უკან</button>
          <div class="detail__head">
            <span class="workspace-kicker">${esc(wo.work_order_number)} · ${esc(WORK_ORDER_CATEGORY_LABELS[wo.category] || wo.category || "—")}</span>
            <h2>${esc(wo.title)}</h2>
          </div>
          <div class="detail__status">
            ${statusPill(wo.status, WORK_ORDER_STATUS_META)}
            ${priorityBadge(wo.priority)}
          </div>
        </div>

        <div class="detail__actions">${actions}</div>

        <div class="detail-meta">
          <div class="detail-meta__item"><span>მომთხოვნი</span><b>${esc(wo.requester ? wo.requester.username : "—")}</b></div>
          <div class="detail-meta__item"><span>ტექნიკოსი</span><b>${esc(wo.assignee ? wo.assignee.username : "—")}</b></div>
          <div class="detail-meta__item"><span>დეპარტამენტი</span><b>${esc(wo.department ? wo.department.name : "—")}</b></div>
          <div class="detail-meta__item"><span>აქტივი</span><b>${esc(wo.asset ? (wo.asset.terminal_number || wo.asset.asset_code) : "—")}</b></div>
          <div class="detail-meta__item"><span>ადგილი</span><b>${esc(wo.location ? wo.location.name : "—")}</b></div>
          <div class="detail-meta__item"><span>დაგეგმილი</span><b>${esc(formatDateTime(wo.scheduled_at))}</b></div>
          <div class="detail-meta__item"><span>ვადა</span><b>${esc(formatDateTime(wo.due_at))}</b></div>
          <div class="detail-meta__item"><span>შექმნილია</span><b>${esc(formatDateTime(wo.created_at))}</b></div>
        </div>

        ${wo.description ? `<div class="detail-description"><span class="workspace-kicker">აღწერა</span><p>${esc(wo.description)}</p></div>` : ""}

        <div class="detail-tabs" role="tablist" aria-label="სამუშაო ბრძანების განყოფილებები">
          ${[
            ["tasks", "დავალებები"],
            ["parts", "ნაწილები"],
            ["attachments", "ფაილები"],
            ["sla", "SLA"]
          ].map(([key, label]) => `
            <button type="button" role="tab" class="detail-tabs__tab ${this.detailTab === key ? "is-active" : ""}" data-action="tab" data-tab="${key}">${label}</button>
          `).join("")}
        </div>
        <div id="workOrderTabContent" class="detail-tab-content" aria-live="polite"></div>
      </div>
    `;
  },

  async loadDetailTab(target, wo) {
    const tabHost = document.getElementById("workOrderTabContent");
    if (!tabHost) return;
    setLoading(tabHost);

    const isMyWo = Boolean(wo.assignee && wo.assignee.id === this.currentUserId);

    try {
      switch (this.detailTab) {
        case "tasks":
          await this.renderTasksTab(tabHost, wo, isMyWo);
          break;
        case "parts":
          await this.renderPartsTab(tabHost, wo, isMyWo);
          break;
        case "attachments":
          await this.renderAttachmentsTab(tabHost, wo, isMyWo);
          break;
        case "sla":
          await this.renderSlaTab(tabHost, wo);
          break;
        default:
          break;
      }
    } catch (error) {
      tabHost.innerHTML = errorState(error.message);
    }
  },

  // -- Tasks tab -------------------------------------------------------------

  async renderTasksTab(tabHost, wo, isMyWo) {
    const tasks = await apiGet(`/work-orders/${wo.id}/tasks`);

    const rows = (tasks || []).map((task) => {
      const isMyTask = Boolean(task.technician && task.technician.id === this.currentUserId);

      const transitions = this.role === "employee"
        ? []
        : this.canManage
          ? allowedTransitions("work_order_task", task.status).filter((s) => s !== "completed" && s !== "assigned")
          : allowedTransitions("work_order_task", task.status).filter((s) => s !== "assigned" && s !== "completed");
      const canComplete = (this.role === "technician" && isMyWo && isMyTask) || this.isAdmin;
      const canAssignTask = this.canManage && allowedTransitions("work_order_task", task.status).includes("assigned");

      const actionButtons = [
        canAssignTask ? `<button type="button" class="btn btn--ghost btn--compact" data-action="assign-task" data-id="${task.id}">დანიშვნა</button>` : "",
        this.canManage ? `<button type="button" class="btn btn--ghost btn--compact" data-action="edit-task" data-id="${task.id}">რედაქტირება</button>` : "",
        ...transitions.map((s) => {
          const meta = WORK_ORDER_STATUS_META[s];
          return `<button type="button" class="btn btn--ghost btn--compact" data-action="transition-task" data-id="${task.id}" data-status="${s}">→ ${esc(meta.label)}</button>`;
        }),
        canComplete ? `<button type="button" class="btn btn--primary btn--compact" data-action="complete-task" data-id="${task.id}">დასრულება</button>` : ""
      ].filter(Boolean).join(" ");

      return `
        <div class="task-card">
          <div class="task-card__head">
            <b>${esc(task.title)}</b>
            <div class="task-card__pills">
              ${statusPill(task.status, WORK_ORDER_STATUS_META)}
              ${priorityBadge(task.priority)}
            </div>
          </div>
          ${task.description ? `<p class="task-card__desc">${esc(task.description)}</p>` : ""}
          <div class="task-card__meta">
            <span>ტექნიკოსი: <b>${esc(task.technician ? task.technician.username : "—")}</b></span>
            <span>ვადა: <b>${esc(formatDateTime(task.due_at))}</b></span>
            ${task.completion_comment ? `<span>კომენტარი: ${esc(task.completion_comment)}</span>` : ""}
          </div>
          ${actionButtons ? `<div class="task-card__actions">${actionButtons}</div>` : ""}
        </div>
      `;
    }).join("");

    tabHost.innerHTML = `
      <div class="tab-toolbar">
        ${this.canManage ? `<button type="button" class="btn btn--primary btn--compact" data-action="create-task">+ ახალი დავალება</button>` : ""}
      </div>
      ${rows || emptyState("დავალებები არ არის")}
    `;
  },

  openCreateTask(woId) {
    openEntityDialog({
      kicker: "დავალება",
      title: "ახალი დავალება",
      fields: [
        { name: "title", label: "სათაური", type: "text", required: true },
        {
          name: "priority", label: "პრიორიტეტი", type: "select", value: "medium",
          options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
        },
        { name: "technician_id", label: "ტექნიკოსი", type: "select", placeholder: "—", options: () => this.technicianOptions() },
        { name: "due_at", label: "ვადა", type: "datetime-local" },
        { name: "description", label: "აღწერა", type: "textarea" }
      ],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        await apiPost(`/work-orders/${woId}/tasks`, {
          title: values.title,
          priority: values.priority || "medium",
          technician_id: values.technician_id ? Number(values.technician_id) : null,
          due_at: values.due_at || null,
          description: values.description || null
        });
        await this.refreshDetail();
      }
    });
  },

  openEditTask(woId, task) {
    openEntityDialog({
      kicker: `დავალება #${task.id}`,
      title: "რედაქტირება",
      fields: [
        { name: "title", label: "სათაური", type: "text", required: true, value: task.title },
        {
          name: "priority", label: "პრიორიტეტი", type: "select", value: task.priority,
          options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
        },
        { name: "due_at", label: "ვადა", type: "datetime-local", value: task.due_at || "" },
        { name: "description", label: "აღწერა", type: "textarea", value: task.description || "" }
      ],
      onSave: async (values) => {
        await apiPatch(`/work-order-tasks/${task.id}`, {
          title: values.title,
          priority: values.priority || "medium",
          due_at: values.due_at || null,
          description: values.description || null
        });
        await this.refreshDetail();
      }
    });
  },

  openAssignTask(woId, task) {
    openEntityDialog({
      kicker: `დავალება #${task.id}`,
      title: "ტექნიკოსის დანიშვნა",
      fields: [
        { name: "technician_id", label: "ტექნიკოსი", type: "select", required: true, options: () => this.technicianOptions() }
      ],
      submitLabel: "დანიშვნა",
      onSave: async (values) => {
        await apiPatch(`/work-order-tasks/${task.id}/assign`, { technician_id: Number(values.technician_id) });
        await this.refreshDetail();
      }
    });
  },

  async changeTaskStatus(taskId, status) {
    try {
      await apiPatch(`/work-order-tasks/${taskId}/status`, { status });
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  openCompleteTask(task) {
    openEntityDialog({
      kicker: `დავალება #${task.id}`,
      title: "დავალების დასრულება",
      fields: [
        { name: "comment", label: "დასრულების კომენტარი", type: "textarea" }
      ],
      submitLabel: "დასრულება",
      onSave: async (values) => {
        await apiPut(`/work-order-tasks/${task.id}/complete`, { comment: values.comment || null });
        await this.refreshDetail();
      }
    });
  },

  // -- Parts tab -------------------------------------------------------------

  async renderPartsTab(tabHost, wo, isMyWo) {
    const parts = await apiGet(`/work-orders/${wo.id}/parts`);

    const rows = (parts || []).map((wop) => `
      <tr>
        <td>
          <div class="row-title">${esc(wop.part.name)}</div>
          <small class="row-sub">${esc(wop.part.sku)}${wop.part.category ? ` · ${esc(wop.part.category)}` : ""}</small>
        </td>
        <td>${esc(String(wop.required_quantity))} ${esc(wop.part.unit || "")}</td>
        <td>${esc(String(wop.reserved_quantity || 0))} ${esc(wop.part.unit || "")}</td>
        <td>${esc(String(wop.consumed_quantity || 0))} ${esc(wop.part.unit || "")}</td>
        <td>${statusPill(wop.status, WOP_STATUS_META)}</td>
        <td>
          <div class="row-actions">
            ${this.canManage ? `
              <button type="button" class="btn btn--ghost btn--compact" data-action="reserve-part" data-id="${wop.id}">ჯავშანი</button>
              <button type="button" class="btn btn--ghost btn--compact" data-action="edit-part" data-id="${wop.id}">რედაქტირება</button>
              <button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="remove-part" data-id="${wop.id}">წაშლა</button>
            ` : ""}
          </div>
        </td>
      </tr>`).join("");

    tabHost.innerHTML = `
      <div class="tab-toolbar">
        ${this.canManage ? `<button type="button" class="btn btn--primary btn--compact" data-action="add-part">+ საჭირო ნაწილი</button>` : ""}
        <small class="form-hint">რეზერვაცია და მოხმარება ხდება საწყობის ბალანსიდან.</small>
      </div>
      ${dataTable(["ნაწილი", "საჭიროა", "დაჯავშნული", "მოხმარებული", "სტატუსი", ""], rows, "საჭირო ნაწილები არ არის")}
    `;
  },

  async partOptions() {
    const parts = await apiGet("/parts").catch(() => []);
    return this.withEmpty(parts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })));
  },

  openAddPart(woId) {
    openEntityDialog({
      kicker: "საჭირო ნაწილი",
      title: "ნაწილის დამატება",
      fields: [
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "required_quantity", label: "საჭირო რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "დამატება",
      onSave: async (values) => {
        await apiPost(`/work-orders/${woId}/parts`, {
          part_id: Number(values.part_id),
          required_quantity: values.required_quantity,
          notes: values.notes || null
        });
        await this.refreshDetail();
      }
    });
  },

  openEditPart(woId, wop) {
    openEntityDialog({
      kicker: `ნაწილი ${wop.part.sku}`,
      title: "რედაქტირება",
      fields: [
        { name: "required_quantity", label: "საჭირო რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01", value: wop.required_quantity },
        { name: "notes", label: "შენიშვნა", type: "textarea", value: wop.notes || "" }
      ],
      onSave: async (values) => {
        await apiPatch(`/work-orders/${woId}/parts/${wop.id}`, {
          required_quantity: values.required_quantity,
          notes: values.notes || null
        });
        await this.refreshDetail();
      }
    });
  },

  openReservePart(woId, wop) {
    openEntityDialog({
      kicker: `ნაწილი ${wop.part.sku}`,
      title: "რეზერვაცია",
      fields: [
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" }
      ],
      submitLabel: "დაჯავშნა",
      onSave: async (values) => {
        await apiPost(`/work-orders/${woId}/parts/${wop.id}/reserve`, {
          warehouse_id: Number(values.warehouse_id),
          quantity: values.quantity
        });
        await this.refreshDetail();
      }
    });
  },

  async warehouseOptions() {
    const warehouses = await apiGet("/warehouses").catch(() => []);
    return this.withEmpty(warehouses.map((w) => ({ value: w.id, label: w.name })));
  },

  async removePart(woId, wop) {
    const confirmed = await confirmAction(`წაშალო ნაწილი „${wop.part.name}“ სამუშაო ბრძანებიდან?`, { title: "ნაწილის წაშლა" });
    if (!confirmed) return;
    try {
      await apiDelete(`/work-orders/${woId}/parts/${wop.id}`);
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  // -- Attachments tab -------------------------------------------------------

  async renderAttachmentsTab(tabHost, wo, isMyWo) {
    const attachments = await apiGet(`/work-orders/${wo.id}/attachments`);
    const canUpload = this.canManage || (this.role === "technician" && isMyWo);
    const canDelete = this.canManage;

    const rows = (attachments || []).map((att) => `
      <tr>
        <td>
          <div class="row-title">${esc(att.original_name)}</div>
          <small class="row-sub">${esc(att.mime_type || "—")} · ${esc(formatBytes(att.size))}</small>
        </td>
        <td>${esc(att.uploaded_by ? att.uploaded_by.username : "—")}</td>
        <td>${esc(formatDateTime(att.created_at))}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn--ghost btn--compact" data-action="download-attachment" data-id="${att.id}" data-name="${esc(att.original_name)}">ჩამოტვირთვა</button>
            ${canDelete ? `<button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="delete-attachment" data-id="${att.id}" data-name="${esc(att.original_name)}">წაშლა</button>` : ""}
          </div>
        </td>
      </tr>`).join("");

    tabHost.innerHTML = `
      <div class="tab-toolbar">
        ${canUpload ? `
          <label class="btn btn--primary btn--compact file-upload">
            + ატვირთვა
            <input type="file" id="attachmentInput" data-action="upload-attachment" hidden>
          </label>
        ` : ""}
        <small class="form-hint">დაშვებულია: JPG, PNG, WebP, GIF, PDF, TXT.</small>
      </div>
      ${dataTable(["ფაილი", "ატვირთა", "თარიღი", ""], rows, "ფაილები არ არის")}
    `;

    const input = document.getElementById("attachmentInput");
    if (input) input.addEventListener("change", () => this.uploadAttachment(wo.id, input));
  },

  async uploadAttachment(woId, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await apiPost(`/work-orders/${woId}/attachments`, form);
      showToast(STRINGS.success);
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async downloadAttachment(att) {
    try {
      const blob = await apiDownload(`/attachments/${att.id}`);
      downloadBlob(blob, att.original_name);
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async deleteAttachment(att) {
    const confirmed = await confirmAction(`წაშალო ფაილი „${att.original_name}“?`, { title: "ფაილის წაშლა" });
    if (!confirmed) return;
    try {
      await apiDelete(`/attachments/${att.id}`);
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  // -- SLA tab ---------------------------------------------------------------

  async renderSlaTab(tabHost, wo) {
    let sla = null;
    try {
      sla = await apiGet(`/work-orders/${wo.id}/sla`);
    } catch (error) {
      // SLA is optional per work order.
    }
    if (!sla) {
      tabHost.innerHTML = emptyState("SLA არ არის მინიჭებული ამ სამუშაო ბრძანებაზე.");
      return;
    }

    tabHost.innerHTML = `
      <div class="detail-meta">
        <div class="detail-meta__item"><span>სტატუსი</span><b>${statusPill(sla.status, SLA_STATUS_META)}</b></div>
        <div class="detail-meta__item"><span>პოლიტიკა</span><b>${esc(sla.sla_policy ? sla.sla_policy.name : "—")}</b></div>
        <div class="detail-meta__item"><span>დაწყებულია</span><b>${esc(formatDateTime(sla.sla_started_at))}</b></div>
        <div class="detail-meta__item"><span>რეაგირების ვადა</span><b>${esc(formatDateTime(sla.response_due_at))}</b></div>
        <div class="detail-meta__item"><span>შესრულების ვადა</span><b>${esc(formatDateTime(sla.resolution_due_at))}</b></div>
        <div class="detail-meta__item"><span>რეაგირება (მეტი)</span><b>${esc(formatDateTime(sla.response_met_at))}</b></div>
        <div class="detail-meta__item"><span>შესრულებულია</span><b>${esc(formatDateTime(sla.resolution_met_at))}</b></div>
        ${sla.at_risk_at ? `<div class="detail-meta__item"><span>რისკის აღნიშვნა</span><b>${esc(formatDateTime(sla.at_risk_at))}</b></div>` : ""}
        ${sla.breached_at ? `<div class="detail-meta__item"><span>დარღვევა</span><b>${esc(formatDateTime(sla.breached_at))}</b></div>` : ""}
      </div>
    `;
  },

  // ---------------------------------------------------------------------------
  // Detail actions
  // ---------------------------------------------------------------------------

  async handleDetailAction(action, target, wo) {
    switch (action) {
      case "back":
        await this.backToList();
        break;
      case "tab":
        this.detailTab = target.dataset.tab;
        await this.loadDetailTab(null, wo);
        break;
      case "edit-wo":
        this.openEdit(wo);
        break;
      case "assign-wo":
        this.openAssignWorkOrder(wo);
        break;
      case "transition-wo":
        await this.changeWorkOrderStatus(wo, target.dataset.status);
        break;
      case "create-task":
        this.openCreateTask(wo.id);
        break;
      case "edit-task":
        await this.withTask(target, wo, (task) => this.openEditTask(wo.id, task));
        break;
      case "assign-task":
        await this.withTask(target, wo, (task) => this.openAssignTask(wo.id, task));
        break;
      case "transition-task":
        this.changeTaskStatus(Number(target.dataset.id), target.dataset.status);
        break;
      case "complete-task":
        await this.withTask(target, wo, (task) => this.openCompleteTask(task));
        break;
      case "add-part":
        this.openAddPart(wo.id);
        break;
      case "edit-part":
        await this.withWorkOrderPart(target, wo, (wop) => this.openEditPart(wo.id, wop));
        break;
      case "reserve-part":
        await this.withWorkOrderPart(target, wo, (wop) => this.openReservePart(wo.id, wop));
        break;
      case "remove-part":
        await this.withWorkOrderPart(target, wo, (wop) => this.removePart(wo.id, wop));
        break;
      case "download-attachment":
        this.downloadAttachment({ id: target.dataset.id, original_name: target.dataset.name });
        break;
      case "delete-attachment":
        this.deleteAttachment({ id: target.dataset.id, original_name: target.dataset.name });
        break;
      default:
        break;
    }
  },

  openAssignWorkOrder(wo) {
    openEntityDialog({
      kicker: `სამუშაო ბრძანება ${wo.work_order_number}`,
      title: "ტექნიკოსის დანიშვნა",
      fields: [
        { name: "technician_id", label: "ტექნიკოსი", type: "select", required: true, options: () => this.technicianOptions() }
      ],
      submitLabel: "დანიშვნა",
      onSave: async (values) => {
        await apiPatch(`/work-orders/${wo.id}/assign`, { technician_id: Number(values.technician_id) });
        await this.refreshDetail();
      }
    });
  },

  async changeWorkOrderStatus(wo, status) {
    if (status === "cancelled") {
      const confirmed = await confirmAction(`გააუქმო სამუშაო ბრძანება ${wo.work_order_number}?`, {
        title: "გაუქმება",
        okLabel: "გაუქმება",
        danger: true
      });
      if (!confirmed) return;
    }
    try {
      await apiPatch(`/work-orders/${wo.id}/status`, { status });
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  // ---------------------------------------------------------------------------
  // Task / part lookups (the detail sub-resource is re-fetched on demand).
  // ---------------------------------------------------------------------------

  async withTask(target, wo, callback) {
    try {
      const tasks = await apiGet(`/work-orders/${wo.id}/tasks`);
      const task = (tasks || []).find((t) => String(t.id) === String(target.dataset.id));
      if (!task) throw new Error("დავალება ვერ მოიძებნა.");
      callback(task);
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async withWorkOrderPart(target, wo, callback) {
    try {
      const parts = await apiGet(`/work-orders/${wo.id}/parts`);
      const wop = (parts || []).find((p) => String(p.id) === String(target.dataset.id));
      if (!wop) throw new Error("ნაწილი ვერ მოიძებნა.");
      callback(wop);
    } catch (error) {
      showToast(error.message, true);
    }
  }
};

// Global click delegation for the whole view section.
document.getElementById("workOrdersContent").addEventListener("click", async (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  const action = node.dataset.action;

  // List-level actions carry a numeric id directly.
  if (action === "open-wo") {
    await WorkOrdersView.handleListAction(action, node);
    return;
  }
  if (["apply-filters", "reset-filters", "toggle-my"].includes(action)) {
    await WorkOrdersView.handleListAction(action, node);
    return;
  }

  // Detail-level actions need the current work order.
  if (WorkOrdersView.detailId) {
    const wo = await apiGet(`/work-orders/${WorkOrdersView.detailId}`);
    await WorkOrdersView.handleDetailAction(action, node, wo);
  }
});