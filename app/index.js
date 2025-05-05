// Servidor WebSocket en Replit para recibir audio, transcribir con Whisper y responder con ChatGPT

const express = require("express");
const dom = require("dom");
const { WebSocketServer } = require("ws");
const axios = require("axios");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { execSync } = require("child_process");
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY_OPENAI = process.env.API_KEY_OPENAI; // Reemplaza con tu clave

const server = app.listen(PORT, () => {
  console.log("🌐 Servidor HTTP activo en puerto " + PORT);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔗 Cliente conectado por WebSocket");
  let chunks = [];

  ws.on("message", async (data) => {
    chunks.push(Buffer.from(data));

    if (chunks.length > 100) {
      const audioBuffer = Buffer.concat(chunks);
      chunks = [];

      const filename = `tmp_${uuidv4()}.wav`;
      fs.writeFileSync(filename, audioBuffer);
      console.log("📥 Audio recibido, enviando a Whisper...");

      try {
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filename));
        formData.append("model", "whisper-1");

        const whisperRes = await axios.post(
          "https://api.openai.com/v1/audio/transcriptions",
          formData,
          {
            headers: {
              Authorization: `Bearer ${API_KEY_OPENAI}`,
              ...formData.getHeaders(),
            },
          },
        );

        const transcript = whisperRes.data.text;
        console.log("📝 Texto transcrito:", transcript);

        const chatRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "Eres un asistente en una reunión que responde cordialmente.",
              },
              { role: "user", content: transcript },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${API_KEY_OPENAI}`,
            },
          },
        );

        const respuesta = chatRes.data.choices[0].message.content;
        console.log("🤖 Respuesta GPT:", respuesta);

        ws.send(JSON.stringify({ transcript, respuesta }));
        fs.unlinkSync(filename);
      } catch (err) {
        console.error("❌ Error en procesamiento:", err.message);
        ws.send(JSON.stringify({ error: "Error al procesar audio" }));
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("✅ Servidor WebSocket de audio y respuesta GPT activo.");
});
