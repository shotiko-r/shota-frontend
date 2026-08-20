// views/purchaseOrders.js — purchase orders (Phase 11).
// Verified Phase 10 endpoints:
//   GET /purchase-orders, GET /purchase-orders/:id
//   POST /purchase-orders, PATCH /purchase-orders/:id (draft only)
//   PATCH /purchase-orders/:id/status  (submit/ordered/cancel)
//   POST /purchase-orders/:id/receive  (receipt with per-item quantities)
// Manager/admin only (migration 009).

const PurchaseOrdersView = {
  role: "employee",
  canManage: false,
  state: { status: "", supplier_id: "" },
  detailId: null,
  parts: [],

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);
    this.detailId = null;

    const createButton = document.getElementById("createPurchaseOrderButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
    }
    try {
      this.parts = await apiGet("/parts");
    } catch (error) {
      this.parts = [];
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("purchaseOrdersContent");
    if (!target) return;
    setLoading(target);
    const params = new URLSearchParams();
    if (this.state.status) params.set("status", this.state.status);
    if (this.state.supplier_id) params.set("supplier_id", this.state.supplier_id);
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const [orders, suppliers] = await Promise.all([
        apiGet(`/purchase-orders${query}`),
        apiGet("/suppliers").catch(() => [])
      ]);
      this.render(target, orders || [], suppliers || []);
      if (this.detailId) {
        try {
          const po = await apiGet(`/purchase-orders/${this.detailId}`);
          this.loadDetail(po);
        } catch (error) {
          showToast(error.message, true);
        }
      }
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, orders, suppliers) {
    const rows = orders.map((po) => `
      <tr class="clickable-row" data-action="open-po" data-id="${po.id}">
        <td><b>${esc(po.purchase_order_number)}</b></td>
        <td>${esc(po.supplier.name)}</td>
        <td>${esc(po.purchase_request ? po.purchase_request.request_number : "—")}</td>
        <td>${esc(po.warehouse ? po.warehouse.name : "—")}</td>
        <td>${statusPill(po.status, PO_STATUS_META)}</td>
        <td>${esc(formatDateOnly(po.expected_at))}</td>
        <td>${(po.items || []).length}</td>
      </tr>`).join("");

    target.innerHTML = `
      ${this.detailId ? `<div id="poDetail"></div>` : ""}
      <div class="view-toolbar" aria-label="შესყიდვის ორდერების ფილტრები">
        <select class="input view-toolbar__select" id="poStatusFilter" aria-label="სტატუსის ფილტრი">
          <option value="">ყველა სტატუსი</option>
          ${PO_STATUS_ORDER.map((s) => `<option value="${s}" ${this.state.status === s ? "selected" : ""}>${esc(PO_STATUS_META[s].label)}</option>`).join("")}
        </select>
        <select class="input view-toolbar__select" id="poSupplierFilter" aria-label="მომწოდებლის ფილტრი">
          <option value="">ყველა მომწოდებელი</option>
          ${suppliers.map((s) => `<option value="${s.id}" ${String(this.state.supplier_id) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-po-filters">ფილტრი</button>
      </div>
      ${dataTable(
        ["ნომერი", "მომწოდებელი", "მოთხოვნა", "საწყობი", "სტატუსი", "მოსალოდნელია", "პუნქტები"],
        rows,
        "შესყიდვის ორდერები არ არის"
      )}
    `;
  },

  // ---------------------------------------------------------------------------
  // Create / edit
  // ---------------------------------------------------------------------------

  partOptions() {
    return this.parts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  },

  async supplierOptions() {
    const suppliers = await apiGet("/suppliers").catch(() => []);
    return [{ value: "", label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))];
  },

  async warehouseOptions() {
    const warehouses = await apiGet("/warehouses").catch(() => []);
    return [{ value: "", label: "—" }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))];
  },

  async purchaseRequestOptions() {
    const requests = await apiGet("/purchase-requests?status=approved").catch(() => []);
    return [{ value: "", label: "—" }, ...requests.map((pr) => ({ value: pr.id, label: `${pr.request_number} · ${pr.requester ? pr.requester.username : ""}` }))];
  },

  openCreate() {
    openEntityDialog({
      kicker: "შესყიდვები",
      title: "ახალი შესყიდვის ორდერი",
      fields: [
        { name: "supplier_id", label: "მომწოდებელი", type: "select", required: true, options: () => this.supplierOptions() },
        { name: "purchase_request_id", label: "შესყიდვის მოთხოვნა", type: "select", placeholder: "—", options: () => this.purchaseRequestOptions() },
        { name: "warehouse_id", label: "მიმღები საწყობი", type: "select", placeholder: "—", options: () => this.warehouseOptions() },
        { name: "expected_at", label: "მოსალოდნელი ვადა", type: "date" },
        {
          name: "items", label: "პუნქტები", type: "items", required: true, addLabel: "პუნქტის დამატება",
          itemFields: [
            { name: "part_id", type: "select", options: this.partOptions() },
            { name: "ordered_quantity", type: "number", min: 0.01, step: "0.01", placeholder: "რაოდენობა" },
            { name: "unit_cost", type: "number", min: 0, step: "0.01", placeholder: "ფასი" }
          ]
        }
      ],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        await apiPost("/purchase-orders", {
          supplier_id: Number(values.supplier_id),
          purchase_request_id: values.purchase_request_id ? Number(values.purchase_request_id) : null,
          warehouse_id: values.warehouse_id ? Number(values.warehouse_id) : null,
          expected_at: values.expected_at || null,
          items: values.items.map((i) => ({
            part_id: Number(i.part_id),
            ordered_quantity: i.ordered_quantity,
            unit_cost: i.unit_cost == null ? null : i.unit_cost
          }))
        });
        await this.refresh();
      }
    });
  },

  openEdit(po) {
    openEntityDialog({
      kicker: `ორდერი ${po.purchase_order_number}`,
      title: "რედაქტირება",
      fields: [
        { name: "warehouse_id", label: "მიმღები საწყობი", type: "select", placeholder: "—", value: po.warehouse_id || "", options: () => this.warehouseOptions() },
        { name: "expected_at", label: "მოსალოდნელი ვადა", type: "date", value: po.expected_at || "" },
        {
          name: "items", label: "პუნქტები", type: "items", required: true, addLabel: "პუნქტის დამატება",
          value: (po.items || []).map((i) => ({
            part_id: i.part_id,
            ordered_quantity: i.ordered_quantity,
            unit_cost: i.unit_cost == null ? "" : i.unit_cost
          })),
          itemFields: [
            { name: "part_id", type: "select", options: this.partOptions() },
            { name: "ordered_quantity", type: "number", min: 0.01, step: "0.01", placeholder: "რაოდენობა" },
            { name: "unit_cost", type: "number", min: 0, step: "0.01", placeholder: "ფასი" }
          ]
        }
      ],
      onSave: async (values) => {
        await apiPatch(`/purchase-orders/${po.id}`, {
          warehouse_id: values.warehouse_id ? Number(values.warehouse_id) : null,
          expected_at: values.expected_at || null,
          items: values.items.map((i) => ({
            part_id: Number(i.part_id),
            ordered_quantity: i.ordered_quantity,
            unit_cost: i.unit_cost == null ? null : i.unit_cost
          }))
        });
        await this.refreshDetail();
      }
    });
  },

  // ---------------------------------------------------------------------------
  // Detail + transitions
  // ---------------------------------------------------------------------------

  async openDetail(id) {
    this.detailId = id;
    await this.refresh();
  },

  async refreshDetail() {
    await this.refresh();
  },

  async loadDetail(po) {
    const host = document.getElementById("poDetail");
    if (!host) return;

    const transitions = this.allowedTransitions(po.status);
    const buttons = transitions.map((s) => {
      const meta = PO_STATUS_META[s];
      return `<button type="button" class="btn btn--ghost btn--compact" data-action="transition-po" data-status="${s}">→ ${esc(meta.label)}</button>`;
    }).join(" ");

    const actions = [
      po.status === "draft" ? `<button type="button" class="btn btn--ghost btn--compact" data-action="edit-po">რედაქტირება</button>` : "",
      buttons
    ].filter(Boolean).join(" ");

    const itemRows = (po.items || []).map((i) => {
      const received = i.received_quantity || 0;
      return `
        <tr>
          <td>
            <div class="row-title">${esc(i.part.name)}</div>
            <small class="row-sub">${esc(i.part.sku)}</small>
          </td>
          <td>${esc(String(i.ordered_quantity))} ${esc(i.part.unit || "")}</td>
          <td>${esc(String(received))} ${esc(i.part.unit || "")}</td>
          <td>${i.unit_cost != null ? esc(String(i.unit_cost)) : "—"}</td>
          <td>${esc(String(i.ordered_quantity - received))} ${esc(i.part.unit || "")}</td>
        </tr>`;
    }).join("");

    host.innerHTML = `
      <div class="detail">
        <div class="detail__top">
          <button type="button" class="btn btn--ghost btn--compact" data-action="close-po">×</button>
          <div class="detail__head">
            <span class="workspace-kicker">${esc(po.purchase_order_number)}</span>
            <h2>${esc(po.supplier.name)}</h2>
          </div>
          <div class="detail__status">${statusPill(po.status, PO_STATUS_META)}</div>
        </div>
        ${actions ? `<div class="detail__actions">${actions}</div>` : ""}
        <div class="detail-meta">
          <div class="detail-meta__item"><span>მომწოდებელი</span><b>${esc(po.supplier.name)}</b></div>
          <div class="detail-meta__item"><span>შესყიდვის მოთხოვნა</span><b>${esc(po.purchase_request ? po.purchase_request.request_number : "—")}</b></div>
          <div class="detail-meta__item"><span>საწყობი</span><b>${esc(po.warehouse ? po.warehouse.name : "—")}</b></div>
          <div class="detail-meta__item"><span>დეპარტამენტი</span><b>${esc(po.department ? po.department.name : "—")}</b></div>
          <div class="detail-meta__item"><span>მოსალოდნელია</span><b>${esc(formatDateOnly(po.expected_at))}</b></div>
          <div class="detail-meta__item"><span>შექმნილია</span><b>${esc(formatDateTime(po.created_at))} · ${esc(po.created_by_user ? po.created_by_user.username : "")}</b></div>
          <div class="detail-meta__item"><span>მიღებულია</span><b>${esc(formatDateTime(po.received_at))}</b></div>
        </div>
        ${dataTable(["ნაწილი", "შეკვეთილია", "მიღებულია", "ფასი", "დარჩენილია"], itemRows, "პუნქტები არ არის")}
      </div>
    `;
  },

  allowedTransitions(status) {
    const targets = allowedTransitions("po", status);
    const result = [];
    for (const t of targets) {
      if (["submitted", "cancelled", "ordered", "received", "partially_received"].includes(t)) result.push(t);
    }
    return result;
  },

  openReceive(po) {
    const fields = (po.items || [])
      .filter((i) => (i.received_quantity || 0) < i.ordered_quantity)
      .map((i) => ({
        name: `qty_${i.part_id}`,
        label: `${i.part.name} (${i.part.sku}) · დარჩენილია ${i.ordered_quantity - (i.received_quantity || 0)}`,
        type: "number",
        required: true,
        min: 0.01,
        step: "0.01",
        value: i.ordered_quantity - (i.received_quantity || 0)
      }));

    if (!fields.length) {
      showToast("მისაღები არაფერია.", true);
      return;
    }

    openEntityDialog({
      kicker: `ორდერი ${po.purchase_order_number}`,
      title: "მიღება",
      fields,
      submitLabel: "მიღება",
      onSave: async (values) => {
        const items = fields
          .map((f) => ({ part_id: Number(f.name.replace("qty_", "")), quantity: values[f.name] }))
          .filter((i) => i.quantity != null && i.quantity > 0);
        await apiPost(`/purchase-orders/${po.id}/receive`, { items });
        await this.refreshDetail();
      }
    });
  },

  async transition(po, status) {
    if (status === "cancelled") {
      const confirmed = await confirmAction(`გააუქმო ორდერი ${po.purchase_order_number}?`, { title: "გაუქმება", okLabel: "გაუქმება" });
      if (!confirmed) return;
    }
    try {
      await apiPatch(`/purchase-orders/${po.id}/status`, { status });
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-po-filters":
        this.state.status = document.getElementById("poStatusFilter").value;
        this.state.supplier_id = document.getElementById("poSupplierFilter").value;
        await this.refresh();
        break;
      case "open-po":
        this.detailId = Number(node.dataset.id);
        await this.refresh();
        break;
      case "close-po":
        this.detailId = null;
        await this.refresh();
        break;
      case "edit-po":
        try {
          const po = await apiGet(`/purchase-orders/${this.detailId}`);
          this.openEdit(po);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      case "transition-po":
        try {
          const po = await apiGet(`/purchase-orders/${this.detailId}`);
          if (["received", "partially_received"].includes(node.dataset.status)) {
            this.openReceive(po);
          } else {
            await this.transition(po, node.dataset.status);
          }
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      default:
        break;
    }
  }
};

document.getElementById("purchaseOrdersContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  PurchaseOrdersView.handleAction(node.dataset.action, node);
});