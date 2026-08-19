// login.js — login page wiring.
// A 401 on /login is normalized by api.js to STRINGS.sessionExpired; here it is
// surfaced as "invalid credentials" (api.js never exposes raw backend errors).

async function submitLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const button = event.currentTarget.querySelector("button[type='submit']");

  if (!usernameInput.value.trim() || !passwordInput.value) {
    showToast("შეიყვანეთ მომხმარებლის სახელი და პაროლი.", true);
    return;
  }

  button.disabled = true;
  button.textContent = "შესვლა…";

  try {
    const data = await apiRequest("/login", {
      method: "POST",
      body: { username: usernameInput.value.trim(), password: passwordInput.value }
    });
    setToken(data.token);
    const decoded = decodeToken(data.token);
    if (decoded && decoded.username && decoded.role) {
      setUser({ id: decoded.id, username: decoded.username, role: decoded.role });
    } else {
      setUser({ role: data.role });
    }
    redirectAfterLogin(data.role);
  } catch (error) {
    const message =
      error.message === STRINGS.sessionExpired || error.message === "Invalid credentials"
        ? "მომხმარებლის სახელი ან პაროლი არასწორია."
        : error.message;
    showToast(message, true);
  } finally {
    button.disabled = false;
    button.textContent = "შესვლა";
  }
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (form) form.addEventListener("submit", submitLogin);

  const params = new URLSearchParams(window.location.search);
  if (params.get("session") === "expired") {
    showToast(STRINGS.sessionExpired, true);
  }

  const storedToken = getToken();
  if (storedToken && decodeToken(storedToken)) {
    const user = getUser();
    if (user && user.role) {
      const notice = document.getElementById("loggedInNotice");
      if (notice) {
        notice.textContent = `თქვენ უკვე შესული ხართ, როგორც ${LEGACY_ROLE_LABELS[user.role] || user.role}.`;
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", initLoginPage);