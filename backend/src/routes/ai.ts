import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const aiRouter = new Hono();

const openAiKey = process.env.OPENAI_API_KEY || "";
const geminiKey = process.env.GEMINI_API_KEY || "";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "gemma3:4b";
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || "glm-ocr";

function looksHealthRelated(text = "") {
  const lower = text.toLowerCase();
  return [
    "medicine",
    "medicines",
    "tablet",
    "capsule",
    "syrup",
    "balm",
    "ointment",
    "gel",
    "pain",
    "fever",
    "cough",
    "cold",
    "allergy",
    "symptom",
    "doctor",
    "report",
    "blood",
    "hb",
    "hba1c",
    "hemoglobin",
    "sugar",
    "bp",
    "pressure",
    "dose",
    "side effect",
    "reaction",
    "paracetamol",
    "crocin",
    "metformin",
    "amlodipine",
    "aspirin",
    "eno",
    "vicks",
    "hajmola",
  ].some((word) => lower.includes(word));
}

function extractGeminiText(data: any) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("")
      .trim() || ""
  );
}

function cleanOllamaAnswer(text: string) {
  const trimmed = (text || "").replace(/<think>[\s\S]*?<\/think>/gi, " ").trim();
  if (!trimmed) return "";

  const finalQuoteMatch = trimmed.match(/i(?:'|’)ll say:\s*["“]([\s\S]+?)["”]\s*\.?$/i);
  if (finalQuoteMatch?.[1]) return finalQuoteMatch[1].trim();

  if (trimmed.includes("</think>")) {
    return trimmed.split("</think>").pop()?.trim() || "";
  }

  const metaMarkers = [
    "the user just asked",
    "the user mentioned",
    "i need to figure out",
    "i should keep it simple",
    "as medassist",
    "the context shows",
    "they might be",
    "i should",
    "i'll",
    "let me think",
  ];

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length > 1 && metaMarkers.some((marker) => trimmed.toLowerCase().includes(marker))) {
    const candidate = [...paragraphs]
      .reverse()
      .find((part) => !metaMarkers.some((marker) => part.toLowerCase().includes(marker)));
    if (candidate) return candidate;
  }

  if (metaMarkers.some((marker) => trimmed.toLowerCase().includes(marker))) {
    const quotedChunks = [...trimmed.matchAll(/["“]([^"”]+?)["”]/g)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    const lastQuoted = quotedChunks.at(-1);
    if (lastQuoted && lastQuoted.length > 8) return lastQuoted;
  }

  return trimmed;
}

function parseJsonBlock(text: string) {
  const raw = (text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try {
      return JSON.parse(fenced);
    } catch {}
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }

  return null;
}

async function parseApiResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || data?.error || `API request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function answerWithGemini(system: string, prompt: string, maxOutputTokens = 400) {
  if (!geminiKey) return "";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
      geminiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.5,
        },
      }),
    }
  );

  const data = await parseApiResponse(response);
  return extractGeminiText(data);
}

async function answerWithAnthropic(system: string, prompt: string, maxTokens = 320) {
  if (!anthropicKey) return "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await parseApiResponse(response);
  return data.content?.[0]?.text || "";
}

async function answerWithOpenAI(prompt: string) {
  if (!openAiKey) return "";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: prompt,
    }),
  });

  const data = await parseApiResponse(response);
  return data.output_text || "";
}

async function answerWithOllama(system: string, prompt: string) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ollamaModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      stream: false,
      think: false,
      keep_alive: "10m",
      options: {
        temperature: 0.25,
        num_predict: 180,
        top_k: 20,
        top_p: 0.9,
      },
    }),
  });

  const data = await parseApiResponse(response);
  const answer = cleanOllamaAnswer(data?.message?.content || "");
  if (!answer) {
    throw new Error(`Ollama returned an empty response for model ${ollamaModel}.`);
  }
  return answer;
}

async function answerWithOllamaVision(system: string, prompt: string, imageBase64: string) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ollamaVisionModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt, images: [imageBase64] },
      ],
      stream: false,
      think: false,
      keep_alive: "10m",
      options: {
        temperature: 0.1,
        num_predict: 500,
        top_k: 20,
        top_p: 0.9,
      },
    }),
  });

  const data = await parseApiResponse(response);
  const answer = cleanOllamaAnswer(data?.message?.content || "");
  if (!answer) {
    throw new Error(`Ollama vision returned an empty response for model ${ollamaVisionModel}.`);
  }
  return answer;
}

async function answerMedicineQuestion(body: any) {
  const { question = "", medicine = "", lang = "English" } = body;
  const prompt = `User question: ${question}\nMedicine: ${
    medicine || "unknown"
  }\nPlease answer briefly with uses, common side effects, and important cautions when relevant.`;
  const system = `You are a helpful assistant. Reply in ${lang}. When the user asks health or medicine questions, be careful, calm, and practical. Do not pretend to diagnose with certainty. For non-health questions, answer normally and clearly. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Keep answers short, usually 2 to 4 sentences.`;

  if (openAiKey) return answerWithOpenAI(prompt);

  try {
    if (geminiKey) return await answerWithGemini(system, prompt, 280);
  } catch {}

  try {
    if (anthropicKey) return await answerWithAnthropic(system, prompt, 280);
  } catch {}

  return answerWithOllama(system, prompt);
}

async function answerGeneralChat(body: any) {
  const { question = "", lang = "English", patient = {}, medicines = [] } = body;
  const healthMode = looksHealthRelated(question);
  const prompt = healthMode
    ? `Patient: ${patient?.name || "Unknown"}, age ${patient?.age || "Unknown"}, condition ${
        patient?.condition || "Unknown"
      }.\nMedicines: ${
        Array.isArray(medicines) ? medicines.map((med: any) => `${med.name} ${med.dosage}`).join(", ") : "None"
      }.\nUser question: ${question}\nAnswer briefly and clearly.`
    : `User question: ${question}\nAnswer briefly and clearly.`;

  const system = healthMode
    ? `You are MedAssist. Reply in ${lang}. If the user asks about health, symptoms, medicines, or reports, be careful, calm, and practical. Do not pretend to diagnose with certainty. Be warm and concise. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Give only the final answer in 2 to 4 short sentences.`
    : `You are MedAssist. Reply in ${lang}. Answer general questions normally and clearly. Do not mention patient medicines or health context unless the user is actually asking about health. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Give only the final answer in 1 to 3 short sentences.`;

  if (openAiKey) return answerWithOpenAI(prompt);

  try {
    if (geminiKey) return await answerWithGemini(system, prompt, 320);
  } catch {}

  try {
    if (anthropicKey) return await answerWithAnthropic(system, prompt, 320);
  } catch {}

  return answerWithOllama(system, prompt);
}

async function analyzeReportImage(body: any) {
  const { imageBase64 = "", mime = "", age = "", manualValues = {} } = body;
  if (!imageBase64 || !String(mime).startsWith("image/")) {
    throw new Error("Image report analysis currently supports uploaded images only.");
  }

  const prompt = [
    "Read this blood report image carefully.",
    "Return only valid JSON.",
    "Use this exact shape:",
    '{"values":{"hb":"","wbc":"","platelets":"","glucose":"","hba1c":"","cholesterol":"","ldl":"","creatinine":""},"result":{"level":"SAFE|WARNING|URGENT","message":"short sentence","doctor":"short recommendation","summary":["point 1"],"abnormal":["point"],"normal":["point"],"advice":["point 1"]}}',
    "If a value is not visible, use an empty string for that field.",
    `Patient age: ${age || "unknown"}.`,
    `Manual values already available: ${JSON.stringify(manualValues || {})}.`,
    "Be cautious. If the image is unclear, say so in message and advice.",
  ].join(" ");

  const system =
    "You read medical lab report images. Output strict JSON only. Do not explain your reasoning.";
  const raw = await answerWithOllamaVision(system, prompt, imageBase64);
  const parsed = parseJsonBlock(raw);

  if (!parsed?.result?.level || !parsed?.result?.message || !parsed?.result?.doctor) {
    throw new Error("Vision model did not return usable report JSON.");
  }

  return parsed;
}

aiRouter.post("/chat", async (c) => {
  try {
    const body = await c.req.json();
    const answer = await answerGeneralChat(body);
    if (!answer) {
      throw new HTTPException(503, {
        message: "AI backend returned no answer. Check the configured model key and server logs.",
      });
    }
    return c.json({ answer });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, {
      message: error?.message || "Unknown server error",
    });
  }
});

aiRouter.post("/medicine", async (c) => {
  try {
    const body = await c.req.json();
    const answer = await answerMedicineQuestion(body);
    if (!answer) {
      throw new HTTPException(503, {
        message: "AI backend returned no answer. Check the configured model key and server logs.",
      });
    }
    return c.json({ answer });
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, {
      message: error?.message || "Unknown server error",
    });
  }
});

aiRouter.post("/report-image", async (c) => {
  try {
    const body = await c.req.json();
    const result = await analyzeReportImage(body);
    return c.json(result);
  } catch (error: any) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, {
      message: error?.message || "Report image analysis failed.",
    });
  }
});

export default aiRouter;
