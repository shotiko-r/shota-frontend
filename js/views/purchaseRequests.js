// views/purchaseRequests.js — procurement entry point (Phase 11).
// Verified Phase 10 endpoints:
//   GET /purchase-requests, GET /purchase-requests/:id
//   POST /purchase-requests, PATCH /purchase-requests/:id (draft only)
//   PATCH /purchase-requests/:id/status  (submit/approve/reject/cancel)
// Technician: own requests, submit/cancel; manager/admin: full workflow incl.
// approve/reject. Backend remains authoritative.

const PurchaseRequestsView = {
  role: "employee",
  canManage: false,
  canApprove: false,
  state: { status: "", work_order_id: "" },
  detailId: null,
  parts: [],

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager", "technician"].includes(this.role);
    this.canApprove = ["admin", "manager"].includes(this.role);
    this.detailId = null;

    const createButton = document.getElementById("createPurchaseRequestButton");
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
    const target = document.getElementById("purchaseRequestsContent");
    if (!target) return;
    setLoading(target);
    const params = new URLSearchParams();
    if (this.state.status) params.set("status", this.state.status);
    if (this.state.work_order_id) params.set("work_order_id", this.state.work_order_id);
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const [requests, workOrders] = await Promise.all([
        apiGet(`/purchase-requests${query}`),
        apiGet("/work-orders").catch(() => [])
      ]);
      this.render(target, requests || [], workOrders || []);
      if (this.detailId) {
        try {
          const pr = await apiGet(`/purchase-requests/${this.detailId}`);
          this.loadDetail(pr);
        } catch (error) {
          showToast(error.message, true);
        }
      }
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, requests, workOrders) {
    const rows = requests.map((pr) => {
      const total = (pr.items || []).reduce((sum, i) => sum + (i.requested_quantity || 0), 0);
      return `
        <tr class="clickable-row" data-action="open-pr" data-id="${pr.id}">
          <td><b>${esc(pr.request_number)}</b></td>
          <td>${priorityBadge(pr.priority)}</td>
          <td>${esc(pr.requester ? pr.requester.username : "—")}</td>
          <td>${esc(pr.department ? pr.department.name : "—")}</td>
          <td>${esc(pr.work_order ? pr.work_order.work_order_number : "—")}</td>
          <td>${statusPill(pr.status, PR_STATUS_META)}</td>
          <td>${(pr.items || []).length} / ${esc(String(total))}</td>
          <td>${esc(formatDateTime(pr.created_at))}</td>
        </tr>`;
    }).join("");

    target.innerHTML = `
      ${this.detailId ? `<div id="prDetail"></div>` : ""}
      <div class="view-toolbar" aria-label="შესყიდვის მოთხოვნების ფილტრები">
        <select class="input view-toolbar__select" id="prStatusFilter" aria-label="სტატუსის ფილტრი">
          <option value="">ყველა სტატუსი</option>
          ${PR_STATUS_ORDER.map((s) => `<option value="${s}" ${this.state.status === s ? "selected" : ""}>${esc(PR_STATUS_META[s].label)}</option>`).join("")}
        </select>
        <select class="input view-toolbar__select" id="prWorkOrderFilter" aria-label="სამუშაო ბრძანების ფილტრი">
          <option value="">ყველა ბრძანება</option>
          ${workOrders.map((wo) => `<option value="${wo.id}" ${String(this.state.work_order_id) === String(wo.id) ? "selected" : ""}>${esc(wo.work_order_number)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-pr-filters">ფილტრი</button>
      </div>
      ${dataTable(
        ["ნომერი", "პრიორიტეტი", "მომთხოვნი", "დეპარტამენტი", "ბრძანება", "სტატუსი", "პუნქტები", "შექმნილია"],
        rows,
        "შესყიდვის მოთხოვნები არ არის"
      )}
    `;
  },

  // ---------------------------------------------------------------------------
  // Create / edit
  // ---------------------------------------------------------------------------

  partOptions() {
    return this.parts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
  },

  async workOrderOptions() {
    const workOrders = await apiGet("/work-orders").catch(() => []);
    return [{ value: "", label: "—" }, ...workOrders.map((wo) => ({ value: wo.id, label: `${wo.work_order_number} — ${wo.title}` }))];
  },

  openCreate() {
    openEntityDialog({
      kicker: "შესყიდვები",
      title: "ახალი შესყიდვის მოთხოვნა",
      fields: [
        {
          name: "priority", label: "პრიორიტეტი", type: "select", value: "medium",
          options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
        },
        { name: "work_order_id", label: "სამუშაო ბრძანება", type: "select", placeholder: "—", options: () => this.workOrderOptions() },
        {
          name: "items", label: "პუნქტები", type: "items", required: true, addLabel: "პუნქტის დამატება",
          itemFields: [
            { name: "part_id", type: "select", options: this.partOptions() },
            { name: "requested_quantity", type: "number", min: 0.01, step: "0.01", placeholder: "რაოდენობა" },
            { name: "notes", type: "text", placeholder: "შენიშვნა" }
          ]
        },
        { name: "notes", label: "შენიშვნა", type: "textarea" }
      ],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        await apiPost("/purchase-requests", {
          priority: values.priority || "medium",
          work_order_id: values.work_order_id ? Number(values.work_order_id) : null,
          items: values.items.map((i) => ({
            part_id: Number(i.part_id),
            requested_quantity: i.requested_quantity,
            notes: i.notes || null
          })),
          notes: values.notes || null
        });
        await this.refresh();
      }
    });
  },

  openEdit(pr) {
    openEntityDialog({
      kicker: `მოთხოვნა ${pr.request_number}`,
      title: "რედაქტირება",
      fields: [
        {
          name: "priority", label: "პრიორიტეტი", type: "select", value: pr.priority,
          options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))
        },
        {
          name: "items", label: "პუნქტები", type: "items", required: true, addLabel: "პუნქტის დამატება",
          value: (pr.items || []).map((i) => ({
            part_id: i.part_id,
            requested_quantity: i.requested_quantity,
            notes: i.notes || ""
          })),
          itemFields: [
            { name: "part_id", type: "select", options: this.partOptions() },
            { name: "requested_quantity", type: "number", min: 0.01, step: "0.01", placeholder: "რაოდენობა" },
            { name: "notes", type: "text", placeholder: "შენიშვნა" }
          ]
        },
        { name: "notes", label: "შენიშვნა", type: "textarea", value: pr.notes || "" }
      ],
      onSave: async (values) => {
        await apiPatch(`/purchase-requests/${pr.id}`, {
          priority: values.priority || "medium",
          items: values.items.map((i) => ({
            part_id: Number(i.part_id),
            requested_quantity: i.requested_quantity,
            notes: i.notes || null
          })),
          notes: values.notes || null
        });
        await this.refreshDetail();
      }
    });
  },

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async openDetail(id) {
    this.detailId = id;
    await this.refresh();
  },

  async refreshDetail() {
    await this.refresh();
  },

  async loadDetail(pr) {
    const host = document.getElementById("prDetail");
    if (!host) return;

    const transitions = this.allowedTransitions(pr.status);
    const buttons = transitions.map((s) => {
      const meta = PR_STATUS_META[s];
      return `<button type="button" class="btn btn--ghost btn--compact" data-action="transition-pr" data-status="${s}">→ ${esc(meta.label)}</button>`;
    }).join(" ");

    const actions = [
      this.canManage && pr.status === "draft"
        ? `<button type="button" class="btn btn--ghost btn--compact" data-action="edit-pr">რედაქტირება</button>` : "",
      buttons
    ].filter(Boolean).join(" ");

    const itemRows = (pr.items || []).map((i) => `
      <tr>
        <td>
          <div class="row-title">${esc(i.part.name)}</div>
          <small class="row-sub">${esc(i.part.sku)}</small>
        </td>
        <td>${esc(String(i.requested_quantity))} ${esc(i.part.unit || "")}</td>
        <td>${i.approved_quantity != null ? esc(String(i.approved_quantity)) + " " + esc(i.part.unit || "") : "—"}</td>
        <td>${esc(String(i.received_quantity || 0))} ${esc(i.part.unit || "")}</td>
        <td>${i.notes ? esc(i.notes) : "—"}</td>
      </tr>`).join("");

    host.innerHTML = `
      <div class="detail">
        <div class="detail__top">
          <button type="button" class="btn btn--ghost btn--compact" data-action="close-pr">×</button>
          <div class="detail__head">
            <span class="workspace-kicker">${esc(pr.request_number)}</span>
            <h2>შესყიდვის მოთხოვნა</h2>
          </div>
          <div class="detail__status">
            ${statusPill(pr.status, PR_STATUS_META)}
            ${priorityBadge(pr.priority)}
          </div>
        </div>
        ${actions ? `<div class="detail__actions">${actions}</div>` : ""}
        <div class="detail-meta">
          <div class="detail-meta__item"><span>მომთხოვნი</span><b>${esc(pr.requester ? pr.requester.username : "—")}</b></div>
          <div class="detail-meta__item"><span>დეპარტამენტი</span><b>${esc(pr.department ? pr.department.name : "—")}</b></div>
          <div class="detail-meta__item"><span>სამუშაო ბრძანება</span><b>${esc(pr.work_order ? `${pr.work_order.work_order_number} · ${pr.work_order.title}` : "—")}</b></div>
          <div class="detail-meta__item"><span>დამამტკიცებელი</span><b>${esc(pr.approver ? pr.approver.username : "—")}</b></div>
          <div class="detail-meta__item"><span>დამტკიცდა</span><b>${esc(formatDateTime(pr.approved_at))}</b></div>
          ${pr.notes ? `<div class="detail-meta__item"><span>შენიშვნა</span><b>${esc(pr.notes)}</b></div>` : ""}
        </div>
        ${dataTable(["ნაწილი", "მოთხოვნილია", "დამტკიცებულია", "მიღებულია", "შენიშვნა"], itemRows, "პუნქტები არ არის")}
      </div>
    `;
  },

  allowedTransitions(status) {
    const targets = allowedTransitions("pr", status);
    const result = [];
    for (const t of targets) {
      if (t === "submitted" && this.canManage) result.push(t);
      if (t === "approved" && this.canApprove) result.push(t);
      if (t === "rejected" && this.canApprove) result.push(t);
      if (t === "cancelled" && this.canManage) result.push(t);
    }
    return result;
  },

  openApprove(pr) {
    const itemFields = (pr.items || []).map((i) => ({
      name: `approved_${i.part_id}`,
      label: `${i.part.name} (${i.part.sku}) · მოთხოვნილია ${i.requested_quantity}`,
      type: "number",
      required: true,
      min: 0.01,
      step: "0.01",
      value: i.approved_quantity != null ? i.approved_quantity : i.requested_quantity
    }));

    openEntityDialog({
      kicker: `მოთხოვნა ${pr.request_number}`,
      title: "დამტკიცება",
      fields: itemFields,
      submitLabel: "დამტკიცება",
      onSave: async (values) => {
        const items = (pr.items || []).map((i) => ({
          part_id: i.part_id,
          approved_quantity: values[`approved_${i.part_id}`]
        }));
        await apiPatch(`/purchase-requests/${pr.id}/status`, { status: "approved", items });
        await this.refreshDetail();
      }
    });
  },

  async transition(pr, status) {
    if (status === "cancelled") {
      const confirmed = await confirmAction(`გააუქმო მოთხოვნა ${pr.request_number}?`, { title: "გაუქმება", okLabel: "გაუქმება" });
      if (!confirmed) return;
    }
    try {
      if (status === "approved") {
        this.openApprove(pr);
        return;
      }
      await apiPatch(`/purchase-requests/${pr.id}/status`, { status });
      await this.refreshDetail();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-pr-filters":
        this.state.status = document.getElementById("prStatusFilter").value;
        this.state.work_order_id = document.getElementById("prWorkOrderFilter").value;
        await this.refresh();
        break;
      case "open-pr":
        this.detailId = Number(node.dataset.id);
        await this.refresh();
        break;
      case "close-pr":
        this.detailId = null;
        await this.refresh();
        break;
      case "edit-pr":
        try {
          const pr = await apiGet(`/purchase-requests/${this.detailId}`);
          this.openEdit(pr);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      case "transition-pr":
        try {
          const pr = await apiGet(`/purchase-requests/${this.detailId}`);
          await this.transition(pr, node.dataset.status);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      default:
        break;
    }
  }
};

document.getElementById("purchaseRequestsContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  PurchaseRequestsView.handleAction(node.dataset.action, node);
});