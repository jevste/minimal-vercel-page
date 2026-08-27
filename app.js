const SUPABASE_URL = "https://mhmxfcoahmmhxhxiiazf.supabase.co";
const SUPABASE_KEY = "sb_publishable_-zO3eqnHgePmPocjDsKjFw_IJbcv6q0";
const TABLE_NAME = "availability";

const now = new Date();
let viewDate = new Date(now.getFullYear(), now.getMonth(), 1);

const calendarGrid = document.querySelector("#calendar-grid");
const calendarTitle = document.querySelector("#calendar-title");
const topDaysList = document.querySelector("#top-days-list");
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

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function peopleLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} человек`;
  if (last === 1) return `${count} человек`;
  if (last >= 2 && last <= 4) return `${count} человека`;
  return `${count} человек`;
}

function renderTopDays() {
  topDaysList.replaceChildren();
  const grouped = new Map();

  availability.forEach((entry) => {
    const names = grouped.get(entry.available_on) || [];
    names.push(entry.name);
    grouped.set(entry.available_on, names);
  });

  const topDays = [...grouped.entries()]
    .sort(([dateA, namesA], [dateB, namesB]) => namesB.length - namesA.length || dateA.localeCompare(dateB))
    .slice(0, 3);

  if (!topDays.length) {
    const empty = document.createElement("p");
    empty.className = "top-days-empty";
    empty.textContent = "В этом месяце пока нет отметок.";
    topDaysList.append(empty);
    return;
  }

  topDays.forEach(([dateKey, names], index) => {
    const date = dateFromKey(dateKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-day";
    button.setAttribute("aria-label", `${dateFormatter.format(date)}: ${peopleLabel(names.length)}`);

    const rank = document.createElement("span");
    rank.className = "top-day-rank";
    rank.textContent = `№ ${index + 1}`;

    const dateLabel = document.createElement("span");
    dateLabel.className = "top-day-date";
    dateLabel.textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);

    const count = document.createElement("span");
    count.className = "top-day-count";
    count.textContent = peopleLabel(names.length);

    const nameList = document.createElement("span");
    nameList.className = "top-day-names";
    nameList.textContent = names.join(", ");

    button.append(rank, dateLabel, count, nameList);
    button.addEventListener("click", () => selectDate(date, dateKey));
    topDaysList.append(button);
  });
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
      const count = document.createElement("span");
      count.className = "people-count";
      count.textContent = names.length;
      count.setAttribute("aria-hidden", "true");
      button.append(count);

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
  renderTopDays();
  loadAvailability();
}

function selectDate(date, dateKey) {
  selectedDate = dateKey;
  const names = namesForDate(dateKey);
  formTitle.textContent = capitalize(dateFormatter.format(date));
  selectedDateCopy.textContent = names.length
    ? `Уже свободны: ${names.join(", ")}. Добавьте своё имя.`
    : "Пока никто не отметился. Добавьте своё имя.";
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
    renderTopDays();
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
window.setInterval(() => loadAvailability({ silent: true }), 5000);

updateMonthHeader();
renderCalendar();
renderTopDays();
loadAvailability();
