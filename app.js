const app = document.querySelector("#app");
const storageKey = "rantau-app-v3";
const tokenKey = "rantau-api-token";

const initialState = {
  route: "login",
  isLoggedIn: false,
  activeFilter: "Semua",
  query: "",
  modalCommunity: null,
  routeParams: {},
  requests: {},
  joined: [],
  saved: [],
  rsvps: [],
  communities: [],
  notificationsRead: [],
  settings: {
    notification: true,
    visible: true,
    autoReply: true,
    localData: true
  },
  profile: {
    name: "",
    username: "",
    password: "",
    origin: "",
    city: "",
    bio: ""
  },
  messages: {}
};

let state = loadState();
let communities = state.communities;
let apiToken = localStorage.getItem(tokenKey) || "";

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function applyServerState(nextState) {
  state = mergeDeep(structuredClone(initialState), nextState);
  state.isLoggedIn = true;
  communities = state.communities;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored) return mergeDeep(structuredClone(initialState), stored);
  } catch (error) {
    console.warn("Failed to load saved RantaU data", error);
  }
  return structuredClone(initialState);
}

function saveState() {
  if (!state.settings.localData) return;
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (state.isLoggedIn && apiToken) {
    apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify({ state })
    }).catch((error) => console.warn("Backend save failed", error));
  }
}

function mergeDeep(base, updates) {
  Object.keys(updates || {}).forEach((key) => {
    if (updates[key] && typeof updates[key] === "object" && !Array.isArray(updates[key])) {
      base[key] = mergeDeep(base[key] || {}, updates[key]);
    } else {
      base[key] = updates[key];
    }
  });
  return base;
}

function setRoute(route, params = {}) {
  state.route = route;
  state.routeParams = params;
  state.modalCommunity = null;
  window.location.hash = buildHash(route, params);
  saveState();
  render();
  window.scrollTo({ top: 0, left: 0 });
}

function buildHash(route, params = {}) {
  const query = new URLSearchParams(params).toString();
  return query ? `${route}?${query}` : route;
}

function readHashRoute() {
  const raw = window.location.hash.replace("#", "");
  if (!raw) return;
  const [route, query = ""] = raw.split("?");
  state.route = route;
  state.routeParams = Object.fromEntries(new URLSearchParams(query));
}

function requireLogin(route) {
  if (["login", "register"].includes(route)) return true;
  return state.isLoggedIn;
}

function html(strings, ...values) {
  return strings.reduce((out, str, i) => out + str + (values[i] ?? ""), "");
}

function brand() {
  return html`<button class="brand brand-button" data-route="${state.isLoggedIn ? "dashboard" : "login"}">RantaU</button>`;
}

function authLayout(kind) {
  const register = kind === "register";
  return html`
    <main class="auth" style="--auth-bg: ${register ? "var(--gold)" : "var(--lavender)"}">
      <section class="auth-panel">
        ${brand()}
        <h1 class="auth-title">${register ? "Buat akun RantaU" : "Teman rantau mulai dari sini."}</h1>
        <p class="auth-copy">
          ${register
            ? "Isi profil dasar dulu. Detail lain bisa diedit nanti."
            : "Login dulu buat cari komunitas, lihat profil kamu, dan mulai kenalan dengan orang yang satu kota atau satu minat."}
        </p>
      </section>
      <section class="auth-main">
        <form class="auth-box" data-form="${register ? "register" : "login"}" novalidate>
          <h1>${register ? "Create account" : "Login"}</h1>
          ${register ? "" : `<p class="subtle">Masuk dulu buat cari teman rantau.</p>`}
          ${register ? field("Nama lengkap", "name", state.profile.name, "text", true) : ""}
          ${field("Username", "username", register ? state.profile.username : "", "text", true)}
          ${field("Password", "password", "", "password", true)}
          ${register ? field("Kota asal", "origin", state.profile.origin, "text", true) : ""}
          ${register ? field("Kota rantau", "city", state.profile.city, "text", true) : ""}
          <div class="form-error" data-error></div>
          <div class="auth-actions">
            <button class="btn primary" type="submit">${register ? "Buat akun" : "Login"}</button>
            ${register
              ? `<button class="link-btn" type="button" data-route="login">Sudah punya akun? Login</button>`
              : `<button class="btn pink" type="button" data-route="register">Buat akun baru</button>`}
          </div>
        </form>
      </section>
    </main>
  `;
}

function field(label, name, value, type = "text", required = false) {
  return html`
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeAttr(value)}" ${required ? "required" : ""}>
    </label>
  `;
}

function shell(content, active = "Home") {
  return html`
    <div class="app-shell">
      <header class="topbar">
        ${brand()}
        <nav class="nav" aria-label="Primary">
          ${navButton("Home", "dashboard", active)}
          ${navButton("Profile", "profile", active)}
          ${navButton("Communities", "communities", active)}
          ${navButton("Chat", "chat", active)}
          ${navButton("Settings", "settings", active)}
        </nav>
      </header>
      ${sidebar()}
      <main class="main">${content}</main>
    </div>
    ${state.modalCommunity ? modal() : ""}
  `;
}

function navButton(label, route, active) {
  return `<button class="nav-btn ${active === label ? "active" : ""}" data-route="${route}">${label}</button>`;
}

function sidebar() {
  return html`
    <aside class="sidebar">
      <div class="user-card card">
        <h2>${firstName()}</h2>
        <div class="handle">@${escapeHtml(state.profile.username)}</div>
        <div class="avatar">${initials()}</div>
      </div>
      <button class="btn primary" data-route="profile">Lihat Profile</button>
      <div class="card stat-card"><strong class="blank-value"></strong><span class="subtle">komunitas tersedia di sekitar kota rantau</span></div>
      <div class="card stat-card"><strong class="blank-value"></strong><span class="subtle">cocok berdasarkan minat dan tujuan</span></div>
      <div class="card stat-card"><strong class="blank-value"></strong><span class="subtle">komunitas aktif</span><span class="subtle">request menunggu</span></div>
    </aside>
  `;
}

function dashboard() {
  const nearbyEvents = communities.filter((community) => state.joined.includes(community.id) || state.saved.includes(community.id));
  return shell(html`
    <section class="view wide">
      <div class="panel hero-panel">
        <div>
          <h1>Temukan teman rantau yang satu frekuensi.</h1>
          <p class="subtle">RantaU bantu kamu masuk ke komunitas yang cocok sebelum mulai kenalan.</p>
          <div class="actions">
            <button class="btn primary" data-route="communities">Cari komunitas</button>
            <button class="btn gold" data-route="notifications">Cek notifikasi</button>
          </div>
        </div>
        <div class="hero-note">${state.joined.length ? "Kamu sudah punya komunitas aktif" : "Komunitas untuk minggu pertama di kota baru"}</div>
      </div>
      <h2>Ringkasan hari ini</h2>
      <div class="metric-grid">
        <div class="metric"><strong class="blank-value"></strong><span class="subtle">anggota aktif</span></div>
        <div class="metric"><strong class="blank-value"></strong><span class="subtle">match komunitas</span></div>
        <div class="metric"><strong class="blank-value"></strong><span class="subtle">event dekat</span></div>
        <div class="metric mint"><strong class="blank-value"></strong><span>profil valid</span></div>
      </div>
      <div class="panel status-note">
        <h2>Agenda terdekat</h2>
        ${nearbyEvents.map((community) => agendaItem(community)).join("") || `<p class="subtle">Simpan atau join komunitas untuk melihat agenda.</p>`}
      </div>
    </section>
  `, "Home");
}

function agendaItem(community) {
  const rsvp = state.rsvps.includes(community.id);
  return html`
    <div class="list-line">
      <span class="check">${rsvp ? "GO" : "EV"}</span>
      <span><strong>${community.nextEvent}</strong><br><span class="subtle">${community.name} &bull; ${community.location}</span></span>
      <button class="btn ${rsvp ? "mint" : "gold"}" data-action="toggle-rsvp" data-community="${community.id}">${rsvp ? "Terdaftar" : "Ikut"}</button>
    </div>
  `;
}

function profile() {
  const activeRows = state.joined.map((id) => communityById(id)).filter(Boolean);
  const savedRows = state.saved.map((id) => communityById(id)).filter(Boolean);
  return shell(html`
    <section class="view wide">
      <div class="panel profile-hero">
        <div class="big-avatar">${initials()}</div>
        <div>
          <h1>${escapeHtml(state.profile.name)}</h1>
          <p class="subtle">@${escapeHtml(state.profile.username)} &bull; ${escapeHtml(state.profile.origin || "Kota asal")} ke ${escapeHtml(state.profile.city || "Kota rantau")}</p>
          <p><strong>${escapeHtml(state.profile.bio || "Bio belum diisi.")}</strong></p>
          <div class="info-row">
            <div class="info-box"><span class="subtle">Kota asal</span><br><strong>${escapeHtml(state.profile.origin || "-")}</strong></div>
            <div class="info-box"><span class="subtle">Kota rantau</span><br><strong>${escapeHtml(state.profile.city || "-")}</strong></div>
            <button class="btn primary" data-route="edit-profile">Edit profile</button>
          </div>
        </div>
      </div>
      <div class="two-col">
        <div class="panel">
          <h2>Komunitas aktif</h2>
          ${activeRows.map((community) => communityLine(community, "joined")).join("") || `<p class="subtle">Belum join komunitas.</p>`}
          ${savedRows.map((community) => communityLine(community, "saved")).join("")}
        </div>
        <div class="panel">
          <h2>Account settings</h2>
          ${settingRow("Notification", "On", "notification")}
          ${settingRow("Profile visible", "Community only", "visible")}
        </div>
      </div>
    </section>
  `, "Profile");
}

function communityLine(community, status) {
  return html`
    <div class="list-line">
      <span class="check">${status === "joined" ? "IN" : "SV"}</span>
      <span>${community.name}</span>
      <span class="subtle">${status}</span>
    </div>
  `;
}

function editProfile() {
  return shell(html`
    <section class="view wide">
      <form class="panel profile-form" data-form="profile" novalidate>
        <h1 class="full">Edit profile</h1>
        ${field("Nama", "name", state.profile.name, "text", true)}
        ${field("Username", "username", state.profile.username, "text", true)}
        ${field("Kota asal", "origin", state.profile.origin, "text", true)}
        ${field("Kota rantau", "city", state.profile.city, "text", true)}
        <label class="field full">
          <span>Bio</span>
          <textarea name="bio" required>${escapeHtml(state.profile.bio)}</textarea>
        </label>
        <div class="form-error full" data-error></div>
        <div class="actions full">
          <button class="btn primary" type="submit">Simpan</button>
          <button class="btn" type="button" data-route="profile">Batal</button>
        </div>
      </form>
    </section>
  `, "Profile");
}

function communitiesView() {
  const filtered = communities.filter((community) => {
    const byChip = state.activeFilter === "Semua" || community.category === state.activeFilter;
    const text = `${community.name} ${community.city} ${community.category}`.toLowerCase();
    return byChip && text.includes(state.query.toLowerCase());
  });

  return shell(html`
    <section class="view wide">
      <div class="search-row">
        <h1 style="margin:0; flex:1 1 280px">Cari komunitas</h1>
        <button class="btn primary" data-route="create-community">Buat komunitas baru</button>
        <div class="chip-row">
          ${["Semua", "Kuliner", "Karier", "Bahasa daerah"].map(chip).join("")}
        </div>
      </div>
      <div class="search-row">
        <input class="search-input" data-search value="${escapeAttr(state.query)}" placeholder="Cari komunitas..." aria-label="Cari komunitas">
        <button class="btn" data-action="reset-search">Reset</button>
      </div>
      <div class="community-grid">
        ${filtered.map(communityCard).join("") || `<div class="panel"><h3>Belum ada komunitas</h3><p class="subtle">Data komunitas akan tampil setelah tersedia dari backend.</p></div>`}
      </div>
      <div class="panel status-note">
        <h3>Filter aktif: ${state.activeFilter === "Semua" ? "Semua komunitas" : state.activeFilter}</h3>
        <p class="subtle">Gunakan pencarian dan filter setelah data komunitas tersedia.</p>
      </div>
    </section>
  `, "Communities");
}

function createCommunity() {
  return shell(html`
    <section class="view wide">
      <form class="panel profile-form" data-form="community" novalidate>
        <h1 class="full">Buat komunitas baru</h1>
        ${field("Nama komunitas", "name", "", "text", true)}
        ${field("Kota", "city", state.profile.city || "", "text", true)}
        <label class="field">
          <span>Kategori</span>
          <input name="category" type="text" value="" placeholder="Kuliner, Karier, Bahasa daerah..." required>
        </label>
        <label class="field">
          <span>Next event</span>
          <input name="nextEvent" type="text" value="" placeholder="Contoh: Diskusi komunitas minggu ini">
        </label>
        <label class="field">
          <span>Lokasi event</span>
          <input name="location" type="text" value="" placeholder="Lokasi atau area">
        </label>
        <label class="field full">
          <span>Deskripsi komunitas</span>
          <textarea name="description" required placeholder="Jelaskan tujuan komunitas dan siapa yang cocok untuk bergabung."></textarea>
        </label>
        <label class="field full">
          <span>Alasan cocok</span>
          <textarea name="reasons" placeholder="Tulis satu alasan per baris."></textarea>
        </label>
        <div class="form-error full" data-error></div>
        <div class="actions full">
          <button class="btn primary" type="submit">Simpan komunitas</button>
          <button class="btn" type="button" data-route="communities">Batal</button>
        </div>
      </form>
    </section>
  `, "Communities");
}

function chip(name) {
  return `<button class="chip ${state.activeFilter === name ? "active" : ""}" data-filter="${name}">${name}</button>`;
}

function communityCard(community) {
  const status = communityStatus(community.id);
  return html`
    <article class="community-card card">
      <div class="community-art ${community.art}"></div>
      <h3>${community.name}</h3>
      <p class="subtle">${community.city || "Kota belum diisi"} &bull; ${community.category || "Kategori belum diisi"}</p>
      <div class="tag-row">
        <span class="tag">${community.category}</span>
        <span class="tag">${status}</span>
      </div>
      <div class="card-actions">
        <button class="btn primary" data-route="community-detail" data-community="${community.id}">Lihat</button>
        ${communityActionButton(community)}
      </div>
    </article>
  `;
}

function communityActionButton(community) {
  if (state.joined.includes(community.id)) return `<button class="btn gold" data-route="chat" data-community="${community.id}">Chat</button>`;
  if (state.requests[community.id] === "pending") return `<button class="btn gold" data-route="request-sent" data-community="${community.id}">Status</button>`;
  if (state.saved.includes(community.id)) return `<button class="btn" data-action="toggle-save" data-community="${community.id}">Unsave</button>`;
  return `<button class="btn primary" data-action="send-request" data-community="${community.id}">Request</button>`;
}

function communityDetail() {
  const community = communityById(state.routeParams.community);
  if (!community) return shell(emptyPanel("Data komunitas belum tersedia", "Detail komunitas akan tampil setelah backend menyediakan data komunitas."), "Communities");
  const saved = state.saved.includes(community.id);
  const joined = state.joined.includes(community.id);
  const pending = state.requests[community.id] === "pending";
  return shell(html`
    <section class="view wide">
      <h1>${community.name}</h1>
      <p class="subtle">${community.city || "Kota belum diisi"} &bull; ${community.category || "Kategori belum diisi"}</p>
      <div class="detail-layout">
        <div>
          <div class="detail-image ${community.art}"></div>
          <div class="actions" style="margin-top: 28px">
            ${joined
              ? `<button class="btn primary" data-route="chat" data-community="${community.id}">Mulai Chat</button>`
              : pending
                ? `<button class="btn gold" data-route="request-sent" data-community="${community.id}">Lihat status</button>`
                : `<button class="btn primary" data-action="send-request" data-community="${community.id}">Kirim Permintaan</button>`}
            <button class="btn gold" data-action="toggle-save" data-community="${community.id}">${saved ? "Tersimpan" : "Simpan"}</button>
            <button class="btn ${state.rsvps.includes(community.id) ? "mint" : ""}" data-action="toggle-rsvp" data-community="${community.id}">
              ${state.rsvps.includes(community.id) ? "Ikut event" : "Daftar event"}
            </button>
          </div>
        </div>
        <div class="reason-card card">
          <h2>Kenapa cocok?</h2>
          ${(community.reasons || []).map((reason) => `<p>&bull; ${reason}</p>`).join("") || `<p class="subtle">Data rekomendasi belum tersedia.</p>`}
        </div>
      </div>
      <div class="description card">
        <h3>Deskripsi komunitas</h3>
        <p class="subtle">${community.description || "Deskripsi belum tersedia."}</p>
        <h3>Next event</h3>
        <p class="subtle">${community.nextEvent || "Event belum tersedia"}${community.location ? ` &bull; ${community.location}` : ""}</p>
      </div>
    </section>
  `, "Communities");
}

function requestSent() {
  const community = communityById(state.routeParams.community);
  if (!community) return shell(emptyPanel("Request belum tersedia", "Data request akan tampil setelah ada komunitas yang dipilih."), "Communities");
  return shell(html`
    <section class="view wide">
      <h1>Request terkirim</h1>
      <div class="request-grid">
        <div class="panel">
          <h2>${community.name}</h2>
          <p class="subtle">Permintaan kamu sudah masuk ke sistem dan tersimpan di browser ini.</p>
          <div class="list-line"><span class="check">OK</span><span>Profil dasar valid</span><span></span></div>
          <div class="list-line"><span class="check" style="background: var(--gold)">...</span><span>Menunggu admin komunitas</span><span></span></div>
        </div>
        <div class="status-card sent-card"><div><strong>Sent</strong><span>${state.settings.notification ? "notifikasi aktif" : "notifikasi off"}</span></div></div>
      </div>
      <div class="actions" style="margin-top: 26px">
        <button class="btn primary" data-action="approve-request" data-community="${community.id}">Simulasikan diterima</button>
        <button class="btn gold" data-route="notifications">Lihat notifikasi</button>
        <button class="btn pink" data-action="cancel-request" data-community="${community.id}">Batal request</button>
      </div>
    </section>
  `, "Communities");
}

function accepted() {
  const community = communityById(state.routeParams.community);
  if (!community) return shell(emptyPanel("Status belum tersedia", "Data penerimaan akan tampil setelah request komunitas disetujui."), "Communities");
  return shell(html`
    <section class="view wide">
      <h1>Kamu diterima</h1>
      <div class="panel">
        <div class="search-row" style="margin:0">
          <div style="flex:1 1 300px">
            <h2>${community.name}</h2>
            <p class="subtle">Selamat, ${firstName()}. Kamu sudah masuk grup dan bisa mulai interaksi.</p>
          </div>
          <button class="btn primary" data-route="chat" data-community="${community.id}">Mulai Chat</button>
        </div>
      </div>
      <h2>Buddy rekomendasi</h2>
      <div class="buddy-grid">
        <div>
          <p class="subtle">Rekomendasi buddy akan tampil setelah data anggota tersedia.</p>
        </div>
        <div class="event-card card">
          <h2>Next event</h2>
          <h3>${community.nextEvent || "Event belum tersedia"}</h3>
          <p class="subtle">${community.location || "Lokasi belum tersedia"}</p>
          <button class="btn primary" data-action="toggle-rsvp" data-community="${community.id}">${state.rsvps.includes(community.id) ? "Batalkan RSVP" : "Ikut event"}</button>
        </div>
      </div>
    </section>
  `, "Communities");
}

function buddy(initialsText, name, detail, tone = "") {
  return html`
    <div class="buddy-card card">
      <div class="mini-avatar ${tone}">${initialsText}</div>
      <div><h3>${name}</h3><p class="subtle">${detail}</p></div>
    </div>
  `;
}

function notifications() {
  const items = notificationsData();
  return shell(html`
    <section class="view wide">
      <h1>Notifications</h1>
      <div class="notification-grid">
        <div>
          ${items.length
            ? items.map((item) => notificationItem(item)).join("")
            : `<div class="notification"><div class="notif-icon"></div><div><h3>Belum ada notifikasi</h3><p class="subtle">Semua sudah dibaca.</p></div></div>`}
        </div>
        <div class="empty-panel card">
          <h2>${items.length ? `${items.length} pesan baru` : "Empty state"}</h2>
          <p class="subtle">${items.length ? "Tindak lanjuti request, chat, dan event dari sini." : "Kalau belum ada notifikasi, area ini menampilkan pesan kosong."}</p>
          <button class="btn gold" data-action="mark-read" style="margin-top: 48px">Mark all read</button>
        </div>
      </div>
    </section>
  `, "Settings");
}

function notificationsData() {
  const dynamic = [];
  Object.entries(state.requests).forEach(([id, status]) => {
    const community = communityById(id);
    if (!community) return;
    if (status === "pending") {
      dynamic.push({ id: `request-${id}`, title: "Permintaan terkirim", copy: `Request kamu ke ${community.name} sedang diverifikasi.`, tone: "mint", route: "request-sent", community: id });
    }
  });
  state.joined.forEach((id) => {
    const community = communityById(id);
    if (community) dynamic.push({ id: `accepted-${id}`, title: "Kamu diterima", copy: `Kamu sudah masuk ke ${community.name}.`, tone: "gold", route: "accepted", community: id });
  });
  if (Object.values(state.messages).some((messages) => messages.length > 4)) {
    dynamic.push({ id: "chat-new", title: "Chat aktif", copy: "Percakapan terakhir kamu tersimpan.", tone: "lavender", route: "chat", community: state.joined[0] || "" });
  }
  return dynamic.filter((item) => !state.notificationsRead.includes(item.id));
}

function notificationItem(item) {
  return html`
    <button class="notification" data-route="${item.route}" data-community="${item.community}">
      <span class="notif-icon ${item.tone}"></span>
      <span style="text-align:left"><h3>${item.title}</h3><span class="subtle">${item.copy}</span></span>
    </button>
  `;
}

function settings() {
  return shell(html`
    <section class="view wide">
      <div class="panel">
        <h1>Settings</h1>
        ${settingRow("Notification", "On", "notification")}
        ${settingRow("Profile visible", "Community only", "visible")}
        ${settingRow("Auto reply chat", "On", "autoReply")}
        ${settingRow("Save local data", "On", "localData")}
        <div class="actions" style="margin-top: 30px">
          <button class="btn pink" data-action="logout">Logout</button>
          <button class="btn gold" data-action="reset-data">Reset app data</button>
        </div>
      </div>
    </section>
  `, "Settings");
}

function settingRow(label, value, key) {
  return html`
    <div class="settings-row">
      <span>${label}</span>
      <span class="subtle">${state.settings[key] ? value : "Off"}</span>
      <button class="switch ${state.settings[key] ? "" : "off"}" data-toggle="${key}" aria-label="Toggle ${label}">
        <span></span>
      </button>
    </div>
  `;
}

function chat() {
  const community = communityById(state.routeParams.community) || communityById(state.joined[0]);
  if (!community) return shell(emptyPanel("Chat belum tersedia", "Chat akan aktif setelah user bergabung dengan komunitas."), "Chat");
  const messages = state.messages[community.id] || [];
  return shell(html`
    <section class="view wide">
      <div class="chat-panel panel">
        <h1>${community.name}</h1>
        <p class="subtle">Percakapan komunitas</p>
        <div class="messages" aria-live="polite">
          ${messages.map((message) => chatBubble(message)).join("") || `<div class="chat-bubble">Belum ada pesan.<span></span></div>`}
        </div>
        <form class="chat-composer" data-form="chat" data-community="${community.id}">
          <input class="search-input" name="message" placeholder="Tulis pesan..." aria-label="Tulis pesan" required>
          <button class="btn gold" type="submit">Kirim</button>
        </form>
      </div>
    </section>
  `, "Chat");
}

function chatBubble(message) {
  return `<div class="chat-bubble ${message.from === "me" ? "me" : ""}">${escapeHtml(message.text)}<span>${escapeHtml(message.time || "")}</span></div>`;
}

function seedMessages(id) {
  state.messages[id] = [];
  saveState();
  return state.messages[id];
}

function modal() {
  const community = communityById(state.modalCommunity);
  if (!community) return "";
  return html`
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${community.name}" data-modal>
        <h2>${community.name}</h2>
        <p class="subtle">${community.city || "Kota belum diisi"}</p>
        <p>${community.description || "Deskripsi belum tersedia."}</p>
        <div class="actions">
          <button class="btn primary" data-route="community-detail" data-community="${community.id}">Buka detail</button>
          <button class="btn" data-action="close-modal">Tutup</button>
        </div>
      </div>
    </div>
  `;
}

function emptyPanel(title, message) {
  return html`
    <section class="view wide">
      <div class="panel">
        <h1>${title}</h1>
        <p class="subtle">${message}</p>
        <button class="btn primary" data-route="communities">Cari komunitas</button>
      </div>
    </section>
  `;
}

function render() {
  readHashRoute();
  if (!requireLogin(state.route)) {
    state.route = "login";
  }
  const routes = {
    login: () => authLayout("login"),
    register: () => authLayout("register"),
    dashboard,
    profile,
    "edit-profile": editProfile,
    communities: communitiesView,
    "create-community": createCommunity,
    "community-detail": communityDetail,
    "request-sent": requestSent,
    accepted,
    notifications,
    settings,
    chat
  };
  app.innerHTML = (routes[state.route] || dashboard)();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function communityById(id) {
  return communities.find((community) => community.id === id);
}

function communityStatus(id) {
  if (state.joined.includes(id)) return "joined";
  if (state.requests[id] === "pending") return "pending";
  if (state.saved.includes(id)) return "saved";
  return "open";
}

function totalMembers() {
  return communities.reduce((sum, community) => sum + community.members, 0);
}

function bestMatch() {
  return communities.length ? Math.max(...communities.map((community) => community.match || 0)) : 0;
}

function profileComplete() {
  return ["name", "username", "origin", "city", "bio"].every((key) => state.profile[key]?.trim());
}

function firstName() {
  return escapeHtml(state.profile.name.split(" ")[0] || "User");
}

function initials() {
  return escapeHtml(state.profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U");
}

function currentTime() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function createId(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "community";
  return `${slug}-${Date.now().toString(36)}`;
}

function validateRequired(form) {
  const invalid = [...form.querySelectorAll("[required]")].find((fieldItem) => !fieldItem.value.trim());
  if (invalid) {
    invalid.focus();
    showError(form, "Semua field wajib diisi dulu.");
    return false;
  }
  return true;
}

function showError(form, message) {
  const target = form.querySelector("[data-error]");
  if (target) target.textContent = message;
}

function routeParamsFromTarget(target) {
  return target.dataset.community ? { community: target.dataset.community } : {};
}

document.addEventListener("click", (event) => {
  const modalBox = event.target.closest("[data-modal]");
  const routeTarget = event.target.closest("[data-route]");
  const actionTarget = event.target.closest("[data-action]");
  const filterTarget = event.target.closest("[data-filter]");
  const toggleTarget = event.target.closest("[data-toggle]");

  if (modalBox && !routeTarget && !actionTarget) return;

  if (routeTarget) {
    setRoute(routeTarget.dataset.route, routeParamsFromTarget(routeTarget));
    return;
  }

  if (filterTarget) {
    state.activeFilter = filterTarget.dataset.filter;
    saveState();
    render();
    return;
  }

  if (toggleTarget) {
    const key = toggleTarget.dataset.toggle;
    state.settings[key] = !state.settings[key];
    if (key === "localData" && !state.settings.localData) localStorage.removeItem(storageKey);
    saveState();
    render();
    return;
  }

  if (!actionTarget) return;
  const { action, community } = actionTarget.dataset;

  if (action === "reset-search") {
    state.query = "";
    state.activeFilter = "Semua";
  }
  if (action === "detail") state.modalCommunity = community;
  if (action === "close-modal") state.modalCommunity = null;
  if (action === "send-request") {
    state.requests[community] = "pending";
    if (!state.saved.includes(community)) state.saved.push(community);
    setRoute("request-sent", { community });
    return;
  }
  if (action === "approve-request") {
    delete state.requests[community];
    if (!state.joined.includes(community)) state.joined.push(community);
    state.saved = state.saved.filter((id) => id !== community);
    seedMessages(community);
    setRoute("accepted", { community });
    return;
  }
  if (action === "cancel-request") {
    delete state.requests[community];
    setRoute("communities");
    return;
  }
  if (action === "toggle-save") {
    state.saved = state.saved.includes(community)
      ? state.saved.filter((id) => id !== community)
      : [...state.saved, community];
  }
  if (action === "toggle-rsvp") {
    state.rsvps = state.rsvps.includes(community)
      ? state.rsvps.filter((id) => id !== community)
      : [...state.rsvps, community];
  }
  if (action === "mark-read") state.notificationsRead = notificationsData().map((item) => item.id);
  if (action === "logout") {
    state.isLoggedIn = false;
    apiToken = "";
    localStorage.removeItem(tokenKey);
    setRoute("login");
    return;
  }
  if (action === "reset-data") {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(tokenKey);
    apiToken = "";
    state = structuredClone(initialState);
    communities = state.communities;
    setRoute("login");
    return;
  }
  saveState();
  render();
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) {
    const cursor = event.target.selectionStart;
    state.query = event.target.value;
    saveState();
    render();
    const input = document.querySelector("[data-search]");
    if (input) {
      input.focus();
      input.setSelectionRange(cursor, cursor);
    }
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const type = form.dataset.form;

  if (!validateRequired(form)) return;

  if (type === "login") {
    const data = new FormData(form);
    const username = data.get("username").trim();
    const password = data.get("password").trim();
    try {
      const result = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      apiToken = result.token;
      localStorage.setItem(tokenKey, apiToken);
      applyServerState(result.state);
      setRoute("dashboard");
    } catch (error) {
      showError(form, error.message || "Username atau password belum cocok.");
      return;
    }
    return;
  }

  if (type === "register") {
    const data = new FormData(form);
    state.profile = {
      ...state.profile,
      name: data.get("name").trim(),
      username: data.get("username").trim(),
      password: data.get("password").trim(),
      origin: data.get("origin").trim(),
      city: data.get("city").trim()
    };
    try {
      const result = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({ state: { ...state, isLoggedIn: true } })
      });
      apiToken = result.token;
      localStorage.setItem(tokenKey, apiToken);
      applyServerState(result.state);
      setRoute("dashboard");
    } catch (error) {
      showError(form, error.message || "Akun belum bisa dibuat.");
    }
    return;
  }

  if (type === "profile") {
    const data = new FormData(form);
    state.profile = {
      ...state.profile,
      name: data.get("name").trim(),
      username: data.get("username").trim(),
      origin: data.get("origin").trim(),
      city: data.get("city").trim(),
      bio: data.get("bio").trim()
    };
    setRoute("profile");
    return;
  }

  if (type === "community") {
    const data = new FormData(form);
    const name = data.get("name").trim();
    const city = data.get("city").trim();
    const category = data.get("category").trim();
    const description = data.get("description").trim();
    const id = createId(name);
    const community = {
      id,
      name,
      category,
      city,
      art: "",
      nextEvent: data.get("nextEvent").trim(),
      location: data.get("location").trim(),
      reasons: data.get("reasons").split("\n").map((reason) => reason.trim()).filter(Boolean),
      description
    };
    state.communities.push(community);
    communities = state.communities;
    saveState();
    setRoute("community-detail", { community: id });
    return;
  }

  if (type === "chat") {
    const input = form.elements.message;
    const text = input.value.trim();
    const community = form.dataset.community;
    if (text) {
      if (!state.messages[community]) seedMessages(community);
      state.messages[community].push({ from: "me", text, time: currentTime() });
      if (state.settings.autoReply) {
        state.messages[community].push({
          from: "them",
          text: "Noted. Aku kabari detailnya di grup ya.",
          time: currentTime()
        });
      }
      input.value = "";
      saveState();
      render();
    }
  }
});

window.addEventListener("hashchange", render);

async function startApp() {
  if (apiToken) {
    try {
      const result = await apiRequest("/api/state");
      applyServerState(result.state);
    } catch (error) {
      apiToken = "";
      localStorage.removeItem(tokenKey);
      state.isLoggedIn = false;
    }
  }
  render();
}

startApp();
