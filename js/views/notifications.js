// views/notifications.js — user notifications (Phase 11).
// Verified Phase 9 endpoints:
//   GET /notifications?is_read=true|false
//   PATCH /notifications/:id/read, PATCH /notifications/read-all
//   GET /notifications/unread-count (bell badge)
// All roles have notifications scope.

const NotificationsView = {
  role: "employee",
  state: { unread_only: false },
  detailId: null,

  async init({ role } = {}) {
    this.role = role || "employee";
    this.detailId = null;
    const markAll = document.getElementById("markAllReadButton");
    if (markAll) {
      markAll.onclick = async () => {
        try {
          await apiPatch("/notifications/read-all");
          await this.refresh();
        } catch (error) {
          showToast(error.message, true);
        }
      };
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("notificationsContent");
    if (!target) return;
    setLoading(target);
    try {
      const notifications = await apiGet(`/notifications${this.state.unread_only ? "?is_read=false" : ""}`);
      this.render(target, notifications || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, notifications) {
    const rows = notifications.map((n) => `
      <tr class="clickable-row ${n.read_at ? "" : "is-unread"}" data-action="open-notification" data-id="${n.id}">
        <td><b>${n.read_at ? "" : "● "}${esc(NOTIFICATION_TYPE_LABELS[n.type] || n.title || n.type)}</b></td>
        <td>${esc(n.message || "")}</td>
        <td>${esc(n.type)}</td>
        <td>${esc(formatDateTime(n.created_at))}</td>
      </tr>`).join("");

    target.innerHTML = `
      <div class="view-toolbar" aria-label="შეტყობინებების ფილტრი">
        <label class="checkbox-inline">
          <input type="checkbox" id="notificationsUnreadOnly" ${this.state.unread_only ? "checked" : ""}>
          მხოლოდ წაუკითხავი
        </label>
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-notification-filters">ფილტრი</button>
      </div>
      ${dataTable(["შეტყობინება", "ტექსტი", "ტიპი", "დრო"], rows, "შეტყობინებები არ არის")}
    `;
  },

  async openDetail(id) {
    this.detailId = id;
    const notifications = await apiGet("/notifications");
    const notification = (notifications || []).find((n) => n.id === Number(id));
    if (!notification) {
      showToast("შეტყობინება ვერ მოიძებნა.", true);
      return;
    }
    if (!notification.read_at) {
      try {
        await apiPatch(`/notifications/${notification.id}/read`);
      } catch (error) {
        /* non-critical */
      }
    }
    await confirmAction(`${notification.title}\n\n${notification.message}`, { title: "შეტყობინება", okLabel: "დახურვა" });
    await this.refresh();
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-notification-filters":
        this.state.unread_only = document.getElementById("notificationsUnreadOnly").checked;
        await this.refresh();
        break;
      case "open-notification":
        await this.openDetail(node.dataset.id);
        break;
      default:
        break;
    }
  }
};

document.getElementById("notificationsContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  NotificationsView.handleAction(node.dataset.action, node);
});