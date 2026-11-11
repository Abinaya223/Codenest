const API = "/api";
let token = localStorage.getItem("codenest_token");
let currentUser = JSON.parse(localStorage.getItem("codenest_user") || "null");
let courses = [];
let activeCourse = null;
let activeLesson = null;
let pendingCourseSlug = null;
let authMode = "register";
let currentFilter = "All";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

/* =====================================
   API REQUEST
===================================== */
async function request(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(API + url, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Terjadi kesalahan.");
  }
  return data;
}

/* =====================================
   HELPER
===================================== */
function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );
}

/* =====================================
   PAGE NAVIGATION
===================================== */
function showView(name) {
  $$(".page-view").forEach((el) => {
    el.classList.remove("active");
  });
  document.getElementById(name + "View")?.classList.add("active");
  $$(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === name);
  });
  if (name === "dashboard") {
    loadDashboard();
  }
  if (name === "achievements") {
    loadAchievements();
  }
  if (name === "courses") {
    loadCourses();
  }
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-view]");
  if (link) {
    e.preventDefault();
    showView(link.dataset.view);
  }
});

/* =====================================
   AUTHENTICATION NAVBAR
===================================== */
function renderNav() {
  const navUser = $("#navUser");
  if (!navUser) return;
  navUser.innerHTML = currentUser
    ? `
      <span class="welcome-user">
        Hi, ${escapeHTML(currentUser.name.split(" ")[0])} ✦
      </span>
      <button class="btn btn-outline btn-small" id="logoutBtn">
        Log out
      </button>
    `
    : `
      <button class="btn btn-outline btn-small" id="loginOpen">
        Log in
      </button>
      <button class="btn btn-primary btn-small" id="registerOpen">
        Join for free ↗
      </button>
    `;
  $("#logoutBtn")?.addEventListener("click", () => {
    token = null;
    currentUser = null;
    localStorage.removeItem("codenest_token");
    localStorage.removeItem("codenest_user");
    renderNav();
    toast("You have logged out.");
    showView("home");
  });
  $("#loginOpen")?.addEventListener("click", () => {
    openAuth("login");
  });
  $("#registerOpen")?.addEventListener("click", () => {
    openAuth("register");
  });
}

/* =====================================
   AUTH MODAL
===================================== */
function openAuth(mode) {
  authMode = mode;
  $("#authModal").classList.add("show");
  $("#authTitle").textContent =
    mode === "register"
      ? "Join the adventure!"
      : "Welcome back, coder!";
  $("#authSubtitle").textContent =
    mode === "register"
      ? "Create your free account and save your progress."
      : "Log in to continue your coding quest.";
  $("#authEyebrow").textContent =
    mode === "register"
      ? "WELCOME TO THE NEST"
      : "YOUR QUEST AWAITS";
  $("#nameField").style.display =
    mode === "register" ? "block" : "none";
  $("#nameField input").required = mode === "register";
  $("#authSubmit").textContent =
    mode === "register"
      ? "Create my account →"
      : "Log in →";
  $("#authSwitch").innerHTML =
    mode === "register"
      ? 'Already have an account? <button id="switchAuth">Log in</button>'
      : 'New to CodeNest? <button id="switchAuth">Create an account</button>';
  $("#authMessage").textContent = "";
  $("#switchAuth").addEventListener("click", () => {
    openAuth(mode === "register" ? "login" : "register");
  });
}

$("#modalClose")?.addEventListener("click", () => {
  $("#authModal").classList.remove("show");
});

$("#authModal")?.addEventListener("click", (e) => {
  if (e.target.id === "authModal") {
    $("#authModal").classList.remove("show");
  }
});

$("#authForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(
    new FormData(e.currentTarget).entries()
  );
  try {
    const result = await request(`/auth/${authMode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    token = result.token;
    currentUser = result.user;
    localStorage.setItem("codenest_token", token);
    localStorage.setItem(
      "codenest_user",
      JSON.stringify(currentUser)
    );
    $("#authModal").classList.remove("show");
    renderNav();
    toast(result.message);

    // Lanjutkan course yang sebelumnya dipilih user.
    if (pendingCourseSlug) {
      const courseToOpen = pendingCourseSlug;
      pendingCourseSlug = null;
      await openCourse(courseToOpen);
    } else {
      showView("dashboard");
    }
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
});

/* =====================================
   COURSES
===================================== */
async function loadCourses() {
  try {
    const result = await request("/courses");
    courses = result.data || [];
    renderCourses();
  } catch (error) {
    const grid = $("#courseGrid");
    if (grid) {
      grid.innerHTML = `
        <p class="loading-card">
          ${escapeHTML(error.message)}
          <br>
          Pastikan database sudah di-import.
        </p>
      `;
    }
  }
}

function renderCourses() {
  const grid = $("#courseGrid");
  if (!grid) return;
  const search = ($("#courseSearch")?.value || "").toLowerCase();
  const list = courses.filter((course) => {
    const matchesFilter =
      currentFilter === "All" ||
      course.category === currentFilter;
    const matchesSearch =
      course.title.toLowerCase().includes(search) ||
      course.description.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });
  $("#courseCount").textContent = `${list.length} COURSES`;
  grid.innerHTML = list.length
    ? list
        .map(
          (course) => `
          <article class="course-card"
            data-course="${escapeHTML(course.slug)}">
            <div class="course-art ${escapeHTML(course.color)}">
              <small>${escapeHTML(course.category.toUpperCase())}</small>
              ${escapeHTML(course.icon)}
            </div>
            <div class="course-info">
              <div class="course-meta">
                <span>${escapeHTML(course.level.toUpperCase())}</span>
                <span>${course.lesson_count} LESSONS</span>
              </div>
              <h3>${escapeHTML(course.title)}</h3>
              <p>${escapeHTML(course.description)}</p>
              <div class="course-bottom">
                <span>START LEARNING</span>
                <span>↗</span>
              </div>
            </div>
          </article>
        `
        )
        .join("")
    : `<p class="loading-card">No quests found. Try another search.</p>`;
  $$(".course-card").forEach((card) => {
    card.addEventListener("click", () => {
      openCourse(card.dataset.course);
    });
  });
}

$("#courseFilters")?.addEventListener("click", (e) => {
  const button = e.target.closest("[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  $$(".filter").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  renderCourses();
});

$("#courseSearch")?.addEventListener("input", renderCourses);

/* =====================================
   COURSE DETAIL
===================================== */
async function openCourse(slug) {

  // User wajib login sebelum membuka course.
  if (!token || !currentUser) {
    pendingCourseSlug = slug;
    openAuth("login");
    toast("Log in first to start learning and save your progress.");
    return;
  }

  try {
    const data = await request(
      `/courses/${encodeURIComponent(slug)}`
    );
    activeCourse = data.course;
    $("#courseDetail").innerHTML = `
      <div class="detail-hero">
        <div class="detail-icon">
          ${escapeHTML(activeCourse.icon)}
        </div>
        <div>
          <div class="pixel-label">
            ${escapeHTML(activeCourse.category.toUpperCase())}
            ·
            ${escapeHTML(activeCourse.level.toUpperCase())}
          </div>
          <h2>${escapeHTML(activeCourse.title)}</h2>
          <p>${escapeHTML(activeCourse.description)}</p>
          <b>
            ${data.lessons.length} bite-sized lessons · Beginner friendly
          </b>
        </div>
      </div>
      <div class="lesson-list">
        <h3>🗺️ YOUR COURSE MAP</h3>
        ${data.lessons
          .map(
            (lesson, index) => `
              <div class="lesson-row" data-lesson="${lesson.id}">
                <span class="lesson-number">
                  ${String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <b>${escapeHTML(lesson.title)}</b>
                  <small>LESSON ${index + 1} · 5 MIN READ</small>
                </div>
                <span class="row-arrow">→</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;
    $$(".lesson-row").forEach((row) => {
      row.addEventListener("click", () => {
        openLesson(row.dataset.lesson);
      });
    });
    showView("courseDetail");
  } catch (error) {
    toast(error.message);
  }
}

/* =====================================
   LESSON DETAIL
===================================== */
async function openLesson(id) {

  // Pengamanan tambahan agar lesson tidak bisa dibuka tanpa login.
  if (!token || !currentUser) {
    openAuth("login");
    toast("Log in first to access this lesson.");
    return;
  }

  try {
    const data = await request(`/lessons/${id}`);
    activeLesson = data.lesson;
    $("#lessonBack").onclick = () => {
      openCourse(activeCourse.slug);
    };
    $("#lessonContent").innerHTML = `
      <div class="pixel-label">
        ${escapeHTML(data.lesson.course_title.toUpperCase())}
        · LESSON ${data.lesson.sort_order}
      </div>
      <h2>${escapeHTML(data.lesson.title)}</h2>
      <p>${escapeHTML(data.lesson.content)}</p>
      <h3>💻 CODE EXAMPLE</h3>
      <pre class="code-block"><code>${escapeHTML(
        data.lesson.code_example || "// No example yet"
      )}</code></pre>
      <p>
        Try reading the example line by line.
        Change a value and observe what happens.
      </p>
      ${
        data.quizzes.length
          ? data.quizzes
              .map(
                (quiz) => `
                  <div class="quiz-box" data-quiz="${quiz.id}">
                    <h3>🧠 QUICK CHECK</h3>
                    <p>${escapeHTML(quiz.question)}</p>
                    ${quiz.options
                      .map(
                        (option, index) => `
                          <label class="quiz-option">
                            <input
                              type="radio"
                              name="quiz-${quiz.id}"
                              value="${index}"
                            >
                            ${escapeHTML(option)}
                          </label>
                        `
                      )
                      .join("")}
                    <button
                      class="btn btn-primary btn-small check-quiz"
                      data-id="${quiz.id}"
                    >
                      Check answer
                    </button>
                    <div class="quiz-feedback"></div>
                  </div>
                `
              )
              .join("")
          : ""
      }
      <button
        class="btn btn-primary btn-large complete-btn"
        id="completeLesson"
      >
        Mark lesson as complete ✓
      </button>
    `;
    $("#lessonSidebar").innerHTML = `
      <h3>📚 COURSE CONTENT</h3>
      <p>${escapeHTML(data.lesson.course_title)}</p>
      <div class="side-tip">
        💡 <b>TIP</b>
        <br>
        Take your time. Understanding one concept
        is better than rushing through five.
      </div>
    `;
    $("#completeLesson").addEventListener("click", completeLesson);
    $$(".check-quiz").forEach((button) => {
      button.addEventListener("click", () => {
        checkQuiz(button.dataset.id);
      });
    });
    showView("lesson");
  } catch (error) {
    toast(error.message);
  }
}

/* =====================================
   QUIZ
===================================== */
async function checkQuiz(id) {
  if (!token) {
    openAuth("login");
    toast("Log in to check your answer.");
    return;
  }
  const box = document.querySelector(`[data-quiz="${id}"]`);
  const selected = box.querySelector("input:checked");
  if (!selected) {
    toast("Choose an answer first!");
    return;
  }
  try {
    const result = await request(`/quizzes/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({
        selected: Number(selected.value),
      }),
    });
    const feedback = box.querySelector(".quiz-feedback");
    feedback.textContent =
      (result.correct ? "🎉 Correct! " : "Not quite. ") +
      result.explanation;
    feedback.style.color = result.correct
      ? "#238b5b"
      : "#bd536a";
  } catch (error) {
    toast(error.message);
  }
}

/* =====================================
   COMPLETE LESSON
===================================== */
async function completeLesson() {
  if (!token) {
    openAuth("login");
    toast("Log in to save your learning progress.");
    return;
  }
  try {
    await request(`/lessons/${activeLesson.id}/complete`, {
      method: "POST",
      body: "{}",
    });
    toast("Lesson completed! +1 step for your journey ✨");
    // Refresh dashboard and achievement data.
    await loadDashboard();
    await loadAchievements();
  } catch (error) {
    toast(error.message);
  }
}

/* =====================================
   DASHBOARD
===================================== */
async function loadDashboard() {
  $("#dashName").textContent = currentUser
    ? currentUser.name.split(" ")[0]
    : "coder";
  if (!token) {
    $("#completedCount").textContent = "—";
    $("#totalCount").textContent = "—";
    $("#progressPercent").textContent = "—";
    $("#progressList").innerHTML = `
      <p>
        Log in to save lessons and view your learning progress.
        <button class="btn btn-primary btn-small" id="dashLogin">
          Log in
        </button>
      </p>
    `;
    $("#dashLogin").onclick = () => openAuth("login");
    return;
  }
  try {
    const result = await request("/progress");
    $("#completedCount").textContent = result.completed_count;
    $("#totalCount").textContent = result.total_lessons;
    const percentage = result.total_lessons
      ? Math.round(
          (result.completed_count / result.total_lessons) * 100
        )
      : 0;
    $("#progressPercent").textContent = percentage + "%";
    $("#progressList").innerHTML = result.completed.length
      ? result.completed
          .map(
            (item) => `
              <div class="progress-item">
                ✓ ${escapeHTML(item.course_title)}
                — ${escapeHTML(item.title)}
              </div>
            `
          )
          .join("")
      : `
        <p>
          No lessons completed yet.
          Choose a course and start your first lesson!
        </p>
      `;
  } catch (error) {
    $("#progressList").textContent = error.message;
  }
}

/* =====================================
   ACHIEVEMENTS
===================================== */
const achievementDefinitions = [
  {
    id: "first-step",
    title: "First Step",
    description: "Complete your very first lesson.",
    icon: "🌱",
    xp: 10,
    requirement: "Complete 1 lesson",
    check: (completed, total) => completed >= 1,
  },
  {
    id: "getting-started",
    title: "Getting Started",
    description: "You're getting the hang of coding!",
    icon: "🚀",
    xp: 25,
    requirement: "Complete 5 lessons",
    check: (completed, total) => completed >= 5,
  },
  {
    id: "quick-learner",
    title: "Quick Learner",
    description: "Keep learning and keep growing.",
    icon: "⚡",
    xp: 50,
    requirement: "Complete 10 lessons",
    check: (completed, total) => completed >= 10,
  },
  {
    id: "halfway-hero",
    title: "Halfway Hero",
    description: "You've made it halfway through your journey.",
    icon: "🏅",
    xp: 75,
    requirement: "Complete 50% of all lessons",
    check: (completed, total) =>
      total > 0 && completed / total >= 0.5,
  },
  {
    id: "coding-legend",
    title: "Coding Legend",
    description: "You've completed every available lesson!",
    icon: "👑",
    xp: 100,
    requirement: "Complete all lessons",
    check: (completed, total) =>
      total > 0 && completed >= total,
  },
];

/* Load achievement data from progress API */
async function loadAchievements() {
  const grid = $("#achievementGrid");
  if (!grid) return;
  if (!token) {
    renderAchievements(0, 0);
    $("#achievementGreeting").textContent =
      "Start your coding adventure!";
    $("#achievementSummaryText").textContent =
      "Log in to save your progress and unlock achievements.";
    return;
  }
  try {
    const result = await request("/progress");
    const completed = Number(result.completed_count || 0);
    const total = Number(result.total_lessons || 0);
    renderAchievements(completed, total);
    $("#achievementGreeting").textContent =
      `Keep going, ${currentUser.name.split(" ")[0]}!`;
    $("#achievementSummaryText").textContent =
      `You've completed ${completed} out of ${total} lessons. Every lesson brings you closer to your next achievement!`;
  } catch (error) {
    grid.innerHTML = `
      <p class="loading-card">
        ${escapeHTML(error.message)}
      </p>
    `;
  }
}

/* Render achievement cards */
function renderAchievements(completed, total) {
  const grid = $("#achievementGrid");
  if (!grid) return;
  const unlocked = achievementDefinitions.filter((achievement) =>
    achievement.check(completed, total)
  );
  const percentage = achievementDefinitions.length
    ? Math.round(
        (unlocked.length / achievementDefinitions.length) * 100
      )
    : 0;
  $("#achievementTotal").textContent =
    `${unlocked.length}/${achievementDefinitions.length}`;
  $("#achievementPercent").textContent = `${percentage}%`;
  $("#achievementProgressFill").style.width =
    `${percentage}%`;
  grid.innerHTML = achievementDefinitions
    .map((achievement) => {
      const isUnlocked = achievement.check(completed, total);
      return `
        <article class="achievement-card ${
          isUnlocked ? "unlocked" : "locked"
        }">
          <div class="achievement-icon">
            ${isUnlocked ? achievement.icon : "🔒"}
          </div>
          <h3>${escapeHTML(achievement.title)}</h3>
          <p>${escapeHTML(achievement.description)}</p>
          <div class="achievement-status">
            ${
              isUnlocked
                ? "✓ UNLOCKED"
                : "🔒 LOCKED"
            }
          </div>
          <div class="achievement-note">
            ${
              isUnlocked
                ? `🏆 ${achievement.xp} XP · Achievement unlocked!`
                : escapeHTML(achievement.requirement)
            }
          </div>
        </article>
      `;
    })
    .join("");
}

/* =====================================
   PLAYGROUND
===================================== */
const defaultPlaygroundCode = {
  html: `<div class="welcome-card">
  <span class="emoji">🚀</span>
  <h1>Hello, Coder!</h1>
  <p>Welcome to my first playground.</p>
  <button id="helloButton">Click me!</button>
</div>`,
  css: `* {
  box-sizing: border-box;
}
body {
  font-family: Arial, sans-serif;
  background: #fff8e8;
  display: grid;
  place-items: center;
  min-height: 90vh;
}
.welcome-card {
  background: white;
  padding: 35px;
  border: 3px solid #29253d;
  border-radius: 12px;
  box-shadow: 6px 6px 0 #29253d;
  text-align: center;
}
.emoji {
  font-size: 45px;
}
h1 {
  color: #7558df;
}
p {
  color: #77748b;
}
button {
  background: #ffd45e;
  border: 2px solid #29253d;
  padding: 10px 18px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}`,
  js: `const button = document.getElementById("helloButton");
button.addEventListener("click", () => {
  alert("Hello, Coder! Keep learning! 🎉");
});`,
};

/* Run code inside iframe */
function runPlayground(showMessage = true) {
  const htmlEditor = $("#htmlEditor");
  const cssEditor = $("#cssEditor");
  const jsEditor = $("#jsEditor");
  const preview = $("#playgroundPreview");
  if (!htmlEditor || !cssEditor || !jsEditor || !preview) {
    return;
  }
  const safeJSON = (value) =>
    JSON.stringify(value)
      .replace(/</g, "\\\u003c")
      .replace(/\u2028/g, "\\\u2028")
      .replace(/\u2029/g, "\\\u2029");
  preview.srcdoc = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodeNest Preview</title>
    </head>
    <body>
      <div id="playground-root"></div>
      <script>
        const htmlCode = ${safeJSON(htmlEditor.value)};
        const cssCode = ${safeJSON(cssEditor.value)};
        const jsCode = ${safeJSON(jsEditor.value)};
        document.getElementById("playground-root").innerHTML = htmlCode;
        const style = document.createElement("style");
        style.textContent = cssCode;
        document.head.appendChild(style);
        try {
          new Function(jsCode)();
        } catch (error) {
          const box = document.createElement("pre");
          box.style.cssText = "color:#bd536a;background:#fff0f2;padding:12px;white-space:pre-wrap;font:12px monospace;";
          box.textContent = "JavaScript Error: " + error.message;
          document.body.appendChild(box);
        }
      <\/script>
    </body>
    </html> 
  `;
  if (showMessage) {
    toast("Code executed successfully! ✨");
  }
}

/* Initialize playground */
function initPlayground() {
  const htmlEditor = $("#htmlEditor");
  const cssEditor = $("#cssEditor");
  const jsEditor = $("#jsEditor");
  if (!htmlEditor || !cssEditor || !jsEditor) {
    return;
  }
  htmlEditor.value = defaultPlaygroundCode.html;
  cssEditor.value = defaultPlaygroundCode.css;
  jsEditor.value = defaultPlaygroundCode.js;
  $$(".editor-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.editorTab;
      $$(".editor-tab").forEach((item) => {
        item.classList.toggle("active", item === tab);
      });
      [htmlEditor, cssEditor, jsEditor].forEach((editor) => {
        const active = editor.id === `${selected}Editor`;
        editor.classList.toggle("active", active);
        editor.hidden = !active;
      });
    });
  });
  $("#runPlayground")?.addEventListener("click", () => {
    runPlayground(true);
  });
  $("#resetPlayground")?.addEventListener("click", () => {
    htmlEditor.value = defaultPlaygroundCode.html;
    cssEditor.value = defaultPlaygroundCode.css;
    jsEditor.value = defaultPlaygroundCode.js;
    runPlayground(false);
    toast("Playground has been reset! ↺");
  });
  runPlayground(false);
}

/* =====================================
   INITIALIZE APP
===================================== */
async function initializeApp() {
  renderNav();
  await loadCourses();
  initPlayground();
  showView("home");
}
initializeApp();