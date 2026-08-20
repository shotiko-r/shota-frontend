// views/dashboard.js — operational overview (Phase 11).
// KPIs are computed client-side from verified list endpoints only:
//   GET /work-orders, GET /appointments, GET /slas, GET /inventory/low-stock.
// No invented endpoints; role-guarded sections (backend remains authoritative).

const DashboardView = {
  role: "employee",
  loaded: false,

  async init(options = {}) {
    this.role = options.role || this.role;
    this.bindCreateButton();
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    await this.refresh();
  },

  bindCreateButton() {
    const button = document.getElementById("dashboardCreateWorkOrder");
    if (!button) return;
    const canCreate = capability(this.role, "workOrders");
    button.hidden = !canCreate;
    button.onclick = () => {
      Workspace.navigate("workOrders");
      window.setTimeout(() => WorkOrdersView.openCreate(), 60);
    };
  },

  async refresh() {
    const target = document.getElementById("dashboardContent");
    if (!target) return;
    setLoading(target);
    try {
      const canReadWork = capability(this.role, "workOrders");
      const canReadStock = capability(this.role, "stock");

      const results = await Promise.all([
        canReadWork ? apiGet("/work-orders").catch(() => []) : Promise.resolve([]),
        canReadWork ? apiGet("/appointments").catch(() => []) : Promise.resolve([]),
        apiGet("/slas").catch(() => []),
        canReadStock ? apiGet("/inventory/low-stock").catch(() => []) : Promise.resolve([])
      ]);
      const workOrders = results[0] || [];
      const appointments = results[1] || [];
      const slas = results[2] || [];
      const lowStock = results[3] || [];

      target.innerHTML = this.render({ workOrders, appointments, slas, lowStock, canReadStock });
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  computeKpis(workOrders) {
    const open = workOrders.filter((wo) =>
      ["new", "assigned", "in_progress", "blocked"].includes(wo.status)
    );
    const inProgress = workOrders.filter((wo) => wo.status === "in_progress");
    const blocked = workOrders.filter((wo) => wo.status === "blocked");
    const now = new Date();
    const overdue = workOrders.filter(
      (wo) => wo.due_at && !["completed", "cancelled"].includes(wo.status) && new Date(wo.due_at) < now
    );
    return { total: workOrders.length, open: open.length, inProgress: inProgress.length, blocked: blocked.length, overdue: overdue.length };
  },

  upcomingAppointments(appointments) {
    const now = new Date();
    return appointments
      .filter((app) => new Date(app.scheduled_start) >= now && ACTIVE_APPOINTMENT_STATUSES.includes(app.status))
      .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
      .slice(0, 6);
  },

  render({ workOrders, appointments, slas, lowStock, canReadStock }) {
    const kpi = this.computeKpis(workOrders);

    const byStatus = WORK_ORDER_STATUS_ORDER.filter((s) => ["new", "assigned", "in_progress", "blocked"].includes(s))
      .map((status) => {
        const count = workOrders.filter((wo) => wo.status === status).length;
        const meta = WORK_ORDER_STATUS_META[status];
        const pct = workOrders.length ? Math.round((count / workOrders.length) * 100) : 0;
        return `
          <div class="kpi-bar">
            <span class="kpi-bar__label">${esc(meta.label)}</span>
            <div class="kpi-bar__track"><div class="kpi-bar__fill kpi-bar__fill--${esc(meta.tone)}" style="width:${pct}%"></div></div>
            <b>${count}</b>
          </div>`;
      })
      .join("");

    const upcoming = this.upcomingAppointments(appointments).map((app) => `
      <div class="schedule-item">
        <span class="schedule-item__time">${esc(formatDateTime(app.scheduled_start))}</span>
        <span class="schedule-item__body">
          <b>${esc(app.appointment_number || `#${app.id}`)}</b>
          <span>${esc(app.work_order ? app.work_order.title : "")}</span>
        </span>
        ${statusPill(app.status, APPOINTMENT_STATUS_META)}
      </div>`).join("") || emptyState("უახლოესი ვიზიტები არ არის");

    const riskSlas = slas.filter((s) => s.status === "at_risk");
    const breachedSlas = slas.filter((s) => s.status === "breached");
    const slaRows = [...riskSlas, ...breachedSlas].slice(0, 8).map((sla) => `
      <div class="sla-item sla-item--${esc(sla.status)}">
        <span class="sla-item__ref">${esc(sla.work_order ? sla.work_order.work_order_number : `#${sla.work_order_id}`)}</span>
        <span class="sla-item__title">${esc(sla.work_order ? sla.work_order.title : "")}</span>
        <span class="sla-item__due">${esc(formatDateTime(sla.resolution_due_at))}</span>
        ${statusPill(sla.status, SLA_STATUS_META)}
      </div>`).join("") || emptyState("რისკის ქვეშ მყოფი SLA არ არის");

    const lowStockRows = lowStock.slice(0, 8).map((item) => `
      <div class="stock-item">
        <span class="stock-item__part">${esc(item.part.name)} <small>${esc(item.part.sku)}</small></span>
        <span class="stock-item__wh">${esc(item.warehouse.name)}</span>
        <span class="stock-item__qty stock-item__qty--low">${esc(String(item.available_quantity))} ${esc(item.part.unit || "")}</span>
      </div>`).join("") || emptyState("დაბალი მარაგი არ არის");

    return `
      <div class="metrics-grid" aria-label="ოპერატიული მაჩვენებლები">
        <article class="metric-card metric-card--yellow">
          <span class="metric-card__label">ღია სამუშაო ბრძანებები</span>
          <strong>${kpi.open}</strong>
          <span class="metric-card__note">შესრულების პროცესშია</span>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">მიმდინარეობს</span>
          <strong>${kpi.inProgress}</strong>
          <span class="metric-card__note">ტექნიკოსებთან სამუშაოზე</span>
        </article>
        <article class="metric-card metric-card--alert">
          <span class="metric-card__label">დაბლოკილია</span>
          <strong>${kpi.blocked}</strong>
          <span class="metric-card__note">მოითხოვს ყურადღებას</span>
        </article>
        <article class="metric-card metric-card--alert">
          <span class="metric-card__label">ვადაგადაცილებული</span>
          <strong>${kpi.overdue}</strong>
          <span class="metric-card__note">ვადა უკვე გასულია</span>
        </article>
        <article class="metric-card metric-card--alert">
          <span class="metric-card__label">SLA რისკის ქვეშ</span>
          <strong>${riskSlas.length}</strong>
          <span class="metric-card__note">მოითხოვს სასწრაფო ქმედებას</span>
        </article>
      </div>

      <div class="workspace-insights">
        <article class="insight-card">
          <div class="section-title-row">
            <div>
              <span class="workspace-kicker">მდგომარეობა</span>
              <h2>სამუშაო ბრძანებები სტატუსების მიხედვით</h2>
            </div>
          </div>
          <div class="kpi-bars">${byStatus}</div>
        </article>

        <article class="insight-card insight-card--schedule">
          <div class="section-title-row">
            <div>
              <span class="workspace-kicker">განრიგი</span>
              <h2>უახლოესი ვიზიტები</h2>
            </div>
          </div>
          <div class="schedule-list">${upcoming}</div>
        </article>

        <article class="insight-card">
          <div class="section-title-row">
            <div>
              <span class="workspace-kicker">SLA</span>
              <h2>რისკის ქვეშ / დარღვეული</h2>
            </div>
          </div>
          <div class="sla-list">${slaRows}</div>
        </article>

        ${canReadStock ? `
        <article class="insight-card">
          <div class="section-title-row">
            <div>
              <span class="workspace-kicker">მარაგები</span>
              <h2>დაბალი მარაგი</h2>
            </div>
          </div>
          <div class="stock-list">${lowStockRows}</div>
        </article>` : ""}
      </div>
    `;
  }
};