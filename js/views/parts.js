// views/parts.js — shared part catalog (Phase 11).
// GET/POST /parts, GET/PATCH /parts/:id, POST /parts/:id/deactivate.
// Parts are a shared catalog (scope 'all'); create/update/deactivate are
// manager/admin actions (migration 009).

const PartsView = {
  role: "employee",
  canManage: false,
  state: { q: "", category: "", include_inactive: false },

  async init({ role } = {}) {
    this.role = role || "employee";
    this.canManage = ["admin", "manager"].includes(this.role);

    const createButton = document.getElementById("createPartButton");
    if (createButton) {
      createButton.hidden = !this.canManage;
      createButton.onclick = () => this.openCreate();
    }
    await this.refresh();
  },

  async fetchParts() {
    const params = new URLSearchParams();
    if (this.state.q) params.set("q", this.state.q);
    if (this.state.category) params.set("category", this.state.category);
    if (this.state.include_inactive) params.set("include_inactive", "true");
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiGet(`/parts${query}`);
  },

  async refresh() {
    const target = document.getElementById("partsContent");
    if (!target) return;
    setLoading(target);
    try {
      const parts = await this.fetchParts();
      this.render(target, parts || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, parts) {
    const categories = [...new Set(parts.map((p) => p.category).filter(Boolean))].sort();

    const rows = parts.map((part) => `
      <tr>
        <td><b>${esc(part.sku)}</b></td>
        <td>
          <div class="row-title">${esc(part.name)}</div>
          ${part.description ? `<small class="row-sub">${esc(part.description)}</small>` : ""}
        </td>
        <td>${esc(part.category || "—")}</td>
        <td>${esc(part.unit || "—")}</td>
        <td>${esc(String(part.minimum_stock))}</td>
        <td>${esc(String(part.reorder_point))}</td>
        <td>${statePill(part.is_active)}</td>
        ${this.canManage ? `
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn--ghost btn--compact" data-action="edit-part" data-id="${part.id}">რედაქტირება</button>
            ${part.is_active ? `<button type="button" class="btn btn--ghost btn--compact btn--danger-text" data-action="deactivate-part" data-id="${part.id}" data-name="${esc(part.name)}">დეაქტივაცია</button>` : ""}
          </div>
        </td>` : ""}
      </tr>`).join("");

    target.innerHTML = `
      <div class="view-toolbar" aria-label="ნაწილების ფილტრები">
        <label class="search-field">
          <span aria-hidden="true">⌕</span>
          <input id="partSearch" type="search" placeholder="მოძებნე SKU ან სახელით…" value="${esc(this.state.q)}">
        </label>
        <select class="input view-toolbar__select" id="partCategoryFilter" aria-label="კატეგორიის ფილტრი">
          <option value="">ყველა კატეგორია</option>
          ${categories.map((c) => `<option value="${esc(c)}" ${this.state.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        <label class="checkbox-inline">
          <input type="checkbox" id="partIncludeInactive" data-action="toggle-inactive" ${this.state.include_inactive ? "checked" : ""}> არააქტიურებიც
        </label>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-part-filters">ფილტრი</button>
      </div>
      ${dataTable(
        ["SKU", "სახელი", "კატეგორია", "ერთეული", "მინ. მარაგი", "შეკვეთის წერტილი", "სტატუს", ...(this.canManage ? [""] : [])],
        rows,
        "ნაწილები არ არის"
      )}
    `;
  },

  openCreate() {
    openEntityDialog({
      kicker: "კატალოგი",
      title: "ახალი ნაწილი",
      fields: [
        { name: "sku", label: "SKU", type: "text", required: true, placeholder: "მაგ. TERM-100" },
        { name: "name", label: "სახელი", type: "text", required: true },
        { name: "category", label: "კატეგორია", type: "text" },
        { name: "unit", label: "ერთეული", type: "text", placeholder: "ცალი / ლ / კგ" },
        { name: "minimum_stock", label: "მინიმალური მარაგი", type: "number", min: 0, step: "0.01", value: 0 },
        { name: "reorder_point", label: "შეკვეთის წერტილი", type: "number", min: 0, step: "0.01", value: 0 },
        { name: "description", label: "აღწერა", type: "textarea" }
      ],
      submitLabel: "შექმნა",
      onSave: async (values) => {
        await apiPost("/parts", {
          sku: values.sku,
          name: values.name,
          category: values.category || null,
          unit: values.unit || null,
          minimum_stock: values.minimum_stock == null ? 0 : values.minimum_stock,
          reorder_point: values.reorder_point == null ? 0 : values.reorder_point,
          description: values.description || null
        });
        await this.refresh();
      }
    });
  },

  async openEdit(part) {
    openEntityDialog({
      kicker: `ნაწილი ${part.sku}`,
      title: "რედაქტირება",
      fields: [
        { name: "sku", label: "SKU", type: "text", required: true, value: part.sku },
        { name: "name", label: "სახელი", type: "text", required: true, value: part.name },
        { name: "category", label: "კატეგორია", type: "text", value: part.category || "" },
        { name: "unit", label: "ერთეული", type: "text", value: part.unit || "" },
        { name: "minimum_stock", label: "მინიმალური მარაგი", type: "number", min: 0, step: "0.01", value: part.minimum_stock },
        { name: "reorder_point", label: "შეკვეთის წერტილი", type: "number", min: 0, step: "0.01", value: part.reorder_point },
        { name: "description", label: "აღწერა", type: "textarea", value: part.description || "" }
      ],
      onSave: async (values) => {
        await apiPatch(`/parts/${part.id}`, {
          sku: values.sku,
          name: values.name,
          category: values.category || null,
          unit: values.unit || null,
          minimum_stock: values.minimum_stock,
          reorder_point: values.reorder_point,
          description: values.description || null
        });
        await this.refresh();
      }
    });
  },

  async deactivate(part) {
    const confirmed = await confirmAction(`დეაქტივაცია: „${part.name}“?`, { title: "ნაწილის დეაქტივაცია", okLabel: "დეაქტივაცია" });
    if (!confirmed) return;
    try {
      await apiPost(`/parts/${part.id}/deactivate`, {});
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-part-filters":
        this.state.q = document.getElementById("partSearch").value.trim();
        this.state.category = document.getElementById("partCategoryFilter").value;
        await this.refresh();
        break;
      case "toggle-inactive":
        this.state.include_inactive = node.checked;
        await this.refresh();
        break;
      case "edit-part":
        try {
          const part = await apiGet(`/parts/${node.dataset.id}`);
          this.openEdit(part);
        } catch (error) {
          showToast(error.message, true);
        }
        break;
      case "deactivate-part":
        this.deactivate({ id: node.dataset.id, name: node.dataset.name });
        break;
      default:
        break;
    }
  }
};

document.getElementById("partsContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  PartsView.handleAction(node.dataset.action, node);
});