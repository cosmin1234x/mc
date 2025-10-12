// ui.js — drawer, top search, profile menu, and nav actions
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const drawer = $("drawer");
  const navToggle = $("navToggle");
  const navClose = $("navClose");
  const navFX = $("navFX");
  const navAdmin = $("navAdmin");
  const navLogout = $("navLogout");

  const userMenuBtn = $("userMenuBtn");
  const userMenu = $("userMenu");
  const menuAdmin = $("menuAdmin");
  const menuLogout = $("menuLogout");
  const menuToggleFX = $("menuToggleFX");

  const chatTextTop = $("chatText");
  const sendTop = $("sendTop");
  const chatTextBottom = $("chatTextBottom");
  const chatForm = $("chatForm");

  // Drawer toggle
  const openDrawer = () => drawer?.classList.add("open");
  const closeDrawer = () => drawer?.classList.remove("open");
  navToggle?.addEventListener("click", openDrawer);
  navClose?.addEventListener("click", closeDrawer);
  drawer?.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  // User menu
  function toggleUserMenu(force){
    const open = force ?? userMenu?.hidden;
    if (!userMenu) return;
    userMenu.hidden = !open;
  }
  userMenuBtn?.addEventListener("click", () => toggleUserMenu());
  document.addEventListener("click", (e)=>{
    if (!userMenu || !userMenuBtn) return;
    if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) userMenu.hidden = true;
  });

  // Merge top send with bottom chat form
  sendTop?.addEventListener("click", () => {
    const txt = (chatTextTop?.value || "").trim();
    if (!txt) return;
    chatTextBottom.value = txt;
    chatForm?.dispatchEvent(new Event("submit", { cancelable:true, bubbles:true }));
    chatTextTop.value = "";
  });

  // Nav actions
  navFX?.addEventListener("click", () => {
    document.getElementById("toggleFX")?.click();
    closeDrawer();
  });
  menuToggleFX?.addEventListener("click", () => {
    document.getElementById("toggleFX")?.click();
    toggleUserMenu(false);
  });

  function openAdmin(){
    document.getElementById("openAdmin")?.click();
    closeDrawer(); toggleUserMenu(false);
  }
  navAdmin?.addEventListener("click", openAdmin);
  menuAdmin?.addEventListener("click", openAdmin);

  async function doLogout(){
    try{ await NF?.signOut?.("/"); }catch{}
  }
  navLogout?.addEventListener("click", doLogout);
  menuLogout?.addEventListener("click", doLogout);

  // Drawer nav “virtual pages”
  document.querySelectorAll(".nav-item[data-nav]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-nav");
      if (target === "chat") {
        document.querySelector("#chatTextBottom")?.focus();
      }
      if (target === "knowledge") {
        // focus KB list
        document.querySelector("#kbList")?.scrollIntoView({ behavior:"smooth", block:"start" });
      }
      if (target === "swaps") {
        // show latest swaps via command
        const form = document.getElementById("chatForm");
        const input = document.getElementById("chatTextBottom");
        if (input && form){ input.value = "/swaps"; form.dispatchEvent(new Event("submit", { cancelable:true, bubbles:true })); }
      }
      if (target === "dashboard") {
        window.scrollTo({ top:0, behavior:"smooth" });
      }
      closeDrawer();
    });
  });

  // Persist Employee ID shortcut
  $("saveEmpId")?.addEventListener("click", ()=>{
    const emp = $("empId")?.value?.trim();
    if (!emp) return;
    try{ localStorage.setItem("mccrew_emp_id", emp); }catch{}
    const toast = document.createElement("div");
    toast.className = "toast good"; toast.textContent = "Employee ID saved";
    (document.getElementById("toasts")||document.body).appendChild(toast);
    setTimeout(()=>{ toast.classList.add("leave"); setTimeout(()=>toast.remove(), 200); }, 1600);
  });
  // Restore if present
  try{
    const saved = localStorage.getItem("mccrew_emp_id");
    if (saved && $("empId")) $("empId").value = saved;
  }catch{}
});
