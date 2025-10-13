/* login.js — dual-mode login (Crew or Manager with code) using Auth0 NF shim */
document.addEventListener("DOMContentLoaded", () => {
  const MANAGER_CODE = "321234"; // change if needed

  const $ = (s)=>document.querySelector(s);
  const tabCrew = $("#tabCrew");
  const tabMgr  = $("#tabManager");
  const form    = $("#formLogin");
  const email   = $("#email");
  const pass    = $("#pass");
  const codeWrap= $("#managerCodeWrap");
  const managerCode = $("#managerCode");
  const errEl   = $("#err");
  const goSignup= $("#goSignup");

  let mode = "crew";

  function switchMode(next){
    mode = next;
    tabCrew.classList.toggle("active", mode==="crew");
    tabMgr.classList.toggle("active", mode==="manager");
    codeWrap.style.display = mode==="manager" ? "block" : "none";
    (mode==="manager" ? managerCode : email).focus();
  }

  tabCrew.addEventListener("click", ()=>switchMode("crew"));
  tabMgr.addEventListener("click", ()=>switchMode("manager"));

  const sp = new URLSearchParams(location.search);
  if (sp.get("role")==="manager") switchMode("manager"); else switchMode("crew");

  function showErr(msg){ errEl.textContent = msg || "Something went wrong."; errEl.hidden = false; }

  async function doLogin(isSignup=false){
    errEl.hidden = true; errEl.textContent = "";
    const e = (email.value||"").trim();
    const p = (pass.value||"").trim();
    if (!e || !p) return showErr("Please enter email and password.");

    if (mode === "manager"){
      const entered = (managerCode.value||"").trim();
      if (entered !== MANAGER_CODE) return showErr("Manager code is incorrect.");
    }

    try{
      // Client-side hint; server-side Action will override with real role
      localStorage.setItem("mccrew_role", mode);
      if (isSignup) await NF.signUp("/app.html");
      else await NF.signIn("/app.html");
    }catch(e){
      showErr("Login failed. Check SPA settings and callback URLs.");
      console.error(e);
    }
  }

  form.addEventListener("submit", (ev)=>{ ev.preventDefault(); doLogin(false); });
  goSignup.addEventListener("click", ()=> doLogin(true));
});
