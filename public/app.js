/* McCrew AI — app.js with personalizable AI (persona + KB + context) and JSON actions */

(() => {
  /* ---------- Auth guard ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    try{
      if (!window.NF || !NF.requireAuth) return console.warn("[McCrew] NF not ready (auth shim missing?)");
      const user = await NF.requireAuth("/"); // redirect to login if not logged in
      if (user) {
        const who = document.getElementById("userName");
        if (who) {
          const first = (user.name || user.email || "Crew").split(" ")[0];
          who.textContent = `Hello, ${first} 👋`;
        }
        const pic = document.getElementById("userPic");
        if (pic && user.picture) { pic.src = user.picture; pic.style.display = "block"; }
        const logoutBtn = document.getElementById("logout");
        if (logoutBtn) { logoutBtn.style.display = "inline-block"; logoutBtn.onclick = (e)=>{ e.preventDefault(); NF.signOut("/"); }; }
      }
    }catch(e){ console.warn("[Auth]", e); }
  });

  /* ---------- Demo Data ---------- */
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

  /* ---------- Knowledge Base (UI list) ---------- */
  const KB = [
    { topic:"Uniform Policy", keywords:["uniform","dress","appearance"], answer:
      `• Clean full uniform, name badge visible.
• No smart watches/rings by food prep.
• Hair tied, beard nets where required.
• Black, non-slip shoes.
• Follow local store/brand standards.` },
    { topic:"Lateness Policy", keywords:["late","lateness","timekeeping"], answer:
      `• Call the store/manager ASAP if running late.
• Arrivals >5 min late may be logged.
• 3 lateness events in a period triggers a review.
• Repeated issues may affect scheduling.` },
    { topic:"Breaks", keywords:["break","rest","meal"], answer:
      `• Typical UK crew: ~20-min break if shift > 4.5–6 hours (store policy may vary).
• Ask a manager to schedule around rush periods.
• No eating in customer area while on duty.` },
    { topic:"Food Safety / Allergens", keywords:["allergen","safety","food","ccp"], answer:
      `• Strict handwashing between tasks.
• Keep raw/ready-to-eat separate.
• Label and hold times must be followed.
• Use official allergen charts; confirm with manager.` },
  ];

  /* ---------- Quiz ---------- */
  const QUIZ_QUESTIONS = [
    { q:"How long should proper handwashing take?", a:["At least 10s","At least 20s","Until hands feel dry"], correct:1 },
    { q:"What do you do if a guest asks about allergens?", a:["Guess from memory","Use official allergen charts","Say everything is gluten-free"], correct:1 },
    { q:"Which shoes are acceptable?", a:["White trainers","Black non-slip","Open sandals"], correct:1 },
    { q:"What happens after 3 lateness events in a period?", a:["Nothing","Review triggered","Immediate termination"], correct:1 },
    { q:"When filtering fryers, you should…", a:["Mix any chemicals","Wear PPE and follow spec","Skip logging"], correct:1 },
  ];
  let quiz = null;

  /* ---------- Utils ---------- */
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
  const clamp = (n,min,max)=>Math.max(min, Math.min(max,n));
  const escapeHTML = (s)=> s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));

  /* ---------- Persistence ---------- */
  const LS_KEY = "mccrew_ai_personal_v1";
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const data = JSON.parse(raw);
      ["employees","payConfig","swaps"].forEach(k=>{ if(data[k]) store[k]=data[k]; });
    }
  }catch(e){ console.warn("[McCrew]", e.message); }
  const persist = ()=>localStorage.setItem(LS_KEY, JSON.stringify({ ...store }));

  /* ---------- DOM ---------- */
  const chatLog = document.getElementById("chatLog");
  const chatForm = document.getElementById("chatForm");
  const chatText = document.getElementById("chatText");
  const kbList  = document.getElementById("kbList");
  const empIdInput = document.getElementById("empId");

  const openAdminBtn = document.getElementById("openAdmin");
  const adminModal = document.getElementById("adminModal");
  const closeAdminBtn = document.getElementById("closeAdmin");
  const aEmpId = document.getElementById("aEmpId");
  const aName  = document.getElementById("aName");
  const aRate  = document.getElementById("aRate");
  const addEmpBtn = document.getElementById("addEmp");
  const empTable = document.getElementById("empTable");
  const payFreq = document.getElementById("payFreq");
  const nextPayday = document.getElementById("nextPayday");
  const savePayConfig = document.getElementById("savePayConfig");

  const fxCanvas = document.getElementById("fx");
  const toasts = document.getElementById("toasts");
  const on = (el, ev, fn)=> el && el.addEventListener ? el.addEventListener(ev, fn) : null;

  /* ---------- Knowledge list UI ---------- */
  if (kbList){
    KB.forEach(item=>{
      const li = document.createElement("li");
      li.textContent = item.topic;
      li.addEventListener("click", ()=>{
        pushUser(`Tell me about ${item.topic}`);
        respondHTML(`<div><p><b>${item.topic}</b></p><p>${escapeHTML(item.answer).replace(/\n/g,"<br>")}</p></div>`);
      });
      kbList.appendChild(li);
    });
  }

  /* ---------- Admin modal ---------- */
  on(openAdminBtn,"click", ()=>{ adminModal?.showModal?.(); renderEmpTable(); initPayConfigFields(); });
  on(closeAdminBtn,"click", ()=> adminModal?.close?.());
  on(adminModal,"cancel", (e)=>{ e.preventDefault(); adminModal.close(); });
  on(adminModal,"click", (e)=>{
    const r = adminModal.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) adminModal.close();
  });
  on(adminModal,"close", persist);

  on(addEmpBtn,"click", ()=>{
    const id = (aEmpId?.value||"").trim(); if(!id) return;
    const name = (aName?.value||"").trim() || `Crew ${id}`;
    const rate = parseFloat(aRate?.value||"0") || 11.44;
    const ex = store.employees.find(e=>e.id===id);
    if(ex){ ex.name=name; ex.hourlyRate=rate; } else store.employees.push({ id, name, hourlyRate: rate, plannedShifts: [] });
    if (aEmpId) aEmpId.value=""; if (aName) aName.value=""; if (aRate) aRate.value="";
    renderEmpTable(); persist(); toast("Employee saved","good");
  });
  on(savePayConfig,"click", ()=>{
    if (!payFreq) return;
    store.payConfig.frequency = payFreq.value;
    store.payConfig.nextPayday = (nextPayday && nextPayday.value) || store.payConfig.nextPayday;
    persist(); toast("Pay settings updated","good");
    respondText(`Saved pay config: ${store.payConfig.frequency}, next payday ${store.payConfig.nextPayday}`);
  });

  function renderEmpTable(){
    if (!empTable) return;
    const rows = store.employees.map(e=>(
      `<tr><td>${e.id}</td><td>${escapeHTML(e.name)}</td><td>£${e.hourlyRate.toFixed(2)}/hr</td><td>${e.plannedShifts?.length||0} shifts</td></tr>`
    )).join("");
    empTable.innerHTML = `<table>
      <thead><tr><th>ID</th><th>Name</th><th>Rate</th><th>Shifts</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="4">No employees yet</td></tr>`}</tbody>
    </table>`;
  }
  function initPayConfigFields(){ if (payFreq) payFreq.value = store.payConfig.frequency; if (nextPayday) nextPayday.value = store.payConfig.nextPayday; }

  /* ---------- Chat core ---------- */
  on(chatForm,"submit", async (e)=>{
    e.preventDefault();
    const text = (chatText?.value||"").trim(); if(!text) return;
    handleInput(text);
    if (chatText) chatText.value="";
  });

  function pushUser(text){
    if (!chatLog) return;
    const node = document.createElement("div");
    node.className = "user msg";
    node.innerHTML = `<p>${escapeHTML(text)}</p>`;
    chatLog.appendChild(node); chatLog.scrollTop = chatLog.scrollHeight;
  }
  function typingBubble(){
    if (!chatLog) return null;
    const node = document.createElement("div");
    node.className = "bot msg";
    node.innerHTML = `<p class="typing"><span>Typing</span></p>`;
    chatLog.appendChild(node); chatLog.scrollTop = chatLog.scrollHeight;
    return node;
  }
  function respondHTML(html){
    const bubble = typingBubble();
    setTimeout(()=>{ if (bubble){ bubble.innerHTML = html; chatLog.scrollTop = chatLog.scrollHeight; } }, 160);
  }
  function respondText(text){ respondHTML(`<p>${escapeHTML(text).replace(/\n/g,"<br>")}</p>`); }

  /* ---------- Router ---------- */
  async function handleInput(raw){
    const text = raw.trim();
    pushUser(raw);

    // Quiz answers if active
    if (quiz && quiz.active && !text.startsWith("/")){
      const pick = text.trim()[0]?.toLowerCase();
      const idx = "abc123".indexOf(pick);
      if (idx !== -1){
        const mapped = idx % 3;
        const curr = QUIZ_QUESTIONS[quiz.idx];
        const ok = mapped === curr.correct;
        respondHTML(`<p><b>${ok? "✅ Correct":"❌ Not quite"}</b> — ${escapeHTML(curr.a[curr.correct])}</p>`);
        quiz.idx++; if (ok) quiz.score++;
        if (quiz.idx >= QUIZ_QUESTIONS.length){
          respondHTML(`<p><b>Quiz complete!</b> Score: ${quiz.score}/${QUIZ_QUESTIONS.length}</p>`);
          quiz = null; toast("Quiz complete!","good");
        } else { setTimeout(askQuizQuestion, 220); }
        return;
      }
    }

    const low = text.toLowerCase();

    // Commands
    if (low.startsWith("/help"))   return showHelp();
    if (low.startsWith("/shift"))  return handleShift();
    if (low.startsWith("/pay"))    return handleTodayPay();
    if (low.startsWith("/nextpay"))return handleNextPay();
    if (low.startsWith("/week"))   return handleWeek();
    if (low.startsWith("/policy")) return handlePolicy(text);
    if (low.startsWith("/quiz"))   return handleQuiz(text);
    if (low.startsWith("/quit"))   { quiz=null; return respondText("Exited quiz."); }
    if (low.startsWith("/break"))  return handleBreak(text);
    if (low.startsWith("/cancelbreak")) return respondText("Break timer cancelled.");
    if (low.startsWith("/swap"))   return handleSwap(text);
    if (low.startsWith("/swaps"))  return listSwaps();

    // Local intents (cheap)
    const local = localIntents(low);
    if (local) return respondText(local);

    // Quick KB match
    const match = bestKB(low);
    if (match) return respondHTML(`<p><b>${match.topic}</b></p><p>${escapeHTML(match.answer).replace(/\n/g,"<br>")}</p>`);

    // AI call with persona/KB/context
    const reply = await askAI(text);
    if (!maybeHandleAction(reply)) respondText(reply);
  }

  function showHelp(){
    respondHTML(`<p>I can help with:</p>
    <ul>
      <li><code>/shift</code>, <code>/week</code>, <code>/swap ...</code>, <code>/swaps</code></li>
      <li><code>/pay</code>, <code>/nextpay</code></li>
      <li><code>/policy &lt;term&gt;</code>, <code>/quiz start</code>, <code>/quit</code></li>
      <li><code>/break 20</code>, <code>/cancelbreak</code></li>
      <li>Or just ask in plain English 🙂</li>
    </ul>`);
  }

  function findEmployee(idMaybe){
    const id = (idMaybe || empIdInput?.value || "").trim();
    if(!id) {
      respondText("Add your Employee ID first (right panel).");
      empIdInput?.classList.add("shake"); setTimeout(()=>empIdInput?.classList.remove("shake"), 400);
      return null;
    }
    const emp = store.employees.find(e=>e.id===id);
    if(!emp){ respondText(`No employee with ID ${id} in the demo data.`); return null; }
    return emp;
  }

  function handleShift(idMaybe){
    const emp = findEmployee(idMaybe); if(!emp) return;
    const today = todayISO();
    const shift = emp.plannedShifts?.find(s=>s.date===today);
    if(!shift) return respondText(`${emp.name}: No shift found for today (${today}).`);
    const durMin = toMinutes(shift.end)-toMinutes(shift.start);
    respondHTML(`<p><b>${emp.name} — Today’s Shift</b></p>
      <p>${shift.date} • ${shift.start}–${shift.end} (${minutesToHrs(durMin)} hrs)</p>`);
  }

  function handleWeek(idMaybe){
    const emp = findEmployee(idMaybe); if(!emp) return;
    const start = new Date();
    const days = [...Array(7)].map((_,i)=>{const d=new Date(start); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10);});
    const items = days.map(d=>{
      const s = emp.plannedShifts?.find(x=>x.date===d);
      return `<li>${d}: ${s? `${s.start}–${s.end}` : "—"}</li>`;
    }).join("");
    respondHTML(`<p><b>${emp.name} — Next 7 days</b></p><ul>${items}</ul>`);
  }

  function handleTodayPay(idMaybe){
    const emp = findEmployee(idMaybe); if(!emp) return;
    const today = todayISO();
    const shift = emp.plannedShifts?.find(s=>s.date===today);
    if(!shift) return respondText(`${emp.name}: No shift today (${today}).`);
    const durMin = toMinutes(shift.end)-toMinutes(shift.start);
    const hours = durMin/60;
    const base = hours * emp.hourlyRate;
    const nightPremium = shift.end >= "22:00" ? 0.5 * hours : 0;
    const est = base + nightPremium;
    respondHTML(`<p><b>Estimated Pay for Today</b></p>
      <p>${emp.name}: £${est.toFixed(2)} (rate £${emp.hourlyRate.toFixed(2)}/hr, ${hours.toFixed(2)} hrs)</p>
      <small>Demo estimate only; actual pay depends on timeclock, premiums, breaks, taxes, etc.</small>`);
    toast("Pay estimated","good"); confetti(900);
  }

  function handleNextPay(){
    const { frequency, nextPayday } = store.payConfig;
    const today = todayISO();
    let next = nextPayday;
    if (today > nextPayday){
      let t = nextPayday; while (t <= today){ t = paydayAfter(t, frequency); }
      next = t; store.payConfig.nextPayday = next; persist();
    }
    const after = paydayAfter(next, frequency);
    respondHTML(`<p><b>Next Paycheck</b></p>
      <p>Next payday: <b>${next}</b> • Frequency: <b>${frequency}</b></p>
      <p>Following payday: ${after}</p>`);
    toast("Next payday shown","good"); confetti(900);
  }

  function handlePolicy(raw){
    const term = raw.split(" ").slice(1).join(" ").trim();
    if(!term) return respondText("Usage: /policy <term>. Example: /policy uniform");
    const matches = rankedKB(term).slice(0,3);
    if (!matches.length) return respondText(`No matches for “${term}”.`);
    const html = matches.map(k=>`<li><b>${k.topic}</b> — ${escapeHTML(k.answer.split("\n")[0])}…</li>`).join("");
    respondHTML(`<p>Top results for “${escapeHTML(term)}”:</p><ul>${html}</ul>`);
  }

  function handleQuiz(raw){
    if (raw.includes("start")){
      quiz = { idx:0, score:0, active:true };
      respondText("Starting 5-question training quiz. Answer with A/B/C (or 1/2/3). Type /quit to exit.");
      setTimeout(askQuizQuestion, 200);
      toast("Quiz started");
    } else respondText("Use: /quiz start");
  }

  function askQuizQuestion(){
    if (!quiz) return;
    const q = QUIZ_QUESTIONS[quiz.idx];
    const letters = ["A","B","C"];
    const list = q.a.map((t,i)=>`<li><b>${letters[i]}</b> — ${escapeHTML(t)}</li>`).join("");
    respondHTML(`<p><b>Q${quiz.idx+1}.</b> ${escapeHTML(q.q)}</p><ul>${list}</ul>`);
  }

  function handleBreak(raw){
    const m = parseInt(raw.split(" ")[1]||"20",10);
    const mins = clamp(isNaN(m)?20:m, 5, 60);
    let ends = Date.now() + mins*60*1000;
    const id = "breakTimer_"+Math.random().toString(36).slice(2);
    respondHTML(`<p id="${id}"><b>Break timer:</b> ${mins}:00</p>`);
    const t = setInterval(()=>{
      const el = document.getElementById(id); if(!el){ clearInterval(t); return; }
      const left = Math.max(0, ends - Date.now());
      const mm = Math.floor(left/60000).toString().padStart(2,"0");
      const ss = Math.floor((left%60000)/1000).toString().padStart(2,"0");
      el.innerHTML = `<b>Break timer:</b> ${mm}:${ss}`;
      if (left<=0){ clearInterval(t); respondText("⏰ Break finished — please return to station per policy."); }
    }, 250);
  }

  function handleSwap(raw){
    const parts = raw.split(" ").filter(Boolean);
    if (parts.length < 3) return respondText("Usage: /swap YYYY-MM-DD HH:MM-HH:MM Note…");
    store.swaps.push({ id: Math.random().toString(36).slice(2), date:parts[1], range:parts[2], note:parts.slice(3).join(" ")||"(no note)", createdISO:new Date().toISOString() });
    persist(); toast("Swap request posted","good");
    respondHTML(`<p><b>Swap request posted</b></p><p>${parts[1]} • ${parts[2]}<br>${escapeHTML(parts.slice(3).join(" ")||"(no note)")}</p>`);
  }
  function listSwaps(){
    if (!store.swaps.length) return respondText("No swap requests yet.");
    const html = store.swaps.slice(-10).reverse().map(s=>`<li>${s.date} • ${s.range} — ${escapeHTML(s.note)}</li>`).join("");
    respondHTML(`<p><b>Latest swap requests</b></p><ul>${html}</ul>`);
  }

  /* ---------- Local intents ---------- */
  function localIntents(low){
    if (/^(hi|hello|hey|yo)\b/.test(low)) return "Hi 👋 I can help with shifts, pay, policies, and training.";
    if (/how are (you|u)/.test(low)) return "Doing great — ready to help with your shift or questions.";
    if (/thank(s| you)/.test(low)) return "You’re welcome! 🍟";
    if (/(bye|goodbye|see ya)/.test(low)) return "See you later 👋 Have a great shift!";
    if (/uniform/.test(low)) return "Uniform clean, name badge visible, black non-slip shoes, hair tied; follow your store standards.";
    if (/\bbreak\b/.test(low)) return "Typical crew break is ~20 minutes if your shift goes over 4.5–6 hours (store policy may vary).";
    if (/\bpay(day|check)?\b/.test(low)) return "You can view next payday with /nextpay or today’s estimate with /pay.";
    return null;
  }

  /* ---------- KB search helpers ---------- */
  function scoreKB(entry, term){
    term = term.toLowerCase(); let score = 0;
    if (entry.topic.toLowerCase().includes(term)) score += 3;
    if (entry.answer.toLowerCase().includes(term)) score += 1;
    entry.keywords.forEach(k=>{ if (k.includes(term) || term.includes(k)) score += 2; });
    return score;
  }
  function rankedKB(term){ return KB.map(k=>({ ...k, _s:scoreKB(k,term)})).filter(k=>k._s>0).sort((a,b)=>b._s-a._s); }
  function bestKB(text){ return rankedKB(text)[0] || null; }

  /* ---------- Toasts ---------- */
  function toast(msg, type=""){ if(!toasts) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`; el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(()=>{ el.classList.add("leave"); setTimeout(()=>el.remove(), 200); }, 1800);
  }

  /* ---------- Confetti (lightweight) ---------- */
  let confettiActive = false, pieces = [], rafId = 0, killAt = 0;
  const fadeMs = 350;
  const ctx2d = fxCanvas?.getContext?.('2d');
  function resizeFx(){ if(!fxCanvas) return; fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; }
  addEventListener('resize', resizeFx); resizeFx();
  function clearFxCanvas(){ if (ctx2d && fxCanvas) ctx2d.clearRect(0,0,fxCanvas.width,fxCanvas.height); }
  function stopConfetti(clear=true){ confettiActive = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; if (clear) clearFxCanvas(); pieces.length = 0; }
  function makePieces(n){
    const arr = []; const W = fxCanvas?.width || innerWidth, H = fxCanvas?.height || innerHeight;
    for (let i=0;i<n;i++){
      arr.push({ x: Math.random()*W, y: -20 - Math.random()*H*0.25, r: 4 + Math.random()*5,
        vy: 2 + Math.random()*3, vx: -1.2 + Math.random()*2.4, rot: Math.random()*Math.PI, vr: -0.25 + Math.random()*0.5,
        color: `hsl(${Math.random()*360},90%,60%)`, shape: Math.random()<0.5 ? 'rect' : 'circ' });
    }
    return arr;
  }
  function confetti(ms=900){
    if (!ctx2d || !fxCanvas) return;
    stopConfetti(false); pieces = makePieces(120); confettiActive = true;
    const now = performance.now(); killAt = now + ms;
    const tick = (ts) => {
      if (!confettiActive || !ctx2d) return;
      clearFxCanvas();
      const timeLeft = Math.max(0, killAt - ts);
      const alpha = timeLeft <= fadeMs ? (timeLeft / fadeMs) : 1;
      for (const p of pieces){
        p.vy += 0.015; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (alpha === 1 && p.y > (fxCanvas.height + 20)){ p.y = -20; p.x = Math.random()*fxCanvas.width; }
        ctx2d.save(); ctx2d.globalAlpha = alpha; ctx2d.translate(p.x, p.y); ctx2d.rotate(p.rot); ctx2d.fillStyle = p.color;
        if (p.shape === 'rect'){ ctx2d.fillRect(-p.r, -p.r, p.r*2, p.r*2); } else { ctx2d.beginPath(); ctx2d.arc(0,0,p.r,0,Math.PI*2); ctx2d.fill(); }
        ctx2d.restore();
      }
      if (ts >= killAt){ stopConfetti(true); return; }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  /* ---------- PERSONALIZATION PLUMBING ---------- */
  function buildPersona(){
    return localStorage.getItem("mccrew_persona") || `
You are McCrew AI, a friendly assistant for our store. Keep answers short (2–4 sentences), clear and kind.
If unsure, say it may vary by store and suggest asking a manager.`;
  }

  function buildKB(){
    try { return KB.map(item => `# ${item.topic}\n${item.answer}`).join("\n\n"); }
    catch { return ""; }
  }

  function buildContext(){
    return {
      store: { name: "Your Store Name", city: "Your City" },
      payConfig: store?.payConfig || null,
      employeeId: document.getElementById("empId")?.value || null
    };
  }

  async function askAI(message){
    try{
      const res = await fetch("/.netlify/functions/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message,
          persona: buildPersona(),
          kb: buildKB(),
          context: buildContext()
        })
      });
      const text = await res.text();
      let data = {}; try { data = text ? JSON.parse(text) : {}; } catch {}
      if (!res.ok) return `AI connection failed: ${data.error || res.status}`;
      return data.answer || "I couldn’t fetch a reply just now. Please ask again.";
    }catch(e){
      console.error("[AI]", e);
      return "AI connection failed. Please try again later.";
    }
  }

  // If the model suggests a JSON action, run it.
  function maybeHandleAction(answer){
    const m = answer.match(/JSON:\s*({[\s\S]*})/i);
    if (!m) return false;
    try {
      const obj = JSON.parse(m[1]);
      if (obj.action && typeof obj.action === "string") {
        // call back into our router
        handleInput(obj.action);
        return true;
      }
    } catch {}
    return false;
  }

  /* ---------- Local intents ---------- */
  function localIntents(low){
    if (/^(hi|hello|hey|yo)\b/.test(low)) return "Hi 👋 I can help with shifts, pay, policies, and training.";
    if (/how are (you|u)/.test(low)) return "Doing great — ready to help with your shift or questions.";
    if (/thank(s| you)/.test(low)) return "You’re welcome! 🍟";
    if (/(bye|goodbye|see ya)/.test(low)) return "See you later 👋 Have a great shift!";
    return null;
  }

  /* ---------- KB scoring ---------- */
  function scoreKB(entry, term){
    term = term.toLowerCase(); let score = 0;
    if (entry.topic.toLowerCase().includes(term)) score += 3;
    if (entry.answer.toLowerCase().includes(term)) score += 1;
    entry.keywords?.forEach(k=>{ if (k.includes(term) || term.includes(k)) score += 2; });
    return score;
  }
  function rankedKB(term){ return KB.map(k=>({ ...k, _s:scoreKB(k,term)})).filter(k=>k._s>0).sort((a,b)=>b._s-a._s); }
  function bestKB(text){ return rankedKB(text)[0] || null; }

  /* ---------- Bootstrap ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    respondText("Ready. Ask me anything about shifts, pay, or policies — or use /help.");
    try{
      const saved = localStorage.getItem("mccrew_emp_id");
      if (saved && empIdInput) empIdInput.value = saved;
      empIdInput?.addEventListener("change", ()=>{
        try{ localStorage.setItem("mccrew_emp_id", empIdInput.value.trim()); }catch{}
      });
    }catch{}
  });
})();
