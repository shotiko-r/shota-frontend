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