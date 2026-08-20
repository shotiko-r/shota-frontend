// views/suppliers.js — supplier catalog (Phase 11).
// Verified Phase 10 endpoints:
//   GET /suppliers, POST /suppliers, GET/PATCH /suppliers/:id,
//   POST /suppliers/:id/deactivate. Shared catalog; management is manager/admin.

const SuppliersView = {
  role: "employee",
  canManage: false,
  state: { q: "" },

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);

    const createButton = document.getElementById("createSupplierButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("suppliersContent");
    if (!target) return;
    setLoading(target);
    try {
      const suppliers = this.state.q
        ? await apiGet(`/suppliers?q=${encodeURIComponent(this.state.q)}`)
        : await apiGet("/suppliers");
      this.render(target, suppliers || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, suppliers) {
    const rows = suppliers.map((s) => `
      <tr>
        <td><b>${esc(s.code || `#${s.id}`)}</b></td>
        <td>
          <div class="row-title">${esc(s.name)}</div>
          ${s.contact_name ? `<small class="row-sub">${esc(s.contact_name)}</small>` : ""}
        </td>
        <td>${esc(s.email || "—")}</td>
        <td>${esc(s.phone || "—")}</td>
        <td>${statePill(s.is_active)}</td>
        ${this.canManage ? `
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn--ghost btn--compact" data-action="edit-supplier" data-id="${s.id}">რედაქტირება</button>
            ${s.is_active ? `<button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="deactivate-supplier" data-id="${s.id}" data-name="${esc(s.name)}">დეაქტივაცია</button>` : ""}
          </div>
        </td>` : ""}
      </tr>`).join("");

    target.innerHTML = `
      <div class="view-toolbar" aria-label="მომწოდებლების ფილტრები">
        <label class="search-field">
          <span aria-hidden="true">⌕</span>
          <input id="supplierSearch" type="search" placeholder="მოძებნე სახელით, კოდით…" value="${esc(this.state.q)}">
        </label>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-supplier-filters">ძებნა</button>
      </div>
      ${dataTable(
        ["კოდი", "სახელი", "ელ. ფოსტა", "ტელეფონი", "სტატუსი", ...(this.canManage ? [""] : [])],
        rows,
        "მომწოდებლები არ არის"
      )}
    `;
  },

  openCreate() {
    openEntityDialog({
      kicker: "შესყიდვები",
      title: "ახალი მომწოდებელი",
      fields: [
        { name: "name", label: "სახელი", type: "text", required: true },
        { name: "code", label: "კოდი", type: "text", required: true, placeholder: "მაგ. SPL-001" },
        { name: "contact_name", label: "კონტაქტის სახელი", type: "text" },
        { name: "email", label: "ელ. ფოსტა", type: "email" },
        { name: "phone", label: "ტელეფონი", type: "tel" }
      ],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        await apiPost("/suppliers", {
          name: values.name,
          code: values.code || null,
          contact_name: values.contact_name || null,
          email: values.email || null,
          phone: values.phone || null
        });
        await this.refresh();
      }
    });
  },

  openEdit(supplier) {
    openEntityDialog({
      kicker: `მომწოდებელი ${supplier.code || ""}`,
      title: "რედაქტირება",
      fields: [
        { name: "name", label: "სახელი", type: "text", required: true, value: supplier.name },
        { name: "code", label: "კოდი", type: "text", required: true, value: supplier.code || "" },
        { name: "contact_name", label: "კონტაქტის სახელი", type: "text", value: supplier.contact_name || "" },
        { name: "email", label: "ელ. ფოსტა", type: "email", value: supplier.email || "" },
        { name: "phone", label: "ტელეფონი", type: "tel", value: supplier.phone || "" }
      ],
      onSave: async (values) => {
        await apiPatch(`/suppliers/${supplier.id}`, {
          name: values.name,
          code: values.code || null,
          contact_name: values.contact_name || null,
          email: values.email || null,
          phone: values.phone || null
        });
        await this.refresh();
      }
    });
  },

  async deactivate(supplier) {
    const confirmed = await confirmAction(`დეაქტივაცია: „${supplier.name}“?`, { title: "მომწოდებლის დეაქტივაცია", okLabel: "დეაქტივაცია" });
    if (!confirmed) return;
    try {
      await apiPost(`/suppliers/${supplier.id}/deactivate`, {});
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-supplier-filters":
        this.state.q = document.getElementById("supplierSearch").value.trim();
        await this.refresh();
        break;
      case "edit-supplier":
        try {
          const supplier = await apiGet(`/suppliers/${node.dataset.id}`);
          this.openEdit(supplier);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      case "deactivate-supplier":
        this.deactivate({ id: node.dataset.id, name: node.dataset.name });
        break;
      default:
        break;
    }
  }
};

document.getElementById("suppliersContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  SuppliersView.handleAction(node.dataset.action, node);
});