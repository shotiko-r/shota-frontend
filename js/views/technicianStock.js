// views/technicianStock.js — field stock held by technicians (Phase 11).
// Verified Phase 10 endpoints (technician_id in URL is never trusted; the
// backend re-verifies own/department scope):
//   GET  /technicians/:id/stock
//   POST /technicians/:id/stock/receive
//   POST /technicians/:id/stock/:partId/consume
//   POST /technicians/:id/stock/:partId/return

const TechnicianStockView = {
  role: "employee",
  isTechnician: false,
  canManage: false,
  selectedTechnicianId: null,
  users: [],

  async init({ role } = {}) {
    this.role = role || "employee";
    this.isTechnician = this.role === "technician";
    this.canManage = ["admin", "manager"].includes(this.role);
    this.selectedTechnicianId = this.isTechnician
      ? (Workspace.user && Workspace.user.id) || null
      : null;

    if (this.canManage) {
      try {
        const users = await apiGet("/users");
        this.users = (users || []).filter(
          (u) => u.role === "technician" || (u.roles && u.roles.some((r) => r.name === "technician"))
        );
        if (!this.selectedTechnicianId && this.users.length) {
          this.selectedTechnicianId = this.users[0].id;
        }
      } catch (error) {
        this.users = [];
      }
    }

    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("technicianStockContent");
    if (!target) return;
    setLoading(target);
    try {
      const technicianSelect = this.canManage
        ? `
        <div class="view-toolbar" aria-label="ტექნიკოსის არჩევა">
          <select class="input view-toolbar__select" id="technicianStockSelect" aria-label="ტექნიკოსი">
            ${this.users.map((u) => `<option value="${u.id}" ${String(this.selectedTechnicianId) === String(u.id) ? "selected" : ""}>${esc(displayName(u))}</option>`).join("")}
          </select>
          <button type="button" class="btn btn--primary btn--compact" data-action="select-technician">ჩვენება</button>
        </div>`
        : "";

      target.innerHTML = `
        ${technicianSelect}
        <div class="view-toolbar" aria-label="საველე მარაგის ოპერაციები">
          <span class="form-hint">ოპერაციები:</span>
          <button type="button" class="btn btn--primary btn--compact" data-action="tech-receive">მიღება</button>
          ${this.isTechnician ? `
            <button type="button" class="btn btn--ghost btn--compact" data-action="tech-consume">მოხმარება</button>
            <button type="button" class="btn btn--ghost btn--compact" data-action="tech-return">დაბრუნება</button>
          ` : ""}
        </div>
        <div id="technicianStockList" aria-live="polite"></div>
      `;

      if (this.selectedTechnicianId) await this.loadStock();
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  async loadStock() {
    const host = document.getElementById("technicianStockList");
    if (!host) return;
    setLoading(host);
    try {
      const stock = await apiGet(`/technicians/${this.selectedTechnicianId}/stock`);
      const rows = (stock || []).map((s) => `
        <tr>
          <td>
            <div class="row-title">${esc(s.part.name)}</div>
            <small class="row-sub">${esc(s.part.sku)}${s.part.category ? ` · ${esc(s.part.category)}` : ""}</small>
          </td>
          <td>${esc(String(s.quantity))} ${esc(s.part.unit || "")}</td>
          <td>${esc(String(s.reserved_quantity))} ${esc(s.part.unit || "")}</td>
          <td><b>${esc(String(s.available_quantity))} ${esc(s.part.unit || "")}</b></td>
        </tr>`).join("");
      host.innerHTML = dataTable(["ნაწილი", "მარაგი", "დაჯავშნული", "ხელმისაწვდომი"], rows, "საველე მარაგი არ არის");
    } catch (error) {
      host.innerHTML = errorState(error.message);
    }
  },

  withEmpty(items) {
    return [{ value: "", label: "—" }, ...items];
  },

  async partOptions() {
    const parts = await apiGet("/parts").catch(() => []);
    return this.withEmpty(parts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })));
  },

  async warehouseOptions() {
    const warehouses = await apiGet("/warehouses").catch(() => []);
    return this.withEmpty(warehouses.map((w) => ({ value: w.id, label: w.name })));
  },

  async workOrderOptions() {
    const workOrders = await apiGet("/work-orders").catch(() => []);
    return this.withEmpty(workOrders.map((wo) => ({ value: wo.id, label: `${wo.work_order_number} — ${wo.title}` })));
  },

  technicianId() {
    return this.selectedTechnicianId || (Workspace.user && Workspace.user.id);
  },

  openReceive() {
    openEntityDialog({
      kicker: "საველე მარაგი",
      title: "მარაგის მიღება ტექნიკოსთან",
      fields: [
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "work_order_id", label: "სამუშაო ბრძანება", type: "select", required: true, options: () => this.workOrderOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "მიღება",
      onSave: async (values) => {
        await apiPost(`/technicians/${this.technicianId()}/stock/receive`, {
          part_id: Number(values.part_id),
          warehouse_id: Number(values.warehouse_id),
          work_order_id: Number(values.work_order_id),
          quantity: values.quantity,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openConsume() {
    openEntityDialog({
      kicker: "საველე მარაგი",
      title: "მარაგის მოხმარება",
      fields: [
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "work_order_id", label: "სამუშაო ბრძანება", type: "select", placeholder: "—", options: () => this.workOrderOptions() },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "მოხმარება",
      onSave: async (values) => {
        await apiPost(`/technicians/${this.technicianId()}/stock/${values.part_id}/consume`, {
          quantity: values.quantity,
          work_order_id: values.work_order_id ? Number(values.work_order_id) : null,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openReturn() {
    openEntityDialog({
      kicker: "საველე მარაგი",
      title: "მარაგის დაბრუნება",
      fields: [
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "დაბრუნება",
      onSave: async (values) => {
        await apiPost(`/technicians/${this.technicianId()}/stock/${values.part_id}/return`, {
          quantity: values.quantity,
          warehouse_id: Number(values.warehouse_id),
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  async handleAction(action, node) {
    switch (action) {
      case "select-technician":
        this.selectedTechnicianId = Number(document.getElementById("technicianStockSelect").value);
        await this.refresh();
        break;
      case "tech-receive":
        this.openReceive();
        break;
      case "tech-consume":
        this.openConsume();
        break;
      case "tech-return":
        this.openReturn();
        break;
      default:
        break;
    }
  }
};

document.getElementById("technicianStockContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  TechnicianStockView.handleAction(node.dataset.action, node);
});