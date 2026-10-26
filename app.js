(() => {
  "use strict";
  const MOOD_CLASSES = { 1: "face-1", 2: "face-2", 3: "face-3", 4: "face-4", 5: "face-5" };
  const MOOD_NAMES = { 1: "とても悪い", 2: "悪い", 3: "普通", 4: "良い", 5: "とても良い" };
  const STORAGE_KEY = "mood-calendar-records-v1";
  const $ = (id) => document.getElementById(id);
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = dateKey(today);
  let selectedMood = null;
  let records = loadRecords();

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function parseDate(key) {
    const [y,m,d] = key.split("-").map(Number);
    return new Date(y, m-1, d);
  }
  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      $("statusMessage").textContent = "保存しました。";
      $("savedBadge").hidden = false;
      return true;
    } catch (e) {
      $("statusMessage").textContent = "保存できませんでした。ブラウザーの空き容量や設定をご確認ください。";
      return false;
    }
  }
  function renderCalendar() {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(viewYear, viewMonth, 1 - first.getDay());
    $("monthTitle").textContent = `${viewYear}年${viewMonth+1}月`;
    const grid = $("calendarGrid");
    grid.replaceChildren();
    for (let i=0; i<42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
      const key = dateKey(d);
      const rec = records[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-day";
      if (d.getMonth() !== viewMonth) btn.classList.add("other-month");
      if (key === dateKey(today)) btn.classList.add("today");
      if (key === selectedDate) btn.classList.add("selected");
      btn.setAttribute("aria-label", `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日${rec ? "、気分："+MOOD_NAMES[rec.mood] : "、記録なし"}`);
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = d.getDate();
      btn.append(number);
      const mood = document.createElement("span");
      mood.className = "day-mood";
      if (rec) { const face = document.createElement("img"); face.className = `face ${MOOD_CLASSES[rec.mood] || "face-3"}`; face.src = `./mood-${Number(rec.mood) || 3}.svg`; face.alt = ""; face.setAttribute("aria-hidden", "true"); mood.append(face); }
      btn.append(mood);
      btn.addEventListener("click", () => {
        selectedDate = key;
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        renderCalendar();
        loadSelectedRecord();
      });
      grid.append(btn);
    }
  }
  function renderMoodButtons() {
    document.querySelectorAll(".mood-btn").forEach(btn => {
      const active = Number(btn.dataset.mood) === selectedMood;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }
  function loadSelectedRecord() {
    const d = parseDate(selectedDate);
    $("entryTitle").textContent = `${d.getMonth()+1}月${d.getDate()}日の気分`;
    const rec = records[selectedDate];
    selectedMood = rec ? Number(rec.mood) : null;
    $("noteInput").value = rec ? (rec.note || "") : "";
    $("savedBadge").hidden = !rec;
    $("deleteBtn").hidden = !rec;
    $("saveBtn").disabled = !selectedMood;
    $("statusMessage").textContent = rec ? "記録を読み込みました。" : "まだ記録がありません。";
    renderMoodButtons();
  }
  function moveMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  }
  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedMood = Number(btn.dataset.mood);
      renderMoodButtons();
      $("saveBtn").disabled = false;
      $("statusMessage").textContent = "";
      $("savedBadge").hidden = true;
    });
  });
  $("saveBtn").addEventListener("click", () => {
    if (!selectedMood) return;
    records[selectedDate] = { mood: selectedMood, note: $("noteInput").value.trim(), updatedAt: new Date().toISOString() };
    if (persist()) {
      $("deleteBtn").hidden = false;
      renderCalendar();
    }
  });
  $("deleteBtn").addEventListener("click", () => {
    if (!records[selectedDate]) return;
    if (!window.confirm("この日の記録を削除しますか？")) return;
    delete records[selectedDate];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      loadSelectedRecord();
      renderCalendar();
      $("statusMessage").textContent = "記録を削除しました。";
    } catch (e) {
      $("statusMessage").textContent = "削除を保存できませんでした。";
    }
  });
  $("prevMonth").addEventListener("click", () => moveMonth(-1));
  $("nextMonth").addEventListener("click", () => moveMonth(1));
  $("todayBtn").addEventListener("click", () => {
    viewYear = today.getFullYear(); viewMonth = today.getMonth(); selectedDate = dateKey(today);
    renderCalendar(); loadSelectedRecord();
  });
  $("installHelpBtn").addEventListener("click", () => {
    $("installHelp").hidden = !$("installHelp").hidden;
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
  renderCalendar();
  loadSelectedRecord();
})();
