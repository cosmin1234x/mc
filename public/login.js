/* login.js — custom forms using Netlify Identity (GoTrue) via NF.auth */
document.addEventListener("DOMContentLoaded", () => {
  const qs = (s)=>document.querySelector(s);

  const tabIn = qs("#tabSignIn");
  const tabUp = qs("#tabSignUp");
  const formIn = qs("#formSignIn");
  const formUp = qs("#formSignUp");
  const siEmail = qs("#siEmail");
  const siPass  = qs("#siPass");
  const suEmail = qs("#suEmail");
  const suPass  = qs("#suPass");
  const siErr   = qs("#siErr");
  const suErr   = qs("#suErr");
  const remember = qs("#remember");

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "app.html";

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

  formIn.addEventListener("submit", async (e)=>{
    e.preventDefault();
    siErr.hidden = true; siErr.textContent = "";
    try{
      await NF.auth.login(siEmail.value.trim(), siPass.value, !!remember.checked);
      location.replace(next.replace(/^\/*/,""));
    }catch(err){
      // Common errors: bad credentials, email confirmation required, registration closed
      siErr.textContent = (err && err.message) ? err.message : "Sign in failed. Check your email/password or Identity settings.";
      siErr.hidden = false;
      siPass.classList.add("shake"); setTimeout(()=>siPass.classList.remove("shake"), 380);
    }
  });

  formUp.addEventListener("submit", async (e)=>{
    e.preventDefault();
    suErr.hidden = true; suErr.textContent = "";
    try{
      await NF.auth.signup(suEmail.value.trim(), suPass.value);
      // If email verification is on, login will fail until confirmed
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
    }
  });
});
