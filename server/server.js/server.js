const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Интерфейс приложения
app.use(express.static(path.join(__dirname, "..")));

// Подключение OpenAI через переменную окружения
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

// Проверка сервера
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
        "Ты учебный ИИ-помощник. " +
        "Отвечай на русском языке понятно и по существу. " +
        "Если это учебное задание, внимательно проверь правильность ответа. " +
        "Не выдумывай факты.\n\n" +
        "Вопрос ученика:\n" +
        question
    });

    res.json({
      answer: response.output_text
    });

  } catch (error) {
    console.error("Ошибка OpenAI:", error);

    res.status(500).json({
      error: "Ошибка при обращении к ИИ"
    });
  }
});

// Запуск сервера
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Помощник запущен на порту ${PORT}`);
});
