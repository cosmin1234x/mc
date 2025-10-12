// ui.js — drawer, top search, profile menu, and nav actions (fixed)
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const drawer = $("drawer");
  const navToggle = $("navToggle");
  const navClose = $("navClose");
  const navFX = $("navFX");
  const navAdmin = $("navAdmin");
  const navLogout = $("navLogout");

  const headerAdminBtn = $("openAdmin"); // topbar Admin button

  const userMenuBtn = $("userMenuBtn");
  const userMenu = $("userMenu");
  const menuAdmin = $("menuAdmin");
  const menuLogout = $("menuLogout");
  const menuToggleFX = $("menuToggleFX");

  const chatTextTop = $("chatText");
  const sendTop = $("sendTop");
  const chatTextBottom = $("chatTextBottom");
  const chatForm = $("chatForm");

  // Helper: open Admin modal directly (no proxy click)
  function openAdminDirect() {
    const modal = $("adminModal");
    if (modal?.showModal) modal.showModal();
  }

  // Helper: toggle FX via existing button (fallback-safe)
  function toggleFX() {
    const fxBtn = $("toggleFX");
    if (fxBtn) fxBtn.click();
  }

  // Drawer
  const openDrawer = () => drawer?.classList.add("open");
  const closeDrawer = () => drawer?.classList.remove("open");
  navToggle?.addEventListener("click", (e)=>{ e.preventDefault(); openDrawer(); });
  navClose?.addEventListener("click", (e)=>{ e.preventDefault(); closeDrawer(); });
  drawer?.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });

  // User menu
  function toggleUserMenu(force){
    if (!userMenu) return;
    const open = (force === undefined) ? userMenu.hidden : !force;
    userMenu.hidden = !open;
  }
  userMenuBtn?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleUserMenu(); });
  document.addEventListener("click", (e)=>{
    if (!userMenu || !userMenuBtn) return;
    if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) userMenu.hidden = true;
  });

  // Top bar send hooks into bottom chat form
  sendTop?.addEventListener("click", (e)=>{
    e.preventDefault();
    const txt = (chatTextTop?.value || "").trim();
    if (!txt) return;
    if (chatTextBottom) chatTextBottom.value = txt;
    chatForm?.dispatchEvent(new Event("submit", { cancelable:true, bubbles:true }));
    chatTextTop.value = "";
  });

  // Header Admin button
  headerAdminBtn?.addEventListener("click", (e)=>{ e.preventDefault(); openAdminDirect(); });

  // Menu items
  navFX?.addEventListener("click", (e)=>{ e.preventDefault(); toggleFX(); closeDrawer(); });
  menuToggleFX?.addEventListener("click", (e)=>{ e.preventDefault(); toggleFX(); toggleUserMenu(false); });

  function doOpenAdmin(e){ e?.preventDefault?.(); openAdminDirect(); closeDrawer(); toggleUserMenu(false); }
  navAdmin?.addEventListener("click", doOpenAdmin);
  menuAdmin?.addEventListener("click", doOpenAdmin);

  async function doLogout(e){
    e?.preventDefault?.();
    try{ await NF?.signOut?.("/"); }catch{}
  }
  navLogout?.addEventListener("click", doLogout);
  menuLogout?.addEventListener("click", doLogout);

  // Drawer “sections”
  document.querySelectorAll(".nav-item[data-nav]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      const target = btn.getAttribute("data-nav");
      if (target === "chat") document.querySelector("#chatTextBottom")?.focus();
      if (target === "knowledge") document.querySelector("#kbList")?.scrollIntoView({ behavior:"smooth", block:"start" });
      if (target === "swaps") {
        const input = $("chatTextBottom"); const form = $("chatForm");
        if (input && form){ input.value = "/swaps"; form.dispatchEvent(new Event("submit", { cancelable:true, bubbles:true })); }
      }
      if (target === "dashboard") window.scrollTo({ top:0, behavior:"smooth" });
      closeDrawer();
    });
  });

  // Persist Employee ID
  $("saveEmpId")?.addEventListener("click", (e)=>{
    e.preventDefault();
    const emp = $("empId")?.value?.trim();
    if (!emp) return;
    try{ localStorage.setItem("mccrew_emp_id", emp); }catch{}
    const toast = document.createElement("div");
    toast.className = "toast good"; toast.textContent = "Employee ID saved";
    (document.getElementById("toasts")||document.body).appendChild(toast);
    setTimeout(()=>{ toast.classList.add("leave"); setTimeout(()=>toast.remove(), 200); }, 1600);
  });
  try{
    const saved = localStorage.getItem("mccrew_emp_id");
    if (saved && $("empId")) $("empId").value = saved;
  }catch{}
});
