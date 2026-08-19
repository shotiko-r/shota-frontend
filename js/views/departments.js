// views/departments.js — department list, create, edit, deactivate, delete.
// Uses verified endpoints: GET/POST /departments, PATCH/DELETE /departments/:id.
// Write actions are admin-only (backend enforces with 403 for managers).

const DepartmentsView = {
  loaded: false,
  departments: [],

  async init() {
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    this.bindEvents();
    await this.refresh();
  },

  bindEvents() {
    const createButton = document.getElementById("createDepartmentButton");
    if (createButton) {
      createButton.addEventListener("click", () => this.openCreateDialog());
    }
  },

  async refresh() {
    const target = document.getElementById("departmentsContent");
    if (!target) return;
    setLoading(target, true);
    try {
      const isAdmin = getUser()?.role === "admin";
      const params = isAdmin ? "?include_inactive=true" : "";
      this.departments = (await apiGet(`/departments${params}`)) || [];
      this.render();
    } catch (error) {
      target.innerHTML = errorState(error.message);
      showToast(error.message, true);
    }
  },

  render() {
    const target = document.getElementById("departmentsContent");
    if (!target) return;
    const isAdmin = getUser()?.role === "admin";

    if (!this.departments.length) {
      target.innerHTML = `<div class="panel">${emptyState("დეპარტამენტები არ არის.")}</div>`;
      return;
    }

    const rows = this.departments
      .map(
        (dept) => `
          <tr>
            <td data-label="სახელი"><strong>${esc(dept.name)}</strong>${dept.description ? `<small class="table-cell__sub">${esc(dept.description)}</small>` : ""}</td>
            <td data-label="სტატუსი">${statePill(Boolean(dept.is_active))}</td>
            <td data-label="შექმნილი">${esc(formatDate(dept.created_at, true))}</td>
            <td data-label="მოქმედებები" class="table-actions">
              ${isAdmin ? `
                <button type="button" class="btn btn--ghost btn--compact" data-edit-department="${dept.id}">რედაქტირება</button>
                ${dept.is_active
                  ? `<button type="button" class="btn btn--ghost btn--compact" data-deactivate-department="${dept.id}">დეაქტივაცია</button>`
                  : `<button type="button" class="btn btn--ghost btn--compact" data-activate-department="${dept.id}">გააქტიურება</button>`}
                <button type="button" class="btn btn--danger btn--compact" data-delete-department="${dept.id}">წაშლა</button>
              ` : "<span class=\"table-muted\">მხოლოდ ხილვადი</span>"}
            </td>
          </tr>
        `
      )
      .join("");

    target.innerHTML = `
      <div class="panel panel--table">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">სახელი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">შექმნილი</th>
                <th scope="col">მოქმედებები</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    this.bindRowEvents(target);
  },

  bindRowEvents(container) {
    container.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-department]");
      const deactivate = event.target.closest("[data-deactivate-department]");
      const activate = event.target.closest("[data-activate-department]");
      const del = event.target.closest("[data-delete-department]");
      if (edit) this.openEditDialog(Number(edit.dataset.editDepartment));
      else if (deactivate) this.toggleActive(Number(deactivate.dataset.deactivateDepartment), false);
      else if (activate) this.toggleActive(Number(activate.dataset.activateDepartment), true);
      else if (del) this.deleteDepartment(Number(del.dataset.deleteDepartment));
    });
  },

  openCreateDialog() {
    this.openDialog(null);
  },

  openEditDialog(id) {
    const dept = this.departments.find((item) => item.id === id);
    if (dept) this.openDialog(dept);
  },

  openDialog(department) {
    const body = document.getElementById("entityBody");
    if (!body) return;
    document.getElementById("entityKicker").textContent = "დეპარტამენტი";
    document.getElementById("entityTitle").textContent = department ? `დეპარტამენტის რედაქტირება` : "ახალი დეპარტამენტი";
    document.getElementById("entitySaveButton").textContent = department ? "ცვლილებების შენახვა" : "დეპარტამენტის შექმნა";

    body.innerHTML = `
      <label class="form-group">
        <span>სახელი *</span>
        <input class="input" id="deptName" name="name" required maxlength="100" placeholder="მაგ. ტექნიკური მომსახურება" value="${esc(department?.name || "")}">
      </label>
      <label class="form-group">
        <span>აღწერა</span>
        <textarea class="input modal__textarea" id="deptDescription" name="description" maxlength="500" placeholder="მოკლე აღწერა">${esc(department?.description || "")}</textarea>
      </label>
      ${department ? `
        <label class="form-group form-group--check">
          <input type="checkbox" id="deptActive" ${department.is_active ? "checked" : ""}>
          <span>აქტიური</span>
        </label>
      ` : ""}
    `;

    const form = document.getElementById("entityForm");
    form.onsubmit = (event) => {
      event.preventDefault();
      this.save(department);
    };
    openDialog("entityDialog");
  },

  async save(department) {
    const name = document.getElementById("deptName")?.value.trim();
    if (!name) {
      showToast("დეპარტამენტის სახელი სავალდებულოა.", true);
      return;
    }
    const description = document.getElementById("deptDescription")?.value?.trim() || null;
    const isActive = document.getElementById("deptActive");

    const saveButton = document.getElementById("entitySaveButton");
    if (saveButton) saveButton.disabled = true;

    try {
      if (department) {
        const body = { name, description };
        if (isActive) body.is_active = isActive.checked;
        await apiPatch(`/departments/${department.id}`, body);
        showToast("დეპარტამენტი განახლდა");
      } else {
        await apiPost("/departments", { name, description });
        showToast("ახალი დეპარტამენტი დაემატა");
      }
      closeDialog("entityDialog");
      await this.refresh();
      if (PositionsView.loaded) PositionsView.refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  },

  async toggleActive(id, isActive) {
    try {
      await apiPatch(`/departments/${id}`, { is_active: isActive });
      showToast(isActive ? "დეპარტამენტი გააქტიურდა" : "დეპარტამენტი დეაქტივირებულია");
      await this.refresh();
      if (PositionsView.loaded) PositionsView.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async deleteDepartment(id) {
    const dept = this.departments.find((item) => item.id === id);
    const confirmed = await confirmAction(
      `დარწმუნებული ხართ, რომ გსურთ დეპარტამენტის „${dept ? dept.name : id}" წაშლა?`,
      { title: "დეპარტამენტის წაშლა", okLabel: "წაშლა", danger: true }
    );
    if (!confirmed) return;

    try {
      await apiDelete(`/departments/${id}`);
      showToast("დეპარტამენტი წაიშალა");
      await this.refresh();
      if (PositionsView.loaded) PositionsView.refresh();
    } catch (error) {
      // Backend 409 (department still has positions/users) surfaces as a toast.
      showToast(error.message, true);
    }
  }
};