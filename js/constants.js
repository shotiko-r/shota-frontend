// constants.js — centralized labels, transitions, navigation and shared
// configuration for the Unitasks operations workspace (Phase 11).
//
// The backend remains the authority on authorization. ROLE_CAPABILITIES is a
// UX-only approximation built from the verified RBAC permission grants
// (migrations 003/004/009); it decides which views to show and which buttons to
// render. The API still rejects anything the actor may not do.

// ---------------------------------------------------------------------------
// Legacy task model (Phase 5 board) — preserved verbatim.
// ---------------------------------------------------------------------------

const STATUS_META = {
  pending: { label: "მისაღები", tone: "pending" },
  in_progress: { label: "მიმდინარეობს", tone: "progress" },
  blocked: { label: "დაბლოკილი", tone: "blocked" },
  done: { label: "დასრულებული", tone: "done" }
};

const STATUS_ORDER = ["pending", "in_progress", "blocked", "done"];

const PRIORITY_LABELS = {
  urgent: "კრიტიკული",
  high: "მაღალი",
  medium: "საშუალო",
  low: "დაბალი"
};

const CATEGORY_LABELS = {
  maintenance: "ტექნიკური მომსახურება",
  repair: "შეკეთება",
  installation: "ინსტალაცია",
  inspection: "ინსპექცია"
};

const LEGACY_ROLE_LABELS = {
  admin: "ადმინისტრატორი",
  manager: "მენეჯერი",
  technician: "ტექნიკოსი",
  employee: "თანამშრომელი"
};

// RBAC role labels (migration 003 + legacy users.role fallback).
const ROLE_LABELS = {
  super_admin: "სუპერ ადმინისტრატორი",
  department_manager: "დეპარტამენტის მენეჯერი",
  technician: "ტექნიკოსი",
  employee: "თანამშრომელი",
  admin: "ადმინისტრატორი",
  manager: "მენეჯერი"
};

const STRINGS = {
  brand: "Unitasks",
  tagline: "უნივერსალური დავალებების მენეჯერი",
  exportFileName: "unitasks-tasks.xlsx",
  sessionExpired: "სესია დასრულდა. გთხოვთ, თავიდან შეხვიდეთ სისტემაში.",
  forbidden: "ამ მოქმედების შესრულების უფლება არ გაქვთ.",
  rateLimited: "ძალიან ბევრი მოთხოვნა გაიგზავნა. გთხოვთ, ცოტა ხანში სცადოთ.",
  notFound: "მოთხოვნილი რესურსი ვერ მოიძებნა.",
  serviceUnavailable: "სერვისი მიუწვდომელია. გთხოვთ, მოგვიანებით სცადოთ.",
  serverError: "სერვისში ხარვეზი წარმოიშვა. გთხოვთ, მოგვიანებით სცადოთ.",
  noChanges: "ცვლილებები არ არის შეტანილი.",
  loading: "იტვირთება…",
  emptyState: "მონაცემები არ არის.",
  errorState: "მონაცემების ჩატვირთვა ვერ მოხერხდა.",
  saveError: "შენახვა ვერ მოხერხდა.",
  success: "ოპერაცია წარმატებით დასრულდა."
};

// ---------------------------------------------------------------------------
// Phase 7 work order model
// ---------------------------------------------------------------------------

const WORK_ORDER_STATUS_META = {
  new: { label: "ახალი", tone: "pending" },
  assigned: { label: "დანიშნული", tone: "assigned" },
  in_progress: { label: "მიმდინარეობს", tone: "progress" },
  blocked: { label: "დაბლოკილი", tone: "blocked" },
  completed: { label: "დასრულებული", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" }
};

const WORK_ORDER_STATUS_ORDER = [
  "new",
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled"
];

// Verified against backend services/workflowService.js — never invent a
// transition. Work order tasks use WORK_ORDER_TASK_TRANSITIONS.
const WORK_ORDER_TRANSITIONS = {
  new: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: []
};

const WORK_ORDER_TASK_TRANSITIONS = {
  new: ["assigned", "cancelled"],
  assigned: ["in_progress", "completed", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: []
};

const WORK_ORDER_CATEGORY_LABELS = {
  maintenance: "ტექნიკური მომსახურება",
  repair: "შეკეთება",
  installation: "ინსტალაცია",
  inspection: "ინსპექცია",
  other: "სხვა"
};

// ---------------------------------------------------------------------------
// Phase 8 appointment model
// ---------------------------------------------------------------------------

const APPOINTMENT_STATUS_META = {
  scheduled: { label: "დაგეგმილი", tone: "scheduled" },
  confirmed: { label: "დადასტურებული", tone: "assigned" },
  travelling: { label: "გზაში", tone: "travelling" },
  arrived: { label: "ადგილზეა", tone: "travelling" },
  in_progress: { label: "მიმდინარეობს", tone: "progress" },
  completed: { label: "დასრულებული", tone: "done" },
  missed: { label: "გამოტოვებული", tone: "cancelled" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" },
  rescheduled: { label: "გადანაწილებული", tone: "cancelled" }
};

const APPOINTMENT_STATUS_ORDER = [
  "scheduled",
  "confirmed",
  "travelling",
  "arrived",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
  "rescheduled"
];

// Active statuses participate in double-booking protection on the backend.
const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "travelling",
  "arrived",
  "in_progress"
];

// Reschedule is a dedicated endpoint (PATCH /appointments/:id/reschedule);
// it is valid from scheduled/confirmed per the backend state machine.
const APPOINTMENT_TRANSITIONS = {
  scheduled: ["confirmed", "cancelled", "rescheduled"],
  confirmed: ["travelling", "cancelled", "missed", "rescheduled"],
  travelling: ["arrived", "cancelled", "missed"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  missed: [],
  cancelled: [],
  rescheduled: []
};

// ---------------------------------------------------------------------------
// Phase 9 SLA model
// ---------------------------------------------------------------------------

const SLA_STATUS_META = {
  active: { label: "აქტიური", tone: "progress" },
  at_risk: { label: "რისკის ქვეშ", tone: "blocked" },
  breached: { label: "ვადა დარღვეულია", tone: "cancelled" },
  met: { label: "შესრულებულია", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" },
  paused: { label: "პაუზა", tone: "pending" }
};

const NOTIFICATION_TYPE_LABELS = {
  work_order_assigned: "დავალება დაგინიშნათ",
  work_order_updated: "სამუშაო ბრძანება განახლდა",
  appointment_assigned: "ვიზიტი დაგინიშნათ",
  appointment_rescheduled: "ვიზიტი გადაინიშნა",
  appointment_cancelled: "ვიზიტი გაუქმდა",
  sla_at_risk: "SLA რისკის ქვეშაა",
  sla_breached: "SLA ვადა დარღვეულია",
  escalation_created: "ესკალაცია შეიქმნა",
  purchase_request_approved: "შესყიდვის მოთხოვნა დამტკიცდა",
  purchase_request_rejected: "შესყიდვის მოთხოვნა უარყოფილია",
  stock_reserved: "მარაგი დაჯავშნულია",
  stock_unavailable: "მარაგი მიუწვდომელია",
  purchase_order_received: "შესყიდვის ორდერი მიღებულია"
};

// ---------------------------------------------------------------------------
// Phase 10 inventory & procurement model
// ---------------------------------------------------------------------------

const WOP_STATUS_META = {
  required: { label: "საჭიროა", tone: "pending" },
  partially_reserved: { label: "ნაწილობრივ დაჯავშნული", tone: "assigned" },
  reserved: { label: "დაჯავშნული", tone: "progress" },
  partially_consumed: { label: "ნაწილობრივ მოხმარებული", tone: "travelling" },
  consumed: { label: "მოხმარებული", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" }
};

const WOP_STATUS_ORDER = [
  "required",
  "partially_reserved",
  "reserved",
  "partially_consumed",
  "consumed",
  "cancelled"
];

const RESERVATION_STATUS_META = {
  active: { label: "აქტიური", tone: "progress" },
  released: { label: "გათავისუფლებული", tone: "done" },
  consumed: { label: "მოხმარებული", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" }
};

const MOVEMENT_TYPE_LABELS = {
  receipt: "მიღება",
  issue: "გაცემა",
  transfer: "გადატანა",
  reservation: "ჯავშანი",
  reservation_release: "ჯავშნის გათავისუფლება",
  consumption: "მოხმარება",
  adjustment: "კორექტირება",
  return: "დაბრუნება"
};

const TECH_STOCK_MOVEMENT_LABELS = {
  receive: "მიღება",
  consume: "მოხმარება",
  return: "დაბრუნება",
  adjustment: "კორექტირება"
};

const PR_STATUS_META = {
  draft: { label: "პროექტი", tone: "pending" },
  submitted: { label: "გაგზავნილია", tone: "assigned" },
  approved: { label: "დამტკიცებული", tone: "progress" },
  rejected: { label: "უარყოფილი", tone: "cancelled" },
  ordered: { label: "შეკვეთილია", tone: "travelling" },
  partially_received: { label: "ნაწილობრივ მიღებული", tone: "travelling" },
  received: { label: "მიღებული", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" }
};

const PR_STATUS_ORDER = [
  "draft",
  "submitted",
  "approved",
  "ordered",
  "partially_received",
  "received",
  "rejected",
  "cancelled"
];

const PR_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["partially_received", "received", "cancelled"],
  partially_received: ["received"],
  received: [],
  rejected: [],
  cancelled: []
};

const PO_STATUS_META = {
  draft: { label: "პროექტი", tone: "pending" },
  submitted: { label: "გაგზავნილია", tone: "assigned" },
  ordered: { label: "შეკვეთილია", tone: "travelling" },
  partially_received: { label: "ნაწილობრივ მიღებული", tone: "travelling" },
  received: { label: "მიღებული", tone: "done" },
  cancelled: { label: "გაუქმებული", tone: "cancelled" }
};

const PO_STATUS_ORDER = [
  "draft",
  "submitted",
  "ordered",
  "partially_received",
  "received",
  "cancelled"
];

const PO_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["ordered", "cancelled"],
  ordered: ["partially_received", "received", "cancelled"],
  partially_received: ["received"],
  received: [],
  cancelled: []
};

// Audit action labels — verified against the action strings emitted by the
// backend services (auditService.logAudit call sites).
const AUDIT_ACTION_META = {
  "work_order.created": { label: "ბრძანება შეიქმნა", tone: "done" },
  "work_order.updated": { label: "ბრძანება განახლდა", tone: "assigned" },
  "work_order.status_changed": { label: "სტატუსი შეიცვალა", tone: "progress" },
  "work_order.assigned": { label: "ბრძანება დაინიშნა", tone: "assigned" },
  "work_order_task.created": { label: "დავალება შეიქმნა", tone: "done" },
  "work_order_task.updated": { label: "დავალება განახლდა", tone: "assigned" },
  "work_order_task.status_changed": { label: "დავალება — სტატუსი", tone: "progress" },
  "work_order_task.assigned": { label: "დავალება დაინიშნა", tone: "assigned" },
  "work_order_task.completed": { label: "დავალება დასრულდა", tone: "done" },
  "appointment.created": { label: "ვიზიტი შეიქმნა", tone: "done" },
  "appointment.updated": { label: "ვიზიტი განახლდა", tone: "assigned" },
  "appointment.status_changed": { label: "ვიზიტი — სტატუსი", tone: "progress" },
  "appointment.assigned": { label: "ვიზიტი დაინიშნა", tone: "assigned" },
  "appointment.rescheduled": { label: "ვიზიტი გადაინიშნა", tone: "progress" },
  "sla.created": { label: "SLA შეიქმნა", tone: "done" },
  "sla.updated": { label: "SLA განახლდა", tone: "assigned" },
  "sla.at_risk": { label: "SLA რისკი", tone: "blocked" },
  "sla.breached": { label: "SLA დარღვეულია", tone: "cancelled" },
  "sla.met": { label: "SLA შესრულდა", tone: "done" },
  "escalation.triggered": { label: "ესკალაცია", tone: "blocked" },
  "work_order_part.created": { label: "ნაწილი დაემატა", tone: "done" },
  "work_order_part.updated": { label: "ნაწილი განახლდა", tone: "assigned" },
  "work_order_part.deleted": { label: "ნაწილი წაიშალა", tone: "cancelled" },
  "attachment.uploaded": { label: "ფაილი აიტვირთა", tone: "done" },
  "attachment.deleted": { label: "ფაილი წაიშალა", tone: "cancelled" },
  "warehouse.created": { label: "საწყობი შეიქმნა", tone: "done" },
  "warehouse.updated": { label: "საწყობი განახლდა", tone: "assigned" },
  "supplier.created": { label: "მომწოდებელი შეიქმნა", tone: "done" },
  "supplier.updated": { label: "მომწოდებელი განახლდა", tone: "assigned" },
  "part.created": { label: "ნაწილი შეიქმნა", tone: "done" },
  "part.updated": { label: "ნაწილი განახლდა", tone: "assigned" },
  "notification.created": { label: "შეტყობინება", tone: "assigned" },
  "notification.read": { label: "შეტყობინება იკითხა", tone: "done" },
  "stock.received": { label: "მარაგი მიღებულია", tone: "done" },
  "stock.issued": { label: "მარაგი გაცემულია", tone: "progress" },
  "stock.transferred": { label: "მარაგი გადატანილია", tone: "assigned" },
  "stock.adjusted": { label: "მარაგი კორექტირებულია", tone: "assigned" },
  "stock.reserved": { label: "მარაგი დაჯავშნილია", tone: "progress" },
  "stock.released": { label: "ჯავშანი გათავისუფლდა", tone: "done" },
  "stock.consumed": { label: "მარაგი მოხმარდა", tone: "done" },
  "technician_stock.received": { label: "ტექნიკოსმა მიიღო", tone: "done" },
  "technician_stock.consumed": { label: "ტექნიკოსმა მოიხმარა", tone: "done" },
  "technician_stock.returned": { label: "ტექნიკოსმა დააბრუნა", tone: "assigned" },
  "purchase_request.created": { label: "მოთხოვნა შეიქმნა", tone: "done" },
  "purchase_request.updated": { label: "მოთხოვნა განახლდა", tone: "assigned" },
  "purchase_request.submitted": { label: "მოთხოვნა გაიგზავნა", tone: "progress" },
  "purchase_request.approved": { label: "მოთხოვნა დამტკიცდა", tone: "done" },
  "purchase_request.rejected": { label: "მოთხოვნა უარყოფილია", tone: "cancelled" },
  "purchase_request.cancelled": { label: "მოთხოვნა გაუქმდა", tone: "cancelled" },
  "purchase_order.created": { label: "ორდერი შეიქმნა", tone: "done" },
  "purchase_order.updated": { label: "ორდერი განახლდა", tone: "assigned" },
  "purchase_order.received": { label: "ორდერი მიღებულია", tone: "done" }
};

// ---------------------------------------------------------------------------
// Role capability model (UX approximation; backend remains authoritative)
// ---------------------------------------------------------------------------
// Built from the verified permission grants in migrations 003/004/009:
//  - admin / super_admin: full surface, audit log included.
//  - manager / department_manager: operations + inventory + procurement, no
//    user creation and no audit log.
//  - technician: own work orders, own schedule, own field stock, parts read,
//    own purchase requests, notifications.
//  - employee: read the shared part catalog + notifications + profile.

const ROLE_CAPABILITIES = {
  admin: {
    dashboard: true,
    workOrders: true,
    dispatch: true,
    board: true,
    parts: true,
    warehouses: true,
    stock: true,
    reservations: true,
    technicianStock: true,
    purchaseRequests: true,
    suppliers: true,
    purchaseOrders: true,
    notifications: true,
    audit: true,
    reports: true,
    employees: true,
    departments: true,
    positions: true,
    profile: true,
    manageOrganization: true,
    createTask: true
  },
  manager: {
    dashboard: true,
    workOrders: true,
    dispatch: true,
    board: true,
    parts: true,
    warehouses: true,
    stock: true,
    reservations: true,
    technicianStock: true,
    purchaseRequests: true,
    suppliers: true,
    purchaseOrders: true,
    notifications: true,
    audit: false,
    reports: true,
    employees: true,
    departments: true,
    positions: true,
    profile: true,
    manageOrganization: false,
    createTask: true
  },
  technician: {
    dashboard: true,
    workOrders: true,
    dispatch: true,
    board: true,
    parts: true,
    warehouses: false,
    stock: false,
    reservations: false,
    technicianStock: true,
    purchaseRequests: true,
    suppliers: true,
    purchaseOrders: false,
    notifications: true,
    audit: false,
    reports: false,
    employees: false,
    departments: false,
    positions: false,
    profile: true,
    manageOrganization: false,
    createTask: false
  },
  employee: {
    dashboard: false,
    workOrders: false,
    dispatch: false,
    board: false,
    parts: true,
    warehouses: false,
    stock: false,
    reservations: false,
    technicianStock: false,
    purchaseRequests: false,
    suppliers: false,
    purchaseOrders: false,
    notifications: true,
    audit: false,
    reports: false,
    employees: false,
    departments: false,
    positions: false,
    profile: true,
    manageOrganization: false,
    createTask: false
  }
};

// Navigation model — grouped by business area so each role lands on a
// meaningful operations surface.
const NAV_ITEMS = [
  { key: "dashboard", label: "ოპერატიული მიმოხილვა", icon: "◫" },
  {
    group: "ოპერაციები",
    items: [
      { key: "workOrders", label: "სამუშაო ბრძანებები" },
      { key: "dispatch", label: "დისპეჩინგი / განრიგი" },
      { key: "board", label: "დავალებების დაფა" }
    ]
  },
  {
    group: "მარაგები",
    items: [
      { key: "parts", label: "ნაწილები" },
      { key: "warehouses", label: "საწყობები" },
      { key: "stock", label: "მარაგების ბალანსი" },
      { key: "reservations", label: "რეზერვაციები" },
      { key: "technicianStock", label: "ტექნიკოსის მარაგი" }
    ]
  },
  {
    group: "შესყიდვები",
    items: [
      { key: "purchaseRequests", label: "შესყიდვის მოთხოვნები" },
      { key: "suppliers", label: "მომწოდებლები" },
      { key: "purchaseOrders", label: "შესყიდვის ორდერები" }
    ]
  },
  {
    group: "ორგანიზაცია",
    items: [
      { key: "employees", label: "თანამშრომლები" },
      { key: "departments", label: "დეპარტამენტები" },
      { key: "positions", label: "პოზიციები" }
    ]
  },
  { key: "reports", label: "ანგარიშები", icon: "▤" },
  {
    group: "სისტემა",
    items: [
      { key: "notifications", label: "შეტყობინებები" },
      { key: "audit", label: "აუდიტის ჟურნალი" },
      { key: "profile", label: "პროფილი" }
    ]
  }
];

const VIEW_TITLES = {
  dashboard: "ოპერატიული მიმოხილვა",
  workOrders: "სამუშაო ბრძანებები",
  dispatch: "დისპეჩინგი / განრიგი",
  board: "დავალებები",
  parts: "ნაწილები",
  warehouses: "საწყობები",
  stock: "მარაგების ბალანსი",
  reservations: "რეზერვაციები",
  technicianStock: "ტექნიკოსის მარაგი",
  purchaseRequests: "შესყიდვის მოთხოვნები",
  suppliers: "მომწოდებლები",
  purchaseOrders: "შესყიდვის ორდერები",
  reports: "ანგარიშები",
  employees: "თანამშრომლები",
  departments: "დეპარტამენტები",
  positions: "პოზიციები",
  notifications: "შეტყობინებები",
  audit: "აუდიტის ჟურნალი",
  profile: "პროფილი"
};

function capability(role, key) {
  const caps = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.employee;
  return Boolean(caps[key]);
}

function defaultViewForRole(role) {
  if (capability(role, "dashboard")) return "dashboard";
  if (capability(role, "workOrders")) return "workOrders";
  if (capability(role, "notifications")) return "notifications";
  return "profile";
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Returns the allowed next statuses for a work-order style state machine.
function allowedTransitions(kind, status) {
  const map =
    kind === "work_order_task"
      ? WORK_ORDER_TASK_TRANSITIONS
      : kind === "appointment"
        ? APPOINTMENT_TRANSITIONS
        : kind === "pr"
          ? PR_TRANSITIONS
          : kind === "po"
            ? PO_TRANSITIONS
            : WORK_ORDER_TRANSITIONS;
  return map[status] || [];
}

// Full display name for a user (prefers personal name, falls back to username).
function displayName(user) {
  if (!user) return "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.username || `#${user.id}`;
}

function roleLabel(role) {
  return ROLE_LABELS[role] || LEGACY_ROLE_LABELS[role] || role || "—";
}