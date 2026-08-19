// constants.js — centralized labels and shared configuration.
// Avoids duplicating status/priority/role strings across views.

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
  errorState: "მონაცემების ჩატვირთვა ვერ მოხერხდა."
};

// Legacy-role based UI approximation. The backend remains authoritative.
// admin/manager => full management surface; technician => own tasks only;
// employee => no task/dashboard access on the backend.
const ROLE_CAPABILITIES = {
  admin: {
    overview: true,
    board: true,
    departments: true,
    positions: true,
    employees: true,
    reports: true,
    manageOrganization: true,
    createTask: true
  },
  manager: {
    overview: true,
    board: true,
    departments: true,
    positions: true,
    employees: true,
    reports: true,
    manageOrganization: false,
    createTask: true
  },
  technician: {
    overview: false,
    board: true,
    departments: false,
    positions: false,
    employees: false,
    reports: false,
    manageOrganization: false,
    createTask: false
  },
  employee: {
    overview: false,
    board: false,
    departments: false,
    positions: false,
    employees: false,
    reports: false,
    manageOrganization: false,
    createTask: false
  }
};

// Navigation model for the workspace sidebar.
// Each entry may be a leaf ({ key }) or a group ({ group, items }).
const NAV_ITEMS = [
  { key: "overview", label: "მიმოხილვა", icon: "◫" },
  { key: "board", label: "დავალებები", icon: "▦" },
  {
    group: "ორგანიზაცია",
    items: [
      { key: "departments", label: "დეპარტამენტები" },
      { key: "positions", label: "პოზიციები" },
      { key: "employees", label: "თანამშრომლები" }
    ]
  },
  { key: "reports", label: "ანგარიშები", icon: "▤" },
  {
    group: "სისტემა",
    items: [{ key: "profile", label: "პროფილი" }]
  }
];

const VIEW_TITLES = {
  overview: "მიმოხილვა",
  board: "დავალებები",
  departments: "დეპარტამენტები",
  positions: "პოზიციები",
  employees: "თანამშრომლები",
  reports: "ანგარიშები",
  profile: "პროფილი"
};

function capability(role, key) {
  const caps = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.employee;
  return Boolean(caps[key]);
}

function defaultViewForRole(role) {
  if (capability(role, "overview")) return "overview";
  if (capability(role, "board")) return "board";
  return "profile";
}