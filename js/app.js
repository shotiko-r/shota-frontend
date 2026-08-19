// app.js — single workspace shell controller.
// Renders role-based navigation, handles hash routing between views, wires the
// header (user, theme, logout), mobile sidebar and global dialog close buttons.

const Workspace = {
  user: null,
  role: "employee",
  currentView: null,

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
    if (userRole) userRole.textContent = LEGACY_ROLE_LABELS[this.role] || this.role;
    if (userAvatar) {
      userAvatar.textContent = (this.user.username || "?").slice(0, 1).toUpperCase();
    }

    const chip = document.getElementById("userChip");
    if (chip) chip.addEventListener("click", () => this.navigate("profile"));

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
      case "overview":
        OverviewView.init();
        break;
      case "board":
        BoardView.init({
          canCreate: capability(role, "createTask"),
          canManage: capability(role, "employees")
        });
        break;
      case "departments":
        DepartmentsView.init();
        break;
      case "positions":
        PositionsView.init();
        break;
      case "employees":
        EmployeesView.init();
        break;
      case "reports":
        ReportsView.init();
        break;
      case "profile":
        this.renderProfile();
        break;
      default:
        break;
    }
  },

  renderProfile() {
    const target = document.getElementById("profileContent");
    if (!target) return;
    const user = this.user;
    target.innerHTML = `
      <div class="panel profile-panel">
        <div class="profile-panel__avatar" aria-hidden="true">${esc((user.username || "?").slice(0, 1).toUpperCase())}</div>
        <div class="profile-panel__info">
          <span class="workspace-kicker">ანგარიში</span>
          <h2>${esc(user.username || "—")}</h2>
          <p><strong>როლი:</strong> ${esc(LEGACY_ROLE_LABELS[this.role] || this.role)}</p>
          <p class="profile-panel__note">პაროლისა და პირადი მონაცემების მართვა ამ ეტაპზე მიუწვდომელია.</p>
        </div>
      </div>
    `;
  }
};

document.addEventListener("DOMContentLoaded", () => Workspace.init());