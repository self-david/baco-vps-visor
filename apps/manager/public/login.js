const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const projectDetailView = document.querySelector("#project-detail-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const logoutButton = document.querySelector("#logout");

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Error HTTP ${response.status}`);
  return result;
}

function setAuthenticated(authenticated) {
  const isProjectRoute = /^\/projects\/[0-9a-f-]{36}$/i.test(window.location.pathname);
  loginView.classList.toggle("hidden", authenticated);
  dashboardView.classList.toggle("hidden", !authenticated || isProjectRoute);
  projectDetailView.classList.toggle("hidden", !authenticated || !isProjectRoute);
  projectDetailView.hidden = !authenticated || !isProjectRoute;
  logoutButton.classList.toggle("hidden", !authenticated);
  window.managerAuthenticated = authenticated;
  window.dispatchEvent(new CustomEvent("vps-manager:auth", {
    detail: { authenticated },
  }));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: new FormData(loginForm).get("password") }),
    });
    loginForm.reset();
    setAuthenticated(true);
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  loginError.textContent = "";
  try {
    await request("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    logoutButton.disabled = false;
  }
});

async function initializeSession() {
  try {
    const session = await request("/api/auth/session");
    setAuthenticated(session.authenticated);
  } catch (error) {
    loginError.textContent = `No se pudo verificar la sesión: ${error.message}`;
  }
}

void initializeSession();
