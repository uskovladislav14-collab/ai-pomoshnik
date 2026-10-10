
const $ = (id) => document.getElementById(id);

const listenBtn = $("listenBtn");
const transcript = $("transcript");
const question = $("question");
const answer = $("answer");
const status = $("status");
const answerBtn = $("answerBtn");
const clearBtn = $("clearBtn");
const historyEl = $("history");

let recognition = null;
let listening = false;
let recognitionRunning = false;
let finalText = "";
let currentQuestion = "";

function setStatus(text) {
  status.textContent = text;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/* Удаляем повторяющиеся фрагменты */
function cleanSpeech(text) {
  let s = normalizeText(text);
  if (!s) return "";

  // Удаляем повторяющиеся подряд фрагменты речи.
  // Например:
  // "Что Что такое Что такое фотосинтез"
  // -> "Что такое фотосинтез"
  let words = s.split(" ");

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;

    for (let i = 0; i < words.length - 1 && !changed; i++) {
      const maxSize = Math.min(6, Math.floor((words.length - i) / 2));

      for (let size = 1; size <= maxSize; size++) {
        const a = words
          .slice(i, i + size)
          .join(" ")
          .toLowerCase();

        const b = words
          .slice(i + size, i + size * 2)
          .join(" ")
          .toLowerCase();

        if (a === b) {
          words.splice(i + size, size);
          changed = true;
          break;
        }
      }
    }

    if (!changed) break;
  }

  return normalizeText(words.join(" "));
}

/* Добавляем только действительно новый текст */
function mergeSpeech(oldText, newText) {
  oldText = cleanSpeech(oldText);
  newText = cleanSpeech(newText);

  if (!newText) return oldText;
  if (!oldText) return newText;

  const a = oldText.toLowerCase();
  const b = newText.toLowerCase();

  if (a === b) return oldText;

  // Новый результат содержит весь старый
  if (b.includes(a)) return newText;

  // Старый результат уже содержит новый
  if (a.includes(b)) return oldText;

  const oldWords = oldText.split(" ");
  const newWords = newText.split(" ");

  // Ищем совпадение конца старого текста
  // с началом нового результата.
  const max = Math.min(oldWords.length, newWords.length, 12);

  for (let n = max; n >= 2; n--) {
    const oldEnd = oldWords
      .slice(-n)
      .join(" ")
      .toLowerCase();

    const newStart = newWords
      .slice(0, n)
      .join(" ")
      .toLowerCase();

    if (oldEnd === newStart) {
      return cleanSpeech(
        oldWords.join(" ") +
        " " +
        newWords.slice(n).join(" ")
      );
    }
  }

  return cleanSpeech(oldText + " " + newText);
}

/* Проверяем, похожа ли фраза на вопрос */
function looksLikeQuestion(text) {
  const s = normalizeText(text).toLowerCase();

  if (!s) return false;

  if (/[?？]$/.test(s)) return true;

  return /^(?:что(?:\s+такое)?|кто|как|какой|какая|какие|почему|зачем|где|когда|сколько|назовите|объясните|определите|расскажите|покажите|сравните|перечислите|що(?:\s+таке)?|хто|як|який|яка|які|чому|навіщо|де|коли|скільки|назвіть|поясніть|визначте|розкажіть|покажіть|порівняйте|перелічіть)(?:\s|$)/i.test(s);
}

/* Извлекаем вопрос из речи */
function extractQuestion(text) {
  const clean = normalizeText(text);

  if (!clean) return "";

  // Ищем последнее предложение.
  const sentences =
    clean.match(/[^.!?？]+[.!?？]?/g) || [clean];

  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = normalizeText(sentences[i]);

    if (looksLikeQuestion(candidate)) {
      return candidate;
    }
  }

  // Если распознавание не поставило знак вопроса,
  // ищем начало вопроса.
  const re =
    /(?:что\s+такое|что|кто|как|какой|какая|какие|почему|зачем|где|когда|сколько|назовите|объясните|определите|расскажите|покажите|сравните|перечислите|що\s+таке|що|хто|як|який|яка|які|чому|навіщо|де|коли|скільки|назвіть|поясніть|визначте|розкажіть|покажіть|порівняйте|перелічіть)(?=\s|$)/gi;

  let match;
  let lastIndex = -1;

  while ((match = re.exec(clean)) !== null) {
    lastIndex = match.index;
  }

  if (lastIndex >= 0) {
    const candidate = normalizeText(clean.slice(lastIndex));

    if (candidate.split(" ").length <= 40) {
      return candidate;
    }
  }

  return "";
}

/* Обновляем экран */
function renderRecognition(interim = "") {
  const full = cleanSpeech(
    mergeSpeech(finalText, interim)
  );

  transcript.textContent =
    full || "Здесь появится речь преподавателя…";

  const detected = extractQuestion(full);

  if (detected) {
    currentQuestion = detected;
    question.textContent = detected;
    setStatus("Вопрос обнаружен");
  }
}

/* Распознавание речи */
function initRecognition() {
  const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SR) {
    setStatus("Браузер не поддерживает распознавание речи");
    return null;
  }

  const r = new SR();

  r.lang = "ru-RU";
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onstart = () => {
    listening = true;
    recognitionRunning = true;

    listenBtn.classList.add("listening");
    listenBtn.textContent = "⏹ ОСТАНОВИТЬ";

    setStatus("Слушаю…");
  };

  r.onend = () => {
    recognitionRunning = false;
    if (!listening) return;

    setTimeout(() => {
      if (!listening) return;

      try {
        r.start();
      } catch (_) {}
    }, 300);
  };

  r.onerror = (e) => {
    if (e.error === "no-speech") return;

    if (e.error === "not-allowed") {
      setStatus("Разреши доступ к микрофону");
      return;
    }

    setStatus("Ошибка микрофона: " + e.error);
  };

  r.onresult = (e) => {
    let interim = "";

    for (
      let i = e.resultIndex;
      i < e.results.length;
      i++
    ) {
      const text =
        normalizeText(
          e.results[i][0].transcript
        );

      if (!text) continue;

      if (e.results[i].isFinal) {
        finalText = mergeSpeech(finalText, text);
      } else {
        interim = mergeSpeech(interim, text);
      }
    }

    renderRecognition(interim);
  };

  return r;
}

/* История */
function renderHistory() {
  const h = JSON.parse(
    localStorage.getItem("ai_helper_history") || "[]"
  );

  historyEl.innerHTML = h.length
    ? h
        .slice(0, 10)
        .map(
          (x) =>
            `<div class="history-item">
              <div class="history-q">${escapeHtml(x.q)}</div>
              <div class="history-a">${escapeHtml(x.a)}</div>
            </div>`
        )
        .join("")
    : "Пока пусто.";
}

function saveHistory(q, a) {
  const h = JSON.parse(
    localStorage.getItem("ai_helper_history") || "[]"
  );

  h.unshift({
    q,
    a,
    at: Date.now()
  });

  localStorage.setItem(
    "ai_helper_history",
    JSON.stringify(h.slice(0, 30))
  );

  renderHistory();
}

/* Запуск */
recognition = initRecognition();

listenBtn.onclick = async () => {
  if (listening) {
    listening = false;
    recognitionRunning = false;

    try {
      recognition?.stop();
    } catch (_) {}

    listenBtn.classList.remove("listening");
    listenBtn.textContent = "🎤 НАЧАТЬ СЛУШАТЬ";
    setStatus("Пауза");
    return;
  }

  setStatus("Запуск микрофона…");

  try {
    // На Android сначала явно запрашиваем доступ к микрофону.
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      stream.getTracks().forEach((track) => track.stop());
    }

    // Создаём новый объект распознавания при каждом новом запуске.
    recognition = initRecognition();

    if (!recognition) return;

    recognitionRunning = false;
    recognition.start();
  } catch (e) {
    listening = false;
    recognitionRunning = false;
    listenBtn.classList.remove("listening");
    listenBtn.textContent = "🎤 НАЧАТЬ СЛУШАТЬ";

    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      setStatus("Разреши доступ к микрофону в браузере");
    } else {
      setStatus("Не удалось включить микрофон");
    }

    console.error(e);
  }
};

/* Получить ответ ИИ */
answerBtn.onclick = async () => {
  const q = normalizeText(
    currentQuestion ||
    question.textContent
  );

  if (
    !q ||
    q === "Вопрос пока не обнаружен."
  ) {
    setStatus("Сначала нужен вопрос");
    return;
  }

  answer.textContent =
    "ИИ готовит ответ…";

  setStatus("Обработка…");

  try {
    const r = await fetch(
      "/api/answer",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          question: q,
          language: "ru"
        })
      }
    );

    const data =
      await r.json().catch(() => ({}));

    if (!r.ok) {
      throw new Error(
        data.error ||
        `HTTP ${r.status}`
      );
    }

    answer.textContent =
      data.answer ||
      "Ответ не получен.";

    saveHistory(
      q,
      answer.textContent
    );

    setStatus("Готово");
  } catch (e) {
    console.error(e);

    answer.textContent =
      e?.message ||
      "Не удалось получить ответ. Проверь подключение ИИ и API-ключ на сервере.";

    setStatus("Ошибка ИИ");
  }
};

/* Очистить */
clearBtn.onclick = () => {
  finalText = "";
  currentQuestion = "";

  transcript.textContent =
    "Здесь появится речь преподавателя…";

  question.textContent =
    "Вопрос пока не обнаружен.";

  answer.textContent =
    "Ответ появится здесь.";

  setStatus(
    listening ? "Слушаю…" : "Готов"
  );
};

renderHistory();

/* Обновление Service Worker */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register(
      "sw.js?v=5"
    )
    .catch(() => {});
}
