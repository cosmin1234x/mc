/* login.js — Netlify Identity (GoTrue) forms via NF.auth (hardened) */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s) => document.querySelector(s);

  const tabIn = $("#tabSignIn");
  const tabUp = $("#tabSignUp");
  const formIn = $("#formSignIn");
  const formUp = $("#formSignUp");
  const siEmail = $("#siEmail");
  const siPass  = $("#siPass");
  const suEmail = $("#suEmail");
  const suPass  = $("#suPass");
  const siErr   = $("#siErr");
  const suErr   = $("#suErr");
  const remember = $("#remember");
  const btnIn = formIn?.querySelector('button[type="submit"]');
  const btnUp = formUp?.querySelector('button[type="submit"]');

  // Wait for NF to exist
  function waitForNF(retries = 60) {
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (window.NF && NF.auth) return resolve();
        if (retries-- <= 0) return reject(new Error("NF not available"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  const params = new URLSearchParams(location.search);
  const nextRaw = params.get("next") || "app.html";
  // prevent open-redirects
  const next = nextRaw.startsWith("http") ? "app.html" : nextRaw.replace(/^\/*/,"");

  function show(which){
    const signIn = which === "in";
    tabIn.classList.toggle("active", signIn);
    tabUp.classList.toggle("active", !signIn);
    formIn.hidden = !signIn;
    formUp.hidden = signIn;
    (signIn ? siEmail : suEmail).focus();
  }
  tabIn.addEventListener("click", ()=>show("in"));
  tabUp.addEventListener("click", ()=>show("up"));
  show("in");

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.style.opacity = busy ? .6 : 1;
  }

  waitForNF().then(() => {
    formIn.addEventListener("submit", async (e)=>{
      e.preventDefault();
      siErr.hidden = true; siErr.textContent = "";
      setBusy(btnIn, true);
      try{
        await NF.auth.login(siEmail.value.trim(), siPass.value, !!remember.checked);
        location.replace(next);
      }catch(err){
        siErr.textContent = (err && err.message) ? err.message : "Sign in failed. Check email/password or Identity settings.";
        siErr.hidden = false;
        siPass.classList.add("shake"); setTimeout(()=>siPass.classList.remove("shake"), 380);
      }finally{
        setBusy(btnIn, false);
      }
    });

    formUp.addEventListener("submit", async (e)=>{
      e.preventDefault();
      suErr.hidden = true; suErr.textContent = "";
      setBusy(btnUp, true);
      try{
        await NF.auth.signup(suEmail.value.trim(), suPass.value);
        try{
          await NF.auth.login(suEmail.value.trim(), suPass.value, true);
          location.replace("app.html");
        }catch(e2){
          suErr.textContent = "Account created. Please verify your email, then sign in.";
          suErr.hidden = false;
          show("in");
        }
      }catch(err){
        suErr.textContent = (err && err.message) ? err.message : "Could not create account (maybe email already registered?).";
        suErr.hidden = false;
        suPass.classList.add("shake"); setTimeout(()=>suPass.classList.remove("shake"), 380);
      }finally{
        setBusy(btnUp, false);
      }
    });
  }).catch((e)=>{
    console.error(e);
    if (siErr){ siErr.hidden = false; siErr.textContent = "Auth library failed to load. Check script order."; }
  });
});
