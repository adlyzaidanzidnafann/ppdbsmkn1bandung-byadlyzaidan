
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const app = document.querySelector("#app");
const authSection = document.querySelector("#auth-section");
const dashboardSection = document.querySelector("#dashboard-section");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#auth-description");
const authSubmitButton = document.querySelector("#auth-submit-button");
const registerNameField = document.querySelector("#register-name-field");
const authName = document.querySelector("#auth-name");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const dashboardTitle = document.querySelector("#dashboard-title");
const dashboardWelcome = document.querySelector("#dashboard-welcome");
const dashboardContent = document.querySelector("#dashboard-content");
const announcementsContainer = document.querySelector(
  "#announcements-container"
);
const tracksContainer = document.querySelector("#tracks-container");
const toastContainer = document.querySelector("#toast-container");

let supabase = null;
let authMode = "login";
let currentUser = null;
let currentProfile = null;
let tracks = [];

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.append(toast);
  setTimeout(() => toast.remove(), 4500);
}

function setAuthMessage(message = "", type = "") {
  authMessage.textContent = message;
  authMessage.className = `form-message ${type}`;
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";

  authTitle.textContent = registering
    ? "Buat Akun Siswa"
    : "Masuk ke Portal PPDB";

  authDescription.textContent = registering
    ? "Isi data akun untuk memulai pendaftaran."
    : "Masuk menggunakan email dan kata sandi.";

  authSubmitButton.textContent = registering ? "Daftar Akun" : "Masuk";
  registerNameField.hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering
    ? "new-password"
    : "current-password";

  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);

  setAuthMessage("");
}

function openAuth(mode = "login") {
  authSection.hidden = false;
  dashboardSection.hidden = true;
  setAuthMode(mode);
  authSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hidePrivateSections() {
  authSection.hidden = true;
  dashboardSection.hidden = true;
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function statusLabel(status) {
  const labels = {
    draft: "Draf",
    submitted: "Menunggu Verifikasi",
    verified: "Terverifikasi",
    revision: "Perlu Revisi",
    accepted: "Diterima",
    rejected: "Tidak Diterima"
  };

  return labels[status] || status || "Belum Ada";
}

function statusClass(status) {
  if (["verified", "accepted"].includes(status)) return "success";
  if (["revision", "submitted"].includes(status)) return "warning";
  if (status === "rejected") return "danger";
  return "";
}

function statusBadge(status) {
  return `<span class="status-badge ${statusClass(status)}">${escapeHTML(
    statusLabel(status)
  )}</span>`;
}

function showSetupError(message) {
  const existing = $("#setup-error");
  if (existing) existing.remove();

  const section = document.createElement("section");
  section.id = "setup-error";
  section.className = "section";
  section.innerHTML = `
    <div class="container">
      <div class="dashboard-panel">
        <h2>Konfigurasi Belum Lengkap</h2>
        <p>${escapeHTML(message)}</p>
        <p>
          Periksa variabel VITE_SUPABASE_URL dan
          VITE_SUPABASE_ANON_KEY di konfigurasi Vercel.
        </p>
      </div>
    </div>
  `;

  app.prepend(section);
}

async function loadTracks() {
  const { data, error } = await supabase
    .from("admission_tracks")
    .select("id, name, description, quota, is_open")
    .order("name");

  if (error) {
    console.error("Gagal memuat jalur:", error.message);
    return;
  }

  tracks = data || [];

  if (!tracks.length) return;

  tracksContainer.innerHTML = tracks.map((track) => `
    <article class="track-card">
      <span class="track-icon">🎓</span>
      <h3>${escapeHTML(track.name)}</h3>
      <p>${escapeHTML(track.description || "Informasi jalur pendaftaran.")}</p>
      <p style="margin-top:12px">
        ${track.is_open ? "Pendaftaran dibuka" : "Pendaftaran ditutup"}
      </p>
    </article>
  `).join("");
}

async function loadAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Gagal memuat pengumuman:", error.message);
    return;
  }

  if (!data?.length) return;

  announcementsContainer.innerHTML = data.map((item) => `
    <article class="announcement-item">
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.body)}</p>
      <p>${escapeHTML(formatDate(item.published_at))}</p>
    </article>
  `).join("");
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Profil belum tersedia. Periksa trigger pembuatan profil di Supabase."
    );
  }

  return data;
}

async function loadStudentDashboard() {
  const { data: application, error } = await supabase
    .from("applications")
    .select(`
      id,
      full_name,
      registration_number,
      track_id,
      status,
      revision_note,
      submitted_at,
      updated_at
    `)
    .eq("student_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  const track = tracks.find((item) => item.id === application?.track_id);

  dashboardTitle.textContent = "Dashboard Siswa";
  dashboardWelcome.textContent =
    `Selamat datang, ${currentProfile.full_name || currentUser.email}.`;

  dashboardContent.innerHTML = `
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <h3>Status Pendaftaran</h3>
        <p class="metric">${application ? escapeHTML(statusLabel(application.status)) : "Belum Daftar"}</p>
        <p>Pantau proses pendaftaran di sini.</p>
      </article>
      <article class="dashboard-card">
        <h3>Nomor Pendaftaran</h3>
        <p class="metric" style="font-size:18px">
          ${escapeHTML(application?.registration_number || "-")}
        </p>
        <p>Nomor diberikan sesuai proses sistem.</p>
      </article>
      <article class="dashboard-card">
        <h3>Jalur Pilihan</h3>
        <p class="metric" style="font-size:20px">
          ${escapeHTML(track?.name || "-")}
        </p>
        <p>Jalur pendaftaranmu.</p>
      </article>
    </div>

    ${application?.revision_note ? `
      <div class="dashboard-panel">
        <h3>Catatan Panitia</h3>
        <p>${escapeHTML(application.revision_note)}</p>
      </div>
    ` : ""}

    <div class="dashboard-panel">
      <h3>${application ? "Data Pendaftaran" : "Formulir Pendaftaran"}</h3>
      ${application && application.status !== "draft" && application.status !== "revision"
        ? `
          <p>Data pendaftaran telah dikirim. Perubahan hanya dapat dilakukan jika panitia meminta revisi.</p>
          <p>Status: ${statusBadge(application.status)}</p>
        `
        : renderApplicationForm(application)}
    </div>

    ${application ? `
      <div class="dashboard-panel">
        <h3>Dokumen Pendaftaran</h3>
        <p>Unggah dokumen yang diminta oleh sekolah dalam format PDF, JPG, atau PNG.</p>
        ${renderDocumentForm(application.id)}
        <div id="documents-list"></div>
      </div>
    ` : ""}
  `;

  if (application) {
    attachApplicationForm(application);
    attachDocumentForm(application.id);
    await loadDocuments(application.id);
  } else {
    attachApplicationForm(null);
  }
}

function renderApplicationForm(application) {
  const editable = !application ||
    ["draft", "revision"].includes(application.status);

  if (!editable) return "";

  return `
    <form id="application-form" class="dashboard-form">
      <div class="form-group">
        <label for="student-full-name">Nama lengkap</label>
        <input
          id="student-full-name"
          name="full_name"
          required
          maxlength="150"
          value="${escapeHTML(application?.full_name || currentProfile.full_name || "")}"
        />
      </div>

      <div class="form-group">
        <label for="student-nisn">NISN</label>
        <input
          id="student-nisn"
          name="nisn"
          inputmode="numeric"
          maxlength="20"
          required
          value="${escapeHTML(application?.nisn || "")}"
        />
      </div>

      <div class="form-group">
        <label for="student-birth-date">Tanggal lahir</label>
        <input
          id="student-birth-date"
          name="birth_date"
          type="date"
          required
          value="${escapeHTML(application?.birth_date || "")}"
        />
      </div>

      <div class="form-group">
        <label for="student-address">Alamat lengkap</label>
        <textarea
          id="student-address"
          name="address"
          required
          maxlength="1000"
        >${escapeHTML(application?.address || "")}</textarea>
      </div>

      <div class="form-group">
        <label for="student-track">Jalur pendaftaran</label>
        <select id="student-track" name="track_id" required>
          <option value="">Pilih jalur</option>
          ${tracks.filter((item) => item.is_open).map((track) => `
            <option
              value="${escapeHTML(track.id)}"
              ${application?.track_id === track.id ? "selected" : ""}
            >
              ${escapeHTML(track.name)}
            </option>
          `).join("")}
        </select>
      </div>

      <button class="btn btn-primary" type="submit">
        Simpan dan Kirim Pendaftaran
      </button>
      <p class="form-message" id="application-message" role="status"></p>
    </form>
  `;
}

function attachApplicationForm(application) {
  const form = $("#application-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = $("button[type='submit']", form);
    submitButton.disabled = true;
    submitButton.textContent = "Menyimpan...";

    const message = $("#application-message", form);
    message.textContent = "";

    const values = new FormData(form);
    const payload = {
      p_full_name: String(values.get("full_name") || "").trim(),
      p_nisn: String(values.get("nisn") || "").trim(),
      p_birth_date: values.get("birth_date"),
      p_address: String(values.get("address") || "").trim(),
      p_track_id: values.get("track_id")
    };

    try {
      const { error } = await supabase.rpc(
        "save_student_application",
        payload
      );

      if (error) throw error;

      showToast("Data pendaftaran berhasil disimpan.");
      await loadStudentDashboard();
    } catch (error) {
      console.error(error);
      message.textContent =
        error.message || "Pendaftaran gagal disimpan.";
      message.className = "form-message error";
    } finally {
      const currentButton = $("#application-form button[type='submit']");
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = "Simpan dan Kirim Pendaftaran";
      }
    }
  });
}

function renderDocumentForm(applicationId) {
  return `
    <form id="document-form" class="dashboard-form">
      <div class="form-group">
        <label for="document-type">Jenis dokumen</label>
        <select id="document-type" required>
          <option value="rapor">Rapor</option>
          <option value="kartu_keluarga">Kartu Keluarga</option>
          <option value="ijazah">Ijazah / Surat Keterangan Lulus</option>
          <option value="prestasi">Bukti Prestasi</option>
          <option value="afirmasi">Dokumen Afirmasi</option>
          <option value="lainnya">Dokumen Lainnya</option>
        </select>
      </div>
      <div class="form-group">
        <label for="document-file">Pilih berkas</label>
        <input
          id="document-file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          required
        />
      </div>
      <button class="btn btn-primary" type="submit">
        Unggah Dokumen
      </button>
      <p id="document-message" class="form-message" role="status"></p>
    </form>
  `;
}

function attachDocumentForm(applicationId) {
  const form = $("#document-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fileInput = $("#document-file");
    const typeInput = $("#document-type");
    const message = $("#document-message");
    const file = fileInput.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png"
    ];

    if (!allowedTypes.includes(file.type)) {
      message.textContent = "Gunakan file PDF, JPG, atau PNG.";
      message.className = "form-message error";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      message.textContent = "Ukuran file maksimal 5 MB.";
      message.className = "form-message error";
      return;
    }

    const button = $("button[type='submit']", form);
    button.disabled = true;
    button.textContent = "Mengunggah...";

    try {
      const extension = file.name.split(".").pop().toLowerCase();
      const path = `${currentUser.id}/${applicationId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("ppdb-documents")
        .upload(path, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("application_documents")
        .insert({
          application_id: applicationId,
          student_id: currentUser.id,
          document_type: typeInput.value,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size
        });

      if (insertError) {
        await supabase.storage.from("ppdb-documents").remove([path]);
        throw insertError;
      }

      message.textContent = "Dokumen berhasil diunggah.";
      message.className = "form-message success";
      fileInput.value = "";
      await loadDocuments(applicationId);
    } catch (error) {
      console.error(error);
      message.textContent = error.message || "Unggah dokumen gagal.";
      message.className = "form-message error";
    } finally {
      button.disabled = false;
      button.textContent = "Unggah Dokumen";
    }
  });
}

async function loadDocuments(applicationId) {
  const list = $("#documents-list");
  if (!list) return;

  const { data, error } = await supabase
    .from("application_documents")
    .select("id, document_type, file_name, created_at, verification_status, note")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = "Dokumen belum dapat dimuat.";
    console.error(error);
    return;
  }

  if (!data?.length) {
    list.innerHTML = "<p>Belum ada dokumen yang diunggah.</p>";
    return;
  }

  list.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Jenis</th>
            <th>Nama file</th>
            <th>Status</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((doc) => `
            <tr>
              <td>${escapeHTML(doc.document_type)}</td>
              <td>${escapeHTML(doc.file_name)}</td>
              <td>${statusBadge(doc.verification_status)}</td>
              <td>${escapeHTML(doc.note || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadAdminDashboard() {
  dashboardTitle.textContent = "Dashboard Panitia";
  dashboardWelcome.textContent =
    `Masuk sebagai ${currentProfile.full_name || currentUser.email}.`;

  dashboardContent.innerHTML = `
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <h3>Total Pendaftar</h3>
        <p class="metric" id="admin-total">-</p>
      </article>
      <article class="dashboard-card">
        <h3>Menunggu Verifikasi</h3>
        <p class="metric" id="admin-pending">-</p>
      </article>
      <article class="dashboard-card">
        <h3>Pengelolaan</h3>
        <p>Periksa data dan status pendaftaran.</p>
      </article>
    </div>

    <div class="dashboard-panel">
      <h3>Daftar Pendaftar</h3>
      <div id="admin-applications">
        <p>Memuat data pendaftar...</p>
      </div>
    </div>

    <div class="dashboard-panel">
      <h3>Terbitkan Pengumuman</h3>
      <form id="announcement-form" class="dashboard-form">
        <div class="form-group">
          <label for="announcement-title">Judul</label>
          <input id="announcement-title" required maxlength="200" />
        </div>
        <div class="form-group">
          <label for="announcement-body">Isi pengumuman</label>
          <textarea id="announcement-body" required maxlength="10000"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">
          Terbitkan Pengumuman
        </button>
        <p id="announcement-message" class="form-message" role="status"></p>
      </form>
    </div>
  `;

  await loadAdminApplications();
  attachAnnouncementForm();
}

async function loadAdminApplications() {
  const container = $("#admin-applications");

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id,
      full_name,
      nisn,
      registration_number,
      status,
      revision_note,
      created_at,
      profiles:student_id(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    container.textContent =
      "Data pendaftar gagal dimuat. Periksa kebijakan akses database.";
    return;
  }

  $("#admin-total").textContent = String(data.length);
  $("#admin-pending").textContent = String(
    data.filter((item) => item.status === "submitted").length
  );

  if (!data.length) {
    container.innerHTML = "<p>Belum ada pendaftar.</p>";
    return;
  }

  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>NISN</th>
            <th>Status</th>
            <th>Catatan revisi</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((item) => `
            <tr data-application-id="${escapeHTML(item.id)}">
              <td>
                ${escapeHTML(item.full_name)}
                <br />
                <small>${escapeHTML(item.registration_number || "-")}</small>
              </td>
              <td>${escapeHTML(item.nisn)}</td>
              <td>
                <select class="admin-status">
                  ${["submitted", "verified", "revision", "accepted", "rejected"]
                    .map((status) => `
                      <option value="${status}" ${item.status === status ? "selected" : ""}>
                        ${escapeHTML(statusLabel(status))}
                      </option>
                    `).join("")}
                </select>
              </td>
              <td>
                <textarea class="admin-note" rows="2" maxlength="2000">${escapeHTML(item.revision_note || "")}</textarea>
              </td>
              <td>
                <button class="btn btn-primary admin-save" type="button">
                  Simpan
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll(".admin-save").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest("tr");
      const id = row.dataset.applicationId;
      const status = $(".admin-status", row).value;
      const note = $(".admin-note", row).value.trim();

      button.disabled = true;
      button.textContent = "Menyimpan...";

      try {
        const { error } = await supabase.rpc("admin_review_application", {
          p_application_id: id,
          p_status: status,
          p_revision_note: note || null
        });

        if (error) throw error;

        showToast("Status pendaftaran berhasil diperbarui.");
        await loadAdminApplications();
      } catch (error) {
        console.error(error);
        showToast(error.message || "Status gagal diperbarui.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "Simpan";
      }
    });
  });
}

function attachAnnouncementForm() {
  const form = $("#announcement-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("#announcement-title").value.trim();
    const body = $("#announcement-body").value.trim();
    const message = $("#announcement-message");
    const button = $("button[type='submit']", form);

    button.disabled = true;

    try {
      const { error } = await supabase.rpc("publish_announcement", {
        p_title: title,
        p_body: body
      });

      if (error) throw error;

      message.textContent = "Pengumuman berhasil diterbitkan.";
      message.className = "form-message success";
      form.reset();

      await loadAnnouncements();
      showToast("Pengumuman berhasil diterbitkan.");
    } catch (error) {
      console.error(error);
      message.textContent = error.message || "Pengumuman gagal diterbitkan.";
      message.className = "form-message error";
    } finally {
      button.disabled = false;
    }
  });
}

async function showDashboard(user) {
  currentUser = user;
  currentProfile = await loadProfile(user);

  hidePrivateSections();
  dashboardSection.hidden = false;

  if (currentProfile.role === "admin") {
    await loadAdminDashboard();
  } else {
    await loadStudentDashboard();
  }

  dashboardSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  setAuthMessage("");

  const email = authEmail.value.trim();
  const password = authPassword.value;

  authSubmitButton.disabled = true;
  authSubmitButton.textContent = "Memproses...";

  try {
    if (authMode === "register") {
      const fullName = authName.value.trim();

      if (!fullName) {
        throw new Error("Nama lengkap wajib diisi.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        currentProfile = await loadProfile(data.user);
        showToast("Akun berhasil dibuat.");
        await showDashboard(data.user);
      } else {
        setAuthMessage(
          "Akun dibuat. Periksa email untuk konfirmasi, lalu masuk kembali.",
          "success"
        );
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await showDashboard(data.user);
      showToast("Berhasil masuk.");
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(
      error.message || "Proses autentikasi gagal.",
      "error"
    );
  } finally {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent =
      authMode === "register" ? "Daftar Akun" : "Masuk";
  }
}

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showToast("Gagal keluar dari akun.", "error");
    return;
  }

  currentUser = null;
  currentProfile = null;
  hidePrivateSections();
  showToast("Kamu telah keluar.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function attachEvents() {
  $("#auth-nav-button").addEventListener("click", () => openAuth("login"));
  $("#hero-register-button").addEventListener("click", () => openAuth("register"));

  loginTab.addEventListener("click", () => setAuthMode("login"));
  registerTab.addEventListener("click", () => setAuthMode("register"));
  authForm.addEventListener("submit", handleAuthSubmit);
  $("#logout-button").addEventListener("click", logout);

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentProfile = null;
      hidePrivateSections();
    }
  });
}

async function initialize() {
  attachEvents();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    showSetupError(
      "Aplikasi belum memiliki URL dan key Supabase. Atur variabel lingkungan di Vercel lalu lakukan redeploy."
    );
    return;
  }

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    await Promise.all([
      loadTracks(),
      loadAnnouncements()
    ]);

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      await showDashboard(data.session.user);
    }
  } catch (error) {
    console.error("Inisialisasi gagal:", error);
    showToast(
      "Koneksi belum berhasil. Periksa konfigurasi dan database Supabase.",
      "error"
    );
  }
}

initialize();
