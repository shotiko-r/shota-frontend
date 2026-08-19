// auth.js — centralized authentication state helpers.
// The backend JWT payload stays { id, username, role }. The frontend may decode
// it for UX only; backend authorization remains authoritative.

const TOKEN_KEY = "token";
const USER_KEY = "user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function getUser() {
  const stored = getStoredUser();
  if (stored && stored.id) return stored;
  const decoded = decodeToken(getToken());
  if (decoded && decoded.id) {
    setUser({ id: decoded.id, username: decoded.username, role: decoded.role });
    return decoded;
  }
  return stored;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

// Redirect to the login page when not authenticated. Returns true when the
// current page may continue.
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function redirectAfterLogin(role) {
  if (role === "admin" || role === "manager" || role === "technician" || role === "employee") {
    window.location.href = "admin.html";
    return;
  }
  window.location.href = "admin.html";
}