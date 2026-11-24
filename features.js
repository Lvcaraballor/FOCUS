const WORKSPACE_KEY = "focus.workspace.v1";
const WORKSPACE_VIEWS = {
  dashboard: "Inicio",
  calendar: "Calendario",
  kanban: "Tablero Kanban",
  blocks: "Bloques de tiempo",
  goals: "Objetivos y proyectos",
  notes: "Notas y apuntes",
  habits: "Seguimiento de hábitos",
  expenses: "Control de gastos",
  stats: "Estadísticas",
  assistant: "Asistente inteligente"
};
const DEFAULT_WORKSPACE = {
  habits: [],
  habitEntries: {},
  notes: [],
  blocks: [],
  expenses: [],
  goals: [],
  projects: [],
  assistantMessages: [],
  reminderEnabled: false,
  reminderMinutes: 15,
  notified: []
};

function loadWorkspace() {
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY);
    if (!saved) return structuredClone(DEFAULT_WORKSPACE);
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("El formato de los datos de organización no es válido.");
    }
    const workspace = {
      ...structuredClone(DEFAULT_WORKSPACE),
      ...parsed,
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      habitEntries: parsed.habitEntries && typeof parsed.habitEntries === "object" ? parsed.habitEntries : {},
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      assistantMessages: Array.isArray(parsed.assistantMessages) ? parsed.assistantMessages.slice(-12) : [],
      notified: Array.isArray(parsed.notified) ? parsed.notified.slice(-100) : []
    };
    const categories = ["Universidad", "Trabajo", "Vida personal"];
    const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 100;
    const validTitle = (value, limit = 100) => typeof value === "string" && value.length <= limit;
    const validDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T12:00:00`);
      return !Number.isNaN(date.getTime()) && workspaceDateKey(date) === value;
    };
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    workspace.habits = workspace.habits.filter((habit) =>
      habit && validId(habit.id) && validTitle(habit.title, 60) && [3, 5, 7].includes(Number(habit.target))
    ).map((habit) => ({ id: habit.id, title: habit.title, target: Number(habit.target) }));
    workspace.habitEntries = Object.fromEntries(Object.entries(workspace.habitEntries)
      .filter(([id, dates]) => validId(id) && Array.isArray(dates))
      .map(([id, dates]) => [id, dates.filter(validDate).slice(-366)]));
    workspace.notes = workspace.notes.filter((note) =>
      note && validId(note.id) && validTitle(note.title) && typeof note.body === "string" &&
      note.body.length <= 10_000 && categories.includes(note.category)
    ).map((note) => ({
      id: note.id,
      title: note.title,
      category: note.category,
      body: note.body,
      updatedAt: typeof note.updatedAt === "string" && !Number.isNaN(Date.parse(note.updatedAt))
        ? note.updatedAt
        : new Date(0).toISOString()
    }));
    workspace.blocks = workspace.blocks.filter((block) =>
      block && validId(block.id) && validTitle(block.title, 80) && validDate(block.date) &&
      validTime(block.start) && validTime(block.end) && block.start < block.end &&
      categories.includes(block.category) && typeof block.taskId === "string"
    ).map((block) => ({
      id: block.id,
      title: block.title,
      date: block.date,
      start: block.start,
      end: block.end,
      taskId: block.taskId,
      category: block.category
    }));
    workspace.expenses = workspace.expenses.filter((item) =>
      item && validId(item.id) && validTitle(item.title, 80) && validDate(item.date) &&
      Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 && Number(item.amount) <= 1_000_000 &&
      ["expense", "income"].includes(item.type) && categories.includes(item.category)
    ).map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      amount: Math.round(Number(item.amount) * 100) / 100,
      type: item.type,
      category: item.category
    }));
    workspace.goals = workspace.goals.filter((goal) =>
      goal && validId(goal.id) && validTitle(goal.title) && validDate(goal.date) &&
      Number.isInteger(Number(goal.progress)) && Number(goal.progress) >= 0 && Number(goal.progress) <= 100
    ).map((goal) => ({
      id: goal.id,
      title: goal.title,
      date: goal.date,
      progress: Number(goal.progress)
    }));
    workspace.projects = workspace.projects.filter((project) =>
      project && validId(project.id) && validTitle(project.title, 80) &&
      (!project.date || validDate(project.date))
    ).map((project) => ({ id: project.id, title: project.title, date: project.date || "" }));
    workspace.assistantMessages = workspace.assistantMessages.filter((message) =>
      message && ["user", "assistant"].includes(message.role) &&
      typeof message.text === "string" && message.text.length <= 1600
    ).slice(-12);
    workspace.reminderEnabled = parsed.reminderEnabled === true;
    workspace.reminderMinutes = [5, 15, 30].includes(Number(parsed.reminderMinutes))
      ? Number(parsed.reminderMinutes)
      : 15;
    workspace.notified = workspace.notified.filter((key) => typeof key === "string" && key.length <= 200).slice(-100);
    return workspace;
  } catch (error) {
    console.error("No se pudieron cargar los datos de organización.", error);
    window.focusApp.showToast("No pudimos leer tus datos guardados de organización.");
    return structuredClone(DEFAULT_WORKSPACE);
  }
}

const workspace = loadWorkspace();
const workspaceView = document.querySelector("#workspace-view");
const dashboardContent = document.querySelector(".page-content");
let activeView = "dashboard";
let calendarMode = "week";
let calendarDate = new Date();
let activeNoteId = null;
let currentAssistantError = "";

function saveWorkspace() {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los datos de organización.", error);
    window.focusApp.showToast("No pudimos guardar este cambio en el navegador.");
    return false;
  }
}

function escapeWorkspace(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function workspaceId() {
  return window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function workspaceDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function workspaceToday() {
  return workspaceDateKey(new Date());
}

function workspaceDate(value) {
  return new Date(`${value}T12:00:00`);
}

function validWorkspaceDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = workspaceDate(value);
  return !Number.isNaN(date.getTime()) && workspaceDateKey(date) === value;
}

function workspaceDuration(value) {
  const duration = Number(value) || 0;
  return duration >= 60
    ? `${Math.floor(duration / 60)} h${duration % 60 ? ` ${duration % 60} min` : ""}`
    : `${duration} min`;
}

function renderWorkspaceHeader(title, description, action = "") {
  return `<header class="workspace-heading"><div><p class="eyebrow">TU ESPACIO, A TU RITMO</p><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
}

function openWorkspace(view, options = {}) {
  if (!WORKSPACE_VIEWS[view]) return;
  activeView = view;
  document.querySelector(".sidebar").classList.remove("mobile-open");
  document.querySelector("#menu-button").setAttribute("aria-expanded", "false");
  document.querySelector("#menu-button").setAttribute("aria-label", "Abrir menú");
  dashboardContent.hidden = view !== "dashboard";
  workspaceView.hidden = view === "dashboard";
  document.querySelectorAll("[data-workspace]").forEach((link) => {
    const isActive = link.dataset.workspace === view;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector(".breadcrumbs strong").textContent = WORKSPACE_VIEWS[view];
  if (view === "dashboard") return;
  renderWorkspace();
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".main-content").scrollTop = 0;
  }
  if (options.emergency) {
    const question = workspaceView.querySelector("#assistant-question");
    question.value = "Tengo varias tareas pendientes y poco tiempo. ¿Cómo debería priorizarlas?";
    question.focus();
  }
}

function categoryOptions(selected = "") {
  return ["Universidad", "Trabajo", "Vida personal"].map((category) =>
    `<option value="${category}"${category === selected ? " selected" : ""}>${category}</option>`
  ).join("");
}

function statusOf(task) {
  return task.done || task.status === "done" ? "done" : task.status === "in_progress" ? "in_progress" : "pending";
}

function tasksForDay(date) {
  return window.focusApp.getTasks()
    .filter((task) => (task.plannedDate || task.date) === date)
    .sort((first, second) => (first.time || "").localeCompare(second.time || ""));
}

function blocksForDay(date) {
  return workspace.blocks.filter((block) => block.date === date).sort((first, second) => first.start.localeCompare(second.start));
}

function renderCalendar() {
  const heading = renderWorkspaceHeader(
    "Tu calendario",
    "Consulta tus tareas y bloques de tiempo en la semana o el mes.",
    `<div class="workspace-actions"><button class="button button-quiet" data-action="calendar-prev" type="button" aria-label="Periodo anterior">←</button><button class="button button-quiet" data-action="calendar-today" type="button">Hoy</button><button class="button button-quiet" data-action="calendar-next" type="button" aria-label="Periodo siguiente">→</button></div>`
  );
  const weekStart = new Date(calendarDate);
  weekStart.setDate(calendarDate.getDate() - ((calendarDate.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthLabel = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(calendarDate);
  const rangeLabel = calendarMode === "month"
    ? monthLabel
    : `${new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(weekStart)} – ${new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(weekEnd)}`;
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let grid;
  if (calendarMode === "week") {
    grid = `<div class="calendar-week-grid">${dayNames.map((dayName, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = workspaceDateKey(date);
      const tasks = tasksForDay(key);
      const blocks = blocksForDay(key);
      return `<article class="calendar-day${key === workspaceToday() ? " is-today" : ""}"><div class="calendar-day-heading"><span>${dayName}</span><strong>${date.getDate()}</strong></div><div class="calendar-events">${tasks.map((task) => `<div class="calendar-event task-event"><time>${escapeWorkspace(task.time || "—")}</time>${escapeWorkspace(task.title)}</div>`).join("")}${blocks.map((block) => `<div class="calendar-event block-event"><time>${escapeWorkspace(block.start)}</time>${escapeWorkspace(block.title)}</div>`).join("")}${!tasks.length && !blocks.length ? '<span class="calendar-empty">Sin actividades</span>' : ""}</div></article>`;
    }).join("")}</div>`;
  } else {
    const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
    grid = `<div class="calendar-month-grid">${dayNames.map((dayName) => `<div class="calendar-month-label">${dayName}</div>`).join("")}${Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = workspaceDateKey(date);
      const tasks = tasksForDay(key);
      const blocks = blocksForDay(key);
      return `<article class="calendar-month-day${date.getMonth() === calendarDate.getMonth() ? "" : " outside-month"}${key === workspaceToday() ? " is-today" : ""}"><strong>${date.getDate()}</strong><div class="calendar-month-events">${tasks.slice(0, 2).map((task) => `<span title="${escapeWorkspace(task.title)}">${escapeWorkspace(task.title)}</span>`).join("")}${blocks.slice(0, 1).map((block) => `<span title="${escapeWorkspace(block.title)}">${escapeWorkspace(block.title)}</span>`).join("")}${tasks.length + blocks.length > 3 ? `<small>+${tasks.length + blocks.length - 3} más</small>` : ""}</div></article>`;
    }).join("")}</div>`;
  }
  workspaceView.innerHTML = `${heading}<section class="panel workspace-panel"><div class="calendar-toolbar"><strong>${escapeWorkspace(rangeLabel)}</strong><div class="segmented-control"><button type="button" data-action="calendar-mode" data-mode="week" class="${calendarMode === "week" ? "selected" : ""}">Semana</button><button type="button" data-action="calendar-mode" data-mode="month" class="${calendarMode === "month" ? "selected" : ""}">Mes</button></div></div>${grid}</section>`;
}

function renderKanban() {
  const tasks = window.focusApp.getTasks();
  const columns = [
    { status: "pending", title: "Pendientes" },
    { status: "in_progress", title: "En proceso" },
    { status: "done", title: "Completadas" }
  ];
  const board = columns.map((column) => {
    const cards = tasks.filter((task) => statusOf(task) === column.status);
    return `<section class="kanban-column" data-status="${column.status}" aria-label="${column.title}"><header><h2>${column.title}</h2><span>${cards.length}</span></header><div class="kanban-cards">${cards.map((task) => `<article class="kanban-card" draggable="true" data-task-id="${escapeWorkspace(task.id)}"><div class="kanban-card-meta"><span class="task-priority ${task.priority === "Alta" ? "alta" : task.priority === "Baja" ? "baja" : ""}">${escapeWorkspace(task.priority)}</span><button class="task-action" type="button" data-action="edit-task" data-task-id="${escapeWorkspace(task.id)}" aria-label="Editar ${escapeWorkspace(task.title)}">✎</button></div><h3>${escapeWorkspace(task.title)}</h3><p>${escapeWorkspace(task.category)}${task.project ? ` · ${escapeWorkspace(task.project)}` : ""}</p><div class="kanban-card-footer"><span>${escapeWorkspace(task.time || "Sin horario")} · ${workspaceDuration(task.duration)}</span><select data-action="move-task" data-task-id="${escapeWorkspace(task.id)}" aria-label="Cambiar estado de ${escapeWorkspace(task.title)}"><option value="pending"${column.status === "pending" ? " selected" : ""}>Pendiente</option><option value="in_progress"${column.status === "in_progress" ? " selected" : ""}>En proceso</option><option value="done"${column.status === "done" ? " selected" : ""}>Completada</option></select></div></article>`).join("") || '<div class="workspace-empty compact">Arrastra aquí una tarea o cámbiala desde su menú.</div>'}</div><button class="text-button kanban-add" type="button" data-action="add-task">＋ Añadir tarea</button></section>`;
  }).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Tablero Kanban", "Mueve tus tareas entre pendientes, en proceso y completadas.", '<button class="button button-primary" type="button" data-action="add-task">＋ Nueva tarea</button>')}<div class="kanban-board">${board}</div>`;
}

function habitStreak(habit) {
  const dates = new Set(workspace.habitEntries[habit.id] || []);
  let streak = 0;
  const day = new Date();
  if (!dates.has(workspaceToday())) day.setDate(day.getDate() - 1);
  while (dates.has(workspaceDateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function renderHabits() {
  const today = workspaceToday();
  const completed = workspace.habits.filter((habit) => (workspace.habitEntries[habit.id] || []).includes(today)).length;
  const habitCards = workspace.habits.map((habit) => {
    const checked = (workspace.habitEntries[habit.id] || []).includes(today);
    return `<article class="habit-card"><button type="button" class="habit-check${checked ? " checked" : ""}" data-action="habit-check" data-habit-id="${escapeWorkspace(habit.id)}" aria-pressed="${checked}" aria-label="${checked ? "Desmarcar" : "Completar"} ${escapeWorkspace(habit.title)}">${checked ? "✓" : ""}</button><div class="habit-copy"><h2>${escapeWorkspace(habit.title)}</h2><p>${habitStreak(habit)} días de racha · objetivo ${habit.target} días/semana</p></div><div class="habit-week">${Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + index);
      const key = workspaceDateKey(date);
      const dayChecked = (workspace.habitEntries[habit.id] || []).includes(key);
      return `<span class="${dayChecked ? "done" : ""}" title="${new Intl.DateTimeFormat("es", { weekday: "long" }).format(date)}">${["L", "M", "X", "J", "V", "S", "D"][index]}</span>`;
    }).join("")}</div><button class="task-action" type="button" data-action="delete-habit" data-habit-id="${escapeWorkspace(habit.id)}" aria-label="Eliminar hábito">×</button></article>`;
  }).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Hábitos que suman", "Construye rutinas pequeñas y celebra cada día que las cumples.", `<div class="metric-chip">${completed} / ${workspace.habits.length} completados hoy</div>`)}<div class="workspace-two-column"><section class="panel workspace-panel"><h2 class="panel-title">Mis hábitos</h2>${habitCards || '<div class="workspace-empty">Empieza con un hábito sencillo, como leer o tomar agua.</div>'}</section><form class="panel workspace-panel workspace-form" data-form="habit"><h2 class="panel-title">Añadir un hábito</h2><label class="field-label">¿Qué hábito quieres seguir?<input class="form-input" name="title" maxlength="60" placeholder="Ej. Leer 10 minutos" required></label><label class="field-label">Meta semanal<select class="form-input" name="target"><option value="3">3 días por semana</option><option value="5" selected>5 días por semana</option><option value="7">Cada día</option></select></label><button class="button button-primary" type="submit">Guardar hábito →</button></form></div>`;
}

function renderNotes() {
  const selectedNote = workspace.notes.find((note) => note.id === activeNoteId) || workspace.notes[0];
  if (selectedNote) activeNoteId = selectedNote.id;
  const noteList = workspace.notes.map((note) => `<button type="button" class="note-list-item${selectedNote && note.id === selectedNote.id ? " selected" : ""}" data-action="open-note" data-note-id="${escapeWorkspace(note.id)}"><strong>${escapeWorkspace(note.title || "Apunte sin título")}</strong><span>${escapeWorkspace(note.category || "Vida personal")}</span><small>${escapeWorkspace(new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(note.updatedAt || Date.now())))}</small></button>`).join("");
  const editor = selectedNote
    ? `<form data-form="note" class="note-editor"><input type="hidden" name="id" value="${escapeWorkspace(selectedNote.id)}"><label class="field-label">Título<input class="form-input" name="title" maxlength="100" value="${escapeWorkspace(selectedNote.title)}" placeholder="Título de tu apunte" required></label><label class="field-label">Categoría<select class="form-input" name="category">${categoryOptions(selectedNote.category)}</select></label><label class="field-label">Apuntes<textarea class="form-input form-textarea note-textarea" name="body" maxlength="10000" placeholder="Escribe aquí tus ideas, apuntes o recordatorios...">${escapeWorkspace(selectedNote.body)}</textarea></label><div class="workspace-actions"><button class="button button-primary" type="submit">Guardar apunte</button><button class="button button-quiet" type="button" data-action="delete-note" data-note-id="${escapeWorkspace(selectedNote.id)}">Eliminar</button></div></form>`
    : '<div class="workspace-empty">Crea una nota para guardar tus apuntes e ideas.</div>';
  workspaceView.innerHTML = `${renderWorkspaceHeader("Notas y apuntes", "Guarda ideas y apuntes en este navegador; no se sincronizan con otros dispositivos.", '<button class="button button-primary" type="button" data-action="new-note">＋ Nueva nota</button>')}<section class="panel notes-workspace"><aside class="note-list">${noteList || '<p class="workspace-empty compact">Todavía no tienes apuntes.</p>'}</aside>${editor}</section>`;
}

function renderBlocks() {
  const blocks = workspace.blocks.slice().sort((first, second) => first.date.localeCompare(second.date) || first.start.localeCompare(second.start));
  const list = blocks.map((block) => `<article class="block-item"><div class="block-time"><strong>${escapeWorkspace(block.start)}</strong><span>${escapeWorkspace(block.end)}</span></div><div class="block-color"></div><div class="block-copy"><h2>${escapeWorkspace(block.title)}</h2><p>${escapeWorkspace(new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" }).format(workspaceDate(block.date)))} · ${escapeWorkspace(block.category)}</p></div><button class="task-action" type="button" data-action="delete-block" data-block-id="${escapeWorkspace(block.id)}" aria-label="Eliminar bloque">×</button></article>`).join("");
  const taskOptions = window.focusApp.getTasks().filter((task) => !task.done).map((task) => `<option value="${escapeWorkspace(task.id)}">${escapeWorkspace(task.title)}</option>`).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Bloques de tiempo", "Reserva espacio para estudiar, trabajar y descansar. Los solapamientos se bloquean.", '<button class="button button-quiet" type="button" data-action="go-calendar">Ver calendario →</button>')}<div class="workspace-two-column"><section class="panel workspace-panel"><h2 class="panel-title">Tus bloques</h2>${list || '<div class="workspace-empty">Reserva un bloque para proteger tu tiempo.</div>'}</section><form class="panel workspace-panel workspace-form" data-form="block"><h2 class="panel-title">Crear un bloque</h2><label class="field-label">Actividad<input class="form-input" name="title" maxlength="80" placeholder="Ej. Estudio de química" required></label><label class="field-label">Tarea relacionada (opcional)<select class="form-input" name="taskId"><option value="">Bloque personal</option>${taskOptions}</select></label><div class="form-row"><label class="field-label">Fecha<input class="form-input" name="date" type="date" value="${workspaceToday()}" required></label><label class="field-label">Categoría<select class="form-input" name="category">${categoryOptions("Universidad")}</select></label></div><div class="form-row"><label class="field-label">Inicio<input class="form-input" name="start" type="time" value="09:00" required></label><label class="field-label">Fin<input class="form-input" name="end" type="time" value="10:00" required></label></div><button class="button button-primary" type="submit">Reservar bloque →</button></form></div>`;
}

function renderExpenses() {
  const currentMonth = workspaceToday().slice(0, 7);
  const entries = workspace.expenses.filter((item) => item.date.startsWith(currentMonth)).sort((first, second) => second.date.localeCompare(first.date));
  const total = (type) => entries.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount, 0);
  const money = (amount) => new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(amount);
  const entryList = entries.map((item) => `<article class="expense-item"><span class="expense-symbol${item.type === "income" ? " income" : ""}">${item.type === "income" ? "↗" : "↘"}</span><div class="expense-copy"><strong>${escapeWorkspace(item.title)}</strong><span>${escapeWorkspace(item.category)} · ${escapeWorkspace(new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(workspaceDate(item.date)))}</span></div><strong class="${item.type === "income" ? "income-text" : ""}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</strong><button class="task-action" type="button" data-action="delete-expense" data-expense-id="${escapeWorkspace(item.id)}" aria-label="Eliminar registro">×</button></article>`).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Control de gastos", "Registra tus gastos e ingresos y consulta este mes, sin compartir tus datos.", "")}<div class="expense-totals"><article class="panel"><span>Gastos del mes</span><strong>${money(total("expense"))}</strong></article><article class="panel"><span>Ingresos del mes</span><strong>${money(total("income"))}</strong></article><article class="panel"><span>Balance</span><strong>${money(total("income") - total("expense"))}</strong></article></div><div class="workspace-two-column"><section class="panel workspace-panel"><h2 class="panel-title">Movimientos de ${escapeWorkspace(new Intl.DateTimeFormat("es", { month: "long" }).format(new Date()))}</h2>${entryList || '<div class="workspace-empty">Aún no hay movimientos este mes.</div>'}</section><form class="panel workspace-panel workspace-form" data-form="expense"><h2 class="panel-title">Nuevo movimiento</h2><label class="field-label">Concepto<input class="form-input" name="title" maxlength="80" placeholder="Ej. Materiales de estudio" required></label><div class="form-row"><label class="field-label">Tipo<select class="form-input" name="type"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label class="field-label">Importe<input class="form-input" name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" required></label></div><div class="form-row"><label class="field-label">Categoría<select class="form-input" name="category">${categoryOptions("Vida personal")}</select></label><label class="field-label">Fecha<input class="form-input" name="date" type="date" value="${workspaceToday()}" required></label></div><button class="button button-primary" type="submit">Guardar movimiento →</button><small class="form-help">Importes mostrados en dólares estadounidenses (USD).</small></form></div>`;
}

function renderGoals() {
  const goals = workspace.goals.map((goal) => `<article class="goal-card"><div class="goal-card-heading"><div><span class="section-kicker">OBJETIVO</span><h2>${escapeWorkspace(goal.title)}</h2></div><button class="task-action" type="button" data-action="delete-goal" data-goal-id="${escapeWorkspace(goal.id)}" aria-label="Eliminar objetivo">×</button></div><p>Fecha objetivo: ${escapeWorkspace(new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" }).format(workspaceDate(goal.date)))}</p><div class="goal-progress"><span style="width:${goal.progress}%"></span></div><form data-form="goal-progress" class="goal-progress-form"><input type="hidden" name="id" value="${escapeWorkspace(goal.id)}"><label>Progreso<input type="number" name="progress" min="0" max="100" value="${goal.progress}" aria-label="Progreso de ${escapeWorkspace(goal.title)}"></label><button class="text-button" type="submit">Actualizar</button></form></article>`).join("");
  const projects = workspace.projects.map((project) => `<article class="project-item"><div class="project-mark">P</div><div><h3>${escapeWorkspace(project.title)}</h3><p>${project.date ? `Fecha objetivo: ${escapeWorkspace(new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(workspaceDate(project.date)))}` : "Sin fecha objetivo"}</p></div><span class="project-task-count">${window.focusApp.getTasks().filter((task) => task.project === project.title).length} tareas</span><button class="task-action" type="button" data-action="delete-project" data-project-id="${escapeWorkspace(project.id)}" aria-label="Eliminar proyecto">×</button></article>`).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Objetivos y proyectos", "Convierte tus metas en pasos visibles y mantén cada proyecto en marcha.", "")}<div class="workspace-two-column goals-layout"><div><section class="panel workspace-panel"><div class="box-heading"><h2 class="panel-title">Mis objetivos</h2></div><div class="goal-list">${goals || '<div class="workspace-empty compact">Añade una meta concreta para empezar.</div>'}</div></section><form class="panel workspace-panel workspace-form inline-form" data-form="goal"><h2 class="panel-title">Nuevo objetivo</h2><label class="field-label">¿Qué quieres lograr?<input class="form-input" name="title" maxlength="100" placeholder="Ej. Terminar el semestre al día" required></label><div class="form-row"><label class="field-label">Fecha objetivo<input class="form-input" name="date" type="date" value="${workspaceToday()}" required></label><label class="field-label">Progreso inicial<input class="form-input" name="progress" type="number" min="0" max="100" value="0" required></label></div><button class="button button-primary" type="submit">Añadir objetivo</button></form></div><div><section class="panel workspace-panel"><h2 class="panel-title">Proyectos</h2>${projects || '<div class="workspace-empty compact">Agrupa tareas relacionadas en un proyecto.</div>'}</section><form class="panel workspace-panel workspace-form" data-form="project"><h2 class="panel-title">Nuevo proyecto</h2><label class="field-label">Nombre del proyecto<input class="form-input" name="title" maxlength="80" placeholder="Ej. Trabajo final de historia" required></label><label class="field-label">Fecha objetivo (opcional)<input class="form-input" name="date" type="date"></label><button class="button button-primary" type="submit">Crear proyecto →</button><small class="form-help">Después podrás asignarle tareas al editar cada tarea.</small></form></div></div>`;
}

function renderStats() {
  const tasks = window.focusApp.getTasks();
  const completed = tasks.filter((task) => statusOf(task) === "done");
  const completionRate = tasks.length ? Math.round(completed.length / tasks.length * 100) : 0;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = workspaceDateKey(date);
    const doneCount = completed.filter((task) => (task.plannedDate || task.date) === key).length;
    const habitCount = workspace.habits.filter((habit) => (workspace.habitEntries[habit.id] || []).includes(key)).length;
    const activity = doneCount + habitCount;
    return { date, activity };
  });
  const maxActivity = Math.max(1, ...weekDays.map((day) => day.activity));
  const expenseMonth = workspace.expenses.filter((item) => item.type === "expense" && item.date.startsWith(workspaceToday().slice(0, 7))).reduce((sum, item) => sum + item.amount, 0);
  const bars = weekDays.map(({ date, activity }) => `<div class="chart-day"><div class="chart-bar-wrap"><span class="chart-bar" style="height:${Math.max(activity ? 12 : 4, activity / maxActivity * 100)}%" title="${activity} actividades"></span></div><span>${new Intl.DateTimeFormat("es", { weekday: "short" }).format(date)}</span></div>`).join("");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Tu progreso", "Revisa cómo avanzas y ajusta tu ritmo cuando lo necesites.", "")}<div class="expense-totals stats-totals"><article class="panel"><span>Tareas completadas</span><strong>${completed.length} <small>de ${tasks.length}</small></strong></article><article class="panel"><span>Avance total</span><strong>${completionRate}%</strong></article><article class="panel"><span>Tiempo de enfoque</span><strong>${document.querySelector("#stat-focus").textContent}</strong></article><article class="panel"><span>Hábitos de esta semana</span><strong>${weekDays.reduce((sum, day) => sum + day.activity, 0)}</strong></article></div><div class="workspace-two-column"><section class="panel workspace-panel"><h2 class="panel-title">Actividad de los últimos 7 días</h2><div class="activity-chart">${bars}</div><p class="form-help">Actividad = tareas completadas + hábitos marcados.</p></section><section class="panel workspace-panel insight-panel"><span class="section-kicker">TU RESUMEN</span><h2>Un ritmo sostenible también es progreso.</h2><p>${tasks.length ? `Has completado ${completionRate}% de las tareas que tienes registradas.` : "Añade una tarea y empieza a crear tu propio historial de progreso."} ${workspace.habits.length ? `Esta semana ya registraste ${weekDays.reduce((sum, day) => sum + day.activity, 0)} actividades de tareas y hábitos.` : "Prueba a registrar un hábito para ampliar tus estadísticas."}</p><div class="insight-row"><span>Gastos registrados este mes</span><strong>${new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(expenseMonth)}</strong></div></section></div>`;
}

function renderAssistant() {
  const messages = workspace.assistantMessages.map((message) => `<article class="chat-message ${message.role === "user" ? "user-message" : "assistant-message"}"><span>${message.role === "user" ? "Tú" : "FOCUS · Asistente"}</span><p>${escapeWorkspace(message.text)}</p></article>`).join("");
  const tasks = window.focusApp.getTasks().filter((task) => statusOf(task) !== "done");
  workspaceView.innerHTML = `${renderWorkspaceHeader("Tu asistente de organización", "Recibe ideas personalizadas para priorizar, planear proyectos y encontrar tiempo para descansar.", "")}<div class="workspace-two-column assistant-layout"><section class="panel assistant-panel"><div class="assistant-intro"><span class="assistant-avatar">✧</span><div><strong>Asistente FOCUS</strong><span>Usa tus tareas y disponibilidad solo cuando tú lo confirmes.</span></div></div><div class="chat-history" id="assistant-history">${messages || '<div class="assistant-welcome"><strong>¿Qué te gustaría organizar?</strong><p>Puedo ayudarte a priorizar tareas, dar el primer paso en un proyecto o hacer un plan más realista.</p><div class="quick-prompts"><button type="button" data-action="quick-prompt" data-prompt="Ayúdame a priorizar mis tareas para hoy.">Priorizar mi día</button><button type="button" data-action="quick-prompt" data-prompt="Ayúdame a dividir un proyecto en pasos pequeños.">Dividir un proyecto</button><button type="button" data-action="quick-prompt" data-prompt="¿Cómo puedo organizar pausas en mi horario disponible?">Planear descansos</button></div></div>'}${currentAssistantError ? `<p class="assistant-error">${escapeWorkspace(currentAssistantError)}</p>` : ""}</div><form class="assistant-form" data-form="assistant"><label class="sr-only" for="assistant-question">Escribe una pregunta para el asistente</label><textarea id="assistant-question" name="question" maxlength="500" rows="2" placeholder="Escribe una pregunta para organizarte mejor…" required></textarea><button class="button button-primary" type="submit">Consultar →</button></form><p class="assistant-privacy">${tasks.length} tareas pendientes podrán compartirse con el proveedor de IA tras tu confirmación. No se envían descripciones, apuntes ni gastos.</p></section><aside class="assistant-tools"><section class="panel workspace-panel emergency-panel"><span class="emergency-icon">!</span><h2>¿El día cambió?</h2><p>Reorganiza las tareas urgentes dentro de tu disponibilidad. FOCUS te pedirá permiso antes de consultar a la IA.</p><button class="button button-primary" type="button" data-action="emergency-plan">Reorganizar pendientes →</button></section><section class="panel workspace-panel reminder-panel"><span class="section-kicker">RECORDATORIOS</span><h2>Un aviso a tiempo</h2><p>Recibe un recordatorio antes del inicio de una tarea o bloque con horario. Funciona mientras FOCUS está abierto.</p><label class="reminder-toggle"><input type="checkbox" data-action="reminder-toggle"${workspace.reminderEnabled ? " checked" : ""}>Activar recordatorios</label><label class="field-label">Avisarme antes<select class="form-input" data-action="reminder-lead"><option value="5"${workspace.reminderMinutes === 5 ? " selected" : ""}>5 minutos</option><option value="15"${workspace.reminderMinutes === 15 ? " selected" : ""}>15 minutos</option><option value="30"${workspace.reminderMinutes === 30 ? " selected" : ""}>30 minutos</option></select></label></section><section class="workspace-panel assistant-disclaimer"><span class="section-kicker">IMPORTANTE</span><p>Las sugerencias de IA son orientativas. No cambian tareas, fechas, gastos ni calendario. La clave del proveedor nunca se comparte con el navegador.</p></section></aside></div>`;
}

function renderWorkspace() {
  if (activeView === "calendar") renderCalendar();
  if (activeView === "kanban") renderKanban();
  if (activeView === "habits") renderHabits();
  if (activeView === "notes") renderNotes();
  if (activeView === "blocks") renderBlocks();
  if (activeView === "expenses") renderExpenses();
  if (activeView === "goals") renderGoals();
  if (activeView === "stats") renderStats();
  if (activeView === "assistant") renderAssistant();
}

function refreshTaskProjects(selected = "") {
  const select = document.querySelector("#task-form [name=project]");
  if (!select) return;
  select.innerHTML = `<option value="">Sin proyecto</option>${workspace.projects.map((project) => `<option value="${escapeWorkspace(project.title)}">${escapeWorkspace(project.title)}</option>`).join("")}`;
  select.value = selected;
}

function saveHabit(form) {
  const values = new FormData(form);
  const title = String(values.get("title")).trim();
  const target = Number(values.get("target"));
  if (!title || ![3, 5, 7].includes(target)) return;
  workspace.habits.push({ id: workspaceId(), title, target });
  const saved = saveWorkspace();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Hábito añadido. ¡Un paso pequeño cuenta!");
}

function toggleHabit(id) {
  const habit = workspace.habits.find((item) => item.id === id);
  if (!habit) return;
  const dates = workspace.habitEntries[id] || [];
  workspace.habitEntries[id] = dates.includes(workspaceToday())
    ? dates.filter((date) => date !== workspaceToday())
    : [...dates, workspaceToday()];
  saveWorkspace();
  renderWorkspace();
}

function saveNote(form) {
  const values = new FormData(form);
  const note = workspace.notes.find((item) => item.id === values.get("id"));
  if (!note) return;
  note.title = String(values.get("title")).trim();
  note.category = String(values.get("category"));
  note.body = String(values.get("body"));
  note.updatedAt = new Date().toISOString();
  const saved = saveWorkspace();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Apunte guardado en este navegador.");
}

function timeToMinutes(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function hasBlockConflict(date, start, end, taskId = "") {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const blocksOverlap = workspace.blocks.some((block) => block.date === date &&
    startMinutes < timeToMinutes(block.end) && endMinutes > timeToMinutes(block.start));
  if (blocksOverlap) return true;
  return window.focusApp.getTasks().some((task) => {
    if (task.done || task.id === taskId || (task.plannedDate || task.date) !== date || !task.time) return false;
    const taskStart = timeToMinutes(task.time);
    return taskStart !== null && startMinutes < taskStart + Number(task.duration) && endMinutes > taskStart;
  });
}

function saveBlock(form) {
  const values = new FormData(form);
  const title = String(values.get("title")).trim();
  const date = String(values.get("date"));
  const start = String(values.get("start"));
  const end = String(values.get("end"));
  const taskId = String(values.get("taskId"));
  if (!title || !validWorkspaceDate(date)) {
    window.focusApp.showToast("Revisa el nombre y la fecha del bloque.");
    return;
  }
  if (timeToMinutes(start) === null || timeToMinutes(end) === null || timeToMinutes(start) >= timeToMinutes(end)) {
    window.focusApp.showToast("La hora de inicio debe ser anterior a la hora de fin.");
    return;
  }
  if (hasBlockConflict(date, start, end, taskId)) {
    window.focusApp.showToast("Ese bloque se cruza con otra actividad. Elige otro horario.");
    return;
  }
  workspace.blocks.push({ id: workspaceId(), title, date, start, end, taskId, category: String(values.get("category")) });
  const saved = saveWorkspace();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Bloque de tiempo reservado.");
}

function saveExpense(form) {
  const values = new FormData(form);
  const amount = Number(values.get("amount"));
  const date = String(values.get("date"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !validWorkspaceDate(date)) {
    window.focusApp.showToast("Indica un importe y una fecha válidos.");
    return;
  }
  workspace.expenses.push({
    id: workspaceId(),
    title: String(values.get("title")).trim(),
    amount: Math.round(amount * 100) / 100,
    type: values.get("type") === "income" ? "income" : "expense",
    category: String(values.get("category")),
    date
  });
  const saved = saveWorkspace();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Movimiento registrado.");
}

function saveGoal(form) {
  const values = new FormData(form);
  const progress = Number(values.get("progress"));
  const date = String(values.get("date"));
  if (!Number.isInteger(progress) || progress < 0 || progress > 100 || !validWorkspaceDate(date)) {
    window.focusApp.showToast("Revisa el progreso y la fecha objetivo.");
    return;
  }
  workspace.goals.push({ id: workspaceId(), title: String(values.get("title")).trim(), date, progress });
  const saved = saveWorkspace();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Objetivo añadido.");
}

function saveProject(form) {
  const values = new FormData(form);
  const title = String(values.get("title")).trim();
  const date = String(values.get("date"));
  if (!title || (date && !validWorkspaceDate(date)) || workspace.projects.some((project) => project.title.toLocaleLowerCase("es") === title.toLocaleLowerCase("es"))) {
    window.focusApp.showToast("Escribe un nombre nuevo para el proyecto.");
    return;
  }
  workspace.projects.push({ id: workspaceId(), title, date });
  const saved = saveWorkspace();
  refreshTaskProjects();
  renderWorkspace();
  if (saved) window.focusApp.showToast("Proyecto creado. Ya puedes asignarle tareas.");
}

function currentAvailability() {
  return {
    start: document.querySelector("#availability-start").value,
    end: document.querySelector("#availability-end").value
  };
}

async function askAssistant(form) {
  const values = new FormData(form);
  const question = String(values.get("question")).trim();
  const tasks = window.focusApp.getTasks().filter((task) => statusOf(task) !== "done");
  const history = workspace.assistantMessages.slice(-6).map(({ role, text }) => ({ role, text }));
  const prompt = `Para responder, FOCUS enviará tu pregunta, hasta 6 mensajes previos de esta conversación, tus tareas pendientes, nombres y fechas objetivo de proyectos, y tu horario disponible al proveedor de IA configurado. No se enviarán descripciones, apuntes ni gastos. ¿Quieres continuar?`;
  if (!window.confirm(prompt)) return;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  currentAssistantError = "";
  workspace.assistantMessages.push({ role: "user", text: question });
  workspace.assistantMessages = workspace.assistantMessages.slice(-12);
  saveWorkspace();
  renderWorkspace();
  const newForm = workspaceView.querySelector('[data-form="assistant"]');
  if (newForm) newForm.querySelector('button[type="submit"]').disabled = true;
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        history,
        planningDate: workspaceToday(),
        availability: currentAvailability(),
        projects: workspace.projects.slice(0, 20).map((project) => ({
          title: project.title,
          dueDate: project.date
        })),
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          category: task.category,
          priority: task.priority,
          dueDate: task.date,
          duration: Number(task.duration),
          status: statusOf(task)
        }))
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar al asistente.");
    if (typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > 1600) {
      throw new Error("La respuesta del asistente no tiene un formato válido.");
    }
    workspace.assistantMessages.push({ role: "assistant", text: data.answer });
    workspace.assistantMessages = workspace.assistantMessages.slice(-12);
    saveWorkspace();
    renderWorkspace();
    workspaceView.querySelector("#assistant-question").focus();
  } catch (error) {
    console.error("No se pudo consultar al asistente.", error);
    currentAssistantError = error.message || "No se pudo consultar al asistente.";
    renderWorkspace();
  }
}

async function enableReminders(input) {
  if (!input.checked) {
    workspace.reminderEnabled = false;
    saveWorkspace();
    window.focusApp.showToast("Recordatorios desactivados.");
    return;
  }
  if (!("Notification" in window)) {
    workspace.reminderEnabled = false;
    input.checked = false;
    window.focusApp.showToast("Este navegador no admite notificaciones.");
    return;
  }
  let permission;
  try {
    permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  } catch (error) {
    console.error("No se pudo solicitar permiso para los recordatorios.", error);
    workspace.reminderEnabled = false;
    input.checked = false;
    window.focusApp.showToast("No pudimos solicitar permiso para las notificaciones.");
    return;
  }
  workspace.reminderEnabled = permission === "granted";
  if (!workspace.reminderEnabled) input.checked = false;
  if (saveWorkspace()) {
    window.focusApp.showToast(workspace.reminderEnabled
      ? "Recordatorios activados mientras FOCUS permanezca abierto."
      : "El navegador no autorizó las notificaciones.");
  }
}

function checkReminders() {
  if (!workspace.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const lead = Number(workspace.reminderMinutes) || 15;
  const tasks = window.focusApp.getTasks()
    .filter((task) => !task.done && task.time && (task.plannedDate || task.date) === workspaceToday())
    .map((task) => ({ id: `task-${task.id}`, title: task.title, time: task.time }));
  const blocks = blocksForDay(workspaceToday())
    .map((block) => ({ id: `block-${block.id}`, title: block.title, time: block.start }));
  [...tasks, ...blocks].forEach((item) => {
    const taskMinutes = timeToMinutes(item.time);
    const key = `${item.id}-${workspaceToday()}-${item.time}`;
    if (taskMinutes !== null && taskMinutes > nowMinutes && taskMinutes - nowMinutes <= lead && !workspace.notified.includes(key)) {
      try {
        new Notification("FOCUS · Próxima actividad", { body: `${item.title} empieza a las ${item.time}.` });
      } catch (error) {
        console.error("No se pudo mostrar un recordatorio de FOCUS.", error);
        window.focusApp.showToast("No pudimos mostrar un recordatorio. Revisa los permisos del navegador.");
        return;
      }
      workspace.notified.push(key);
      workspace.notified = workspace.notified.slice(-100);
      saveWorkspace();
    }
  });
}

function moveTask(id, status) {
  if (window.focusApp.updateTaskStatus(id, status)) renderWorkspace();
}

function handleWorkspaceAction(actionElement) {
  const action = actionElement.dataset.action;
  const id = actionElement.dataset.taskId;
  if (action === "calendar-mode") {
    calendarMode = actionElement.dataset.mode;
    renderCalendar();
  } else if (action === "calendar-prev" || action === "calendar-next") {
    const direction = action === "calendar-next" ? 1 : -1;
    calendarDate = new Date(calendarDate);
    if (calendarMode === "month") calendarDate.setMonth(calendarDate.getMonth() + direction);
    else calendarDate.setDate(calendarDate.getDate() + direction * 7);
    renderCalendar();
  } else if (action === "calendar-today") {
    calendarDate = new Date();
    renderCalendar();
  } else if (action === "add-task") {
    window.focusApp.openTaskDialog();
  } else if (action === "edit-task") {
    const task = window.focusApp.getTasks().find((item) => item.id === id);
    if (task) window.focusApp.openTaskDialog(task);
  } else if (action === "new-note") {
    const note = { id: workspaceId(), title: "", category: "Universidad", body: "", updatedAt: new Date().toISOString() };
    workspace.notes.unshift(note);
    activeNoteId = note.id;
    saveWorkspace();
    renderWorkspace();
    workspaceView.querySelector('[name="title"]').focus();
  } else if (action === "open-note") {
    activeNoteId = actionElement.dataset.noteId;
    renderWorkspace();
  } else if (action === "delete-note") {
    workspace.notes = workspace.notes.filter((note) => note.id !== actionElement.dataset.noteId);
    activeNoteId = null;
    saveWorkspace();
    renderWorkspace();
  } else if (action === "habit-check") {
    toggleHabit(actionElement.dataset.habitId);
  } else if (action === "delete-habit") {
    workspace.habits = workspace.habits.filter((habit) => habit.id !== actionElement.dataset.habitId);
    delete workspace.habitEntries[actionElement.dataset.habitId];
    saveWorkspace();
    renderWorkspace();
  } else if (action === "delete-block") {
    workspace.blocks = workspace.blocks.filter((block) => block.id !== actionElement.dataset.blockId);
    saveWorkspace();
    renderWorkspace();
  } else if (action === "delete-expense") {
    workspace.expenses = workspace.expenses.filter((item) => item.id !== actionElement.dataset.expenseId);
    saveWorkspace();
    renderWorkspace();
  } else if (action === "delete-goal") {
    workspace.goals = workspace.goals.filter((goal) => goal.id !== actionElement.dataset.goalId);
    saveWorkspace();
    renderWorkspace();
  } else if (action === "delete-project") {
    const project = workspace.projects.find((item) => item.id === actionElement.dataset.projectId);
    if (!project) return;
    workspace.projects = workspace.projects.filter((item) => item.id !== project.id);
    window.focusApp.getTasks().filter((task) => task.project === project.title).forEach((task) => {
      window.focusApp.updateTaskProject(task.id, "");
    });
    const saved = saveWorkspace();
    refreshTaskProjects();
    renderWorkspace();
    if (saved) window.focusApp.showToast("Proyecto eliminado. Las tareas se conservaron.");
  } else if (action === "quick-prompt") {
    workspaceView.querySelector("#assistant-question").value = actionElement.dataset.prompt;
    workspaceView.querySelector("#assistant-question").focus();
  } else if (action === "emergency-plan") {
    openWorkspace("dashboard");
    window.focusApp.createPlan(true);
  } else if (action === "go-calendar") {
    openWorkspace("calendar");
  }
}

workspaceView.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (actionElement && !["reminder-toggle", "reminder-lead", "move-task"].includes(actionElement.dataset.action)) {
    handleWorkspaceAction(actionElement);
  }
});

workspaceView.addEventListener("change", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  if (actionElement.dataset.action === "move-task") moveTask(actionElement.dataset.taskId, actionElement.value);
  if (actionElement.dataset.action === "reminder-toggle") enableReminders(actionElement);
  if (actionElement.dataset.action === "reminder-lead") {
    workspace.reminderMinutes = Number(actionElement.value);
    saveWorkspace();
  }
});

workspaceView.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const handlers = {
    habit: saveHabit,
    note: saveNote,
    block: saveBlock,
    expense: saveExpense,
    goal: saveGoal,
    project: saveProject,
    assistant: askAssistant,
    "goal-progress": (goalForm) => {
      const values = new FormData(goalForm);
      const progress = Number(values.get("progress"));
      const goal = workspace.goals.find((item) => item.id === values.get("id"));
      if (!goal || !Number.isInteger(progress) || progress < 0 || progress > 100) return;
      goal.progress = progress;
      const saved = saveWorkspace();
      renderWorkspace();
      if (saved) window.focusApp.showToast("Progreso actualizado.");
    }
  };
  const handler = handlers[form.dataset.form];
  if (handler) handler(form);
});

workspaceView.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".kanban-card");
  if (card) event.dataTransfer.setData("text/plain", card.dataset.taskId);
});

workspaceView.addEventListener("dragover", (event) => {
  if (event.target.closest(".kanban-column")) event.preventDefault();
});

workspaceView.addEventListener("drop", (event) => {
  const column = event.target.closest(".kanban-column");
  if (!column) return;
  event.preventDefault();
  moveTask(event.dataTransfer.getData("text/plain"), column.dataset.status);
});

document.querySelectorAll(".main-nav").forEach((nav) => nav.addEventListener("click", (event) => {
  const link = event.target.closest("[data-workspace]");
  if (!link) return;
  event.preventDefault();
  openWorkspace(link.dataset.workspace);
}));

document.querySelector("#emergency-shortcut").addEventListener("click", () => openWorkspace("assistant", { emergency: true }));
document.querySelector("#focus-shortcut").addEventListener("click", () => {
  openWorkspace("dashboard");
  document.querySelector("#focus-title").scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector("#timer-start").focus({ preventScroll: true });
});
document.addEventListener("focus:tasks-changed", () => {
  refreshTaskProjects();
  if (activeView !== "dashboard") renderWorkspace();
});

refreshTaskProjects();
document.querySelector("#task-form").addEventListener("submit", () => {
  window.setTimeout(() => {
    if (activeView !== "dashboard") renderWorkspace();
  }, 0);
});
checkReminders();
window.setInterval(checkReminders, 60_000);
