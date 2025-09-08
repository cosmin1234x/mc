/* =========================
   McCrew AI (Client-side demo)
   ========================= */

// --- Demo Data (edit or replace with real API/DB) ---
const store = {
  employees: [
    // id, name, hourlyRate, plannedShifts: [{date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM'}]
    { id: "1234", name: "Alex", hourlyRate: 11.5, plannedShifts: [
      { date: offsetDate(0), start:"09:00", end:"17:00" },
      { date: offsetDate(1), start:"12:00", end:"20:00" },
    ]},
    { id: "5678", name: "Sam", hourlyRate: 12.1, plannedShifts: [
      { date: offsetDate(0), start:"17:00", end:"23:00" },
      { date: offsetDate(2), start:"08:00", end:"16:00" },
    ]},
  ],
  payConfig: { frequency: "biweekly", nextPayday: nextFridayISO() },
};

// Knowledge Base — short, editable items
const KB = [
  { topic: "Uniform Policy", keywords:["uniform","dress","appearance"], answer:
    `• Clean full uniform, name badge visible.\n• No smart watches/rings by food prep.\n• Hair tied, beard nets where required.\n• Black, non-slip shoes.\n• Follow local store/brand standards.` },
  { topic: "Lateness Policy", keywords:["late","lateness","timekeeping"], answer:
    `• Call the store/manager ASAP if running late.\n• Arrivals >5 min late may be logged.\n• 3 lateness events in a period triggers a review.\n• Repeated issues may affect scheduling.` },
  { topic: "Breaks", keywords:["break","rest","meal"], answer:
    `• UK guidance: 20-min uninterrupted break if working >6 hours.\n• Ask a manager to schedule the break considering rush periods.\n• No eating in customer area while on duty.` },
  { topic: "Food Safety / Allergens", keywords:["allergen","safety","food","ccp"], answer:
    `• Strict handwashing between tasks.\n• Keep raw/ready-to-eat separate.\n• Label and hold times must be followed.\n• For allergen queries, always use official charts & confirm with manager.` },
  { topic: "Cleaning Chemicals", keywords:["chemical","clean","safety","msds"], answer:
    `• Wear PPE.\n• Never mix chemicals.\n• Follow dilution/soak times on label.\n• Store securely; report spills immediately.` },
  { topic: "Fry Station — Setup", keywords:["fry","fries","vat","setup"], answer:
    `• Check oil level & temperature (target per spec).\n• Skim oil, insert baskets, confirm timers.\n• Use correct cook times & salting procedure.\n• Filter oil per schedule; record in log.` },
  { topic: "Sandwich Build — Big Mac", keywords:["big mac","build","assemble","burger"], answer:
    `• Toast 3-part bun; sauce + onions + lettuce; cheese + patty on heel; club + sauce + lettuce + pickles; top patty; crown. Wrap per spec.` },
  { topic: "Training & e-Learning", keywords:["train","training","learn","module"], answer:
    `• Follow station checklists.\n• Shadow a trained crew.\n• Complete e-learning modules & sign-offs.\n• Ask manager for station certification.` },
];

// --- Utils ---
function todayISO(){ return new Date().toISOString().slice(0,10); }
function offsetDate(days){
  const d = new Date(); d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function toMinutes(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function minutesToHrs(min){ return (min/60).toFixed(2); }
function nextFridayISO(){
  const d = new Date();
  const day = d.getDay(); // 0=Sun ... 5=Fri
  const add = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate()+add);
  return d.toISOString().slice(0,10);
}
function paydayAfter(dateISO, freq){
  const d = new Date(dateISO+"T00:00:00");
  if (freq==="weekly") d.setDate(d.getDate()+7);
  else if (freq==="biweekly") d.setDate(d.getDate()+14);
  else if (freq==="monthly") d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}

// Persist demo data (optional)
const LS_KEY = "mccrew_ai_demo";
(function loadFromLS(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if (parsed.employees) store.employees = parsed.employees;
    if (parsed.payConfig) store.payConfig = parsed.payConfig;
  }catch{}
})();
function saveToLS(){ localStorage.setItem(LS_KEY, JSON.stringify(store)); }

// --- UI elements ---
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatText = document.getElementById("chatText");
const kbList  = document.getElementById("kbList");
const empIdInput = document.getElementById("empId");
const adminModal = document.getElementById("adminModal");
const openAdminBtn = document.getElementById("openAdmin");

// Admin fields
const aEmpId = document.getElementById("aEmpId");
const aName  = document.getElementById("aName");
const aRate  = document.getElementById("aRate");
const addEmpBtn = document.getElementById("addEmp");
const empTable = document.getElementById("empTable");
const payFreq = document.getElementById("payFreq");
const nextPayday = document.getElementById("nextPayday");
const savePayConfig = document.getElementById("savePayConfig");

// Populate KB topics
KB.forEach(item=>{
  const li = document.createElement("li");
  li.textContent = item.topic;
  li.addEventListener("click", ()=>{
    pushUser(`Tell me about ${item.topic}`);
    answerText(item.answer);
  });
  kbList.appendChild(li);
});

// Quick buttons
document.querySelectorAll(".quick").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const msg = btn.dataset.msg;
    pushUser(msg);
    handleMessage(msg);
  });
});

// Admin modal
openAdminBtn.addEventListener("click", ()=>{ adminModal.showModal(); renderEmpTable(); initPayConfigFields(); });
adminModal.addEventListener("close", ()=>saveToLS());

addEmpBtn.addEventListener("click", ()=>{
  const id = aEmpId.value.trim(); if(!id) return;
  const name = aName.value.trim() || `Crew ${id}`;
  const rate = parseFloat(aRate.value||"0") || 11.44; // UK NMW/nearby demo
  const existing = store.employees.find(e=>e.id===id);
  if(existing){ existing.name=name; existing.hourlyRate=rate; }
  else store.employees.push({ id, name, hourlyRate: rate, plannedShifts: [] });
  aEmpId.value=aName.value=aRate.value="";
  renderEmpTable(); saveToLS();
});

savePayConfig.addEventListener("click", ()=>{
  store.payConfig.frequency = payFreq.value;
  store.payConfig.nextPayday = nextPayday.value || store.payConfig.nextPayday;
  saveToLS();
  notify(`Saved pay config: ${store.payConfig.frequency}, next payday ${store.payConfig.nextPayday}`);
});

function renderEmpTable(){
  const rows = store.employees.map(e=>(
    `<tr><td>${e.id}</td><td>${e.name}</td><td>£${e.hourlyRate.toFixed(2)}/hr</td><td>${e.plannedShifts?.length||0} shifts</td></tr>`
  )).join("");
  empTable.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Rate</th><th>Shifts</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="4">No employees yet</td></tr>`}</tbody>
    </table>`;
}
function initPayConfigFields(){
  payFreq.value = store.payConfig.frequency;
  nextPayday.value = store.payConfig.nextPayday;
}

// Chat form
chatForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const text = chatText.value.trim();
  if(!text) return;
  pushUser(text);
  chatText.value="";
  handleMessage(text);
});

function pushUser(text){
  const node = document.createElement("div");
  node.className = "user msg";
  node.innerHTML = `<p>${escapeHtml(text)}</p>`;
  chatLog.appendChild(node); chatLog.scrollTop = chatLog.scrollHeight;
}
function answerHTML(html){
  const node = document.createElement("div");
  node.className = "bot msg";
  node.innerHTML = html;
  chatLog.appendChild(node); chatLog.scrollTop = chatLog.scrollHeight;
}
function answerText(text){
  answerHTML("<p>"+escapeHtml(text).replace(/\n/g,"<br>")+"</p>");
}
function notify(text){ answerHTML(`<p>${escapeHtml(text)}</p>`); }

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

// --- AI Router (intent rules) ---
function handleMessage(raw){
  const text = raw.toLowerCase();

  // Slash commands (use ID from input if none provided)
  if (text.startsWith("/shift"))    return handleShift();
  if (text.startsWith("/pay"))      return handleTodayPay();
  if (text.startsWith("/nextpay"))  return handleNextPay();

  // If user included an ID like "/shift 1234"
  const idInMsg = (raw.match(/\b\d{3,6}\b/g)||[])[0] || "";

  // Heuristics for intents
  if (contains(text,["shift","rota","schedule"])) {
    return handleShift(idInMsg);
  }
  if (contains(text,["pay","paycheck","wage","salary","how much i made","how much did i make","today’s pay","todays pay"])) {
    return handleTodayPay(idInMsg);
  }
  if (contains(text,["next pay","next paycheck","payday"])) {
    return handleNextPay();
  }

  // Knowledge Base match by keywords
  const kb = KB.find(k=>k.keywords.some(kw=>text.includes(kw)));
  if (kb) return answerHTML(`<p><b>${kb.topic}</b></p><p>${escapeHtml(kb.answer).replace(/\n/g,"<br>")}</p>`);

  // Fallback small talk / guidance
  return answerHTML(`<p>I can help with:</p>
  <ul>
    <li><code>/shift</code> – see today’s shift</li>
    <li><code>/pay</code> – estimate today’s pay</li>
    <li><code>/nextpay</code> – next paycheck date</li>
    <li>Ask: “What is the uniform policy?”, “How to set up fry station?”</li>
  </ul>`);
}
function contains(text, arr){ return arr.some(a=>text.includes(a)); }

// --- Shift & Pay logic (demo) ---
function findEmployee(idMaybe){
  const id = (idMaybe || empIdInput.value || "").trim();
  if(!id) { notify("Add your Employee ID first (left panel)."); return null; }
  const emp = store.employees.find(e=>e.id===id);
  if(!emp){ notify(`No employee with ID ${id} in the demo data.`); return null; }
  return emp;
}
function handleShift(idMaybe){
  const emp = findEmployee(idMaybe); if(!emp) return;
  const today = todayISO();
  const shift = emp.plannedShifts?.find(s=>s.date===today);
  if(!shift){
    return answerText(`${emp.name}: No shift found for today (${today}). Ask a manager or check your scheduling app.`);
  }
  const durMin = toMinutes(shift.end)-toMinutes(shift.start);
  answerHTML(`<p><b>${emp.name} — Today’s Shift</b></p>
    <p>${shift.date} • ${shift.start}–${shift.end} (${minutesToHrs(durMin)} hrs)</p>`);
}

function handleTodayPay(idMaybe){
  const emp = findEmployee(idMaybe); if(!emp) return;
  const today = todayISO();
  const shift = emp.plannedShifts?.find(s=>s.date===today);
  if(!shift){
    return answerText(`${emp.name}: No shift today (${today}).`);
  }
  const durMin = toMinutes(shift.end)-toMinutes(shift.start);
  const hours = durMin/60;
  const base = hours * emp.hourlyRate;

  // Simple demo uplift for night premium (after 22:00) – extremely simplified
  const nightPremium = shift.end >= "22:00" ? 0.5 * hours : 0;

  const est = base + nightPremium;
  answerHTML(`<p><b>Estimated Pay for Today</b></p>
    <p>${emp.name}: £${est.toFixed(2)} (rate £${emp.hourlyRate.toFixed(2)}/hr, ${hours.toFixed(2)} hrs)</p>
    <small>Demo estimate only. Actual pay depends on timeclock, premiums, breaks, taxes, etc.</small>`);
}

function handleNextPay(){
  const { frequency, nextPayday } = store.payConfig;
  const today = todayISO();
  let next = nextPayday;
  if (today > nextPayday){
    // roll forward until in the future
    let tmp = nextPayday;
    while (tmp <= today){
      tmp = paydayAfter(tmp, frequency);
    }
    next = tmp;
    store.payConfig.nextPayday = next; saveToLS();
  }
  const after = paydayAfter(next, frequency);
  answerHTML(`<p><b>Next Paycheck</b></p>
    <p>Next payday: <b>${next}</b> • Frequency: <b>${frequency}</b></p>
    <p>Following payday: ${after}</p>`);
}

// --- Integration Guidance (displayed on / first time?) ---
notify(`Tip: you can wire this to real data by replacing the demo functions with:
• Your scheduling API (7shifts, Deputy, etc.)
• A Google Sheet (use Netlify Functions / simple API)
• Your payroll system’s read-only endpoints
`);

// --- End ---
