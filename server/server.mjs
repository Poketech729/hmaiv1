import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(path.join(rootDir, '.env'))
loadEnvFile(path.join(rootDir, '.env.local'))

const port = Number(process.env.PORT || 8787)
const openAiKey = process.env.OPENAI_API_KEY || ''
const geminiKey = process.env.GEMINI_API_KEY || ''
const anthropicKey = process.env.ANTHROPIC_API_KEY || ''
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b'
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || ollamaModel

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

async function parseApiResponse(response) {
  const data = await response.json()
  if (!response.ok) {
    const message = data?.error?.message || data?.error || `API request failed with status ${response.status}`
    throw new Error(message)
  }
  return data
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim() || ''
}

function cleanOllamaAnswer(text) {
  const trimmed = (text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .trim()
  if (!trimmed) return ''
  const finalQuoteMatch = trimmed.match(/i(?:'|’)ll say:\s*["“]([\s\S]+?)["”]\s*\.?$/i)
  if (finalQuoteMatch?.[1]) {
    return finalQuoteMatch[1].trim()
  }
  const thinkTag = '</think>'
  if (trimmed.includes(thinkTag)) {
    return trimmed.split(thinkTag).pop().trim()
  }
  const metaMarkers = [
    'the user just asked',
    'the user mentioned',
    'i need to figure out',
    'i should keep it simple',
    'as medassist',
    'the context shows',
    'they might be',
  ]
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (paragraphs.length > 1 && metaMarkers.some((marker) => trimmed.toLowerCase().includes(marker))) {
    const candidate = [...paragraphs].reverse().find((part) => !metaMarkers.some((marker) => part.toLowerCase().includes(marker)))
    if (candidate) return candidate
  }
  if (metaMarkers.some((marker) => trimmed.toLowerCase().includes(marker))) {
    const quotedChunks = [...trimmed.matchAll(/["“]([^"”]+?)["”]/g)].map((match) => match[1].trim()).filter(Boolean)
    const lastQuoted = quotedChunks.at(-1)
    if (lastQuoted && lastQuoted.length > 8) return lastQuoted
  }
  return trimmed
}

function looksHealthRelated(text = '') {
  const lower = text.toLowerCase()
  return [
    'medicine', 'medicines', 'med', 'tablet', 'capsule', 'syrup', 'balm', 'ointment', 'gel',
    'pain', 'fever', 'cough', 'cold', 'allergy', 'symptom', 'doctor', 'report', 'blood',
    'hb', 'hba1c', 'hemoglobin', 'sugar', 'bp', 'pressure', 'dose', 'side effect', 'reaction',
    'paracetamol', 'crocin', 'metformin', 'amlodipine', 'aspirin', 'eno', 'vicks', 'hajmola'
  ].some((word) => lower.includes(word))
}

function parseJsonBlock(text) {
  const raw = (text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  if (fenced) {
    try {
      return JSON.parse(fenced)
    } catch {}
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1))
    } catch {}
  }
  return null
}

async function answerWithGemini(system, prompt, maxOutputTokens = 400) {
  if (!geminiKey) return ''

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.5,
      },
    }),
  })

  const data = await parseApiResponse(response)
  return extractGeminiText(data)
}

async function answerWithOllama(system, prompt) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      stream: false,
      think: false,
      keep_alive: '10m',
      options: {
        temperature: 0.25,
        num_predict: 120,
        top_k: 20,
        top_p: 0.9,
      },
    }),
  })

  const data = await parseApiResponse(response)
  const answer = cleanOllamaAnswer(data?.message?.content || '')
  if (!answer) {
    throw new Error(`Ollama returned an empty response for model ${ollamaModel}.`)
  }
  return answer
}

async function answerWithOllamaVision(system, prompt, imageBase64, mimeType) {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaVisionModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt, images: [imageBase64] },
      ],
      stream: false,
      think: false,
      keep_alive: '10m',
      options: {
        temperature: 0.1,
        num_predict: 500,
        top_k: 20,
        top_p: 0.9,
      },
    }),
  })

  const data = await parseApiResponse(response)
  const answer = cleanOllamaAnswer(data?.message?.content || '')
  if (!answer) {
    throw new Error(`Ollama vision returned an empty response for model ${ollamaVisionModel}.`)
  }
  return answer
}

async function answerMedicineQuestion(body) {
  const { question = '', medicine = '', lang = 'English' } = body
  const prompt = `User question: ${question}\nMedicine: ${medicine || 'unknown'}\nPlease answer briefly with uses, common side effects, and important cautions when relevant.`
  const system = `You are a helpful assistant. Reply in ${lang}. When the user asks health or medicine questions, be careful, calm, and practical. Do not pretend to diagnose with certainty. For non-health questions, answer normally and clearly. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Keep answers short, usually 2 to 4 sentences.`

  if (openAiKey) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
      }),
    })
    const data = await parseApiResponse(response)
    return data.output_text || ''
  }

  if (geminiKey) {
    try {
      return await answerWithGemini(system, prompt, 280)
    } catch {}
  }

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 280,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await parseApiResponse(response)
      return data.content?.[0]?.text || ''
    } catch {}
  }

  try {
    return await answerWithOllama(system, prompt)
  } catch {
    throw new Error(`No working AI provider is available. Remove invalid cloud keys or install and run Ollama with model ${ollamaModel}.`)
  }
}

async function answerGeneralChat(body) {
  const { question = '', lang = 'English', patient = {}, medicines = [] } = body
  const healthMode = looksHealthRelated(question)
  const prompt = healthMode
    ? `
Patient: ${patient?.name || 'Unknown'}, age ${patient?.age || 'Unknown'}, condition ${patient?.condition || 'Unknown'}.
Medicines: ${Array.isArray(medicines) ? medicines.map((med) => `${med.name} ${med.dosage}`).join(', ') : 'None'}.
User question: ${question}
Answer briefly and clearly.
`.trim()
    : `User question: ${question}\nAnswer briefly and clearly.`
  const system = healthMode
    ? `You are MedAssist. Reply in ${lang}. If the user asks about health, symptoms, medicines, or reports, be careful, calm, and practical. Do not pretend to diagnose with certainty. Be warm and concise. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Give only the final answer in 2 to 4 short sentences.`
    : `You are MedAssist. Reply in ${lang}. Answer general questions normally and clearly. Do not mention patient medicines or health context unless the user is actually asking about health. Output only the final answer text. Do not reveal hidden reasoning, internal analysis, chain-of-thought, or phrases like "I should" or "I'll say". Give only the final answer in 1 to 3 short sentences.`

  if (openAiKey) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
      }),
    })
    const data = await parseApiResponse(response)
    return data.output_text || ''
  }

  if (geminiKey) {
    try {
      return await answerWithGemini(system, prompt, 320)
    } catch {}
  }

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 320,
          system: `You are MedAssist. Reply in ${lang}.`,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await parseApiResponse(response)
      return data.content?.[0]?.text || ''
    } catch {}
  }

  try {
    return await answerWithOllama(system, prompt)
  } catch {
    throw new Error(`No working AI provider is available. Remove invalid cloud keys or install and run Ollama with model ${ollamaModel}.`)
  }
}

async function analyzeReportImage(body) {
  const { imageBase64 = '', mime = '', age = '', manualValues = {} } = body
  if (!imageBase64 || !String(mime).startsWith('image/')) {
    throw new Error('Image report analysis currently supports uploaded images only.')
  }

  const prompt = [
    'Read this blood report image carefully.',
    'Return only valid JSON.',
    'Use this exact shape:',
    '{"values":{"hb":"","wbc":"","platelets":"","glucose":"","hba1c":"","cholesterol":"","ldl":"","creatinine":""},"result":{"level":"SAFE|WARNING|URGENT","message":"short sentence","doctor":"short recommendation","summary":["point 1"],"abnormal":["point"],"normal":["point"],"advice":["point 1"]}}',
    'If a value is not visible, use an empty string for that field.',
    `Patient age: ${age || 'unknown'}.`,
    `Manual values already available: ${JSON.stringify(manualValues || {})}.`,
    'Be cautious. If the image is unclear, say so in message and advice.',
  ].join(' ')

  const system = 'You read medical lab report images. Output strict JSON only. Do not explain your reasoning.'
  const raw = await answerWithOllamaVision(system, prompt, imageBase64, mime)
  const parsed = parseJsonBlock(raw)
  if (!parsed?.result?.level || !parsed?.result?.message || !parsed?.result?.doctor) {
    throw new Error('Vision model did not return usable report JSON.')
  }
  return parsed
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  if (req.method === 'POST' && req.url === '/api/medicine') {
    try {
      const body = await readBody(req)
      const answer = await answerMedicineQuestion(body)
      if (!answer) {
        sendJson(res, 503, { error: 'AI backend returned no answer. Check the configured model key and server logs.' })
        return
      }
      sendJson(res, 200, { answer })
      return
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown server error' })
      return
    }
  }

  if (req.method === 'POST' && req.url === '/api/report-image') {
    try {
      const body = await readBody(req)
      const result = await analyzeReportImage(body)
      sendJson(res, 200, result)
      return
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Report image analysis failed.' })
      return
    }
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      const body = await readBody(req)
      const answer = await answerGeneralChat(body)
      if (!answer) {
        sendJson(res, 503, { error: 'AI backend returned no answer. Check the configured model key and server logs.' })
        return
      }
      sendJson(res, 200, { answer })
      return
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown server error' })
      return
    }
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(port, () => {
  console.log(`MedAssist backend listening on http://localhost:${port}`)
})
