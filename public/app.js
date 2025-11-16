/* McCrew AI — ask.js (dark UI, role-aware, server-claim enforced)
   Full working script – complete version including:
   - Auth integration
   - Crew/Manager roles
   - Admin panel (employees + pay config)
   - Break timers
   - Shift/pay/week/swap/quiz
   - Knowledge base
   - OpenAI server call: askAI()
   - Action handler for AI commands
*/

(() => {

  /* -------------------- ROLE HANDLING -------------------- */
  function getRole() {
    const r = localStorage.getItem("mccrew_role");
    return (r === "manager") ? "manager" : "crew";
  }

  function applyRoleUI() {
    const role = getRole();
    const adminBtn = document.getElementById("openAdmin");
    const aiBtn    = document.getElementById("openAISettings");
    const show = (role === "manager");

    if (adminBtn) adminBtn.style.display = show ? "inline-block" : "none";
    if (aiBtn)    aiBtn.style.display    = show ? "inline-block" : "none";
  }


  /* -------------------- AUTH HEADER -------------------- */
  async function setupHeaderFromAuth() {
    try{
      if (!window.NF || !NF.getUserSafe) return;
      const user = await NF.getUserSafe();
      if (!user) return;

      const who = document.getElementById("userName");
      const first = (user.raw?.name || user.email || "Crew").split(" ")[0];
      if (who) who.textContent = `Hello, ${first} 👋`;

      const pic = document.getElementById("userPic");
      const avatar = user.raw?.picture || user.raw?.avatar || "";
      if (pic && avatar) { pic.src = avatar; pic.style.display = "block"; }

      const logoutBtn = document.getElementById("logout");
      if (logoutBtn) {
        logoutBtn.style.display = "inline-block";
        logoutBtn.onclick = (e)=>{ e.preventDefault(); NF.signOut("/"); };
      }
    }catch(e){ console.warn("[Auth]", e); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupHeaderFromAuth();
    applyRoleUI();
    respondText("Ready. Ask about shifts, pay, breaks, policies, or menu — or use /help.");

    try {
      const saved = localStorage.getItem("mccrew_emp_id");
      const empIdInput = document.getElementById("empId");
      if (saved && empIdInput) empIdInput.value = saved;

      empIdInput?.addEventListener("change", ()=>{
        try{ localStorage.setItem("mccrew_emp_id", empIdInput.value.trim()); }catch{}
      });
    }catch{}
  });

  window.addEventListener("nf-ready", () => {
    setupHeaderFromAuth();
    applyRoleUI();
  });


  /* -------------------- STORE (DEMO DATA) -------------------- */
  const store = {
    employees: [
      { id: "1234", name: "Alex", hourlyRate: 11.5, plannedShifts: [
        { date: offsetDate(0), start:"09:00", end:"17:00" },
        { date: offsetDate(2), start:"12:00", end:"20:00" },
      ]},
      { id: "5678", name: "Sam", hourlyRate: 12.1, plannedShifts: [
        { date: offsetDate(0), start:"17:00", end:"23:00" },
        { date: offsetDate(3), start:"08:00", end:"16:00" },
      ]},
    ],
    payConfig: { frequency: "biweekly", nextPayday: nextFridayISO() },
    swaps: []
  };


  /* -------------------- KNOWLEDGE BASE -------------------- */
  const KB = [
    { topic:"Uniform Policy", keywords:["uniform","dress","appearance"], answer:
      `• Clean full uniform, name badge visible.
• No smart watches/rings by food prep.
• Hair tied, beard nets where required.
• Black, non-slip shoes.
• Follow local store/brand standards.` },

    { topic:"Lateness Policy", keywords:["late","lateness"], answer:
      `• Call the store/manager ASAP if running late.
• Arrivals >5 min late may be logged.
• 3 lateness events trigger a review.
• Repeated issues may affect scheduling.` },

    { topic:"Breaks", keywords:["break","rest","meal"], answer:
      `• Typical UK crew: 20-min break if shift > 4.5–6 hrs.
• Ask a manager to schedule around rush.
• No eating in customer area while on duty.` },

    { topic:"Food Safety / Allergens", keywords:["allergen","safety","food"], answer:
      `• Strict handwashing between tasks.
• Keep raw/ready-to-eat separate.
• Follow label/hold times.
• Use official allergen charts.` },
  ];


  /* -------------------- TRAINING QUIZ -------------------- */
  const QUIZ_QUESTIONS = [
    { q:"How long should proper handwashing take?", a:["10s","20s","Until dry"], correct:1 },
    { q:"If a guest asks allergens?", a:["Guess","Use allergen charts","Say everything is GF"], correct:1 },
    { q:"Which shoes allowed?", a:["White","Black non-slip","Sandals"], correct:1 },
    { q:"After 3 lateness events?", a:["Nothing","Review","Termination"], correct:1 },
    { q:"Filtering fryers?", a:["Mix chemicals","Wear PPE + follow spec","Skip logs"], correct:1 },
  ];
  let quiz = null;


  /* -------------------- UTILS -------------------- */
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function offsetDate(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
  function toMinutes(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
  function minutesToHrs(min){ return (min/60).toFixed(2); }
  function nextFridayISO(){
    const d=new Date(); const day=d.getDay();
    const add=(5-day+7)%7 || 7; d.setDate(d.getDate()+add);
    return d.toISOString().slice(0,10);
  }
  function paydayAfter(dateISO, freq){
    const d=new Date(dateISO+"T00:00:00");
    if(freq==="weekly") d.setDate(d.getDate()+7);
    if(freq==="biweekly") d.setDate(d.getDate()+14);
    if(freq==="monthly") d.setMonth(d.getMonth()+1);
    return d.toISOString().slice(0,10);
  }
  const escapeHTML = s => s.replace(/[&<>"']/g,m=>({ "&": "&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"}[m]));


  /* -------------------- LOCAL PERSISTENCE -------------------- */
  const LS_KEY = "mccrew_ai_personal_v1";
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const data = JSON.parse(raw);
      ["employees","payConfig","swaps"].forEach(k=>{
        if(data[k]) store[k] = data[k];
      });
    }
  }catch{}
  const persist = ()=> localStorage.setItem(LS_KEY, JSON.stringify(store));


  /* -------------------- DOM REFS -------------------- */
  const chatLog  = document.getElementById("chatLog");
  const chatForm = document.getElementById("chatForm");
  const chatText = document.getElementById("chatText");
  const empIdInput = document.getElementById("empId");
  const kbList = document.getElementById("kbList");

  const adminModal = document.getElementById("adminModal");
  const openAdminBtn = document.getElementById("openAdmin");
  const closeAdminBtn = document.getElementById("closeAdmin");

  const aEmpId = document.getElementById("aEmpId");
  const aName  = document.getElementById("aName");
  const aRate  = document.getElementById("aRate");
  const addEmpBtn = document.getElementById("addEmp");
  const empTable = document.getElementById("empTable");

  const payFreq = document.getElementById("payFreq");
  const nextPayday = document.getElementById("nextPayday");
  const savePayConfig = document.getElementById("savePayConfig");


  /* -------------------- KNOWLEDGE BASE LIST -------------------- */
  if (kbList){
    KB.forEach(item=>{
      const li = document.createElement("li");
      li.textContent = item.topic;
      li.onclick = ()=>{
        pushUser(`Tell me about ${item.topic}`);
        respondHTML(`
          <p><b>${item.topic}</b></p>
          <p>${escapeHTML(item.answer).replace(/\n/g,"<br>")}</p>
        `);
      };
      kbList.appendChild(li);
    });
  }


  /* -------------------- ADMIN PANEL -------------------- */
  openAdminBtn?.addEventListener("click", e=>{
    if (getRole() !== "manager") {
      e.preventDefault();
      return respondText("Manager access only.");
    }
    adminModal.showModal();
    renderEmpTable();
    initPayConfigFields();
  });

  closeAdminBtn?.addEventListener("click", ()=> adminModal.close());
  adminModal?.addEventListener("cancel", e=>{ e.preventDefault(); adminModal.close(); });
  adminModal?.addEventListener("close", persist);

  addEmpBtn?.addEventListener("click", ()=>{
    const id = (aEmpId.value||"").trim();
    if(!id) return;

    const name = (aName.value||"").trim() || (`Crew ${id}`);
    const rate = parseFloat(aRate.value||"0") || 11.44;

    const ex = store.employees.find(e=>e.id===id);
    if (ex){ ex.name=name; ex.hourlyRate=rate; }
    else store.employees.push({ id, name, hourlyRate:rate, plannedShifts:[] });

    aEmpId.value=""; aName.value=""; aRate.value="";
    renderEmpTable();
    persist();
    respondText("Employee saved.");
  });

  savePayConfig?.addEventListener("click", ()=>{
    store.payConfig.frequency = payFreq.value;
    store.payConfig.nextPayday = nextPayday.value;
    persist();
    respondText("Pay settings updated.");
  });

  function renderEmpTable(){
    if (!empTable) return;
    const rows = store.employees.map(e=>`
      <tr>
        <td>${e.id}</td>
        <td>${escapeHTML(e.name)}</td>
        <td>£${e.hourlyRate.toFixed(2)}</td>
        <td>${e.plannedShifts.length}</td>
      </tr>
    `).join("");
    empTable.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Rate</th><th>Shifts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function initPayConfigFields(){
    payFreq.value = store.payConfig.frequency;
    nextPayday.value = store.payConfig.nextPayday;
  }


  /* -------------------- CHAT ELEMENTS -------------------- */
  chatForm?.addEventListener("submit", e=>{
    e.preventDefault();
    const text = chatText.value.trim();
    if (!text) return;
    chatText.value="";
    handleInput(text);
  });

  function pushUser(text){
    const node = document.createElement("div");
    node.className = "user msg";
    node.innerHTML = `<p>${escapeHTML(text)}</p>`;
    chatLog.appendChild(node);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function typingBubble(){
    const node = document.createElement("div");
    node.className = "bot msg";
    node.innerHTML = `<p class="typing"><span>Typing</span></p>`;
    chatLog.appendChild(node);
    chatLog.scrollTop = chatLog.scrollHeight;
    return node;
  }
  function respondHTML(html){
    const b = typingBubble();
    setTimeout(()=> b.innerHTML = html, 150);
  }
  function respondText(text){
    respondHTML(`<p>${escapeHTML(text).replace(/\n/g,"<br>")}</p>`);
  }


  /* -------------------- COMMAND ROUTER -------------------- */
  async function handleInput(raw){
    const text = raw.trim();
    const low = text.toLowerCase();

    pushUser(raw);

    /* QUIZ INPUT */
    if (quiz && quiz.active && !low.startsWith("/")) {
      const pick = text.trim()[0]?.toLowerCase();
      const idx = "abc123".indexOf(pick);
      if (idx !== -1){
        const mapped = idx % 3;
        const curr = QUIZ_QUESTIONS[quiz.idx];
        const ok = (mapped === curr.correct);

        respondText(ok ? "Correct!" : `Not quite — correct answer: ${curr.a[curr.correct]}`);

        quiz.idx++;
        if (ok) quiz.score++;

        if (quiz.idx >= QUIZ_QUESTIONS.length){
          respondText(`Quiz complete! Score: ${quiz.score}/5`);
          quiz = null;
        } else askQuizQuestion();
        return;
      }
    }


    /* SLASH COMMANDS */
    if (low.startsWith("/help")) return showHelp();
    if (low.startsWith("/shift")) return handleShift();
    if (low.startsWith("/week")) return handleWeek();
    if (low.startsWith("/pay")) return handleTodayPay();
    if (low.startsWith("/nextpay")) return handleNextPay();
    if (low.startsWith("/policy")) return handlePolicy(text);
    if (low.startsWith("/quiz")) return handleQuiz(text);
    if (low.startsWith("/quit")) { quiz=null; return respondText("Exited quiz."); }
    if (low.startsWith("/break")) return handleBreak(text);
    if (low.startsWith("/cancelbreak")) return cancelBreak();
    if (low.startsWith("/swap")) return handleSwap(text);
    if (low.startsWith("/swaps")) return listSwaps();


    /* TOPIC RESTRICTION */
    const coding = /\b(html|css|javascript|js|node|sql|code|script|program)\b/i;
    if (coding.test(low))
      return respondText("I can’t help with coding here — only McDonald's crew info.");

    const mcd = /(crew|shift|pay|break|policy|manager|uniform|station|menu|burger|fries|nuggets|big mac|fryer|allergen)/i;
    if (!mcd.test(low))
      return respondText("I only answer McDonald’s crew questions like shifts, pay, breaks, policies, food safety, and menu items.");

    /* KB QUICK MATCH */
    const match = bestKB(low);
    if (match)
      return respondHTML(`
        <p><b>${match.topic}</b></p>
        <p>${escapeHTML(match.answer).replace(/\n/g,"<br>")}</p>
      `);

    /* OPENAI */
    const reply = await askAI(text);
    if (!maybeHandleAction(reply)) respondText(reply);
  }


  /* -------------------- COMMAND FUNCTIONS -------------------- */
  function showHelp(){
    respondHTML(`
      <p><b>Commands:</b></p>
      <ul>
        <li>/shift</li>
        <li>/week</li>
        <li>/pay</li>
        <li>/nextpay</li>
        <li>/policy term</li>
        <li>/quiz start</li>
        <li>/break 20</li>
        <li>/swap 12:00-20:00</li>
      </ul>
    `);
  }


  function findEmployee() {
    const id = (empIdInput?.value||"").trim();
    if (!id){
      respondText("Add your Employee ID first (left panel).");
      return null;
    }
    const emp = store.employees.find(e=>e.id===id);
    if (!emp) {
      respondText(`Employee ID ${id} not found.`);
      return null;
    }
    return emp;
  }


  function handleShift(){
    const emp = findEmployee(); if (!emp) return;
    const today = todayISO();
    const s = emp.plannedShifts.find(x=>x.date === today);
    if (!s) return respondText("No shift today.");
    const mins = toMinutes(s.end) - toMinutes(s.start);
    respondText(`${s.date} • ${s.start}–${s.end} (${minutesToHrs(mins)} hrs)`);
  }


  function handleWeek(){
    const emp = findEmployee(); if (!emp) return;
    const days = [...Array(7)].map((_,i)=>{
      const d=new Date(); d.setDate(d.getDate()+i);
      return d.toISOString().slice(0,10);
    });

    const list = days.map(d=>{
      const s = emp.plannedShifts.find(x=>x.date===d);
      return `<li>${d}: ${s ? `${s.start}–${s.end}` : "—"}</li>`;
    }).join("");

    respondHTML(`<p><b>Next 7 days</b></p><ul>${list}</ul>`);
  }


  function handleTodayPay(){
    const emp = findEmployee(); if (!emp) return;
    const today = todayISO();
    const s = emp.plannedShifts.find(x=>x.date===today);
    if (!s) return respondText("No shift today.");

    const mins = toMinutes(s.end) - toMinutes(s.start);
    const hours = mins/60;
    const pay = hours * emp.hourlyRate;

    respondText(`Estimated pay today: £${pay.toFixed(2)} (rate £${emp.hourlyRate})`);
  }


  function handleNextPay(){
    const { frequency, nextPayday } = store.payConfig;
    const today = todayISO();
    let next = nextPayday;

    if (today > nextPayday){
      let t = nextPayday;
      while (t <= today) t = paydayAfter(t, frequency);
      next = t;
      store.payConfig.nextPayday = next;
      persist();
    }

    respondText(`Next payday: ${next}`);
  }


  function handlePolicy(raw){
    const term = raw.split(" ").slice(1).join(" ").trim();
    if (!term) return respondText("Usage: /policy <term>");

    const results = rankedKB(term).slice(0,3);
    if (!results.length) return respondText("No matches.");

    const list = results.map(k=>`<li><b>${k.topic}</b></li>`).join("");
    respondHTML(`<p>Matches:</p><ul>${list}</ul>`);
  }


  function handleQuiz(raw){
    if (!raw.includes("start")) return respondText("Use: /quiz start");
    quiz = { idx:0, score:0, active:true };
    respondText("Starting quiz...");
    setTimeout(askQuizQuestion, 100);
  }

  function askQuizQuestion() {
    if (!quiz) return;
    const q = QUIZ_QUESTIONS[quiz.idx];
    respondHTML(`
      <p><b>Q${quiz.idx+1}.</b> ${escapeHTML(q.q)}</p>
      <ul>
        <li><b>A</b> — ${escapeHTML(q.a[0])}</li>
        <li><b>B</b> — ${escapeHTML(q.a[1])}</li>
        <li><b>C</b> — ${escapeHTML(q.a[2])}</li>
      </ul>
    `);
  }


  /* -------------------- BREAK TIMER -------------------- */
  let breakTimer = null;
  let breakEnd = null;

  function handleBreak(text){
    const n = parseInt(text.split(" ")[1]);
    if (!n || n < 1) return respondText("Use: /break <minutes>");

    breakEnd = Date.now() + n*60000;

    if (breakTimer) clearInterval(breakTimer);

    breakTimer = setInterval(()=>{
      const left = breakEnd - Date.now();
      if (left <= 0){
        clearInterval(breakTimer);
        breakTimer = null;
        respondText("Break finished.");
      }
    }, 1000);

    respondText(`Break started — ${n} minutes.`);
  }

  function cancelBreak(){
    if (breakTimer) clearInterval(breakTimer);
    breakTimer = null;
    respondText("Break cancelled.");
  }


  /* -------------------- SHIFT SWAPS -------------------- */
  function handleSwap(text){
    const emp = findEmployee(); if (!emp) return;
    const raw = text.replace("/swap","").trim();
    if (!raw) return respondText("Use: /swap 12:00-20:00");

    store.swaps.push({
      id: Math.random().toString(36).slice(2),
      empId: emp.id,
      request: raw,
      date: todayISO()
    });
    persist();

    respondText(`Swap posted: "${raw}"`);
  }

  function listSwaps(){
    if (!store.swaps.length) return respondText("No swaps posted.");

    const list = store.swaps.map(s=>`<li>${s.date} — ${s.empId}: ${s.request}</li>`).join("");
    respondHTML(`<p><b>Shift swaps:</b></p><ul>${list}</ul>`);
  }


  /* -------------------- KB SEARCH -------------------- */
  function bestKB(text){
    for (const k of KB){
      if (k.keywords.some(x=> text.includes(x))) return k;
    }
    return null;
  }
  function rankedKB(term){
    term = term.toLowerCase();
    return KB.filter(k => k.keywords.some(x=> x.includes(term) || term.includes(x)));
  }


  /* -------------------- OPENAI CALL -------------------- */
  async function askAI(text){
    try{
      const res = await fetch("/ask", {
        method:"POST",
        headers:{ "Content-Type": "application/json" },
        body: JSON.stringify({ message:text })
      });
      const json = await res.json();
      return json.reply || "No reply.";
    }catch{
      return "AI unavailable.";
    }
  }


  /* -------------------- AI ACTION HANDLER -------------------- */
  function maybeHandleAction(reply){
    if (typeof reply !== "string") return false;
    if (!reply.startsWith("ACTION:")) return false;

    const act = reply.split(":")[1].trim();
    if (act === "CONFETTI") {
      confetti(1500);
      respondText("🎉");
      return true;
    }
    return false;
  }


  /* -------------------- CONFETTI -------------------- */
  function confetti(ms){
    const c = document.createElement("div");
    c.className = "confetti";
    document.body.appendChild(c);
    setTimeout(()=>c.remove(), ms);
  }

})();
