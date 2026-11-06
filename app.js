(() => {
  "use strict";
  const MOOD_CLASSES = { 1: "face-1", 2: "face-2", 3: "face-3", 4: "face-4", 5: "face-5" };
  const MOOD_NAMES = { 1: "とても悪い", 2: "悪い", 3: "普通", 4: "良い", 5: "とても良い" };
  const STORAGE_KEY = "mood-calendar-records-v1";
  const MONTHLY_MANUAL_KEY = "mood-calendar-monthly-manual-v1";
  const $ = (id) => document.getElementById(id);
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = dateKey(today);
  let selectedMood = null;
  let records = loadRecords();
  let manualMonthly = loadManualMonthly();
  let editingMonthKey = null;

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
  function loadManualMonthly() {
    try { const v = JSON.parse(localStorage.getItem(MONTHLY_MANUAL_KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
    catch (e) { return {}; }
  }
  function monthKey(year, monthIndex) { return `${year}-${String(monthIndex+1).padStart(2,"0")}`; }
  function monthAverage(key) {
    const vals = Object.entries(records).filter(([date, rec]) => date.startsWith(key + "-") && rec && Number.isFinite(Number(rec.mood)))
      .map(([, rec]) => Number(rec.mood) - 3);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }
  function monthLabel(key) { const [y,m] = key.split("-").map(Number); return `${y}年${m}月`; }
  function getMonthlyValue(key) {
    if (Object.prototype.hasOwnProperty.call(manualMonthly,key)) return {value:Number(manualMonthly[key]),manual:true};
    const avg = monthAverage(key); return avg === null ? null : {value:avg,manual:false};
  }
  function renderTrend() {
    const svg = $("moodChart"); if (!svg) return;
    const months=[]; const end=new Date(today.getFullYear(),today.getMonth(),1);
    for(let i=11;i>=0;i--){const d=new Date(end.getFullYear(),end.getMonth()-i,1);months.push(monthKey(d.getFullYear(),d.getMonth()));}
    const vals=months.map(k=>getMonthlyValue(k));
    const W=600,H=250,L=42,R=18,T=18,B=42, plotW=W-L-R, plotH=H-T-B;
    const y=v=>T+(2-v)/4*plotH; const x=i=>L+(months.length===1?plotW/2:i*plotW/(months.length-1));
    let markup='';
    [-2,-1,0,1,2].forEach(v=>{const yy=y(v);markup+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="chart-gridline"/><text x="${L-10}" y="${yy+4}" text-anchor="end" class="chart-axis-label">${v}</text>`;});
    const points=vals.map((v,i)=>v?`${x(i)},${y(v.value)}`:null);
    let segment=[]; const paths=[];
    points.forEach(p=>{if(p)segment.push(p);else if(segment.length){if(segment.length>1)paths.push(segment.join(" "));segment=[];}}); if(segment.length>1)paths.push(segment.join(" "));
    paths.forEach(d=>markup+=`<polyline points="${d}" class="chart-line"/>`);
    months.forEach((k,i)=>{
      const xx=x(i), v=vals[i], label=String(Number(k.slice(5)));
      markup+=`<text x="${xx}" y="${H-14}" text-anchor="middle" class="chart-month-label">${label}月</text>`;
      if(v){markup+=`<circle cx="${xx}" cy="${y(v.value)}" r="7" class="chart-point ${v.manual?'manual-point':''}" data-month="${k}" tabindex="0" role="button" aria-label="${monthLabel(k)}、${v.manual?'手動登録':'記録から計算'}、${v.value.toFixed(1)}。タップして管理値を編集"/>`;
      } else {markup+=`<circle cx="${xx}" cy="${y(0)}" r="7" class="chart-empty-point" data-month="${k}" tabindex="0" role="button" aria-label="${monthLabel(k)}、値なし。タップして管理値を登録"/>`;}
    });
    svg.innerHTML=markup;
    svg.querySelectorAll('[data-month]').forEach(el=>{const open=()=>openMonthlyEditor(el.dataset.month);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
    const current=vals[vals.length-1];
    $("trendSummary").textContent=current?`${monthLabel(months[months.length-1])}：${current.value.toFixed(2)}（${current.manual?'手動登録':'記録から計算'}）`:`${monthLabel(months[months.length-1])}：まだ記録がありません`;
  }
  function openMonthlyEditor(key) {
    const [year,month]=key.split('-').map(Number);
    if(new Date(year,month-1,1)>=new Date(today.getFullYear(),today.getMonth(),1)) {
      $("monthlyValueDescription").textContent='過去の月のみ手動登録できます。';
    } else { $("monthlyValueDescription").textContent=`${monthLabel(key)}の管理用の月平均値を登録します。`; }
    editingMonthKey=key;
    const exists=Object.prototype.hasOwnProperty.call(manualMonthly,key);
    const calculated=monthAverage(key);
    $("monthlyValueInput").value=exists?manualMonthly[key]:(calculated===null?'':calculated.toFixed(1));
    $("deleteMonthlyBtn").hidden=!exists;
    $("saveMonthlyBtn").disabled=new Date(year,month-1,1)>=new Date(today.getFullYear(),today.getMonth(),1);
    $("monthlyValueInput").disabled=$("saveMonthlyBtn").disabled;
    $("monthlyStatus").textContent=exists?'手動登録値を編集中です。':calculated===null?'この月に日々の記録はありません。':'現在の計算値を初期値として表示しています。';
    $("monthlyValueDialog").showModal();
  }
  function saveManualMonthly() {
    const raw=$("monthlyValueInput").value.trim();
    const value=Number(raw);
    if(raw===""||!Number.isFinite(value)||value < -2 || value > 2){$("monthlyStatus").textContent='-2.0〜2.0の範囲で入力してください。';return;}
    manualMonthly[editingMonthKey]=Math.round(value*10)/10;
    try{localStorage.setItem(MONTHLY_MANUAL_KEY,JSON.stringify(manualMonthly));$("monthlyValueDialog").close();renderTrend();}
    catch(e){$("monthlyStatus").textContent='登録できませんでした。ブラウザーの空き容量をご確認ください。';}
  }
  function deleteManualMonthly() {
    if(!editingMonthKey)return; delete manualMonthly[editingMonthKey];
    try{localStorage.setItem(MONTHLY_MANUAL_KEY,JSON.stringify(manualMonthly));$("monthlyValueDialog").close();renderTrend();}
    catch(e){$("monthlyStatus").textContent='解除を保存できませんでした。';}
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
      if (rec && typeof rec.note === "string" && rec.note.trim().length > 0) {
        const noteDot = document.createElement("span");
        noteDot.className = "note-dot";
        noteDot.setAttribute("aria-label", "一言メモあり");
        noteDot.title = "一言メモあり";
        btn.append(noteDot);
      }
      btn.addEventListener("click", () => {
        selectedDate = key;
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        renderCalendar();
        loadSelectedRecord();
        if (!$ ("entryDialog").open) $("entryDialog").showModal();
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
      renderTrend();
      $("entryDialog").close();
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
      renderTrend();
      $("statusMessage").textContent = "記録を削除しました。";
    } catch (e) {
      $("statusMessage").textContent = "削除を保存できませんでした。";
    }
  });
  $("closeEntryBtn").addEventListener("click", () => $("entryDialog").close());
  $("entryDialog").addEventListener("click", (event) => { if (event.target === $("entryDialog")) $("entryDialog").close(); });
  $("saveMonthlyBtn").addEventListener("click", saveManualMonthly);
  $("deleteMonthlyBtn").addEventListener("click", deleteManualMonthly);
  $("closeMonthlyBtn").addEventListener("click", () => $("monthlyValueDialog").close());
  $("monthlyValueDialog").addEventListener("click", event => { if(event.target === $("monthlyValueDialog")) $("monthlyValueDialog").close(); });
  $("prevMonth").addEventListener("click", () => moveMonth(-1));
  $("nextMonth").addEventListener("click", () => moveMonth(1));
  $("todayBtn").addEventListener("click", () => {
    viewYear = today.getFullYear(); viewMonth = today.getMonth(); selectedDate = dateKey(today);
    renderCalendar(); loadSelectedRecord();
    $("entryDialog").showModal();
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
  renderCalendar();
  renderTrend();
  loadSelectedRecord();
  $("entryDialog").close();
})();
