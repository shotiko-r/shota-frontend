// theme.js — centralized light/dark theme behaviour.
// Persists across pages via localStorage; falls back to system preference.

const THEME_KEY = "theme";

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    const sun = toggle.querySelector("span:first-child");
    const moon = toggle.querySelector("span:last-child");
    if (sun) sun.style.display = theme === "dark" ? "none" : "inline";
    if (moon) moon.style.display = theme === "dark" ? "inline" : "none";
    toggle.dataset.theme = theme;
  }
}

function toggleTheme() {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function initTheme() {
  applyTheme(getInitialTheme());
  const toggle = document.getElementById("themeToggle");
  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
    toggle.addEventListener("click", toggleTheme);
  }
}

// Apply as early as possible to avoid a light/dark flash on navigation.
applyTheme(getInitialTheme());

// Bind the toggle once the DOM is ready (works on every page).
document.addEventListener("DOMContentLoaded", initTheme);