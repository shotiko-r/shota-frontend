// views/stock.js — warehouse stock balances, movements and low stock (Phase 11).
// Verified Phase 10 endpoints:
//   GET  /warehouses/:id/stock          balances per warehouse
//   GET  /inventory/movements           append-only ledger
//   GET  /inventory/low-stock
//   POST /inventory/receive|issue|transfer|adjust   (manager/admin)

const StockView = {
  role: "employee",
  canManage: false,
  state: { tab: "balance", warehouse_id: "", movement_type: "", part_id: "" },

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);

    const actionButton = document.getElementById("stockActionButton");
    if (actionButton) {
      actionButton.hidden = !this.canManage;
      actionButton.onclick = () => this.openOperationPicker();
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("stockContent");
    if (!target) return;
    setLoading(target);
    try {
      const warehouses = await apiGet("/warehouses");
      this.renderShell(target, warehouses || []);
      await this.loadTab(target, warehouses || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  renderShell(target, warehouses) {
    const tabs = [
      ["balance", "ბალანსი"],
      ["movements", "მოძრაობები"],
      ["low", "დაბალი მარაგი"]
    ];
    target.innerHTML = `
      <div class="detail-tabs" role="tablist" aria-label="მარაგების განყოფილებები">
        ${tabs.map(([key, label]) => `
          <button type="button" role="tab" class="detail-tabs__tab ${this.state.tab === key ? "is-active" : ""}" data-action="stock-tab" data-tab="${key}">${label}</button>
        `).join("")}
      </div>
      ${this.canManage ? `
      <div class="view-toolbar" aria-label="მარაგის ოპერაციები">
        <span class="form-hint">ოპერაციები:</span>
        <button type="button" class="btn btn--primary btn--compact" data-action="op-receive">მიღება</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="op-issue">გაცემა</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="op-transfer">გადატანა</button>
        <button type="button" class="btn btn--ghost btn--compact" data-action="op-adjust">კორექტირება</button>
      </div>` : ""}
      <div id="stockTabContent" aria-live="polite"></div>
    `;
  },

  async loadTab(target, warehouses) {
    const host = document.getElementById("stockTabContent");
    if (!host) return;
    setLoading(host);
    try {
      switch (this.state.tab) {
        case "balance":
          await this.loadBalanceTab(host, warehouses);
          break;
        case "movements":
          await this.loadMovementsTab(host, warehouses);
          break;
        case "low":
          await this.loadLowStockTab(host);
          break;
        default:
          break;
      }
    } catch (error) {
      host.innerHTML = errorState(error.message);
    }
  },

  async loadBalanceTab(host, warehouses) {
    const options = [
      '<option value="">აირჩიე საწყობი…</option>',
      ...warehouses.map((w) => `<option value="${w.id}" ${String(this.state.warehouse_id) === String(w.id) ? "selected" : ""}>${esc(w.name)}</option>`)
    ].join("");

    host.innerHTML = `
      <div class="view-toolbar" aria-label="საწყობის არჩევა">
        <select class="input view-toolbar__select" id="stockWarehouseSelect" aria-label="საწყობი">${options}</select>
        <button type="button" class="btn btn--primary btn--compact" data-action="load-balance">ჩვენება</button>
      </div>
      <div id="stockBalanceList"></div>
    `;

    if (this.state.warehouse_id) await this.loadBalance(this.state.warehouse_id);
  },

  async loadBalance(warehouseId) {
    const host = document.getElementById("stockBalanceList");
    if (!host) return;
    setLoading(host);
    try {
      const stock = await apiGet(`/warehouses/${warehouseId}/stock`);
      const rows = (stock || []).map((s) => `
        <tr>
          <td>
            <div class="row-title">${esc(s.part.name)}</div>
            <small class="row-sub">${esc(s.part.sku)}</small>
          </td>
          <td>${esc(String(s.quantity))} ${esc(s.part.unit || "")}</td>
          <td>${esc(String(s.reserved_quantity))} ${esc(s.part.unit || "")}</td>
          <td><b>${esc(String(s.available_quantity))} ${esc(s.part.unit || "")}</b></td>
          <td>${esc(formatDateTime(s.updated_at))}</td>
        </tr>`).join("");
      host.innerHTML = dataTable(["ნაწილი", "მარაგი", "დაჯავშნული", "ხელმისაწვდომი", "განახლება"], rows, "ბალანსი არ არის");
    } catch (error) {
      host.innerHTML = errorState(error.message);
    }
  },

  async loadMovementsTab(host, warehouses) {
    const params = new URLSearchParams();
    if (this.state.movement_type) params.set("movement_type", this.state.movement_type);
    if (this.state.part_id) params.set("part_id", this.state.part_id);
    const query = params.toString() ? `?${params.toString()}` : "";
    const movements = await apiGet(`/inventory/movements${query}`);

    const typeOptions = Object.entries(MOVEMENT_TYPE_LABELS)
      .map(([v, l]) => `<option value="${v}" ${this.state.movement_type === v ? "selected" : ""}>${esc(l)}</option>`)
      .join("");

    const rows = (movements || []).map((m) => `
      <tr>
        <td><b>${esc(MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type)}</b></td>
        <td>
          <div class="row-title">${esc(m.part.name)}</div>
          <small class="row-sub">${esc(m.part.sku)}</small>
        </td>
        <td>${esc(m.warehouse ? m.warehouse.name : "—")}</td>
        <td><b>${m.quantity < 0 ? "−" : "+"}${esc(String(Math.abs(m.quantity)))}</b> ${esc(m.part.unit || "")}</td>
        <td>${esc(m.actor_user ? m.actor_user.username : "—")}</td>
        <td>${esc(formatDateTime(m.created_at))}</td>
      </tr>`).join("");

    host.innerHTML = `
      <div class="view-toolbar" aria-label="მოძრაობების ფილტრები">
        <select class="input view-toolbar__select" id="movementTypeFilter" aria-label="ტიპის ფილტრი">
          <option value="">ყველა ტიპი</option>
          ${typeOptions}
        </select>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-movement-filters">ფილტრი</button>
      </div>
      ${dataTable(["ოპერაცია", "ნაწილი", "საწყობი", "რაოდენობა", "ოპერატორი", "დრო"], rows, "მოძრაობები არ არის")}
    `;
  },

  async loadLowStockTab(host) {
    const items = await apiGet("/inventory/low-stock");
    const rows = (items || []).map((s) => `
      <tr>
        <td>
          <div class="row-title">${esc(s.part.name)}</div>
          <small class="row-sub">${esc(s.part.sku)}</small>
        </td>
        <td>${esc(s.warehouse ? s.warehouse.name : "—")}</td>
        <td>${esc(String(s.quantity))} ${esc(s.part.unit || "")}</td>
        <td>${esc(String(s.available_quantity))} ${esc(s.part.unit || "")}</td>
        <td>${esc(String(s.reorder_point))} ${esc(s.part.unit || "")}</td>
        <td><b class="text-danger">${esc(String(s.reserved_quantity))}</b> ${esc(s.part.unit || "")}</td>
      </tr>`).join("");
    host.innerHTML = dataTable(
      ["ნაწილი", "საწყობი", "მარაგი", "ხელმისაწვდომი", "შეკვეთის წერტილი", "დაჯავშნული"],
      rows,
      "დაბალი მარაგი არ არის"
    );
  },

  // ---------------------------------------------------------------------------
  // Operations (manager/admin)
  // ---------------------------------------------------------------------------

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

  openOperationPicker() {
    openEntityDialog({
      kicker: "მარაგის ოპერაცია",
      title: "ოპერაციის ტიპი",
      fields: [
        {
          name: "operation", label: "ოპერაცია", type: "select", required: true,
          options: [
            { value: "receive", label: "მიღება" },
            { value: "issue", label: "გაცემა" },
            { value: "transfer", label: "გადატანა" },
            { value: "adjust", label: "კორექტირება" }
          ]
        }
      ],
      submitLabel: "გაგრძელება",
      onSave: async (values) => {
        closeDialog("entityDialog");
        const action = { receive: "openReceive", issue: "openIssue", transfer: "openTransfer", adjust: "openAdjust" }[values.operation];
        this[action]();
      }
    });
  },

  openReceive() {
    openEntityDialog({
      kicker: "მარაგის ოპერაცია",
      title: "მარაგის მიღება",
      fields: [
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "reference", label: "რეფერენსი", type: "text", placeholder: "მაგ. ინვოისი #123" },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "მიღება",
      onSave: async (values) => {
        await apiPost("/inventory/receive", {
          warehouse_id: Number(values.warehouse_id),
          part_id: Number(values.part_id),
          quantity: values.quantity,
          reference: values.reference || null,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openIssue() {
    openEntityDialog({
      kicker: "მარაგის ოპერაცია",
      title: "მარაგის გაცემა",
      fields: [
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "work_order_id", label: "სამუშაო ბრძანება", type: "select", placeholder: "—", options: () => this.workOrderOptions() },
        { name: "reference", label: "რეფერენსი", type: "text" },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "გაცემა",
      onSave: async (values) => {
        await apiPost("/inventory/issue", {
          warehouse_id: Number(values.warehouse_id),
          part_id: Number(values.part_id),
          quantity: values.quantity,
          work_order_id: values.work_order_id ? Number(values.work_order_id) : null,
          reference: values.reference || null,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openTransfer() {
    openEntityDialog({
      kicker: "მარაგის ოპერაცია",
      title: "გადატანა საწყობებს შორის",
      fields: [
        { name: "from_warehouse_id", label: "გამომავალი საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "to_warehouse_id", label: "მიმღები საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity", label: "რაოდენობა", type: "number", required: true, min: 0.01, step: "0.01" },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "გადატანა",
      onSave: async (values) => {
        await apiPost("/inventory/transfer", {
          from_warehouse_id: Number(values.from_warehouse_id),
          to_warehouse_id: Number(values.to_warehouse_id),
          part_id: Number(values.part_id),
          quantity: values.quantity,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openAdjust() {
    openEntityDialog({
      kicker: "მარაგის ოპერაცია",
      title: "კორექტირება",
      fields: [
        { name: "warehouse_id", label: "საწყობი", type: "select", required: true, options: () => this.warehouseOptions() },
        { name: "part_id", label: "ნაწილი", type: "select", required: true, options: () => this.partOptions() },
        { name: "quantity_delta", label: "ცვლილება (±)", type: "number", required: true, step: "0.01", placeholder: "მაგ. -5 ან +3" },
        { name: "reason", label: "მიზეზი", type: "text", required: true },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "კორექტირება",
      onSave: async (values) => {
        await apiPost("/inventory/adjust", {
          warehouse_id: Number(values.warehouse_id),
          part_id: Number(values.part_id),
          quantity_delta: values.quantity_delta,
          reason: values.reason,
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  async handleAction(action, node) {
    switch (action) {
      case "stock-tab":
        this.state.tab = node.dataset.tab;
        await this.refresh();
        break;
      case "load-balance":
        this.state.warehouse_id = document.getElementById("stockWarehouseSelect").value;
        await this.loadBalance(this.state.warehouse_id);
        break;
      case "apply-movement-filters":
        this.state.movement_type = document.getElementById("movementTypeFilter").value;
        await this.refresh();
        break;
      case "op-receive":
        this.openReceive();
        break;
      case "op-issue":
        this.openIssue();
        break;
      case "op-transfer":
        this.openTransfer();
        break;
      case "op-adjust":
        this.openAdjust();
        break;
      default:
        break;
    }
  }
};

document.getElementById("stockContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  StockView.handleAction(node.dataset.action, node);
});