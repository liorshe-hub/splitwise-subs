const PHOTOS = [
  {
    id: "amber-room",
    src: "https://images.unsplash.com/photo-1615874959474-d609969a20d6?auto=format&fit=crop&w=1600&q=80",
    tone: "Amber interior",
  },
  {
    id: "cinema",
    src: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
    tone: "Cinema brown",
  },
  {
    id: "vinyl",
    src: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=80",
    tone: "Vinyl dusk",
  },
  {
    id: "studio",
    src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80",
    tone: "Desk light",
  },
  {
    id: "earth",
    src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80",
    tone: "Night earth",
  },
  {
    id: "gym",
    src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
    tone: "Iron hall",
  },
  {
    id: "game",
    src: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=80",
    tone: "Neon play",
  },
  {
    id: "paper",
    src: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=80",
    tone: "Paper tan",
  },
];

const KEY = "splitwise-subs-v1";

const seed = () => ({
  people: [
    { id: "p1", name: "Lunen" },
    { id: "p2", name: "Amara" },
    { id: "p3", name: "Theo" },
  ],
  subscriptions: [
    {
      id: "netflix",
      name: "Netflix",
      cost: 17.99,
      payer: "p1",
      split: ["p1", "p2", "p3"],
      photo: "cinema",
    },
    {
      id: "spotify",
      name: "Spotify",
      cost: 16.99,
      payer: "p2",
      split: ["p1", "p2", "p3"],
      photo: "vinyl",
    },
    {
      id: "icloud",
      name: "iCloud+",
      cost: 2.99,
      payer: "p1",
      split: ["p1", "p2"],
      photo: "earth",
    },
    {
      id: "gpt",
      name: "ChatGPT Plus",
      cost: 20,
      payer: "p3",
      split: ["p1", "p3"],
      photo: "studio",
    },
    {
      id: "gym",
      name: "Foundry Gym",
      cost: 45,
      payer: "p2",
      split: ["p2", "p3"],
      photo: "gym",
    },
    {
      id: "yt",
      name: "YouTube Premium",
      cost: 13.99,
      payer: "p1",
      split: ["p1", "p2", "p3"],
      photo: "game",
    },
  ],
});

const money = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);

const uid = () => crypto.randomUUID().slice(0, 8);
const initials = (name) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const photoById = (id) => PHOTOS.find((p) => p.id === id) || PHOTOS[0];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const data = JSON.parse(raw);
    if (!data.people?.length) return seed();
    return data;
  } catch {
    return seed();
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function balances(state) {
  const map = Object.fromEntries(state.people.map((p) => [p.id, 0]));
  for (const sub of state.subscriptions) {
    const members = sub.split.filter((id) => map[id] !== undefined);
    if (!members.length || map[sub.payer] === undefined) continue;
    const share = sub.cost / members.length;
    for (const id of members) map[id] -= share;
    if (map[sub.payer] !== undefined) map[sub.payer] += sub.cost;
  }
  return map;
}

function settlements(state) {
  const map = balances(state);
  const debtors = [];
  const creditors = [];
  for (const person of state.people) {
    const amount = Math.round(map[person.id] * 100) / 100;
    if (amount < -0.009) debtors.push({ person, amount: -amount });
    if (amount > 0.009) creditors.push({ person, amount });
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    rows.push({
      from: debtors[i].person,
      to: creditors[j].person,
      amount: pay,
    });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i += 1;
    if (creditors[j].amount < 0.01) j += 1;
  }
  return rows;
}

const state = load();
let selectedPhoto = PHOTOS[0].id;
let openId = null;

const grid = document.getElementById("photo-grid");
const peopleList = document.getElementById("people-list");
const ledgerList = document.getElementById("ledger-list");
const detail = document.getElementById("detail");
const home = document.getElementById("home");
const addDialog = document.getElementById("add-sub");
const photoPicks = document.getElementById("photo-picks");
const signupForm = document.getElementById("signup-form");
const verifyEmailForm = document.getElementById("verify-email-form");
const loginForm = document.getElementById("login-form");
const authIdentity = document.querySelector("[data-auth-identity]");
const signOutButton = document.querySelector("[data-sign-out]");
const authButtons = document.querySelectorAll("[data-open-auth]");
const supabaseConfig = window.SPLIT_SUPABASE_CONFIG || {};
const supabaseUrl = (supabaseConfig.url || "").trim();
const supabaseAnonKey = (supabaseConfig.anonKey || "").trim();
let supabaseClient = null;
let supabaseConfigError = "";
let pendingVerificationEmail = "";

if (supabaseUrl || supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    supabaseConfigError = "Both the Supabase project URL and anon key are required.";
  } else if (!window.supabase?.createClient) {
    supabaseConfigError = "The Supabase client library could not be loaded.";
  } else {
    try {
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      supabaseConfigError = `Supabase configuration is invalid: ${error.message}`;
      console.error(supabaseConfigError);
    }
  }
}

function setAuthStatus(form, message, isError = false) {
  const status = form.querySelector(".auth-status");
  status.textContent = message;
  status.classList.toggle("auth-status-error", isError);
}

function authSetupMessage(action) {
  if (!supabaseClient) {
    return (
      supabaseConfigError ||
      `Connect your Supabase project to enable ${action}.`
    );
  }
  if (window.location.protocol === "file:") {
    return "Open Split from localhost or an HTTPS website to use Supabase Auth.";
  }
  return "";
}

function setAuthPending(form, pending) {
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = pending;
  submit.textContent = pending ? "Please wait…" : submit.dataset.label;
}

function updateAuthNavigation(user) {
  authButtons.forEach((button) => {
    button.hidden = Boolean(user);
  });
  authIdentity.hidden = !user;
  signOutButton.hidden = !user;
  authIdentity.textContent = user?.email || "";
}

if (supabaseClient) {
  supabaseClient.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      updateAuthNavigation(data.session?.user || null);
    })
    .catch((error) => {
      console.error("Could not restore the Supabase session:", error);
    });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateAuthNavigation(session?.user || null);
  });
}

document.querySelectorAll(".auth-form button[type='submit']").forEach((button) => {
  button.dataset.label = button.textContent.trim();
});

function renderPeople() {
  peopleList.innerHTML = state.people
    .map(
      (p) => `
      <li>
        <span class="avatar">${initials(p.name)}</span>
        <strong>${p.name}</strong>
        <button class="remove" data-remove-person="${p.id}">Remove</button>
      </li>`
    )
    .join("");
}

function renderGrid() {
  grid.innerHTML = state.subscriptions
    .map((sub) => {
      const photo = photoById(sub.photo);
      const n = sub.split.length || 1;
      return `
        <button class="photo-tile" data-open-sub="${sub.id}">
          <img src="${photo.src}" alt="${photo.tone}" />
          <span class="tile-veil"></span>
          <span class="tile-copy">
            <span>${photo.tone}</span>
            <strong>${sub.name}</strong>
            <em>${money(sub.cost)} · ${n} people</em>
          </span>
        </button>`;
    })
    .join("");
}

function renderLedger() {
  const rows = settlements(state);
  if (!rows.length) {
    ledgerList.innerHTML = `<p class="empty">The household is even.</p>`;
    return;
  }
  ledgerList.innerHTML = rows
    .map(
      (row) => `
      <div class="settle-row">
        <p>${row.from.name} pays ${row.to.name}</p>
        <span>${money(row.amount)}</span>
      </div>`
    )
    .join("");
}

function renderPicks() {
  photoPicks.innerHTML = PHOTOS.map(
    (p) => `
      <button type="button" data-pick="${p.id}" class="${
        p.id === selectedPhoto ? "selected" : ""
      }">
        <img src="${p.src}" alt="${p.tone}" />
      </button>`
  ).join("");
}

function personName(id) {
  return state.people.find((p) => p.id === id)?.name || "Someone";
}

function openDetail(id) {
  const sub = state.subscriptions.find((s) => s.id === id);
  if (!sub) return;
  openId = id;
  const photo = photoById(sub.photo);
  home.hidden = true;
  detail.hidden = false;
  document.getElementById("detail-photo").src = photo.src;
  document.getElementById("detail-photo").alt = photo.tone;
  document.getElementById("detail-kicker").textContent = photo.tone;
  document.getElementById("detail-title").textContent = sub.name;
  const form = document.getElementById("detail-form");
  form.cost.value = sub.cost;
  const payer = form.payer;
  payer.innerHTML = state.people
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === sub.payer ? "selected" : ""}>${p.name}</option>`
    )
    .join("");
  document.getElementById("split-chips").innerHTML = state.people
    .map(
      (p) => `
      <label class="chip">
        <input type="checkbox" name="split" value="${p.id}" ${
          sub.split.includes(p.id) ? "checked" : ""
        } />
        ${p.name}
      </label>`
    )
    .join("");
  const n = sub.split.length || 1;
  document.getElementById("detail-aside").innerHTML = `
    <p>${money(sub.cost / n)} each this month.</p>
    <p>${personName(sub.payer)} fronts the bill.</p>
    <p>${n} people on this photograph.</p>
  `;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function closeDetail() {
  openId = null;
  detail.hidden = true;
  home.hidden = false;
  renderAll();
}

function renderAll() {
  save(state);
  renderPeople();
  renderGrid();
  renderLedger();
  renderPicks();
}

document.getElementById("add-person").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = new FormData(e.target).get("name").trim();
  if (!name) return;
  state.people.push({ id: uid(), name });
  e.target.reset();
  renderAll();
});

peopleList.addEventListener("click", (e) => {
  const id = e.target.dataset.removePerson;
  if (!id || state.people.length < 2) return;
  state.people = state.people.filter((p) => p.id !== id);
  for (const sub of state.subscriptions) {
    sub.split = sub.split.filter((pid) => pid !== id);
    if (sub.payer === id) sub.payer = state.people[0].id;
    if (!sub.split.length) sub.split = [state.people[0].id];
  }
  renderAll();
});

grid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open-sub]");
  if (btn) openDetail(btn.dataset.openSub);
});

document.querySelector("[data-close-detail]").addEventListener("click", closeDetail);

document.getElementById("detail-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const sub = state.subscriptions.find((s) => s.id === openId);
  if (!sub) return;
  const data = new FormData(e.target);
  sub.cost = Number(data.get("cost"));
  sub.payer = data.get("payer");
  sub.split = [...e.target.querySelectorAll("input[name=split]:checked")].map(
    (el) => el.value
  );
  if (!sub.split.length) sub.split = [sub.payer];
  save(state);
  openDetail(sub.id);
});

document.querySelector("[data-delete-sub]").addEventListener("click", () => {
  state.subscriptions = state.subscriptions.filter((s) => s.id !== openId);
  closeDetail();
});

const authDialogs = {
  login: document.getElementById("login"),
  signup: document.getElementById("signup"),
};

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    authDialogs[button.dataset.openAuth].showModal();
  });
});

document.querySelectorAll("[data-switch-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    const currentDialog = button.closest("dialog");
    const nextDialog = authDialogs[button.dataset.switchAuth];
    currentDialog.close();
    nextDialog.showModal();
  });
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const setupMessage = authSetupMessage("sign-up and email verification");
  if (setupMessage) {
    setAuthStatus(signupForm, setupMessage, true);
    return;
  }

  setAuthPending(signupForm, true);
  setAuthStatus(signupForm, "");
  const formData = new FormData(signupForm);
  const email = formData.get("email").trim();
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password: formData.get("password"),
      options: {
        data: {
          name: formData.get("name").trim(),
          phone: formData.get("phone").trim(),
        },
      },
    });
    if (error) throw error;
    if (data.session) {
      authDialogs.signup.close();
      signupForm.reset();
      return;
    }
    if (!data.user) {
      throw new Error("Supabase did not return a user for this sign-up.");
    }
    pendingVerificationEmail = email;
    document.querySelector("[data-verification-email]").textContent = email;
    signupForm.hidden = true;
    verifyEmailForm.hidden = false;
    setAuthStatus(verifyEmailForm, "We sent a verification code to your email.");
    verifyEmailForm.querySelector('input[name="token"]').focus();
  } catch (error) {
    setAuthStatus(signupForm, error.message, true);
  } finally {
    setAuthPending(signupForm, false);
  }
});

verifyEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const setupMessage = authSetupMessage("email verification");
  if (setupMessage) {
    setAuthStatus(verifyEmailForm, setupMessage, true);
    return;
  }
  if (!pendingVerificationEmail) {
    setAuthStatus(
      verifyEmailForm,
      "Please start sign-up again to request a new verification code.",
      true
    );
    return;
  }

  setAuthPending(verifyEmailForm, true);
  setAuthStatus(verifyEmailForm, "");
  try {
    const { error } = await supabaseClient.auth.verifyOtp({
      email: pendingVerificationEmail,
      token: new FormData(verifyEmailForm).get("token").trim(),
      type: "signup",
    });
    if (error) throw error;
    pendingVerificationEmail = "";
    verifyEmailForm.reset();
    signupForm.reset();
    verifyEmailForm.hidden = true;
    signupForm.hidden = false;
    authDialogs.signup.close();
  } catch (error) {
    setAuthStatus(verifyEmailForm, error.message, true);
  } finally {
    setAuthPending(verifyEmailForm, false);
  }
});

document
  .querySelector("[data-resend-code]")
  .addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const setupMessage = authSetupMessage("email verification");
    if (setupMessage) {
      setAuthStatus(verifyEmailForm, setupMessage, true);
      return;
    }
    if (!pendingVerificationEmail) {
      setAuthStatus(
        verifyEmailForm,
        "Please start sign-up again to request a new verification code.",
        true
      );
      return;
    }

    button.disabled = true;
    setAuthStatus(verifyEmailForm, "");
    try {
      const { error } = await supabaseClient.auth.resend({
        type: "signup",
        email: pendingVerificationEmail,
      });
      if (error) throw error;
      setAuthStatus(verifyEmailForm, "A new verification code has been sent.");
    } catch (error) {
      setAuthStatus(verifyEmailForm, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const setupMessage = authSetupMessage("login");
  if (setupMessage) {
    setAuthStatus(loginForm, setupMessage, true);
    return;
  }

  setAuthPending(loginForm, true);
  setAuthStatus(loginForm, "");
  const formData = new FormData(loginForm);
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: formData.get("email").trim(),
      password: formData.get("password"),
    });
    if (error) throw error;
    loginForm.reset();
    authDialogs.login.close();
  } catch (error) {
    setAuthStatus(loginForm, error.message, true);
  } finally {
    setAuthPending(loginForm, false);
  }
});

signOutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  signOutButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Could not sign out of Supabase:", error);
    window.alert(`Could not log out: ${error.message}`);
  } finally {
    signOutButton.disabled = false;
  }
});

photoPicks.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick]");
  if (!btn) return;
  selectedPhoto = btn.dataset.pick;
  renderPicks();
});

document.getElementById("new-sub-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const sub = {
    id: uid(),
    name: data.get("name").trim(),
    cost: Number(data.get("cost")),
    payer: state.people[0].id,
    split: state.people.map((p) => p.id),
    photo: selectedPhoto,
  };
  state.subscriptions.unshift(sub);
  e.target.reset();
  addDialog.close();
  renderAll();
  openDetail(sub.id);
});

renderAll();
