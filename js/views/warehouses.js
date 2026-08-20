// views/warehouses.js — stock locations (Phase 11).
// GET /warehouses, POST /warehouses, GET/PATCH /warehouses/:id,
// POST /warehouses/:id/deactivate, GET /warehouses/:id/stock (balances).

const WarehousesView = {
  role: "employee",
  canManage: false,
  isAdmin: false,
  selectedId: null,

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);
    this.isAdmin = this.role === "admin";

    const createButton = document.getElementById("createWarehouseButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("warehousesContent");
    if (!target) return;
    setLoading(target);
    try {
      const warehouses = await apiGet("/warehouses");
      this.render(target, warehouses || []);
      if (this.selectedId) await this.renderStock(this.selectedId);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, warehouses) {
    const rows = warehouses.map((wh) => `
      <tr class="clickable-row" data-action="open-warehouse" data-id="${wh.id}">
        <td><b>${esc(wh.code || `#${wh.id}`)}</b></td>
        <td>
          <div class="row-title">${esc(wh.name)}</div>
          ${wh.description ? `<small class="row-sub">${esc(wh.description)}</small>` : ""}
        </td>
        <td>${esc(wh.department ? wh.department.name : "—")}</td>
        <td>${statePill(wh.is_active)}</td>
        ${this.canManage ? `
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn--ghost btn--compact" data-action="edit-warehouse" data-id="${wh.id}">რედაქტირება</button>
            ${wh.is_active ? `<button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="deactivate-warehouse" data-id="${wh.id}" data-name="${esc(wh.name)}">დეაქტივაცია</button>` : ""}
          </div>
        </td>` : ""}
      </tr>`).join("");

    target.innerHTML = `
      ${this.selectedId ? `<div id="warehouseDetail"></div>` : ""}
      ${dataTable(
        ["კოდი", "სახელი", "დეპარტამენტი", "სტატუსი", ...(this.canManage ? [""] : [])],
        rows,
        "საწყობები არ არის"
      )}
    `;
  },

  async renderStock(warehouseId) {
    const host = document.getElementById("warehouseDetail");
    if (!host) return;
    setLoading(host);
    try {
      const [warehouse, stock] = await Promise.all([
        apiGet(`/warehouses/${warehouseId}`),
        apiGet(`/warehouses/${warehouseId}/stock`)
      ]);
      const rows = (stock || []).map((s) => `
        <tr>
          <td>
            <div class="row-title">${esc(s.part.name)}</div>
            <small class="row-sub">${esc(s.part.sku)}</small>
          </td>
          <td>${esc(String(s.quantity))} ${esc(s.part.unit || "")}</td>
          <td>${esc(String(s.reserved_quantity))} ${esc(s.part.unit || "")}</td>
          <td><b>${esc(String(s.available_quantity))} ${esc(s.part.unit || "")}</b></td>
        </tr>`).join("");

      host.innerHTML = `
        <div class="detail">
          <div class="detail__top">
            <button type="button" class="btn btn--ghost btn--compact" data-action="close-warehouse">×</button>
            <div class="detail__head">
              <span class="workspace-kicker">საწყობი ${esc(warehouse.code || "")}</span>
              <h2>${esc(warehouse.name)}</h2>
            </div>
          </div>
          ${dataTable(["ნაწილი", "მარაგი", "დაჯავშნული", "ხელმისაწვდომი"], rows, "მარაგი არ არის")}
        </div>
      `;
    } catch (error) {
      host.innerHTML = errorState(error.message);
    }
  },

  async departmentOptions() {
    const departments = await apiGet("/departments").catch(() => []);
    return this.withEmpty(departments.map((d) => ({ value: d.id, label: d.name })));
  },

  withEmpty(items) {
    return [{ value: "", label: "—" }, ...items];
  },

  openCreate() {
    const fields = [
      { name: "name", label: "სახელი", type: "text", required: true },
      { name: "code", label: "კოდი", type: "text" },
      { name: "description", label: "აღწერა", type: "textarea" }
    ];
    if (this.isAdmin) {
      fields.splice(2, 0, { name: "department_id", label: "დეპარტამენტი", type: "select", placeholder: "—", options: () => this.departmentOptions() });
    }

    openEntityDialog({
      kicker: "მარაგები",
      title: "ახალი საწყობი",
      fields,
      submitLabel: "შექმნა",
      onSave: async (values) => {
        const payload = {
          name: values.name,
          code: values.code || null,
          description: values.description || null
        };
        if (this.isAdmin) payload.department_id = values.department_id ? Number(values.department_id) : null;
        await apiPost("/warehouses", payload);
        await this.refresh();
      }
    });
  },

  openEdit(warehouse) {
    const fields = [
      { name: "name", label: "სახელი", type: "text", required: true, value: warehouse.name },
      { name: "code", label: "კოდი", type: "text", value: warehouse.code || "" },
      { name: "description", label: "აღწერა", type: "textarea", value: warehouse.description || "" }
    ];
    if (this.isAdmin) {
      fields.splice(2, 0, {
        name: "department_id", label: "დეპარტამენტი", type: "select",
        value: warehouse.department ? warehouse.department.id : "", placeholder: "—",
        options: () => this.departmentOptions()
      });
    }

    openEntityDialog({
      kicker: `საწყობი ${warehouse.code || ""}`,
      title: "რედაქტირება",
      fields,
      onSave: async (values) => {
        const payload = {
          name: values.name,
          code: values.code || null,
          description: values.description || null
        };
        if (this.isAdmin) payload.department_id = values.department_id ? Number(values.department_id) : null;
        await apiPatch(`/warehouses/${warehouse.id}`, payload);
        await this.refresh();
      }
    });
  },

  async deactivate(warehouse) {
    const confirmed = await confirmAction(`დეაქტივაცია: „${warehouse.name}“?`, { title: "საწყობის დეაქტივაცია", okLabel: "დეაქტივაცია" });
    if (!confirmed) return;
    try {
      await apiPost(`/warehouses/${warehouse.id}/deactivate`, {});
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "open-warehouse":
        this.selectedId = Number(node.dataset.id);
        await this.refresh();
        break;
      case "close-warehouse":
        this.selectedId = null;
        await this.refresh();
        break;
      case "edit-warehouse":
        try {
          const warehouse = await apiGet(`/warehouses/${node.dataset.id}`);
          this.openEdit(warehouse);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      case "deactivate-warehouse":
        this.deactivate({ id: node.dataset.id, name: node.dataset.name });
        break;
      default:
        break;
    }
  }
};

document.getElementById("warehousesContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  WarehousesView.handleAction(node.dataset.action, node);
});