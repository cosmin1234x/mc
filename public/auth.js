/* auth.js — tiny client-side auth (demo only, stores users in localStorage) */
(() => {
  const USERS_KEY = "mccrew_users_v2";
  const SESSION_KEY = "mccrew_session_v2";
  const SEEDED_KEY = "mccrew_seeded_v2";

  // --- Helpers ---
  const toast = (msg) => {
    const box = document.getElementById("toasts");
    if (!box) return console.log(msg);
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    box.appendChild(el);
    setTimeout(()=>{ el.classList.add("leave"); setTimeout(()=>el.remove(), 180); }, 1800);
  };

  async function sha256Hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  function randomSalt(len=16){
    const bytes = new Uint8Array(len); crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,len);
  }
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }catch{ return []; } }
  function saveUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }
  function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }catch{ return null; } }
  function setSession(sess){ localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  // --- Seed a default user on first run so you can log in immediately ---
  async function ensureSeedUser(){
    if (localStorage.getItem(SEEDED_KEY)) return;
    const users = getUsers();
    if (users.length === 0){
      const email = "demo@store.local";
      const password = "pass1234"; // demo password
      const salt = randomSalt(16);
      const hash = await sha256Hex(salt + password);
      users.push({ email, salt, hash });
      saveUsers(users);
      localStorage.setItem(SEEDED_KEY, "1");
      // if on login page (root), show tip
      if (/\/($|index\.html$)/.test(location.pathname)) setTimeout(()=>toast(`Seeded demo user: ${email} / ${password}`), 200);
    }
  }

  // --- Public API ---
  window.McAuth = {
    async signUp(email, password){
      email = (email||"").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email.");
      if ((password||"").length < 6) throw new Error("Password must be at least 6 characters.");
      const users = getUsers();
      if (users.some(u=>u.email === email)) throw new Error("Email already registered.");
      const salt = randomSalt(16);
      const hash = await sha256Hex(salt + password);
      users.push({ email, salt, hash });
      saveUsers(users);
      return true;
    },
    async signIn(email, password, remember=false){
      email = (email||"").trim().toLowerCase();
      const users = getUsers();
      const u = users.find(x=>x.email === email);
      if (!u) throw new Error("No user with that email.");
      const hex = await sha256Hex(u.salt + (password||""));
      if (hex !== u.hash) throw new Error("Wrong password.");
      const hours = remember ? 24*7 : 12;
      const exp = Date.now() + hours*60*60*1000;
      const sess = { email, exp };
      setSession(sess);
      return sess;
    },
    signOut(){ clearSession(); },
    getSession
  };

  // --- Page bootstrap: guard + header wiring ---
  document.addEventListener("DOMContentLoaded", async () => {
    await ensureSeedUser();

    // Treat "/" or "/index.html" as the login page
    const isLogin = /\/($|index\.html$)/.test(location.pathname);
    const sess = getSession();

    // Protect any page that's not the login
    if (!isLogin){
      if (!sess || (sess.exp && Date.now() > sess.exp)){
        localStorage.removeItem(SESSION_KEY);
        const next = encodeURIComponent(location.pathname);
        location.replace(`/?next=${next}`); // root is login now
        return;
      }
    }

    // Header UI if present (on app.html)
    const who = document.getElementById("who");
    const logoutBtn = document.getElementById("logout");
    if (who && sess) who.textContent = sess.email;
    if (logoutBtn){
      logoutBtn.style.display = sess ? "inline-block" : "none";
      logoutBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        clearSession();
        toast("Signed out");
        location.replace("/"); // back to login
      });
    }
  });
})();
