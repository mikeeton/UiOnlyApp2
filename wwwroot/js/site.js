// File: wwwroot/js/site.js
// Global UI namespace
window.UI = (() => {

  // 🔐 Login form handler
  function login(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value.trim();

    if (!email || !pass) {
      alert("Please enter both email and password.");
      return false;
    }

    // Demo only: redirect by role keyword
    if (email.includes("clin")) window.location.href = "/Home/Clinician";
    else if (email.includes("admin")) window.location.href = "/Home/Admin";
    else window.location.href = "/Home/Patient";

    return false;
  }

  // 👁️ Toggle password visibility
  function togglePass(btn) {
    const input = btn.previousElementSibling;
    if (!input) return;
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.innerHTML = `<i class="bi bi-eye${isHidden ? '-slash' : ''}"></i>`;
  }

  // 💬 Add comment (Patient)
  function addComment(e) {
    e.preventDefault();
    const box = document.getElementById("commentInput");
    const text = box.value.trim();
    if (!text) return false;

    const thread = document.getElementById("commentsThread");
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="avatar patient">P</div>
      <div class="bubble">
        <div>${text}</div>
        <div class="meta mt-1">You • just now</div>
      </div>`;
    thread.prepend(div);
    box.value = "";
    return false;
  }

  // 💬 Clinician reply
  function replyClinician(e) {
    e.preventDefault();
    const box = document.getElementById("clinReply");
    const text = box.value.trim();
    if (!text) return false;

    const thread = document.getElementById("clinThread");
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="avatar clinician">C</div>
      <div class="bubble">
        <div>${text}</div>
        <div class="meta mt-1">Clinician • just now</div>
      </div>`;
    thread.prepend(div);
    box.value = "";
    return false;
  }

  // 🧍 Create user (Admin)
  function createUser(e) {
    e.preventDefault();
    const name = document.getElementById("newFullName").value.trim();
    const email = document.getElementById("newEmail").value.trim();
    const role = document.getElementById("newRole").value;
    const group = document.getElementById("newGroup").value.trim() || "-";
    if (!name || !email) return false;

    const tbody = document.getElementById("tblUsers");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${email}</td>
      <td><span class="badge text-bg-primary">${role}</span></td>
      <td>${group}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </td>`;
    tbody.appendChild(tr);

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalCreateUser"));
    modal?.hide();
    e.target.reset();
    return false;
  }

  // 📈 Generate report (UI only)
  function generateReport(e) {
    e.preventDefault();
    alert("Generating demo report...");
    populateReport();
    return false;
  }

  // 💾 Export report (PDF/CSV)
  function exportReport(type) {
    alert(`Exporting as ${type.toUpperCase()} (demo only)`);
  }

  // 📊 Populate dummy report data
  function populateReport() {
    const tbody = document.getElementById("tblReport");
    if (!tbody) return;
    tbody.innerHTML = "";

    for (let i = 0; i < 10; i++) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(Date.now() - i * 3600000).toLocaleString()}</td>
        <td>${(Math.random() * 80 + 100).toFixed(1)}</td>
        <td>${(Math.random() * 30 + 60).toFixed(1)}%</td>
        <td>${Math.random() < 0.2 ? "⚠️" : ""}</td>`;
      tbody.appendChild(row);
    }
    document.getElementById("repPeak").innerText = "180";
    document.getElementById("repAvg").innerText = "112";
    document.getElementById("repContact").innerText = "72%";
    document.getElementById("repAlerts").innerText = "3";
  }

  // 🧠 Auto-demo injection (onload)
  function init() {
    // Populate admin demo users
    const tbl = document.getElementById("tblUsers");
    if (tbl) {
      ["John Doe", "Jane Clin", "Admin One"].forEach((n, i) => {
        const role = i === 2 ? "admin" : i === 1 ? "clinician" : "patient";
        const email = `${n.split(" ")[0].toLowerCase()}@example.com`;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${n}</td>
          <td>${email}</td>
          <td><span class="badge text-bg-primary">${role}</span></td>
          <td>${i === 0 ? "Ward A" : "Ward B"}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()">
              <i class="bi bi-trash"></i>
            </button>
          </td>`;
        tbl.appendChild(tr);
      });
    }

    // Populate patients dropdown in reports
    const sel = document.getElementById("repPatient");
    if (sel) ["User-001", "User-002", "User-003"].forEach(u => {
      const opt = document.createElement("option");
      opt.textContent = u;
      sel.appendChild(opt);
    });
  }

  // Run on DOM load
  document.addEventListener("DOMContentLoaded", init);

  return { login, togglePass, addComment, replyClinician, createUser, generateReport, exportReport };
})();
