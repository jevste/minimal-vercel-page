const SUPABASE_URL = "https://mhmxfcoahmmhxhxiiazf.supabase.co";
const SUPABASE_KEY = "sb_publishable_-zO3eqnHgePmPocjDsKjFw_IJbcv6q0";
const TABLE_NAME = "availability";

const now = new Date();
let viewDate = new Date(now.getFullYear(), now.getMonth(), 1);

const calendarGrid = document.querySelector("#calendar-grid");
const calendarTitle = document.querySelector("#calendar-title");
const selectedDateCopy = document.querySelector("#selected-date-copy");
const formTitle = document.querySelector("#form-title");
const form = document.querySelector("#availability-form");
const nameInput = document.querySelector("#name-input");
const submitButton = document.querySelector("#submit-button");
const refreshButton = document.querySelector("#refresh-button");
const previousMonthButton = document.querySelector("#previous-month");
const nextMonthButton = document.querySelector("#next-month");
const statusMessage = document.querySelector("#status-message");

let selectedDate = null;
let availability = [];
let loadRequestId = 0;

const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

nameInput.value = localStorage.getItem("availability-name") || "";

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function namesForDate(dateKey) {
  return availability.filter((entry) => entry.available_on === dateKey).map((entry) => entry.name);
}

function getMonthBounds() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  };
}

function updateMonthHeader() {
  calendarTitle.textContent = capitalize(monthFormatter.format(viewDate));
  document.querySelector("#month-number").textContent = String(viewDate.getMonth() + 1).padStart(2, "0");
  document.querySelector("#year-number").textContent = viewDate.getFullYear();
}

function renderCalendar() {
  const { start: monthStart, end: monthEnd } = getMonthBounds();
  calendarGrid.replaceChildren();
  const mondayOffset = (monthStart.getDay() + 6) % 7;

  for (let index = 0; index < mondayOffset; index += 1) {
    const spacer = document.createElement("div");
    spacer.className = "calendar-spacer";
    calendarGrid.append(spacer);
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateKey = toDateKey(date);
    const names = namesForDate(dateKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = dateKey;
    button.setAttribute("aria-label", `${dateFormatter.format(date)}. Отметок: ${names.length}`);

    if (dateKey === selectedDate) button.classList.add("is-selected");
    if (dateKey === toDateKey(now)) button.classList.add("is-today");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    button.append(number);

    if (names.length) {
      const list = document.createElement("span");
      list.className = "people-list";

      names.slice(0, 3).forEach((name) => {
        const chip = document.createElement("span");
        chip.className = "person-chip";
        chip.textContent = name;
        list.append(chip);
      });

      if (names.length > 3) {
        const more = document.createElement("span");
        more.className = "more-people";
        more.textContent = `ещё ${names.length - 3}`;
        list.append(more);
      }

      button.append(list);
    }

    button.addEventListener("click", () => selectDate(date, dateKey));
    calendarGrid.append(button);
  }
}

function changeMonth(offset) {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
  selectedDate = null;
  availability = [];
  formTitle.textContent = "Выберите день";
  selectedDateCopy.textContent = "Нажмите на дату в календаре.";
  submitButton.disabled = true;
  updateMonthHeader();
  renderCalendar();
  loadAvailability();
}

function selectDate(date, dateKey) {
  selectedDate = dateKey;
  formTitle.textContent = capitalize(dateFormatter.format(date));
  selectedDateCopy.textContent = "Добавьте своё имя к этой дате.";
  submitButton.disabled = false;
  setStatus("");
  renderCalendar();
  nameInput.focus();
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${type ? ` is-${type}` : ""}`;
}

async function loadAvailability({ silent = false } = {}) {
  const requestId = ++loadRequestId;
  const { start: monthStart, end: monthEnd } = getMonthBounds();
  if (!silent) setStatus("Загружаю отметки…");
  refreshButton.disabled = true;
  previousMonthButton.disabled = true;
  nextMonthButton.disabled = true;

  const start = toDateKey(monthStart);
  const end = toDateKey(monthEnd);
  const query = new URLSearchParams({
    select: "available_on,name",
    available_on: `gte.${start}`,
    order: "available_on.asc,name.asc",
  });
  query.append("available_on", `lte.${end}`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    if (requestId !== loadRequestId) return;
    availability = result;
    renderCalendar();
    if (!silent) setStatus("Календарь обновлён.", "success");
  } catch (error) {
    if (requestId !== loadRequestId) return;
    console.error(error);
    setStatus("Не удалось загрузить календарь. Проверьте настройку таблицы Supabase.", "error");
  } finally {
    if (requestId === loadRequestId) {
      refreshButton.disabled = false;
      previousMonthButton.disabled = false;
      nextMonthButton.disabled = false;
    }
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!selectedDate || !name) return;

  submitButton.disabled = true;
  setStatus("Сохраняю отметку…");

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?on_conflict=available_on,name`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({ available_on: selectedDate, name }),
      },
    );

    if (!response.ok) throw new Error(await response.text());
    localStorage.setItem("availability-name", name);
    await loadAvailability({ silent: true });
    setStatus("Готово — вашу доступность теперь видят все.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Не удалось сохранить отметку. Попробуйте ещё раз.", "error");
  } finally {
    submitButton.disabled = !selectedDate;
  }
});

refreshButton.addEventListener("click", () => loadAvailability());
previousMonthButton.addEventListener("click", () => changeMonth(-1));
nextMonthButton.addEventListener("click", () => changeMonth(1));
window.setInterval(() => loadAvailability({ silent: true }), 15000);

updateMonthHeader();
renderCalendar();
loadAvailability();
