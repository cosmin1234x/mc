/* =========================
   McCrew AI — Playmobil Animals (Interactive)
   ========================= */

// --- Demo Data (edit or replace with real API/DB) ---
const store = {
  employees: [
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
  { topic: "Happy Meal — Playmobil Animals", keywords:["happy meal","toy","playmobil","animals"], answer:
    `• Promo toys: Playmobil Animals (availability varies by store/region).
• Keep toys & inserts tidy in the designated storage; rotate by current week.
• If asked about toy choice/exchanges, follow store policy and manager guidance.
• Always hand out the correct toy safely; remove any loose packaging hazards.
• For any complaints or shortages, escalate to a manager.` },
  { topic: "Uniform Policy", keywords:["uniform","dress","appearance"], answer:
    `• Clean full uniform, name badge visible.
• No smart watches/rings by food prep.
• Hair tied, beard nets where required.
• Black, non-slip shoes.
• Follow local store/brand standards.` },
  { topic: "Lateness Policy", keywords:["late","lateness","timekeeping"], answer:
    `• Call the store/manager ASAP if running late.
• Arrivals >5 min late may be logged.
• 3 lateness events in a period triggers a review.
• Repeated issues may affect scheduling.` },
  { topic: "Breaks", keywords:["break","rest","meal"], answer:
    `• UK guidance: 20-min uninterrupted break if working >6 hours.
• Ask a manager to schedule the break considering rush periods.
• No eating in customer area while on duty.` },
  { topic: "Food Safety / Allergens", keywords:["allergen","safety","food","ccp"], answer:
    `• Strict handwashing between tasks.
• Keep raw/ready-to-eat separate.
• Label and hold times must be followed.
• For allergen queries, always use official charts & confirm with manager.` },
  { topic: "Cleaning Chemicals", keywords:["chemical","clean","safety","msds"], answer:
    `• Wear PPE.
• Never mix chemicals.
• Follow dilution/soak times on label.
• Store securely; report spills immediately.` },
  { topic: "Fry Station — Setup", keywords:["fry","fries","vat","setup"], answer:
    `• Check oil level & temperature (target per spec).
• Skim oil, insert baskets, confirm timers.
• Use correct cook times & salting procedure.
• Filter oil per schedule; record in log.` },
  { topic: "Sandwich Build — Big Mac", keywords:["big mac","build","assemble","burger"], answer:
    `• Toast 3-part bun; sauce + onions + lettuce; cheese + patty on heel; club + sauce + lettuce + pickles; top patty; crown. Wrap per spec.` },
  { topic: "Training & e-Learning", keywords:["train","training","learn","module"], answer:
    `• Follow station checklists.
• Shadow a trained crew.
• Complete e-learning modules & sign-offs.
• Ask manager for station certification.` },
];

// --- Utils ---
function todayISO(){ return new Date().toISOString().slice(0,10); }
function offsetDate(days){ const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function toMinutes(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function minutesToHrs(min){ return (min/60).toFixed(2); }
function nextFridayISO(){ const d=new Date(); const day=d.getDay(); const add=(5-day+7)%7||7; d.setDate(d.getDate()+add); return d.toISOString().slice(0,10); }
function paydayAfter(dateISO, freq){
  const d = new Date(dateISO+"T00:00:00");
  if (freq==="weekly") d.setDate(d.getDate()+7);
  else if (freq==="biweekly") d.setDate(d.getDate()+14);
  else if (freq==="monthly") d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}
function contains(text, arr){ return arr.some(a=>text.includes(a)); }
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

// Persist demo data
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
const drawer = document.getElementById("drawer");
const openDrawerBtn = document.getElementById("openDrawer");
const closeDrawerBtn = document.getElementById("closeDrawer");
const fxCanvas = document.getElementById("fx");

// Admin fields
const aEmpId = document.getElementById("aEmpId");
const aName  = document.getElementById("aName");
const aRate  = document.getElementById("aRate");
const addEmpBtn = document.getElementById("addEmp");
const empTable = document.getElementById("empTable");
const payFreq = document.getElementById("payFreq");
const nextPayday = document.getElementById("nextPayday");
const savePayConfig = document.getElementById("savePayConfig");

// --- FX: simple confetti ---
const fx = fxCanvas.getContext('2d');
let confettiActive = false, confettiPieces = [];
function resizeFx(){ fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; }
addEventListener('resize', resizeFx); resizeFx();

function startConfetti(ms=1400){
  const n = 120;
  confettiPieces = [];
  for(let i=0;i<n;i++){
    confettiPieces.push({
      x: Math.random()*fxCanvas.width,
      y: -20 - Math.random()*fxCanvas.height*0.3,
      r: 4 + Math.random()*5,
      vy: 2+Math.random()*3,
      vx: -1.5 + Math.random()*3,
      rot: Math.random()*Math.PI,
      vr: -0.2 + Math.random()*0.4,
      color: `hsl(${Math.random()*360},90%,60%)`,
      shape: Math.random()<0.5?'rect':'circ'
    });
  }
  if(!confettiActive){ confettiActive = true; requestAnimationFrame(tickConfetti); }
  setTimeout(()=>{ confettiActive=false; }, ms);
}
function tickConfetti(){
  fx.clearRect(0,0,fxCanvas.width,fxCanvas.height);
  confettiPieces.forEach(p=>{
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    if (p.y > fxCanvas.height+20) { p.y = -20; p.x = Math.random()*fxCanvas.width; }
    fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot);
    fx.fillStyle = p.color;
    if (p.shape==='rect'){ fx.fillRect(-p.r, -p.r, p.r*2, p.r*2); }
    else { fx.beginPath(); fx.arc(0,0,p.r,0,Math.PI*2); fx.fill(); }
    fx.restore();
  });
  if(confettiActive) requestAnimationFrame(tickConfetti);
}

// Populate KB topics
KB.forEach(item=>{
  const li = document.createElement("li");
  li.textContent = item.topic;
  li.addEventListener("click", ()=>{
    pushUser(`Tell me about ${item.topic}`);
    answerText(item.answer);
    if (item.topic.includes("Happy Meal")) startConfetti();
  });
  kbList.appendChild(li);
});

// Quick buttons + suggestion chips
document.querySelectorAll(".quick, .chip").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const msg = btn.dataset.msg;
    pushUser(msg);
    handleMessage(msg);
  });
});

// Drawer controls
openDrawerBtn.addEventListener("click", ()=> drawer.classList.add("open"));
closeDrawerBtn.addEventListener("click", ()=> drawer.classList.remove("open"));
drawer.addEventListener("click", (e)=>{
  const card = e.target.closest(".toy-card");
  if(!card) return;
  const which = card.dataset.animal;
  toyExplain(which);
});

// Animal stage interactions
const animalMap = {
  lion:  { el: document.querySelector(".a-lion"),  msg: "Lion — brave & bouncy. Follow weekly rotation and stock checks." },
  panda: { el: document.querySelector(".a-panda"), msg: "Panda — guest favourite. Keep inserts together; avoid loose packaging." },
  fox:   { el: document.querySelector(".a-fox"),   msg: "Fox — quick kit. For swaps, follow store policy & manager guidance." },
  giraffe:{ el: document.querySelector(".a-giraffe"), msg:"Giraffe — tall fun. Rotate boxes by current promo week." },
};
Object.entries(animalMap).forEach(([key, obj])=>{
  obj.el.addEventListener("click", ()=>{
    drawer.classList.add("open");
    toyExplain(key);
  });
});
function toyExplain(key){
  const animal = key[0].toUpperCase()+key.slice(1);
  pushUser(`${animal} toy info`);
  answerHTML(`<p><b>${animal}</b> — ${escapeHtml(animalMap[key].msg)}</p>`);
  startConfetti();
}

// Admin modal
openAdminBtn.addEventListener("click", ()=>{ adminModal.showModal(); renderEmpTable(); initPayConfigFields(); });
adminModal.addEventListener("close", ()=>saveToLS());

addEmpBtn.addEventListener("click", ()=>{
  const id = aEmpId.value.trim(); if(!id) return;
  const name = aName.value.trim() || `Crew ${id}`;
  const rate = parseFloat(aRate.value||"0") || 11.44; // demo default
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

// --- AI Router (intent rules) ---
function handleMessage(raw){
  const text = raw.toLowerCase();

  // Slash commands
  if (text.startsWith("/shift"))    return handleShift();
  if (text.startsWith("/pay"))      return handleTodayPay();
  if (text.startsWith("/nextpay"))  return handleNextPay();

  // If user included an ID like "/shift 1234"
  const idInMsg = (raw.match(/\b\d{3,6}\b/g)||[])[0] || "";

  // Intents
  if (contains(text,["shift","rota","schedule"])) {
    return handleShift(idInMsg);
  }
  if (contains(text,["pay","paycheck","wage","salary","how much i made","how much did i make","today’s pay","todays pay"])) {
    return handleTodayPay(idInMsg);
  }
  if (contains(text,["next pay","next paycheck","payday"])) {
    return handleNextPay();
  }

  // Mini “checklist” interaction for fryer
  if (text.includes("fryer") && text.includes("checklist")){
    return answerHTML(`<p><b>Fryer Filtering Checklist</b></p>
      <ol>
        <li>Wear PPE (gloves/apron).</li>
        <li>Set to filter; confirm temperature & signage.</li>
        <li>Scrape & skim, then filter per spec time.</li>
        <li>Wipe surrounds; record in log.</li>
      </ol>`);
  }

  // Knowledge Base match
  const kb = KB.find(k=>k.keywords.some(kw=>text.includes(kw)));
  if (kb){
    answerHTML(`<p><b>${kb.topic}</b></p><p>${escapeHtml(kb.answer).replace(/\n/g,"<br>")}</p>`);
    if (kb.topic.includes("Happy Meal")) startConfetti();
    return;
  }

  // Fallback
  return answerHTML(`<p>I can help with:</p>
  <ul>
    <li><code>/shift</code> – see today’s shift</li>
    <li><code>/pay</code> – estimate today’s pay</li>
    <li><code>/nextpay</code> – next paycheck date</li>
    <li>Ask: “Happy Meal — Playmobil Animals”, “uniform policy”, “fry station setup”</li>
  </ul>`);
}

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
  const nightPremium = shift.end >= "22:00" ? 0.5 * hours : 0; // demo only
  const est = base + nightPremium;
  answerHTML(`<p><b>Estimated Pay for Today</b></p>
    <p>${emp.name}: £${est.toFixed(2)} (rate £${emp.hourlyRate.toFixed(2)}/hr, ${hours.toFixed(2)} hrs)</p>
    <small>Demo estimate only. Actual pay depends on timeclock, premiums, breaks, taxes, etc.</small>`);
  startConfetti(900);
}

function handleNextPay(){
  const { frequency, nextPayday } = store.payConfig;
  const today = todayISO();
  let next = nextPayday;
  if (today > nextPayday){
    let tmp = nextPayday;
    while (tmp <= today){ tmp = paydayAfter(tmp, frequency); }
    next = tmp;
    store.payConfig.nextPayday = next; saveToLS();
  }
  const after = paydayAfter(next, frequency);
  answerHTML(`<p><b>Next Paycheck</b></p>
    <p>Next payday: <b>${next}</b> • Frequency: <b>${frequency}</b></p>
    <p>Following payday: ${after}</p>`);
  startConfetti(900);
}

// Tip once
notify(`Interactive Playmobil Animals theme loaded. Click animals, open the toy drawer, or try the quick actions.`);

// --- End ---
