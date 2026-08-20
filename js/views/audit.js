// views/audit.js — audit log (Phase 11).
// Verified Phase 10 endpoint: GET /audit (admin only).
// Filters by entity_type, action, actor_username, date_from/to; admin only.

const AuditView = {
  role: "employee",
  state: { entity_type: "", action: "", actor_username: "", date_from: "", date_to: "" },

  async init({ role } = {}) {
    this.role = role || "employee";
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("auditContent");
    if (!target) return;
    setLoading(target);
    const params = new URLSearchParams();
    if (this.state.entity_type) params.set("entity_type", this.state.entity_type);
    if (this.state.action) params.set("action", this.state.action);
    if (this.state.actor_username) params.set("actor_username", this.state.actor_username);
    if (this.state.date_from) params.set("date_from", this.state.date_from);
    if (this.state.date_to) params.set("date_to", this.state.date_to);
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const logs = await apiGet(`/audit${query}`);
      this.render(target, logs || []);
    } catch (error) {
      target.innerHTML = errorState(error.message);
    }
  },

  render(target, logs) {
    const entityOptions = ["work_order", "work_order_task", "appointment", "sla", "work_order_part", "attachment", "warehouse", "supplier", "part", "notification", "stock", "technician_stock", "purchase_request", "purchase_order"]
      .map((e) => `<option value="${e}" ${this.state.entity_type === e ? "selected" : ""}>${esc(e)}</option>`).join("");

    const rows = logs.map((log) => `
      <tr>
        <td>${esc(log.entity_type)}</td>
        <td>#${esc(String(log.entity_id))}</td>
        <td>${statusPill(log.action, AUDIT_ACTION_META)}</td>
        <td>${esc(log.actor_username || "—")}</td>
        <td>${esc(formatDateTime(log.created_at))}</td>
        <td class="clickable-row" data-action="expand-audit" data-id="${log.id}">⋯</td>
      </tr>`).join("");

    target.innerHTML = `
      <div class="view-toolbar" aria-label="აუდიტის ფილტრები">
        <select class="input view-toolbar__select" id="auditEntityFilter" aria-label="ობიექტის ფილტრი">
          <option value="">ყველა ობიექტი</option>
          ${entityOptions}
        </select>
        <select class="input view-toolbar__select" id="auditActionFilter" aria-label="მოქმედების ფილტრი">
          <option value="">ყველა მოქმედება</option>
          ${Object.entries(AUDIT_ACTION_META).map(([a, m]) => `<option value="${a}" ${this.state.action === a ? "selected" : ""}>${esc(m.label)}</option>`).join("")}
        </select>
        <input class="input view-toolbar__select" id="auditActorFilter" placeholder="მომხმარებელი" value="${esc(this.state.actor_username)}">
        <input class="input view-toolbar__select" type="date" id="auditFromFilter" value="${esc(this.state.date_from)}" aria-label="დან">
        <input class="input view-toolbar__select" type="date" id="auditToFilter" value="${esc(this.state.date_to)}" aria-label="მდე">
        <button type="button" class="btn btn--primary btn--compact" data-action="apply-audit-filters">ფილტრი</button>
      </div>
      ${dataTable(["ობიექტი", "ჩანაწერი", "მოქმედება", "მომხმარებელი", "დრო", ""], rows, "აუდიტის ჩანაწერები არ არის")}
      <div id="auditDetail"></div>
    `;
  },

  async expandDetail(id) {
    try {
      const logs = await apiGet("/audit");
      const log = (logs || []).find((l) => l.id === Number(id));
      if (!log) return;
      const host = document.getElementById("auditDetail");
      if (!host) return;
      host.innerHTML = `
        <div class="detail">
          <div class="detail__top">
            <div class="detail__head">
              <span class="workspace-kicker">აუდიტი #${esc(String(log.id))}</span>
              <h2>${esc(log.entity_type)} ${statusPill(log.action, AUDIT_ACTION_META)}</h2>
            </div>
          </div>
          <pre class="audit-json">${esc(JSON.stringify({ old_data: log.old_data, new_data: log.new_data }, null, 2))}</pre>
        </div>
      `;
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      showToast(error.message, true);
    }
  },

  async handleAction(action, node) {
    switch (action) {
      case "apply-audit-filters":
        this.state.entity_type = document.getElementById("auditEntityFilter").value;
        this.state.action = document.getElementById("auditActionFilter").value;
        this.state.actor_username = document.getElementById("auditActorFilter").value;
        this.state.date_from = document.getElementById("auditFromFilter").value;
        this.state.date_to = document.getElementById("auditToFilter").value;
        await this.refresh();
        break;
      case "expand-audit":
        await this.expandDetail(node.dataset.id);
        break;
      default:
        break;
    }
  }
};

document.getElementById("auditContent").addEventListener("click", (event) => {
  const node = event.target.closest("[data-action]");
  if (!node) return;
  event.preventDefault();
  AuditView.handleAction(node.dataset.action, node);
});