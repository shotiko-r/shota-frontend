// views/dispatch.js — scheduling & dispatch calendar (Phase 11).
//
// Verified Phase 8 endpoints:
//   GET  /appointments/calendar?date_from&date_to&technician_id&status
//   GET  /appointments/availability?technician_id&start&end
//   GET  /appointments, GET /appointments/:id
//   POST /appointments                       (manager/admin)
//   PATCH /appointments/:id                  (update)
//   PATCH /appointments/:id/status           (workflowService transitions)
//   PATCH /appointments/:id/assign           (manager/admin)
//   PATCH /appointments/:id/reschedule       (manager/admin)
// Role-guarded actions; the backend remains authoritative.

const DispatchView = {
  role: "employee",
  canManage: false,
  isAdmin: false,
  currentUserId: null,
  state: { weekOffset: 0, technician_id: "", status: "" },
  detailId: null,
  users: [],

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = capability(this.role, "dispatch");
    this.isAdmin = this.role === "admin";
    this.currentUserId = (Workspace.user && Workspace.user.id) || null;
    this.detailId = null;

    const createButton = document.getElementById("createAppointmentButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
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

  // Permission held per appointment target status (workflowService mapping).
  targetPermission() {
    return {
      confirmed: "confirm",
      travelling: "dispatch",
      arrived: "start",
      in_progress: "start",
      completed: "complete",
      cancelled: "cancel",
      missed: "cancel",
      rescheduled: "reschedule"
    };
  },

  roleHolds(permission) {
    if (this.isAdmin || this.canManage) return true;
    if (this.role === "technician") return ["confirm", "start", "complete", "cancel"].includes(permission);
    return false;
  },

  allowedAppointmentTransitions(status) {
    const targets = allowedTransitions("appointment", status);
    return targets.filter((t) => this.roleHolds(this.targetPermission()[t]));
  },

  // ---------------------------------------------------------------------------
  // Week grid
  // ---------------------------------------------------------------------------

  weekRange(offset) {
    const today = new Date();
    const monday = new Date(today);
    const diff = (today.getDay() + 6) % 7;
    monday.setDate(today.getDate() - diff + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      days.push({ date: day, ymd });
    }
    const from = `${days[0].ymd}T00:00:00`;
    const to = `${days[6].ymd}T23:59:59`;
    return { days, from, to };
  },

  async refresh() {
    const target = document.getElementById("dispatchContent");
    if (!target) return;
    setLoading(target);

    const { days, from, to } = this.weekRange(this.state.weekOffset);
    const params = new URLSearchParams({ date_from: from, date_to: to });
    if (this.state.technician_id) params.set("technician_id", this.state.technician_id);
    if (this.state.status) params.set("status", this.state.status);

    try {
      const appointments = await apiGet(`/appointments/calendar?${params.toString()}`);
      this.renderWeek(target, days, appointments || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  renderWeek(target, days, appointments) {
    const byDay = {};
    for (const day of days) byDay[day.ymd] = [];

    for (const app of appointments) {
      const key = String(app.scheduled_start).slice(0, 10);
      if (byDay[key]) {
        byDay[key].push(app);
      } else {
        // Appointment crosses midnight — attach to its start day bucket.
        byDay[key] = byDay[key] || [app];
      }
    }

    const dayLabel = new Intl.DateTimeFormat("ka-GE", { weekday: "short" }).format;
    const dayNum = new Intl.DateTimeFormat("ka-GE", { day: "numeric" }).format;

    const columns = days
      .map((day) => {
        const isToday = day.ymd === new Date().toISOString().slice(0, 10);
        const cards = byDay[day.ymd]
          .slice()
          .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))
          .map((app) => `
            <button type="button" class="appointment-card appointment-card--${esc(app.status)}" data-action="open-appointment" data-id="${app.id}" title="${esc(app.work_order.title)}">
              <span class="appointment-card__time">${esc(shortTime(app.scheduled_start))}–${esc(shortTime(app.scheduled_end))}</span>
              <b class="appointment-card__title">${esc(app.work_order.title)}</b>
              <span class="appointment-card__tech">${esc(app.technician ? app.technician.username : "—")}</span>
              <span class="appointment-card__status">${statusPill(app.status, APPOINTMENT_STATUS_META)}</span>
            </button>`)
          .join("") || emptyState("არ არის");

        return `
          <div class="week-day${isToday ? " week-day--today" : ""}">
            <div class="week-day__head">
              <span>${esc(dayLabel(day.date))}</span>
              <b>${esc(dayNum(day.date))}</b>
            </div>
            <div class="week-day__body">${cards}</div>
          </div>
        `;
      })
      .join("");

    const toolbar = `
      <div class="view-toolbar" aria-label="განრიგის ფილტრები">
        <button type="button" class="btn btn--ghost btn--compact" data-action="week-prev">←</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="week-today">ამ კვირა</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="week-next">→</button>
        ${this.canManage ? `
        <select class="input view-toolbar__select" id="dispatchTechnicianFilter" aria-label="ტექნიკოსის ფილტრი">
          <option value="">ყველა ტექნიკოსი</option>
          ${this.users.filter((u) => u.role === "technician" || (u.roles && u.roles.some((r) => r.name === "technician"))).map((u) => `<option value="${u.id}" ${String(this.state.technician_id) === String(u.id) ? "selected" : ""}>${esc(displayName(u))}</option>`).join("")}
        </select>` : ""}
        <select class="input view-toolbar__select" id="dispatchStatusFilter" aria-label="სტატუსის ფილტრი">
          <option value="">ყველა სტატუსი</option>
          ${APPOINTMENT_STATUS_ORDER.map((s) => `<option value="${s}" ${this.state.status === s ? "selected" : ""}>${esc(APPOINTMENT_STATUS_META[s].label)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-dispatch-filters">ფილტრი</button>
      </div>
    `;

    target.innerHTML = `
      ${this.detailId ? `<div id="dispatchDetail"></div>` : ""}
      ${toolbar}
      <div class="week-grid" aria-label="კვირის განრიგი">${columns}</div>
    `;

    if (this.detailId) this.renderDetail();
  },

  // ---------------------------------------------------------------------------
  // Appointment detail (inline panel above the grid).
  // ---------------------------------------------------------------------------

  async renderDetail() {
    const host = document.getElementById("dispatchDetail");
    if (!host) return;
    setLoading(host);
    try {
      const app = await apiGet(`/appointments/${this.detailId}`);
      const isMy = this.role === "technician" && app.technician && app.technician.id === this.currentUserId;
      const transitions = this.allowedAppointmentTransitions(app.status);

      const buttons = [
        this.canManage ? `<button type="button" class="btn btn--ghost btn--compact" data-action="edit-appointment">რედაქტირება</button>` : "",
        this.canManage ? `<button type="button" class="btn btn--ghost btn--compact" data-action="assign-appointment">${app.technician ? "გადანიშვნა" : "დანიშვნა"}</button>` : "",
        this.canManage && allowedTransitions("appointment", app.status).includes("rescheduled")
          ? `<button type="button" class="btn btn--ghost btn--compact" data-action="reschedule-appointment">გადანაწილება</button>` : "",
        ...transitions.map((s) => {
          const meta = APPOINTMENT_STATUS_META[s];
          return `<button type="button" class="btn btn--ghost btn--compact" data-action="transition-appointment" data-status="${s}">→ ${esc(meta.label)}</button>`;
        })
      ].filter(Boolean).join(" ");

      host.innerHTML = `
        <div class="detail">
          <div class="detail__top">
            <button type="button" class="btn btn--ghost btn--compact" data-action="close-appointment-detail">×</button>
            <div class="detail__head">
              <span class="workspace-kicker">${esc(app.appointment_number)}</span>
              <h2>${esc(app.work_order.title)}</h2>
            </div>
            <div class="detail__status">
              ${statusPill(app.status, APPOINTMENT_STATUS_META)}
            </div>
          </div>
          ${buttons ? `<div class="detail__actions">${buttons}</div>` : ""}
          <div class="detail-meta">
            <div class="detail-meta__item"><span>სამუშაო ბრძანება</span><b>${esc(app.work_order.work_order_number)}</b></div>
            <div class="detail-meta__item"><span>ტექნიკოსი</span><b>${esc(app.technician ? app.technician.username : "—")}</b></div>
            <div class="detail-meta__item"><span>მომთხოვნი</span><b>${esc(app.requester ? app.requester.username : "—")}</b></div>
            <div class="detail-meta__item"><span>დაწყება</span><b>${esc(formatDateTime(app.scheduled_start))}</b></div>
            <div class="detail-meta__item"><span>დასრულება</span><b>${esc(formatDateTime(app.scheduled_end))}</b></div>
            <div class="detail-meta__item"><span>ადგილი</span><b>${esc(app.location ? app.location.name : "—")}</b></div>
            ${app.notes ? `<div class="detail-meta__item"><span>შენიშვნა</span><b>${esc(app.notes)}</b></div>` : ""}
            ${app.completion_comment ? `<div class="detail-meta__item"><span>კომენტარი</span><b>${esc(app.completion_comment)}</b></div>` : ""}
          </div>
        </div>
      `;
    } catch (error) {
      host.innerHTML = errorState(error.message);
    }
  },

  // ---------------------------------------------------------------------------
  // Create / edit / reschedule
  // ---------------------------------------------------------------------------

  withEmpty(items) {
    return [{ value: "", label: "—" }, ...items];
  },

  async workOrderOptions() {
    const workOrders = await apiGet("/work-orders").catch(() => []);
    return this.withEmpty(workOrders.map((wo) => ({ value: wo.id, label: `${wo.work_order_number} — ${wo.title}` })));
  },

  async technicianOptions() {
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

  openCreate() {
    const base = [
      { name: "work_order_id", label: "სამუშაო ბრძანება", type: "select", required: true, options: () => this.workOrderOptions() },
      { name: "technician_id", label: "ტექნიკოსი", type: "select", required: true, options: () => this.technicianOptions() },
      { name: "scheduled_start", label: "დაწყება", type: "datetime-local", required: true },
      { name: "scheduled_end", label: "დასრულება", type: "datetime-local", required: true }
    ];
    const adminFields = this.isAdmin
      ? [
          { name: "asset_id", label: "აქტივი", type: "select", placeholder: "—", options: () => this.assetOptions() },
          { name: "location_id", label: "ადგილი", type: "select", placeholder: "—", options: () => this.locationOptions() },
        ]
      : [];
    const fields = [...base, ...adminFields, { name: "notes", label: "შენიშვნა", type: "textarea" }];

    openEntityDialog({
      kicker: "დისპეჩინგი",
      title: "ახალი ვიზიტი",
      fields,
      submitLabel: "შექმნა",
      onSave: async (values) => {
        const payload = {
          work_order_id: Number(values.work_order_id),
          technician_id: Number(values.technician_id),
          scheduled_start: values.scheduled_start,
          scheduled_end: values.scheduled_end,
          notes: values.notes || null
        };
        if (this.isAdmin) {
          payload.asset_id = values.asset_id ? Number(values.asset_id) : null;
          payload.location_id = values.location_id ? Number(values.location_id) : null;
        }
        await apiPost("/appointments", payload);
        showToast(STRINGS.success);
        await this.refresh();
      }
    });
  },

  openEdit(appointment) {
    const fields = [
      { name: "scheduled_start", label: "დაწყება", type: "datetime-local", required: true, value: appointment.scheduled_start || "" },
      { name: "scheduled_end", label: "დასრულება", type: "datetime-local", required: true, value: appointment.scheduled_end || "" },
      { name: "notes", label: "შენიშვნა", type: "textarea", value: appointment.notes || "" }
    ];

    openEntityDialog({
      kicker: `ვიზიტი ${appointment.appointment_number}`,
      title: "რედაქტირება",
      fields,
      onSave: async (values) => {
        await apiPatch(`/appointments/${appointment.id}`, {
          scheduled_start: values.scheduled_start,
          scheduled_end: values.scheduled_end,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openAssignAppointment(appointment) {
    openEntityDialog({
      kicker: `ვიზიტი ${appointment.appointment_number}`,
      title: "ტექნიკოსის დანიშვნა",
      fields: [
        { name: "technician_id", label: "ტექნიკოსი", type: "select", required: true, options: () => this.technicianOptions() }
      ],
      submitLabel: "დანიშვნა",
      onSave: async (values) => {
        await apiPatch(`/appointments/${appointment.id}/assign`, { technician_id: Number(values.technician_id) });
        await this.refresh();
      }
    });
  },

  openReschedule(appointment) {
    openEntityDialog({
      kicker: `ვიზიტი ${appointment.appointment_number}`,
      title: "გადანაწილება",
      fields: [
        { name: "scheduled_start", label: "ახალი დაწყება", type: "datetime-local", required: true },
        { name: "scheduled_end", label: "ახალი დასრულება", type: "datetime-local", required: true },
        { name: "notes", label: "შენიშვნა", type: "textarea", value: appointment.notes || "" }
      ],
      submitLabel: "გადანაწილება",
      onSave: async (values) => {
        await apiPatch(`/appointments/${appointment.id}/reschedule`, {
          scheduled_start: values.scheduled_start,
          scheduled_end: values.scheduled_end,
          notes: values.notes || null
        });
        showToast("ვიზიტი გადანაწილდა.");
        await this.refresh();
      }
    });
  },

  async changeStatus(appointment, status) {
    if (["cancelled", "missed"].includes(status)) {
      const confirmed = await confirmAction(
        `${status === "cancelled" ? "გააუქმო" : "მოინიშნოს გამოტოვებულად"} ვიზიტი ${appointment.appointment_number}?`,
        { title: status === "cancelled" ? "გაუქმება" : "გამოტოვება", okLabel: status === "cancelled" ? "გაუქმება" : "გამოტოვება", danger: true }
      );
      if (!confirmed) return;
    }
    try {
      await apiPatch(`/appointments/${appointment.id}/status`, { status });
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  // ---------------------------------------------------------------------------
  // Event handling (delegated from the content container).
  // ---------------------------------------------------------------------------

  async handleAction(action, node) {
    switch (action) {
      case "week-prev":
        this.state.weekOffset -= 1;
        this.detailId = null;
        await this.refresh();
        break;
      case "week-next":
        this.state.weekOffset += 1;
        this.detailId = null;
        await this.refresh();
        break;
      case "week-today":
        this.state.weekOffset = 0;
        this.detailId = null;
        await this.refresh();
        break;
      case "apply-dispatch-filters":
        this.state.technician_id = document.getElementById("dispatchTechnicianFilter")
          ? document.getElementById("dispatchTechnicianFilter").value
          : "";
        this.state.status = document.getElementById("dispatchStatusFilter").value;
        this.detailId = null;
        await this.refresh();
        break;
      case "open-appointment":
        this.detailId = Number(node.dataset.id);
        await this.refresh();
        break;
      case "close-appointment-detail":
        this.detailId = null;
        await this.refresh();
        break;
      default:
        break;
    }

    if (!this.detailId || ["open-appointment", "close-appointment-detail", "week-prev", "week-next", "week-today", "apply-dispatch-filters"].includes(action)) {
      return;
    }

    let appointment = null;
    try {
      appointment = await apiGet(`/appointments/${this.detailId}`);
    } catch (error) {
      showToast(error.message, true);
      return;
    }

    switch (action) {
      case "edit-appointment":
        this.openEdit(appointment);
        break;
      case "assign-appointment":
        this.openAssignAppointment(appointment);
        break;
      case "reschedule-appointment":
        this.openReschedule(appointment);
        break;
      case "transition-appointment":
        await this.changeStatus(appointment, node.dataset.status);
        break;
      default:
        break;
    }
  }
};

// Click delegation for the dispatch section.
document.getElementById("dispatchContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  DispatchView.handleAction(node.dataset.action, node);
});