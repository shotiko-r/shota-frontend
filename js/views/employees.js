// views/employees.js — user list and organization assignment.
// Uses verified endpoints: GET /users, PATCH /users/:id/organization,
// GET /departments, GET /positions. The backend does NOT expose user create or
// status endpoints, so no create/status UI is built.
// Organization editing is admin-only (backend denies managers via users.update).

const EmployeesView = {
  loaded: false,
  users: [],
  departments: [],
  positions: [],
  editingUserId: null,

  async init() {
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("employeesContent");
    if (!target) return;
    setLoading(target, true);
    try {
      this.users = (await apiGet("/users")) || [];
      this.render();
    } catch (error) {
      target.innerHTML = errorState(error.message);
      showToast(error.message, true);
    }
  },

  roleLabel(role) {
    return LEGACY_ROLE_LABELS[role] || role || "—";
  },

  render() {
    const target = document.getElementById("employeesContent");
    if (!target) return;
    const isAdmin = getUser()?.role === "admin";

    if (!this.users.length) {
      target.innerHTML = `<div class="panel">${emptyState("თანამშრომლები არ არის.")}</div>`;
      return;
    }

    const rows = this.users
      .map(
        (user) => `
          <tr>
            <td data-label="მომხმარებელი"><strong>${esc(user.username)}</strong></td>
            <td data-label="როლი"><span class="role-badge">${esc(this.roleLabel(user.role))}</span></td>
            <td data-label="დეპარტამენტი">${esc(user.department?.name || "—")}</td>
            <td data-label="პოზიცია">${esc(user.position?.name || "—")}</td>
            <td data-label="მენეჯერი">${esc(user.manager?.username || "—")}</td>
            <td data-label="სტატუსი">${statePill(Boolean(user.is_active))}</td>
            <td data-label="აქტიური დავალებები">${user.active_task_count || 0}</td>
            <td data-label="მოქმედებები" class="table-actions">
              ${isAdmin ? `<button type="button" class="btn btn--ghost btn--compact" data-edit-user="${user.id}">ორგანიზაცია</button>` : "<span class=\"table-muted\">მხოლოდ ხილვადი</span>"}
            </td>
          </tr>
        `
      )
      .join("");

    target.innerHTML = `
      <div class="panel panel--table">
        <div class="table-scroll">
          <table class="data-table data-table--employees">
            <thead>
              <tr>
                <th scope="col">მომხმარებელი</th>
                <th scope="col">როლი</th>
                <th scope="col">დეპარტამენტი</th>
                <th scope="col">პოზიცია</th>
                <th scope="col">მენეჯერი</th>
                <th scope="col">სტატუსი</th>
                <th scope="col">აქტიური</th>
                <th scope="col">მოქმედებები</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    target.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-user]");
      if (edit) this.openOrganizationDialog(Number(edit.dataset.editUser));
    });
  },

  async openOrganizationDialog(userId) {
    const user = this.users.find((item) => item.id === userId);
    if (!user) return;

    try {
      const [departments, positions] = await Promise.all([
        apiGet("/departments"),
        apiGet("/positions")
      ]);
      this.departments = departments || [];
      this.positions = positions || [];
      this.editingUserId = userId;
      this.renderOrganizationForm(user);
    } catch (error) {
      showToast(error.message, true);
    }
  },

  managerCandidates(user) {
    return this.users.filter(
      (candidate) =>
        candidate.is_active &&
        candidate.id !== user.id &&
        (candidate.role === "manager" || candidate.role === "admin")
    );
  },

  renderOrganizationForm(user) {
    const body = document.getElementById("entityBody");
    if (!body) return;
    document.getElementById("entityKicker").textContent = `ორგანიზაცია — ${user.username}`;
    document.getElementById("entityTitle").textContent = "ორგანიზაციული მინიჭება";
    document.getElementById("entitySaveButton").textContent = "ცვლილებების შენახვა";

    const departmentOptions = this.departments
      .map(
        (dept) =>
          `<option value="${dept.id}" ${user.department_id === dept.id ? "selected" : ""}>${esc(dept.name)}</option>`
      )
      .join("");
    const positionOptions = this.positions
      .filter((position) => position.department_id === user.department_id)
      .map(
        (position) =>
          `<option value="${position.id}" ${user.position_id === position.id ? "selected" : ""}>${esc(position.name)}</option>`
      )
      .join("");
    const managerOptions = this.managerCandidates(user)
      .map(
        (candidate) =>
          `<option value="${candidate.id}" ${user.manager_id === candidate.id ? "selected" : ""}>${esc(candidate.username)}</option>`
      )
      .join("");

    body.innerHTML = `
      <div class="org-form">
        <p class="org-form__note">მომხმარებელი: <strong>${esc(user.username)}</strong> · ${esc(this.roleLabel(user.role))}</p>

        <label class="form-group">
          <span>დეპარტამენტი</span>
          <select class="input" id="orgDepartment">
            <option value="">— არაა მინიჭებული —</option>
            ${departmentOptions}
          </select>
        </label>
        <label class="form-group">
          <span>პოზიცია</span>
          <select class="input" id="orgPosition">
            <option value="">— არაა მინიჭებული —</option>
            ${positionOptions}
          </select>
        </label>
        <label class="form-group">
          <span>მენეჯერი</span>
          <select class="input" id="orgManager">
            <option value="">— არაა მინიჭებული —</option>
            ${managerOptions}
          </select>
        </label>
        <label class="form-group form-group--check">
          <input type="checkbox" id="orgActive" ${user.is_active ? "checked" : ""}>
          <span>აქტიური ანგარიში</span>
        </label>
      </div>
    `;

    const departmentSelect = document.getElementById("orgDepartment");
    departmentSelect.addEventListener("change", () => {
      const positionSelect = document.getElementById("orgPosition");
      const selectedDepartment = Number(departmentSelect.value);
      positionSelect.innerHTML = `<option value="">— არაა მინიჭებული —</option>${this.positions
        .filter((position) => position.department_id === selectedDepartment)
        .map((position) => `<option value="${position.id}">${esc(position.name)}</option>`)
        .join("")}`;
    });

    const form = document.getElementById("entityForm");
    form.onsubmit = (event) => {
      event.preventDefault();
      this.saveOrganization(user);
    };
    openDialog("entityDialog");
  },

  async saveOrganization(user) {
    const departmentId = document.getElementById("orgDepartment")?.value
      ? Number(document.getElementById("orgDepartment").value)
      : null;
    const positionId = document.getElementById("orgPosition")?.value
      ? Number(document.getElementById("orgPosition").value)
      : null;
    const managerId = document.getElementById("orgManager")?.value
      ? Number(document.getElementById("orgManager").value)
      : null;
    const isActive = document.getElementById("orgActive")?.checked;

    const payload = { department_id: departmentId, position_id: positionId, manager_id: managerId, is_active: isActive };

    const saveButton = document.getElementById("entitySaveButton");
    if (saveButton) saveButton.disabled = true;

    try {
      await apiPatch(`/users/${user.id}/organization`, payload);
      closeDialog("entityDialog");
      showToast("ორგანიზაციული ინფორმაცია განახლდა");
      await this.refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }
};