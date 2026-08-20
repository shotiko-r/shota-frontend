// views/reservations.js — stock reservations (Phase 11).
// Verified Phase 10 endpoints:
//   GET  /inventory/reservations (filters status/part/warehouse/work_order)
//   POST /inventory/reservations/:id/release|cancel|consume  (manager/admin)

const ReservationsView = {
  role: "employee",
  canManage: false,
  state: { status: "", part_id: "", warehouse_id: "", work_order_id: "" },

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("reservationsContent");
    if (!target) return;
    setLoading(target);

    const params = new URLSearchParams();
    if (this.state.status) params.set("status", this.state.status);
    if (this.state.part_id) params.set("part_id", this.state.part_id);
    if (this.state.warehouse_id) params.set("warehouse_id", this.state.warehouse_id);
    if (this.state.work_order_id) params.set("work_order_id", this.state.work_order_id);
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const [reservations, parts, warehouses] = await Promise.all([
        apiGet(`/inventory/reservations${query}`),
        apiGet("/parts").catch(() => []),
        apiGet("/warehouses").catch(() => [])
      ]);
      this.render(target, reservations || [], parts || [], warehouses || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, reservations, parts, warehouses) {
    const rows = reservations.map((r) => {
      const actions = r.status === "active" && this.canManage
        ? `
          <div class="row-actions">
            <button type="button" class="btn btn--primary btn--compact" data-action="consume-reservation" data-id="${r.id}">მოხმარება</button>
            <button type="button" class="btn btn--ghost btn--compact" data-action="release-reservation" data-id="${r.id}">გათავისუფლება</button>
            <button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="cancel-reservation" data-id="${r.id}">გაუქმება</button>
          </div>`
        : "";
      return `
        <tr>
          <td>
            <div class="row-title">${esc(r.part.name)}</div>
            <small class="row-sub">${esc(r.part.sku)}</small>
          </td>
          <td>${esc(r.warehouse.name)}</td>
          <td>${esc(r.work_order ? r.work_order.work_order_number : "—")}</td>
          <td><b>${esc(String(r.quantity))}</b> ${esc(r.part.unit || "")}</td>
          <td>${statusPill(r.status, RESERVATION_STATUS_META)}</td>
          <td>${esc(formatDateTime(r.created_at))}</td>
          ${this.canManage ? `<td>${actions}</td>` : ""}
        </tr>`;
    }).join("");

    target.innerHTML = `
      <div class="view-toolbar" aria-label="რეზერვაციების ფილტრები">
        <select class="input view-toolbar__select" id="reservationStatusFilter" aria-label="სტატუსის ფილტრი">
          <option value="">ყველა სტატუსი</option>
          ${Object.keys(RESERVATION_STATUS_META).map((s) => `<option value="${s}" ${this.state.status === s ? "selected" : ""}>${esc(RESERVATION_STATUS_META[s].label)}</option>`).join("")}
        </select>
        <select class="input view-toolbar__select" id="reservationPartFilter" aria-label="ნაწილის ფილტრი">
          <option value="">ყველა ნაწილი</option>
          ${parts.map((p) => `<option value="${p.id}" ${String(this.state.part_id) === String(p.id) ? "selected" : ""}>${esc(p.name)} (${esc(p.sku)})</option>`).join("")}
        </select>
        <select class="input view-toolbar__select" id="reservationWarehouseFilter" aria-label="საწყობის ფილტრი">
          <option value="">ყველა საწყობი</option>
          ${warehouses.map((w) => `<option value="${w.id}" ${String(this.state.warehouse_id) === String(w.id) ? "selected" : ""}>${esc(w.name)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-reservation-filters">ფილტრი</button>
      </div>
      ${dataTable(
        ["ნაწილი", "საწყობი", "სამუშაო ბრძანება", "რაოდენობა", "სტატუსი", "შექმნილია", ...(this.canManage ? [""] : [])],
        rows,
        "რეზერვაციები არ არის"
      )}
    `;
  },

  async runReservationAction(id, action) {
    try {
      await apiPost(`/inventory/reservations/${id}/${action}`, {});
      showToast(STRINGS.success);
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-reservation-filters":
        this.state.status = document.getElementById("reservationStatusFilter").value;
        this.state.part_id = document.getElementById("reservationPartFilter").value;
        this.state.warehouse_id = document.getElementById("reservationWarehouseFilter").value;
        await this.refresh();
        break;
      case "release-reservation":
        await this.runReservationAction(node.dataset.id, "release");
        break;
      case "cancel-reservation":
        if (await confirmAction("გააუქმო ეს რეზერვაცია?", { title: "გაუქმება", okLabel: "გაუქმება" })) {
          await this.runReservationAction(node.dataset.id, "cancel");
        }
        break;
      case "consume-reservation":
        if (await confirmAction("მოხმარდეს ეს რეზერვაცია?", { title: "მოხმარება", okLabel: "მოხმარება" })) {
          await this.runReservationAction(node.dataset.id, "consume");
        }
        break;
      default:
        break;
    }
  }
};

document.getElementById("reservationsContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  ReservationsView.handleAction(node.dataset.action, node);
});