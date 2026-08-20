// app.js — single workspace shell controller (Phase 11).
// Renders role-based navigation, handles hash routing between business-area
// views, wires the header (user, notifications, theme, logout), mobile sidebar
// and global dialog close buttons.

const Workspace = {
  user: null,
  role: "employee",
  currentView: null,
  _notifyTimer: null,

  init() {
    if (!requireAuth()) return;

    this.user = getUser();
    this.role = (this.user && this.user.role) || "employee";

    initTheme();
    this.setupHeader();
    this.renderNav();
    this.setupSidebar();
    this.setupDialogs();
    this.setupRouting();
    this.setInitialView();
    this.startNotificationPolling();
  },

  setupHeader() {
    const todayLabel = document.getElementById("todayLabel");
    if (todayLabel) {
      todayLabel.textContent = new Intl.DateTimeFormat("ka-GE", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(new Date());
    }

    const userName = document.getElementById("userName");
    const userRole = document.getElementById("userRole");
    const userAvatar = document.getElementById("userAvatar");
    if (userName) userName.textContent = this.user.username || "—";
    if (userRole) userRole.textContent = roleLabel(this.role);
    if (userAvatar) {
      userAvatar.textContent = (this.user.username || "?").slice(0, 1).toUpperCase();
    }

    const chip = document.getElementById("userChip");
    if (chip) chip.addEventListener("click", () => this.navigate("profile"));

    const bell = document.getElementById("notifyBell");
    if (bell) bell.addEventListener("click", () => this.navigate("notifications"));

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) logoutButton.addEventListener("click", logout);
  },

  setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("workspaceSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");

    const closeSidebar = () => {
      sidebar.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-visible");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    };

    if (toggle && sidebar) {
      toggle.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("is-open");
        if (backdrop) backdrop.classList.toggle("is-visible", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeSidebar);
  },

  setupDialogs() {
    document.addEventListener("click", (event) => {
      const closer = event.target.closest("[data-close-dialog]");
      if (closer) closeDialog(closer.dataset.closeDialog);
    });
  },

  setupRouting() {
    window.addEventListener("hashchange", () => this.handleRoute());
  },

  navForRole() {
    const items = [];
    for (const entry of NAV_ITEMS) {
      if (entry.key) {
        if (this.canAccess(entry.key)) items.push(entry);
      } else if (entry.group) {
        const visibleItems = entry.items.filter((item) => this.canAccess(item.key));
        if (visibleItems.length) items.push({ group: entry.group, items: visibleItems });
      }
    }
    return items;
  },

  canAccess(view) {
    if (view === "profile") return true;
    return capability(this.role, view);
  },

  renderNav() {
    const nav = document.getElementById("workspaceNav");
    if (!nav) return;

    const html = this.navForRole()
      .map((entry) => {
        if (entry.key) {
          return `<button type="button" class="workspace-nav__item" data-nav="${entry.key}">
            <span aria-hidden="true">${entry.icon || "•"}</span> ${esc(entry.label)}
          </button>`;
        }
        return `
          <div class="workspace-nav__group">
            <span class="workspace-nav__group-label">${esc(entry.group)}</span>
            ${entry.items
              .map(
                (item) => `<button type="button" class="workspace-nav__item workspace-nav__item--sub" data-nav="${item.key}">
                  <span aria-hidden="true">•</span> ${esc(item.label)}
                </button>`
              )
              .join("")}
          </div>
        `;
      })
      .join("");

    nav.innerHTML = html;
    nav.addEventListener("click", (event) => {
      const item = event.target.closest("[data-nav]");
      if (item) this.navigate(item.dataset.nav);
    });
  },

  setActiveNav(view) {
    document.querySelectorAll("[data-nav]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.nav === view);
    });
  },

  setInitialView() {
    let view = this.parseHash();
    if (!this.canAccess(view)) view = defaultViewForRole(this.role);
    this.navigate(view, { replace: true });
  },

  parseHash() {
    const raw = window.location.hash.replace(/^#/, "");
    return raw || "";
  },

  navigate(view, options = {}) {
    if (!this.canAccess(view)) {
      view = defaultViewForRole(this.role);
    }

    const hashChanged = options.replace ? false : this.parseHash() !== view;
    if (options.replace) {
      history.replaceState(null, "", `#${view}`);
    } else if (hashChanged) {
      window.location.hash = view;
    }

    this.showView(view);
    this.setActiveNav(view);
    this.closeMobileSidebar();
    this.currentView = view;
    // When the hash changed, the hashchange event re-initializes the view.
    if (!hashChanged) this.initView(view);
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById("workspaceSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const toggle = document.getElementById("sidebarToggle");
    if (sidebar) sidebar.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-visible");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  },

  showView(view) {
    document.querySelectorAll("[data-view]").forEach((section) => {
      section.hidden = section.dataset.view !== view;
    });
  },

  handleRoute() {
    let view = this.parseHash();
    if (!view) view = defaultViewForRole(this.role);
    if (!this.canAccess(view)) view = defaultViewForRole(this.role);
    this.showView(view);
    this.setActiveNav(view);
    this.closeMobileSidebar();
    this.currentView = view;
    this.initView(view);
  },

  initView(view) {
    const role = this.role;
    switch (view) {
      case "dashboard":
        DashboardView.init({ role, canCreate: capability(role, "workOrders") });
        break;
      case "workOrders":
        WorkOrdersView.init({ role });
        break;
      case "dispatch":
        DispatchView.init({ role });
        break;
      case "board":
        BoardView.init({
          canCreate: capability(role, "createTask"),
          canManage: capability(role, "employees")
        });
        break;
      case "parts":
        PartsView.init({ role });
        break;
      case "warehouses":
        WarehousesView.init({ role });
        break;
      case "stock":
        StockView.init({ role });
        break;
      case "reservations":
        ReservationsView.init({ role });
        break;
      case "technicianStock":
        TechnicianStockView.init({ role });
        break;
      case "purchaseRequests":
        PurchaseRequestsView.init({ role });
        break;
      case "suppliers":
        SuppliersView.init({ role });
        break;
      case "purchaseOrders":
        PurchaseOrdersView.init({ role });
        break;
      case "notifications":
        NotificationsView.init({ role });
        break;
      case "audit":
        AuditView.init({ role });
        break;
      case "reports":
        ReportsView.init();
        break;
      case "employees":
        EmployeesView.init({ role });
        break;
      case "departments":
        DepartmentsView.init();
        break;
      case "positions":
        PositionsView.init();
        break;
      case "profile":
        this.renderProfile();
        break;
      default:
        break;
    }
  },

  // -------------------------------------------------------------------------
  // Notifications bell (recipient-scoped, read-only count).
  // -------------------------------------------------------------------------
  startNotificationPolling() {
    if (!capability(this.role, "notifications")) return;
    this.refreshUnreadCount();
    this._notifyTimer = window.setInterval(() => this.refreshUnreadCount(), 60000);
  },

  async refreshUnreadCount() {
    try {
      const result = await apiGet("/notifications/unread-count");
      const count = Number(result && result.unread_count) || 0;
      const badge = document.getElementById("notifyBadge");
      if (!badge) return;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = count === 0;
    } catch (error) {
      // Silent — the bell is a convenience, not a critical path.
    }
  },

  // -------------------------------------------------------------------------
  // Profile (self-service, read-only; no write endpoints exist for self).
  // -------------------------------------------------------------------------
  async renderProfile() {
    const target = document.getElementById("profileContent");
    if (!target) return;
    const user = this.user;
    setLoading(target);

    let detail = null;
    try {
      detail = await apiGet(`/users/${user.id}`);
    } catch (error) {
      // Fall back to token data if the detail call is not allowed.
    }

    const roleLabelText = roleLabel(this.role);
    const name = detail
      ? [detail.first_name, detail.last_name].filter(Boolean).join(" ") || detail.username
      : user.username;

    target.innerHTML = `
      <div class="panel profile-panel">
        <div class="profile-panel__avatar" aria-hidden="true">${esc((user.username || "?").slice(0, 1).toUpperCase())}</div>
        <div class="profile-panel__info">
          <span class="workspace-kicker">ანგარიში</span>
          <h2>${esc(name)}</h2>
          <p><strong>მომხმარებელი:</strong> ${esc(user.username || "—")}</p>
          <p><strong>როლი:</strong> ${esc(roleLabelText)}</p>
          ${
            detail
              ? `<p><strong>ელ. ფოსტა:</strong> ${esc(detail.email || "—")}</p>
                 <p><strong>ტელეფონი:</strong> ${esc(detail.phone || "—")}</p>
                 <p><strong>დეპარტამენტი:</strong> ${esc(detail.department ? detail.department.name : "—")}</p>
                 <p><strong>პოზიცია:</strong> ${esc(detail.position ? detail.position.name : "—")}</p>`
              : ""
          }
          <p class="profile-panel__note">პაროლისა და პირადი მონაცემების შეცვლა ამ ეტაპზე მიუწვდომელია.</p>
        </div>
      </div>
    `;
  }
};

document.addEventListener("DOMContentLoaded", () => Workspace.init());