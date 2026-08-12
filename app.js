const API = "/api";

// TOKEN
function getToken() {
  return localStorage.getItem("token");
}

// LOGIN
function login() {
  fetch(API + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    })
  })
    .then(async (res) => {
      const data = await res.json();
      console.log("LOGIN RESPONSE:", data);

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({ role: data.role }));

      if (data.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    })
    .catch(err => {
      console.error(err);
      alert("სერვერთან კავშირი ვერ მოხერხდა");
    });
}

// LOAD TASKS
function loadTasks() {
  fetch(API + "/tasks", {
    headers: {
      Authorization: "Bearer " + getToken()
    }
  })
    .then(r => r.json())
    .then(tasks => {
      const tasksDiv = document.getElementById("tasks");
      if (!tasksDiv) return;

      tasksDiv.innerHTML = "";

      tasks.forEach(t => {
        tasksDiv.innerHTML += `
          <div class="card">
            <b>${t.title}</b><br>
            📌 სტატუსი: ${t.status}<br>
            <hr>
          </div>
        `;
      });
    });
}

// LOAD USERS
function loadUsers() {
  fetch(API + "/users", {
    headers: {
      Authorization: "Bearer " + getToken()
    }
  })
    .then(r => r.json())
    .then(users => {
      const select = document.getElementById("technician");
      if (!select) return;

      select.innerHTML = "";

      users
        .filter(u => u.role === "technician")
        .forEach(u => {
          select.innerHTML += `<option value="${u.id}">${u.username}</option>`;
        });
    });
}

// CREATE TASK
function createTask() {
  fetch(API + "/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken()
    },
    body: JSON.stringify({
      title: document.getElementById("title").value,
      description: document.getElementById("address").value,
      technician_id: document.getElementById("technician").value
    })
  })
    .then(() => loadTasks());
}

// LOGOUT
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location = "index.html";
}

// DASHBOARD CHECK
if (window.location.pathname.includes("dashboard.html")) {
  if (!getToken()) {
    window.location = "index.html";
  } else {
    loadTasks();
  }
}

// ADMIN CHECK
if (window.location.pathname.includes("admin.html")) {
  if (!getToken()) {
    window.location = "index.html";
  } else {
    loadUsers();
    loadTasks();
  }
}
