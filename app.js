const STORAGE_KEY = "focus.tasks.v1";
const FOCUS_MINUTES_KEY = "focus.minutes.v1";
const AVAILABILITY_KEY = "focus.availability.v1";
const INITIAL_TASKS = [
  { id: "seed-1", title: "Repasar apuntes de biología", description: "Revisar el tema de genética y preparar dudas.", category: "Estudio", priority: "Alta", date: dateOffset(0), time: "09:30", duration: 45, done: false },
  { id: "seed-2", title: "Avanzar en el proyecto de historia", description: "Buscar fuentes para el trabajo final.", category: "Proyecto", priority: "Media", date: dateOffset(0), time: "11:00", duration: 60, done: false },
  { id: "seed-3", title: "Leer 20 páginas de la novela", description: "", category: "Estudio", priority: "Baja", date: dateOffset(0), time: "15:30", duration: 25, done: false },
  { id: "seed-4", title: "Preparar la mochila para mañana", description: "", category: "Personal", priority: "Media", date: dateOffset(1), time: "18:00", duration: 25, done: false }
];
const DEFAULT_AVAILABILITY = { start: "09:00", end: "17:00" };

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed) === value;
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return INITIAL_TASKS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error("El formato de las tareas guardadas no es válido.");
    return parsed
      .filter((task) => task && typeof task.id === "string" && typeof task.title === "string")
      .map((task) => ({
        ...task,
        description: typeof task.description === "string" ? task.description : "",
        category: typeof task.category === "string" ? task.category : "Personal",
        project: typeof task.project === "string" ? task.project : "",
        priority: ["Alta", "Media", "Baja"].includes(task.priority) ? task.priority : "Media",
        date: isValidDateKey(task.date) ? task.date : dateOffset(0),
        time: typeof task.time === "string" ? task.time : "12:00",
        duration: [25, 45, 60, 90].includes(Number(task.duration)) ? Number(task.duration) : 25,
        done: Boolean(task.done || task.status === "done"),
        status: task.done || task.status === "done" ? "done" : task.status === "in_progress" ? "in_progress" : "pending"
      }));
  } catch (error) {
    console.error("No se pudieron cargar las tareas guardadas.", error);
    return INITIAL_TASKS;
  }
}

let tasks = loadTasks();
let availability = loadAvailability();
let activeFilter = "today";
let selectedDate = dateOffset(0);
let weekOffset = 0;
let focusedMinutes = 0;
let timerPhase = "focus";
let remainingSeconds = 25 * 60;
let phaseDuration = 25 * 60;
let timerInterval = null;
let toastTimeout = null;

function loadAvailability() {
  try {
    const saved = localStorage.getItem(AVAILABILITY_KEY);
    if (!saved) return { ...DEFAULT_AVAILABILITY };
    const parsed = JSON.parse(saved);
    if (
      parsed &&
      /^\d{2}:\d{2}$/.test(parsed.start) &&
      /^\d{2}:\d{2}$/.test(parsed.end) &&
      parsed.start < parsed.end
    ) return { start: parsed.start, end: parsed.end };
  } catch (error) {
    console.error("No se pudo cargar la disponibilidad guardada.", error);
  }
  return { ...DEFAULT_AVAILABILITY };
}

try {
  focusedMinutes = Number(localStorage.getItem(FOCUS_MINUTES_KEY)) || 0;
} catch (error) {
  console.error("No se pudo cargar el tiempo de enfoque guardado.", error);
}

const taskList = document.querySelector("#task-list");
const taskFooter = document.querySelector("#task-footer");
const dialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const toast = document.querySelector("#toast");
const timerDisplay = document.querySelector("#timer-display");
const timerProgress = document.querySelector("#timer-progress");
const CIRCUMFERENCE = 2 * Math.PI * 70;

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("No se pudieron guardar las tareas.", error);
    showToast("No pudimos guardar tus cambios en este navegador.");
  }
}

function saveAvailability() {
  const start = document.querySelector("#availability-start").value;
  const end = document.querySelector("#availability-end").value;
  if (!start || !end || start >= end) return;
  availability = { start, end };
  try {
    localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(availability));
  } catch (error) {
    console.error("No se pudo guardar la disponibilidad.", error);
    showToast("No pudimos guardar tu disponibilidad en este navegador.");
  }
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDuration(minutes) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
}

function scheduleDate(task) {
  return task.plannedDate || task.date;
}

function formatDeadline(dateKey) {
  const today = dateOffset(0);
  if (dateKey === today) return "Vence hoy";
  const dueDate = new Date(`${dateKey}T12:00:00`);
  if (dateKey < today) return `Vencida · ${new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(dueDate)}`;
  if (dateKey === dateOffset(1)) return "Vence mañana";
  return `Entrega · ${new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(dueDate)}`;
}

function currentTasks() {
  const search = document.querySelector("#task-search").value.trim().toLocaleLowerCase("es");
  const today = dateOffset(0);
  return tasks.filter((task) => {
    const matchesSearch = task.title.toLocaleLowerCase("es").includes(search);
    if (!matchesSearch) return false;
    if (activeFilter === "today") return !task.done && (task.date <= today || task.plannedDate === today);
    if (activeFilter === "upcoming") return !task.done && task.date > today && task.plannedDate !== today;
    return task.done;
  }).sort((a, b) => a.time.localeCompare(b.time));
}

function renderTaskList() {
  const visibleTasks = currentTasks();
  taskList.innerHTML = "";

  if (!visibleTasks.length) {
    const messages = {
      today: ["Tu día tiene espacio para empezar", "Añade una tarea y da el primer paso."],
      upcoming: ["No hay tareas próximas", "Cuando tengas algo en mente, guárdalo aquí."],
      done: ["Todo empieza con una primera tarea", "Las tareas que completes aparecerán aquí."]
    };
    taskList.innerHTML = `<div class="empty-state"><strong>${messages[activeFilter][0]}</strong><p>${messages[activeFilter][1]}</p></div>`;
  } else {
    visibleTasks.forEach((task) => {
      const row = document.createElement("article");
      row.className = `task-row${task.done ? " is-done" : ""}`;
      const categoryClass = { Estudio: "estudio", Universidad: "estudio", Trabajo: "proyecto", "Vida personal": "personal", Personal: "personal", Proyecto: "proyecto" }[task.category] || "";
      const priorityClass = { Alta: "alta", Media: "media", Baja: "baja" }[task.priority] || "";
      row.innerHTML = `
        <button class="task-check" type="button" data-toggle="${escapeHtml(task.id)}" aria-label="${task.done ? "Marcar pendiente" : "Completar"}: ${escapeHtml(task.title)}">${task.done ? "✓" : ""}</button>
        <div class="task-main">
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${task.description ? `<span class="task-description">${escapeHtml(task.description)}</span>` : ""}
          ${!task.time && task.planReason ? `<span class="task-plan-note">${escapeHtml(task.planReason)}</span>` : ""}
          <span class="task-meta"><i class="category-dot ${categoryClass}"></i>${escapeHtml(task.category)}<span>·</span><span class="task-priority ${priorityClass}">${escapeHtml(task.priority)}</span><span class="task-deadline${task.date < dateOffset(0) ? " overdue" : ""}">${escapeHtml(formatDeadline(task.date))}</span></span>
        </div>
        <div class="task-trailing"><time class="task-time" title="${escapeHtml(task.planReason || "")}">${escapeHtml(task.time || "Sin horario")}</time><span class="task-duration">${formatDuration(Number(task.duration))}</span><span class="task-actions"><button class="task-action" type="button" data-edit="${escapeHtml(task.id)}" aria-label="Editar ${escapeHtml(task.title)}">✎</button><button class="task-action" type="button" data-delete="${escapeHtml(task.id)}" aria-label="Eliminar ${escapeHtml(task.title)}">×</button></span></div>`;
      taskList.append(row);
    });
  }

  const today = dateOffset(0);
  const count = tasks.filter((task) => !task.done && (task.date <= today || task.plannedDate === today)).length;
  document.querySelector("#task-total").textContent = String(visibleTasks.length);
  document.querySelector("#nav-count").textContent = String(count);
  document.querySelector("#stat-tasks").innerHTML = `${count} <small>${count === 1 ? "tarea" : "tareas"}</small>`;
  document.querySelector("#stat-completed").innerHTML = `${tasks.filter((task) => task.done).length} <small>${tasks.filter((task) => task.done).length === 1 ? "tarea" : "tareas"}</small>`;
  const completedToday = tasks.filter((task) => task.done && scheduleDate(task) === today).length;
  taskFooter.innerHTML = `<span>${completedToday} completadas · ${count} pendientes</span><button type="button" id="footer-add">＋ Añadir tarea</button>`;
  document.querySelector("#footer-add").addEventListener("click", openTaskDialog);
}

function renderWeek() {
  const today = new Date();
  const monday = new Date(today);
  const dayFromMonday = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - dayFromMonday + weekOffset * 7);
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const weekDays = document.querySelector("#week-days");
  weekDays.innerHTML = "";
  dayNames.forEach((name, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-button${key === selectedDate ? " selected" : ""}${key === dateOffset(0) ? " today" : ""}`;
    button.setAttribute("aria-label", formatLongDate(date));
    button.setAttribute("aria-pressed", String(key === selectedDate));
    button.innerHTML = `<span>${name}</span><strong>${date.getDate()}</strong>`;
    button.addEventListener("click", () => {
      selectedDate = key;
      renderWeek();
    });
    weekDays.append(button);
  });

  const selected = new Date(`${selectedDate}T12:00:00`);
  document.querySelector("#agenda-title").textContent = selectedDate === dateOffset(0)
    ? "HOY"
    : new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "short" }).format(selected).toLocaleUpperCase("es");
  const dayTasks = tasks.filter((task) => scheduleDate(task) === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  document.querySelector("#agenda-count").textContent = `${dayTasks.length} ${dayTasks.length === 1 ? "tarea" : "tareas"}`;
  const agenda = document.querySelector("#agenda-content");
  agenda.innerHTML = dayTasks.length
    ? dayTasks.slice(0, 3).map((task) => `<div class="agenda-item"><time>${escapeHtml(task.time)}</time><i></i><span>${escapeHtml(task.title)}</span></div>`).join("")
    : '<div class="agenda-empty">Un día con espacio para ti.</div>';
}

function render() {
  renderTaskList();
  renderWeek();
  document.querySelector("#stat-focus").innerHTML = `${focusedMinutes} <small>min</small>`;
  document.dispatchEvent(new CustomEvent("focus:tasks-changed"));
}

function openTaskDialog(task = null) {
  taskForm.reset();
  if (window.focusFeatures) window.focusFeatures.refreshTaskProjects(task ? task.project || "" : "");
  taskForm.elements.namedItem("taskId").value = task ? task.id : "";
  taskForm.elements.title.value = task ? task.title : "";
  taskForm.elements.description.value = task ? task.description || "" : "";
  taskForm.elements.category.value = task ? task.category : "Estudio";
  taskForm.elements.project.value = task ? task.project || "" : "";
  taskForm.elements.priority.value = task ? task.priority : "Media";
  taskForm.elements.date.value = task ? task.date : dateOffset(0);
  taskForm.elements.time.value = task ? task.time : "10:00";
  taskForm.elements.duration.value = task ? String(task.duration) : "25";
  document.querySelector("#dialog-title").textContent = task ? "Editar tarea" : "Nueva tarea";
  dialog.showModal();
  document.querySelector("#task-title").focus();
}

function saveTask(event) {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = String(formData.get("title")).trim();
  const taskId = String(formData.get("taskId"));
  if (!title) return;
  const values = {
    title,
    description: String(formData.get("description")).trim(),
    category: String(formData.get("category")),
    project: String(formData.get("project") || ""),
    priority: String(formData.get("priority")),
    date: String(formData.get("date")),
    time: String(formData.get("time")) || "12:00",
    duration: Number(formData.get("duration"))
  };
  const existing = tasks.find((task) => task.id === taskId);
  if (existing) {
    if (existing.date !== values.date) {
      delete existing.plannedDate;
      delete existing.planReason;
    }
    Object.assign(existing, values);
  } else {
    const task = {
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...values,
      done: false,
      status: "pending"
    };
    tasks.push(task);
  }
  saveTasks();
  activeFilter = values.date <= dateOffset(0) ? "today" : "upcoming";
  selectedDate = values.date;
  document.querySelector("#task-search").value = "";
  setFilterTab();
  dialog.close();
  render();
  showToast(existing ? "Cambios guardados." : "Tarea añadida. ¡Un paso más cerca!");
}

function setFilterTab() {
  document.querySelectorAll(".task-tab").forEach((tab) => {
    const active = tab.dataset.filter === activeFilter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

async function createPlan(reorganize = false) {
  if (window.FOCUS_STATIC_HOSTING) {
    showToast("La planificación con IA requiere un servidor y no está disponible en GitHub Pages.");
    return;
  }
  const today = dateOffset(0);
  const pending = tasks.filter((task) => !task.done && (task.date <= today || task.plannedDate === today));
  if (!pending.length) {
    if (reorganize) {
      showToast("No hay tareas pendientes o vencidas para reorganizar.");
    } else {
      showToast("Añade una tarea para empezar a organizar tu día.");
      openTaskDialog();
    }
    return;
  }
  const startControl = document.querySelector("#availability-start");
  const endControl = document.querySelector("#availability-end");
  let startTime = startControl.value;
  const endTime = endControl.value;
  if (!startTime || !endTime || startTime >= endTime) {
    showToast("Ajusta tu disponibilidad: la hora de inicio debe ser anterior a la hora final.");
    return;
  }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  if (startMinutes < currentMinutes) {
    const nextQuarter = Math.ceil(currentMinutes / 15) * 15;
    startTime = `${String(Math.floor(nextQuarter / 60)).padStart(2, "0")}:${String(nextQuarter % 60).padStart(2, "0")}`;
  }
  if (startTime >= endTime) {
    showToast("Ya no queda tiempo dentro del horario disponible de hoy.");
    return;
  }
  const action = reorganize ? "reorganizar tus pendientes" : "crear tu plan de hoy";
  if (!window.confirm(`Para ${action}, FOCUS enviará los nombres, descripciones, categorías, prioridades, fechas límite y duración de tus tareas, además de tu horario disponible, al proveedor de IA configurado por quien administra este servidor. ¿Quieres continuar?`)) return;

  const button = document.querySelector("#plan-button");
  const reorganizeButton = document.querySelector("#replan-button");
  const result = document.querySelector("#plan-result");
  button.disabled = true;
  reorganizeButton.disabled = true;
  button.textContent = reorganize ? "Reorganizando…" : "Creando plan…";
  result.classList.remove("error");
  result.textContent = "";
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planningDate: today,
        tasks: pending.map(({ id, title, description, category, priority, date, duration }) => ({
          id, title, description, category, priority, dueDate: date, duration: Number(duration)
        })),
        availability: { start: startTime, end: endTime },
        breakMinutes: 5
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo crear el plan.");
    if (!Array.isArray(data.plan) || !Array.isArray(data.unscheduled)) {
      throw new Error("La respuesta del planificador no tiene un formato válido.");
    }
    const accountedIds = new Set([...data.plan, ...data.unscheduled].map((item) => item.taskId));
    if (accountedIds.size !== pending.length || pending.some((task) => !accountedIds.has(task.id))) {
      throw new Error("El plan no incluye todas las tareas pendientes.");
    }
    pending.forEach((task) => {
      delete task.plannedDate;
      delete task.planReason;
    });
    data.plan.forEach((item) => {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (!task || typeof item.startTime !== "string") throw new Error("El plan contiene una tarea no reconocida.");
      task.time = item.startTime;
      task.plannedDate = today;
      task.planReason = item.reason || "";
    });
    data.unscheduled.forEach((item) => {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (!task) throw new Error("El plan contiene una tarea no reconocida.");
      task.time = "";
      task.planReason = item.reason || "";
    });
    saveTasks();
    render();
    const unscheduledSummary = data.unscheduled.length
      ? ` Pendientes de ubicar: ${data.unscheduled.map((item) => tasks.find((task) => task.id === item.taskId).title).join(", ")}.`
      : "";
    result.textContent = `${data.summary || `Plan listo: ${data.plan.length} tareas con pausas.`}${unscheduledSummary}`;
    showToast(data.unscheduled.length
      ? `Plan listo con ${data.unscheduled.length} ${data.unscheduled.length === 1 ? "tarea pendiente de ubicar" : "tareas pendientes de ubicar"}.`
      : reorganize ? "Tus pendientes se reorganizaron." : "Tu horario personalizado está listo.");
  } catch (error) {
    console.error("No se pudo crear el plan con IA.", error);
    result.classList.add("error");
    result.textContent = error.message || "No se pudo crear el plan. Intenta de nuevo.";
    showToast(result.textContent);
  } finally {
    button.disabled = false;
    reorganizeButton.disabled = false;
    button.innerHTML = 'Crear plan de hoy <span aria-hidden="true">→</span>';
  }
}

function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  task.status = task.done ? "done" : "pending";
  saveTasks();
  render();
  if (task.done) showToast("¡Tarea completada! Date crédito por ese avance.");
}

function updateTaskStatus(id, status) {
  const task = tasks.find((item) => item.id === id);
  if (!task || !["pending", "in_progress", "done"].includes(status)) return false;
  task.status = status;
  task.done = status === "done";
  saveTasks();
  render();
  return true;
}

function updateTaskProject(id, project) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return false;
  task.project = project;
  saveTasks();
  render();
  return true;
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  tasks = tasks.filter((item) => item.id !== id);
  saveTasks();
  render();
  showToast("Tarea eliminada.");
}

function updateTimerDisplay() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progress = CIRCUMFERENCE * (1 - remainingSeconds / phaseDuration);
  timerProgress.style.strokeDasharray = String(CIRCUMFERENCE);
  timerProgress.style.strokeDashoffset = String(progress);
  document.querySelector("#timer-phase-label").textContent = timerPhase === "focus" ? "ENFOQUE" : "DESCANSO";
  document.querySelector("#timer-caption").textContent = timerPhase === "focus"
    ? "25 min de enfoque · 5 min de descanso"
    : "Tómate cinco minutos para recargar energía.";
}

function toggleTimer() {
  const button = document.querySelector("#timer-start");
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    button.innerHTML = `Continuar ${timerPhase === "focus" ? "enfoque" : "descanso"} <span>→</span>`;
    return;
  }
  button.innerHTML = `Pausar ${timerPhase === "focus" ? "enfoque" : "descanso"} <span>Ⅱ</span>`;
  timerInterval = window.setInterval(() => {
    remainingSeconds -= 1;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      window.clearInterval(timerInterval);
      timerInterval = null;
      if (timerPhase === "focus") {
        focusedMinutes += 25;
        try {
          localStorage.setItem(FOCUS_MINUTES_KEY, String(focusedMinutes));
        } catch (error) {
          console.error("No se pudo guardar el tiempo de enfoque.", error);
        }
        timerPhase = "break";
        remainingSeconds = 5 * 60;
        phaseDuration = 5 * 60;
      } else {
        timerPhase = "focus";
        remainingSeconds = 25 * 60;
        phaseDuration = 25 * 60;
      }
      document.querySelector("#timer-start").innerHTML = timerPhase === "focus"
        ? 'Empezar enfoque <span>→</span>'
        : 'Iniciar descanso <span>→</span>';
      updateTimerDisplay();
      render();
      showToast(timerPhase === "break"
        ? "¡Sesión completada! Tómate cinco minutos para descansar."
        : "Descanso terminado. Cuando quieras, empieza otro bloque de enfoque.");
    }
  }, 1000);
}

document.querySelector("#top-date").textContent = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date());
document.querySelector("#welcome-date").textContent = formatLongDate(new Date()).toLocaleUpperCase("es");
document.querySelector("#add-task-button").addEventListener("click", openTaskDialog);
document.querySelector("#plan-button").addEventListener("click", createPlan);
document.querySelector("#replan-button").addEventListener("click", () => createPlan(true));
document.querySelector("#availability-start").addEventListener("change", saveAvailability);
document.querySelector("#availability-end").addEventListener("change", saveAvailability);
document.querySelector("#view-all-button").addEventListener("click", () => {
  activeFilter = "today";
  setFilterTab();
  renderTaskList();
  document.querySelector("#tareas").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#task-search").addEventListener("input", renderTaskList);
document.querySelectorAll(".task-tab").forEach((tab) => tab.addEventListener("click", () => {
  activeFilter = tab.dataset.filter;
  setFilterTab();
  renderTaskList();
}));
taskList.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-toggle]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (toggleButton) toggleTask(toggleButton.dataset.toggle);
  if (editButton) {
    const task = tasks.find((item) => item.id === editButton.dataset.edit);
    if (task) openTaskDialog(task);
  }
  if (deleteButton) deleteTask(deleteButton.dataset.delete);
});
taskForm.addEventListener("submit", saveTask);
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
document.querySelector("#cancel-task").addEventListener("click", () => dialog.close());
document.querySelector("#timer-start").addEventListener("click", toggleTimer);
document.querySelector("#timer-reset").addEventListener("click", () => {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  timerPhase = "focus";
  remainingSeconds = 25 * 60;
  phaseDuration = 25 * 60;
  document.querySelector("#timer-start").innerHTML = 'Empezar enfoque <span>→</span>';
  updateTimerDisplay();
});
document.querySelector("#focus-shortcut").addEventListener("click", () => {
  document.querySelector("#focus-title").scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector("#timer-start").focus({ preventScroll: true });
});
document.querySelector("#week-next").addEventListener("click", () => {
  weekOffset += 1;
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() - ((nextMonday.getDay() + 6) % 7) + weekOffset * 7);
  selectedDate = localDateKey(nextMonday);
  renderWeek();
});
document.querySelector("#menu-button").addEventListener("click", (event) => {
  const isOpen = document.querySelector(".sidebar").classList.toggle("mobile-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  event.currentTarget.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
});
document.querySelectorAll(".main-nav").forEach((nav) => nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    document.querySelector(".sidebar").classList.remove("mobile-open");
    const menuButton = document.querySelector("#menu-button");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menú");
  }
}));

window.focusApp = {
  createPlan,
  getTasks: () => tasks.map((task) => ({ ...task })),
  openTaskDialog,
  showToast,
  updateTaskProject,
  updateTaskStatus
};

render();
document.querySelector("#availability-start").value = availability.start;
document.querySelector("#availability-end").value = availability.end;
updateTimerDisplay();
