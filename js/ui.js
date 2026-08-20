// ui.js — shared UI utilities: toast, dialogs, confirm, loading, safe rendering.

// Safe HTML escaping for user-controlled strings.
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// Element builder helper — avoids innerHTML for dynamic, user-controlled markup.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

let toastTimeout = null;

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("toast--error", isError);
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

function openDialog(dialog) {
  if (typeof dialog === "string") dialog = document.getElementById(dialog);
  if (dialog && typeof dialog.showModal === "function") dialog.showModal();
}

function closeDialog(dialog) {
  if (typeof dialog === "string") dialog = document.getElementById(dialog);
  if (dialog && dialog.open) dialog.close();
}

// Promise-based confirm dialog reusing the shared <dialog> element.
function confirmAction(message, options = {}) {
  const dialog = document.getElementById("confirmDialog");
  if (!dialog) return Promise.resolve(false);

  dialog.querySelector("[data-confirm-title]").textContent =
    options.title || "დადასტურება";
  dialog.querySelector("[data-confirm-message]").textContent = message;
  const confirmButton = dialog.querySelector("[data-confirm-ok]");
  confirmButton.textContent = options.okLabel || "წაშლა";
  confirmButton.className = `btn ${options.danger === false ? "btn--primary" : "btn--danger"}`;

  return new Promise((resolve) => {
    const close = (result) => {
      confirmButton.removeEventListener("click", onOk);
      cancelButton.removeEventListener("click", onCancel);
      dialog.removeEventListener("close", onClose);
      dialog.close();
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onClose = () => close(false);
    const cancelButton = dialog.querySelector("[data-confirm-cancel]");

    confirmButton.addEventListener("click", onOk);
    cancelButton.addEventListener("click", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function setLoading(target, loading = true) {
  if (!target) return;
  if (loading) {
    target.setAttribute("aria-busy", "true");
    target.innerHTML = `<p class="state-note">${esc(STRINGS.loading)}</p>`;
  } else {
    target.removeAttribute("aria-busy");
  }
}

function emptyState(message = STRINGS.emptyState) {
  return `<p class="state-note">${esc(message)}</p>`;
}

function errorState(message = STRINGS.errorState) {
  return `<p class="state-note state-note--error">${esc(message)}</p>`;
}

function stateContent(message, isError = false) {
  return `<p class="state-note${isError ? " state-note--error" : ""}">${esc(message)}</p>`;
}

function formatDate(dateValue, withTime = false) {
  if (!dateValue) return "ვადა არ არის";
  const date = new Date(`${dateValue}${dateValue.includes("T") ? "" : "T00:00:00"}`);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  const options = withTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("ka-GE", options).format(date);
}

function isOverdue(task) {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(`${task.due_date}T00:00:00`);
  const today = new Date(new Date().toDateString());
  return due < today;
}

function statePill(isActive) {
  const label = isActive ? "აქტიური" : "არააქტიური";
  const cls = isActive ? "state-badge state-badge--active" : "state-badge state-badge--inactive";
  return `<span class="${cls}">${label}</span>`;
}

// ---------------------------------------------------------------------------
// Phase 11 shared render helpers
// ---------------------------------------------------------------------------

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function statusPill(status, meta) {
  const m = meta[status] || { label: status, tone: "pending" };
  return `<span class="status-pill status-pill--${esc(m.tone)}">${esc(m.label)}</span>`;
}

function priorityBadge(priority) {
  const label = PRIORITY_LABELS[priority] || priority || "—";
  return `<span class="priority-badge priority-badge--${esc(priority || "medium")}">${esc(label)}</span>`;
}

function shortTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16) || String(value);
  return new Intl.DateTimeFormat("ka-GE", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

// Reusable data-table wrapper with empty/loading states.
function dataTable(headers, rowsHtml, emptyMessage) {
  if (!rowsHtml) return emptyState(emptyMessage || STRINGS.emptyState);
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

// Builds an <option> list inside a select element.
function fillSelect(select, items, { valueKey = "id", labelKey = "name", placeholder, selected, disabledValue } = {}) {
  if (!select) return;
  const options = [];
  if (placeholder !== undefined) {
    options.push(`<option value="" ${selected === "" ? "selected" : ""}>${esc(placeholder)}</option>`);
  }
  for (const item of items || []) {
    const value = typeof item === "object" ? item[valueKey] : item;
    const label = typeof item === "object" ? item[labelKey] : String(item);
    const disabled = disabledValue != null && value === disabledValue ? " disabled" : "";
    const sel = String(value) === String(selected) ? " selected" : "";
    options.push(`<option value="${esc(value)}"${sel}${disabled}>${esc(label)}</option>`);
  }
  select.innerHTML = options.join("");
}

// Fills a select from an async GET endpoint.
async function fillSelectFromApi(select, path, { valueKey = "id", labelKey = "name", placeholder, selected } = {}) {
  try {
    const items = await apiGet(path);
    fillSelect(select, items || [], { valueKey, labelKey, placeholder, selected });
    return items || [];
  } catch (error) {
    showToast(error.message, true);
    return [];
  }
}

// Simple pagination controls (render buttons; the view handles navigation).
function paginationBar({ page = 1, total = 0, perPage = 50 }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const label = `გვერდი ${Math.min(page, pages)} / ${pages} · სულ ${total}`;
  return `
    <div class="pagination">
      <span class="pagination__info">${esc(label)}</span>
      <div class="pagination__buttons">
        <button type="button" class="btn btn--ghost btn--compact" data-page="prev" ${page <= 1 ? "disabled" : ""}>←</button>
        <button type="button" class="btn btn--ghost btn--compact" data-page="next" ${page >= pages ? "disabled" : ""}>→</button>
      </div>
    </div>
  `;
}

function relativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "ახლახან";
  if (abs < 3600) return `${Math.round(abs / 60)} წთ ${seconds < 0 ? "წინ" : "ში"}`;
  if (abs < 86400) return `${Math.round(abs / 3600)} სთ ${seconds < 0 ? "წინ" : "ში"}`;
  if (abs < 604800) return `${Math.round(abs / 86400)} დღე ${seconds < 0 ? "წინ" : "ში"}`;
  return formatDate(value, true);
}

// ---------------------------------------------------------------------------
// Dynamic form dialog (reuses the shared #entityDialog element).
//
// field spec:
//   { name, label, type: text|number|select|date|datetime-local|textarea,
//     required, placeholder, help, options: [{value,label}], value }
// onSave(values) must return a promise. On success the dialog closes; on
// rejection the message is toasted and the dialog stays open.
// ---------------------------------------------------------------------------

let _entityOnSave = null;

function renderField(field) {
  const required = field.required ? " required" : "";
  const value = field.value == null ? "" : esc(field.value);
  const name = esc(field.name);

  if (field.type === "select") {
    const options = (field.options || [])
      .map(
        (opt) =>
          `<option value="${esc(opt.value)}" ${String(opt.value) === String(field.value) ? "selected" : ""}>${esc(opt.label)}</option>`
      )
      .join("");
    return `<label class="form-group">
      <span>${esc(field.label)}${field.required ? " *" : ""}</span>
      <select class="input" name="${name}"${required}>${options}</select>
      ${field.help ? `<small class="form-hint">${esc(field.help)}</small>` : ""}
    </label>`;
  }

  if (field.type === "items") {
    return `<label class="form-group">
      <span>${esc(field.label)}${field.required ? " *" : ""}</span>
      ${renderItemRows(field)}
      ${field.help ? `<small class="form-hint">${esc(field.help)}</small>` : ""}
    </label>`;
  }

  if (field.type === "textarea") {
    return `<label class="form-group">
      <span>${esc(field.label)}${field.required ? " *" : ""}</span>
      <textarea class="input modal__textarea" name="${name}"${required} placeholder="${esc(field.placeholder || "")}">${value}</textarea>
      ${field.help ? `<small class="form-hint">${esc(field.help)}</small>` : ""}
    </label>`;
  }

  const inputType = field.type || "text";
  return `<label class="form-group">
    <span>${esc(field.label)}${field.required ? " *" : ""}</span>
    <input class="input" type="${esc(inputType)}" name="${name}"${required} value="${value}" placeholder="${esc(field.placeholder || "")}" ${field.step != null ? `step="${esc(String(field.step))}"` : ""} ${field.min != null ? `min="${esc(String(field.min))}"` : ""}>
    ${field.help ? `<small class="form-hint">${esc(field.help)}</small>` : ""}
  </label>`;
}

// Dynamic row-based items editor used by procurement documents.
function renderItemRows(field) {
  const rows = (field.value || []).map((item) => renderItemRow(field, item)).join("");
  return `
    <div class="items-editor__rows" data-items-rows="${esc(field.name)}">${rows}</div>
    <button type="button" class="btn btn--ghost btn--compact" data-add-item="${esc(field.name)}" data-item-fields='${esc(JSON.stringify(field.itemFields || []))}'>+ ${esc(field.addLabel || "პუნქტის დამატება")}</button>
  `;
}

function renderItemRow(field, item = {}) {
  const inputs = (field.itemFields || [])
    .map((f) => {
      const v = item[f.name] == null ? "" : esc(String(item[f.name]));
      if (f.type === "select") {
        const opts = (f.options || [])
          .map(
            (o) => `<option value="${esc(o.value)}" ${String(o.value) === String(item[f.name]) ? "selected" : ""}>${esc(o.label)}</option>`
          )
          .join("");
        return `<select class="input items-editor__input" data-item-field="${esc(f.name)}">${opts}</select>`;
      }
      const type = f.type || "number";
      return `<input class="input items-editor__input" type="${type}" data-item-field="${esc(f.name)}" value="${v}" ${f.step ? `step="${esc(String(f.step))}"` : ""} ${f.min != null ? `min="${esc(String(f.min))}"` : ""} placeholder="${esc(f.placeholder || "")}">`;
    })
    .join("");
  return `
    <div class="items-editor__row">
      ${inputs}
      <button type="button" class="btn btn--ghost btn--compact" data-remove-item aria-label="წაშლა">×</button>
    </div>
  `;
}

document.addEventListener("click", (event) => {
  const addBtn = event.target.closest("[data-add-item]");
  if (addBtn) {
    event.preventDefault();
    const field = {
      name: addBtn.dataset.addItem,
      itemFields: JSON.parse(addBtn.dataset.itemFields || "[]")
    };
    const container = addBtn.closest(".form-group").querySelector("[data-items-rows]");
    if (container) container.insertAdjacentHTML("beforeend", renderItemRow(field, {}));
    return;
  }
  const removeBtn = event.target.closest("[data-remove-item]");
  if (removeBtn) {
    event.preventDefault();
    removeBtn.closest(".items-editor__row").remove();
  }
});

// options can also be a function returning a promise of [{value,label}].
function openEntityDialog({ kicker, title, fields, submitLabel = "შენახვა", onSave }) {
  const dialog = document.getElementById("entityDialog");
  const body = document.getElementById("entityBody");
  const form = document.getElementById("entityForm");
  const saveButton = document.getElementById("entitySaveButton");
  if (!dialog || !body || !form) return;

  document.getElementById("entityKicker").textContent = kicker || "მართვა";
  document.getElementById("entityTitle").textContent = title;
  saveButton.textContent = submitLabel;

  const renderFields = (resolvedFields) => {
    body.innerHTML = `<div class="form-section"><div class="form-section__fields">${resolvedFields
      .map(renderField)
      .join("")}</div></div>`;
  };

  _entityOnSave = onSave;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = {};
    for (const field of fields) {
      if (field.type === "items") {
        const rows = form.querySelectorAll(`[data-items-rows="${CSS.escape(field.name)}"] .items-editor__row`);
        const items = [];
        for (const row of rows) {
          const obj = {};
          let empty = true;
          for (const f of field.itemFields) {
            const input = row.querySelector(`[data-item-field="${CSS.escape(f.name)}"]`);
            const raw = input ? input.value : "";
            if (raw !== "") empty = false;
            if (f.type === "number") {
              obj[f.name] = raw === "" ? null : Number(raw);
            } else {
              obj[f.name] = raw === "" ? null : raw;
            }
          }
          if (!empty) items.push(obj);
        }
        values[field.name] = items;
        if (field.required && !items.length) {
          showToast(`${field.label} სავალდებულოა.`, true);
          return;
        }
        continue;
      }
      const input = form.querySelector(`[name="${CSS.escape(field.name)}"]`);
      if (!input) continue;
      const raw = input.value;
      if (field.type === "number") {
        values[field.name] = raw === "" ? null : Number(raw);
      } else {
        values[field.name] = raw === "" ? null : raw;
      }
      if (field.required && (values[field.name] === null || values[field.name] === "")) {
        showToast(`${field.label} სავალდებულოა.`, true);
        return;
      }
    }
    saveButton.disabled = true;
    try {
      await onSave(values);
      closeDialog("entityDialog");
      showToast(STRINGS.success);
    } catch (error) {
      showToast(error.message || STRINGS.saveError, true);
    } finally {
      saveButton.disabled = false;
    }
  };

  const render = async () => {
    const resolved = [];
    for (const field of fields) {
      if (typeof field.options === "function") {
        const opts = await field.options();
        resolved.push({ ...field, options: opts || [] });
      } else {
        resolved.push(field);
      }
    }
    renderFields(resolved);
  };
  render().then(() => openDialog("entityDialog"));
}