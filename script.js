// Load tasks
async function loadTasks() {
  const res = await fetch('/api/tasks');
  const tasks = await res.json();

  const container = document.querySelector('.tasks');
  container.innerHTML = '<h2>Tasks</h2>';

  tasks.forEach(task => {
    const div = document.createElement('div');
    div.className = 'task-card';

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description}</p>
      <span class="status ${task.status}">${task.status}</span>
    `;

    container.appendChild(div);
  });
}

// Create task
async function createTask() {
  const title = document.querySelector('.create-task input').value;
  const description = document.querySelector('.create-task textarea').value;
  const technician = document.querySelector('.create-task select').value;

  if (!title) {
    alert('შეიყვანე სათაური');
    return;
  }

  await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      description,
      technician
    })
  });

  loadTasks();
}

// Button event
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();

  document.querySelector('.create-task button')
    .addEventListener('click', createTask);
});