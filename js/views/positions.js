// views/positions.js — position list with department filter, create, edit,
// deactivate, delete. Uses GET/POST /positions, PATCH/DELETE /positions/:id and
// GET /departments for the department selector. Write actions are admin-only.

const PositionsView = {
  loaded: false,
  positions: [],
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
    const createButton = document.getElementById("createPositionButton");
    if (createButton) {
      createButton.addEventListener("click", () => this.openCreateDialog());
    }
    const filter = document.getElementById("positionDepartmentFilter");
    if (filter) filter.addEventListener("change", () => this.render());
  },

  async refresh() {
    const target = document.getElementById("positionsContent");
    if (!target) return;
    setLoading(target, true);
    try {
      const isAdmin = getUser()?.role === "admin";
      const params = new URLSearchParams();
      if (isAdmin) params.set("include_inactive", "true");
      this.positions = (await apiGet(`/positions?${params.toString()}`)) || [];
      this.departments = (await apiGet("/departments")) || [];
      this.fillDepartmentFilter();
      this.render();
    } catch (error) {
      target.innerHTML = errorState(error.message);
      showToast(error.message, true);
    }
  },

  fillDepartmentFilter() {
    const filter = document.getElementById("positionDepartmentFilter");
    if (!filter) return;
    const current = filter.value;
    filter.innerHTML = `<option value="">ყველა დეპარტამენტი</option>${this.departments
      .map((dept) => `<option value="${dept.id}" ${String(dept.id) === current ? "selected" : ""}>${esc(dept.name)}</option>`)
      .join("")}`;
  },

  render() {
    const target = document.getElementById("positionsContent");
    if (!target) return;
    const isAdmin = getUser()?.role === "admin";
    const filter = document.getElementById("positionDepartmentFilter");
    const departmentId = filter?.value || "";

    const filtered = this.positions.filter(
      (position) => !departmentId || String(position.department_id) === departmentId
    );

    if (!filtered.length) {
      target.innerHTML = `<div class="panel">${emptyState("პოზიციები არ არის.")}</div>`;
      return;
    }

    const rows = filtered
      .map(
        (position) => `
          <tr>
            <td data-label="სახელი"><strong>${esc(position.name)}</strong></td>
            <td data-label="დეპარტამენტი">${esc(position.department_name || "—")}</td>
            <td data-label="სტატუსი">${statePill(Boolean(position.is_active))}</td>
            <td data-label="მოქმედებები" class="table-actions">
              ${isAdmin ? `
                <button type="button" class="btn btn--ghost btn--compact" data-edit-position="${position.id}">რედაქტირება</button>
                ${position.is_active
                  ? `<button type="button" class="btn btn--ghost btn--compact" data-deactivate-position="${position.id}">დეაქტივაცია</button>`
                  : `<button type="button" class="btn btn--ghost btn--compact" data-activate-position="${position.id}">გააქტიურება</button>`}
                <button type="button" class="btn btn--danger btn--compact" data-delete-position="${position.id}">წაშლა</button>
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
                <th scope="col">დეპარტამენტი</th>
                <th scope="col">სტატუსი</th>
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
      const edit = event.target.closest("[data-edit-position]");
      const deactivate = event.target.closest("[data-deactivate-position]");
      const activate = event.target.closest("[data-activate-position]");
      const del = event.target.closest("[data-delete-position]");
      if (edit) this.openEditDialog(Number(edit.dataset.editPosition));
      else if (deactivate) this.toggleActive(Number(deactivate.dataset.deactivatePosition), false);
      else if (activate) this.toggleActive(Number(activate.dataset.activatePosition), true);
      else if (del) this.deletePosition(Number(del.dataset.deletePosition));
    });
  },

  activeDepartments() {
    // Only active departments may be selected for new/edit positions.
    return this.departments.filter((dept) => Boolean(dept.is_active));
  },

  openCreateDialog() {
    this.openDialog(null);
  },

  openEditDialog(id) {
    const position = this.positions.find((item) => item.id === id);
    if (position) this.openDialog(position);
  },

  openDialog(position) {
    const body = document.getElementById("entityBody");
    if (!body) return;
    document.getElementById("entityKicker").textContent = "პოზიცია";
    document.getElementById("entityTitle").textContent = position ? "პოზიციის რედაქტირება" : "ახალი პოზიცია";
    document.getElementById("entitySaveButton").textContent = position ? "ცვლილებების შენახვა" : "პოზიციის შექმნა";

    const departmentOptions = this.activeDepartments()
      .map(
        (dept) =>
          `<option value="${dept.id}" ${position && position.department_id === dept.id ? "selected" : ""}>${esc(dept.name)}</option>`
      )
      .join("");

    body.innerHTML = `
      <label class="form-group">
        <span>სახელი *</span>
        <input class="input" id="positionName" name="name" required maxlength="100" placeholder="მაგ. უფროსი ტექნიკოსი" value="${esc(position?.name || "")}">
      </label>
      <label class="form-group">
        <span>დეპარტამენტი *</span>
        <select class="input" id="positionDepartment" required>
          <option value="" disabled>აირჩიე დეპარტამენტი</option>
          ${departmentOptions}
        </select>
      </label>
      ${position ? `
        <label class="form-group form-group--check">
          <input type="checkbox" id="positionActive" ${position.is_active ? "checked" : ""}>
          <span>აქტიური</span>
        </label>
      ` : ""}
    `;

    if (position) document.getElementById("positionDepartment").value = position.department_id;

    const form = document.getElementById("entityForm");
    form.onsubmit = (event) => {
      event.preventDefault();
      this.save(position);
    };
    openDialog("entityDialog");
  },

  async save(position) {
    const name = document.getElementById("positionName")?.value.trim();
    const departmentId = document.getElementById("positionDepartment")?.value;
    if (!name) {
      showToast("პოზიციის სახელი სავალდებულოა.", true);
      return;
    }
    if (!departmentId) {
      showToast("დეპარტამენტი სავალდებულოა.", true);
      return;
    }
    const isActive = document.getElementById("positionActive");

    const saveButton = document.getElementById("entitySaveButton");
    if (saveButton) saveButton.disabled = true;

    try {
      if (position) {
        const body = { name, department_id: Number(departmentId) };
        if (isActive) body.is_active = isActive.checked;
        await apiPatch(`/positions/${position.id}`, body);
        showToast("პოზიცია განახლდა");
      } else {
        await apiPost("/positions", { name, department_id: Number(departmentId) });
        showToast("ახალი პოზიცია დაემატა");
      }
      closeDialog("entityDialog");
      await this.refresh();
      if (EmployeesView.loaded) EmployeesView.refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  },

  async toggleActive(id, isActive) {
    try {
      await apiPatch(`/positions/${id}`, { is_active: isActive });
      showToast(isActive ? "პოზიცია გააქტიურდა" : "პოზიცია დეაქტივირებულია");
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async deletePosition(id) {
    const position = this.positions.find((item) => item.id === id);
    const confirmed = await confirmAction(
      `დარწმუნებული ხართ, რომ გსურთ პოზიციის „${position ? position.name : id}" წაშლა?`,
      { title: "პოზიციის წაშლა", okLabel: "წაშლა", danger: true }
    );
    if (!confirmed) return;

    try {
      await apiDelete(`/positions/${id}`);
      showToast("პოზიცია წაიშალა");
      await this.refresh();
      if (EmployeesView.loaded) EmployeesView.refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  }
};