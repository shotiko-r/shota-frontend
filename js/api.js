// api.js — the single centralized API client.
// Every request flows through apiRequest(). Handles JSON and multipart bodies,
// Bearer authentication, timeouts and localized error mapping.
//
// Never logs tokens or passwords. Raw technical errors are never shown to the
// user — a localized message is displayed instead.

const API_BASE = "/api";
const DEFAULT_TIMEOUT_MS = 25000;

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function buildHeaders(method, body, extraHeaders = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && body !== null && !isFormDataBody(body)) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, extraHeaders);
  return headers;
}

function serializeBody(body) {
  if (body === undefined || body === null) return undefined;
  if (isFormDataBody(body)) return body; // browser sets the multipart boundary
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

function errorMessageFor(status, body) {
  switch (status) {
    case 400:
      return (body && body.message) || "მოთხოვნა არასწორია.";
    case 401:
      return STRINGS.sessionExpired;
    case 403:
      return STRINGS.forbidden;
    case 404:
      return STRINGS.notFound;
    case 409:
      return (body && body.message) || "მოთხოვნა ვერ შესრულდა.";
    case 429:
      return STRINGS.rateLimited;
    default:
      if (status >= 500) return STRINGS.serverError;
      return (body && body.message) || "მოთხოვნა ვერ შესრულდა.";
  }
}

function isLoginPage() {
  const path = window.location.pathname.split("/").pop() || "";
  return path === "" || path === "index.html";
}

function handleUnauthorized() {
  clearSession();
  if (!isLoginPage()) {
    window.location.href = "index.html?session=expired";
  }
}

// Core request. Throws an Error with a localized message on failure.
// Returns the parsed JSON body (or undefined for empty responses).
async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    timeout = DEFAULT_TIMEOUT_MS,
    raw = false
  } = options;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: buildHeaders(method, body, headers),
      body: serializeBody(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("მოთხოვნა დროულად ვერ დასრულდა. გთხოვთ, სცადოთ თავიდან.");
    }
    throw new Error(STRINGS.serviceUnavailable);
  } finally {
    window.clearTimeout(timer);
  }

  if (response.status === 401) {
    handleUnauthorized();
    const body = await response.json().catch(() => null);
    throw new Error(errorMessageFor(401, body));
  }

  if (raw) return response;

  const contentType = response.headers.get("content-type") || "";
  const responseBody = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessageFor(response.status, responseBody));
  }
  return responseBody;
}

// Convenience helpers.
function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body });
}

function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PATCH", body });
}

function apiPut(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PUT", body });
}

function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}

// Download helper (e.g. XLSX export). Returns a Blob for the caller.
async function apiDownload(path) {
  const response = await apiRequest(path, { raw: true });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error(STRINGS.sessionExpired);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(errorMessageFor(response.status, body));
  }
  return response.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}