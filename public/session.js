/* session.js — simple client-side auth (demo only, not for real credentials) */
(() => {
  const USERS_KEY = "mccrew_users_v1";
  const SESSION_KEY = "mccrew_session_v1";
  const SEEDED_KEY = "mccrew_seeded_admin_v1";

  // Toast (use app's if present)
  const toast = window.toast || ((msg, type="") => {
    const box = document.getElementById("toasts");
    if (!box) return alert(msg);
    const el = document.createElement("div");
    el.className = `toast ${type}`; el.textContent = msg;
    box.appendChild(el);
    setTimeout(()=>{ el.classList.add("leave"); setTimeout(()=>el.remove(), 180); }, 2000);
  });

  // Crypto helpers
  async function sha256Hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  function randomSalt(len=16){
    const bytes = new Uint8Array(len); crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,len);
  }

  // Users
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }catch{ return []; } }
  function saveUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }

  // Seed default admin (first time only)
  async function ensureDefaultAdmin(){
    if (localStorage.getItem(SEEDED_KEY)) return;
    const users = getUsers();
    if (users.length === 0){
      const email = "admin@store.local";
      const name = "Store Admin";
      const role = "admin";
      const pin = "4321";
      const salt = randomSalt(16);
      const hash = await sha256Hex(salt + pin);
      users.push({ email, name, role, salt, hash });
      saveUsers(users);
      localStorage.setItem(SEEDED_KEY, "1");
      // Show hint only on login page
      if (location.pathname.endsWith("login.html")){
        setTimeout(()=>toast(`Seeded default admin — ${email} / ${pin}`,"warn"), 200);
      }
    }
  }

  // Session helpers
  function getSession(){
    try{
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!s) return null;
      if (s.exp && Date.now() > s.exp){ localStorage.removeItem(SESSION_KEY); return null; }
      return s;
    }catch{ return null; }
  }
  function setSession(sess){ localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  // Public API for login.js
  window.McAuth = {
    async signIn(email, pin, remember=false){
      const users = getUsers();
      const u = users.find(x=>x.email.toLowerCase() === email.toLowerCase());
      if (!u) throw new Error("No user with that email.");
      const hex = await sha256Hex(u.salt + pin);
      if (hex !== u.hash) throw new Error("Invalid PIN.");
      const hours = remember ? 24*7 : 12; // 7 days vs 12 hours
      const exp = Date.now() + hours*60*60*1000;
      const sess = { email: u.email, name: u.name, role: u.role, exp };
      setSession(sess);
      return sess;
    },
    async signUp({ email, name, pin, role="crew"}){
      const users = getUsers();
      if (users.some(x=>x.email.toLowerCase() === email.toLowerCase()))
        throw new Error("Email already registered.");
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits.");
      const salt = randomSalt(16);
      const hash = await sha256Hex(salt + pin);
      users.push({ email, name, role, salt, hash });
      saveUsers(users);
      return true;
    },
    getSession,
    signOut(){ clearSession(); }
  };

  // Page guard + header UI
  async function boot(){
    await ensureDefaultAdmin();

    const isLogin = location.pathname.endsWith("login.html");
    const sess = getSession();

    if (!isLogin && !sess){
      // Protect app pages
      const next = encodeURIComponent(location.pathname);
      location.replace(`login.html?next=${next}`);
      return;
    }

    // Header UI (if present)
    const who = document.getElementById("who");
    const logoutBtn = document.getElementById("logout");
    const adminBtn = document.getElementById("openAdmin");

    if (sess){
      if (who) who.textContent = `${sess.name} (${sess.role})`;
      if (adminBtn && sess.role !== "admin") adminBtn.style.display = "none";
      if (logoutBtn){
        logoutBtn.style.display = "inline-block";
        logoutBtn.addEventListener("click", (e)=>{
          e.preventDefault();
          clearSession();
          toast("Signed out");
          location.replace("login.html");
        });
      }
    } else {
      // On login page hide logout if any
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
