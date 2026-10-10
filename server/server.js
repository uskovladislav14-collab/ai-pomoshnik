const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Открываем интерфейс приложения из основной папки проекта
app.use(express.static(path.join(__dirname, "..")));

// Подключение OpenAI через переменную окружения
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Проверка работы сервера
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    ai_connected: !!client
  });
});

// Запрос к ИИ
app.post("/api/answer", async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();

    if (!question) {
      return res.status(400).json({
        error: "Вопрос не указан"
      });
    }

    if (!client) {
      return res.status(503).json({
        error: "API-ключ OpenAI пока не подключён"
      });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input:
        "Ты учебный ИИ-помощник. Отвечай понятно, кратко и по существу. " +
        "Если вопрос связан с учебным заданием, сначала проверь правильность ответа.\n" +
        "Вопрос ученика:\n" +
        question
    });

    res.json({
      answer: response.output_text
    });

  } catch (error) {
    console.error("Ошибка OpenAI:", error);

    const status = Number(error?.status) || 500;
    const code = error?.code || error?.error?.code || "";

    let message = "Ошибка при обращении к ИИ";

    if (status === 401) {
      message = "Ключ OpenAI недействителен или был отозван.";
    } else if (status === 429 || code === "insufficient_quota") {
      message = "OpenAI API сообщает, что лимит или баланс API исчерпан. Проверь оплату и лимиты API.";
    } else if (status === 403) {
      message = "OpenAI API отклонил запрос. Проверь доступ проекта и права API-ключа.";
    } else if (status === 404) {
      message = "Выбранная модель OpenAI недоступна для этого API-ключа.";
    }

    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message
    });
  }
});

// Запуск сервера
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Помощник запущен на порту ${PORT}`);
});
