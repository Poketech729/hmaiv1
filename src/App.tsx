import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react'
import './App.css'
import AuthGate from './AuthGate'
import { supabase } from './lib/supabaseClient'

// SpeechRecognition global type - browser API
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface SpeechRecognition {
  start(): void
  stop(): void
  abort(): void
  onstart?: () => void
  onend?: () => void
  onresult?: (event: SpeechRecognitionEvent) => void
  onerror?: (event: SpeechRecognitionErrorEvent) => void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor | undefined
    webkitSpeechRecognition: SpeechRecognitionConstructor | undefined
  }
}
import { apiCall } from './lib/api'
import {
  FiActivity,
  FiAlertCircle,
  FiBell,
  FiClock,
  FiFileText,
  FiGlobe,
  FiHeart,
  FiMessageCircle,
  FiMessageSquare,
  FiMic,
  FiPlus,
  FiPhoneCall,
  FiSearch,
  FiSend,
  FiSettings,
  FiShield,
  FiSun,
  FiTrash2,
  FiUpload,
  FiUser,
  FiVolume2,
  FiVolumeX,
  FiMoon,
  FiX,
} from 'react-icons/fi'

type Mode = 'patient' | 'caretaker'
type PatientTab = 'voice' | 'medicines' | 'logs' | 'alerts' | 'reports'
type CareTab = 'medicines' | 'reports' | 'logs' | 'alerts' | 'settings'
type LangKey = 'en' | 'hi' | 'es' | 'it'

type DoseTime = { time: string; taken: boolean; takenAt?: string }
type Med = { id: string; name: string; dosage: string; notes: string; alert: boolean; times: DoseTime[] }
type MedLog = { id: string; med: string; time: string; status: 'taken' | 'missed' | 'recorded' }
type AlertItem = { id: string; msg: string; time: string; type: 'warning' | 'info' | 'success' | 'error' }
type Patient = { name: string; age: string; condition: string; phone: string }
type PatientProfile = Patient & { id: string; savedAt: string }
type ChatMessage = { id: string; role: 'user' | 'ai'; text: string; time: string }

type ReportResult = {
  level: 'SAFE' | 'WARNING' | 'URGENT'
  message: string
  doctor: string
  summary: string[]
  abnormal: string[]
  normal: string[]
  advice: string[]
}

type Report = {
  id: string
  fileName: string
  size: number
  at: string
  raw: string
  notes: string
  dataUrl: string
  mime: string
  result: ReportResult
}

type LegalKey = 'privacy' | 'terms' | 'disclaimer' | 'contact' | 'help' | 'accessibility' | 'account' | null
type Account = { name: string; email: string; role: string }

type MedicineInfo = {
  uses: string
  sideEffects: string[]
  urgentEffects: string[]
  foodTip: string
  symptomLinks: string[]
}

type RemoteDrugInfo = {
  name: string
  genericName: string
  uses: string
  sideEffects: string[]
  warnings: string[]
}

type WeatherInfo = {
  name: string
  country: string
  temperature: number
  apparent: number
  wind: number
  code: number
}

type VoiceProfile = {
  id: string
  label: string
  lang: string
  keywords: string[]
  rate: number
  pitch: number
}

type LocalReply = { handled: boolean; text: string; markedMedicine?: string }

type BloodValues = {
  hb: string
  wbc: string
  platelets: string
  glucose: string
  hba1c: string
  cholesterol: string
  ldl: string
  creatinine: string
}

const LANG_META: Record<LangKey, { label: string; code: string; short: string; greeting: string }> = {
  en: { label: 'English', code: 'en-US', short: '🇬🇧 EN', greeting: 'Ask about medicines, side effects, symptoms, or your next dose.' },
  hi: { label: 'Hindi', code: 'hi-IN', short: '🇮🇳 HI', greeting: 'Dawai, side effect, symptom, ya next dose ke baare mein puchhiye.' },
  es: { label: 'Spanish', code: 'es-ES', short: '🇪🇸 ES', greeting: 'Pregunta sobre medicinas, efectos secundarios, sintomas o tu proxima dosis.' },
  it: { label: 'Italian', code: 'it-IT', short: '🇮🇹 IT', greeting: 'Chiedi di medicine, effetti collaterali, sintomi o prossima dose.' },
}

const UI_TEXT: Record<LangKey, {
  patient: string
  caretaker: string
  heroEyebrow: string
  heroTitle: string
  heroBody: string
  patientTabs: Record<PatientTab, string>
  careTabs: Record<CareTab, string>
}> = {
  en: {
    patient: 'Patient',
    caretaker: 'Caretaker',
    heroEyebrow: 'Positive care, clearer guidance, calmer support',
    heroTitle: 'A calmer, kinder medication guide for patients and caretakers.',
    heroBody: 'Patients can ask about medicines, side effects, symptoms, and reports in a more reassuring experience. Caretakers get clearer tools and stronger patient support.',
    patientTabs: { voice: 'Voice', medicines: 'Medicines', logs: 'Logs', alerts: 'Alerts', reports: 'Reports' },
    careTabs: { medicines: 'Medicines', reports: 'Reports', logs: 'Logs', alerts: 'Alerts', settings: 'Settings' },
  },
  hi: {
    patient: 'मरीज़',
    caretaker: 'देखभालकर्ता',
    heroEyebrow: 'सकारात्मक देखभाल, साफ़ मार्गदर्शन, शांत सहारा',
    heroTitle: 'मरीज़ और देखभालकर्ता के लिए एक शांत और भरोसेमंद दवा सहायक।',
    heroBody: 'मरीज़ दवा, साइड इफेक्ट, लक्षण और रिपोर्ट के बारे में आसान तरीके से पूछ सकते हैं। देखभालकर्ता को अधिक साफ़ और उपयोगी उपकरण मिलते हैं।',
    patientTabs: { voice: 'आवाज़', medicines: 'दवाएं', logs: 'लॉग', alerts: 'अलर्ट', reports: 'रिपोर्ट' },
    careTabs: { medicines: 'दवाएं', reports: 'रिपोर्ट', logs: 'लॉग', alerts: 'अलर्ट', settings: 'सेटिंग्स' },
  },
  es: {
    patient: 'Paciente',
    caretaker: 'Cuidador',
    heroEyebrow: 'Cuidado positivo, guia clara y apoyo sereno',
    heroTitle: 'Una guia de medicacion mas tranquila y amable para pacientes y cuidadores.',
    heroBody: 'Los pacientes pueden preguntar sobre medicinas, efectos secundarios, sintomas y reportes de una manera mas tranquilizadora. Los cuidadores obtienen herramientas mas claras.',
    patientTabs: { voice: 'Voz', medicines: 'Medicinas', logs: 'Registros', alerts: 'Alertas', reports: 'Reportes' },
    careTabs: { medicines: 'Medicinas', reports: 'Reportes', logs: 'Registros', alerts: 'Alertas', settings: 'Ajustes' },
  },
  it: {
    patient: 'Paziente',
    caretaker: 'Assistente',
    heroEyebrow: 'Cura positiva, guida chiara, supporto sereno',
    heroTitle: 'Una guida ai farmaci piu calma e rassicurante per pazienti e assistenti.',
    heroBody: 'I pazienti possono chiedere di farmaci, effetti collaterali, sintomi e referti in un’esperienza piu rassicurante. Gli assistenti ottengono strumenti piu chiari.',
    patientTabs: { voice: 'Voce', medicines: 'Farmaci', logs: 'Registri', alerts: 'Avvisi', reports: 'Referti' },
    careTabs: { medicines: 'Farmaci', reports: 'Referti', logs: 'Registri', alerts: 'Avvisi', settings: 'Impostazioni' },
  },
}

const VIEW_TEXT: Record<LangKey, {
  brandSub: string
  heroMedicineLabel: string
  heroMedicineTitle: string
  heroMedicineBody: string
  heroReportLabel: string
  heroReportTitle: string
  heroReportBody: string
  heroVoiceLabel: string
  heroVoiceTitle: string
  heroVoiceBody: string
  medicineStat: string
  adherenceStat: string
  reportsStat: string
  warningsStat: string
  voiceTitle: string
  voiceLoading: string
  voiceTap: string
  voiceThinking: string
  voiceHeard: string
  assistantName: string
  readAgain: string
  voiceBrowserHint: string
  typeQuestionTitle: string
  typeQuestionBody: string
  chatbotTitle: string
  chatbotBody: string
  chatbotPlaceholder: string
  chatbotReady: string
  thinking: string
  genericPainWord: string
}> = {
  en: {
    brandSub: 'Medication help, symptom support, and report review',
    heroMedicineLabel: '💊 Medicine Q&A',
    heroMedicineTitle: 'Purpose, side effects, symptom matching',
    heroMedicineBody: 'Ask what a medicine does, common side effects, or whether a symptom may be linked to it.',
    heroReportLabel: '🧪 Report Analyzer',
    heroReportTitle: 'Doctor now, soon, or routine',
    heroReportBody: 'Blood values are turned into clearer safe, warning, or urgent guidance.',
    heroVoiceLabel: '🌍 Language & Voice',
    heroVoiceTitle: 'Hindi, Spanish, Italian, English',
    heroVoiceBody: 'Language and voice settings help the assistant speak more clearly for different users.',
    medicineStat: 'Medicines',
    adherenceStat: 'Adherence',
    reportsStat: 'Reports',
    warningsStat: 'Warnings',
    voiceTitle: 'Voice assistant',
    voiceLoading: 'Listening...',
    voiceTap: 'Tap to speak',
    voiceThinking: 'Thinking...',
    voiceHeard: 'You said',
    assistantName: 'MedAssist',
    readAgain: 'Read again',
    voiceBrowserHint: 'Chrome or Edge works best for speech recognition.',
    typeQuestionTitle: 'Type your question',
    typeQuestionBody: 'Use chat if a medicine name is hard to pronounce or you want to type a longer question.',
    chatbotTitle: '💬 Chatbot',
    chatbotBody: 'Write medicine names, side effects, weather, time, or symptom questions.',
    chatbotPlaceholder: 'Try: What does Benadryl do? or What is the weather right now in London?',
    chatbotReady: 'MedAssist is ready. Ask about medicine purpose, side effects, symptom checks, weather, time, or your report.',
    thinking: 'Thinking...',
    genericPainWord: 'pain',
  },
  hi: {
    brandSub: 'दवा सहायता, लक्षण सहयोग, और रिपोर्ट समीक्षा',
    heroMedicineLabel: '💊 दवा सवाल-जवाब',
    heroMedicineTitle: 'उपयोग, साइड इफेक्ट, लक्षण मिलान',
    heroMedicineBody: 'पूछिए दवा क्या करती है, उसके आम साइड इफेक्ट क्या हैं, या कोई लक्षण उससे जुड़ा हो सकता है या नहीं।',
    heroReportLabel: '🧪 रिपोर्ट विश्लेषण',
    heroReportTitle: 'डॉक्टर अभी, जल्द, या सामान्य फॉलो-अप',
    heroReportBody: 'ब्लड वैल्यू को साफ तौर पर सुरक्षित, चेतावनी, या जरूरी मार्गदर्शन में बदला जाता है।',
    heroVoiceLabel: '🌍 भाषा और आवाज़',
    heroVoiceTitle: 'हिंदी, स्पैनिश, इटैलियन, इंग्लिश',
    heroVoiceBody: 'भाषा और आवाज़ सेटिंग अलग-अलग उपयोगकर्ताओं के लिए मददगार हैं।',
    medicineStat: 'दवाएं',
    adherenceStat: 'पालन',
    reportsStat: 'रिपोर्ट',
    warningsStat: 'चेतावनी',
    voiceTitle: 'वॉइस सहायक',
    voiceLoading: 'सुन रहा है...',
    voiceTap: 'बोलने के लिए टैप करें',
    voiceThinking: 'सोच रहा है...',
    voiceHeard: 'आपने कहा',
    assistantName: 'MedAssist',
    readAgain: 'फिर से पढ़ें',
    voiceBrowserHint: 'स्पीच रिकग्निशन के लिए Chrome या Edge बेहतर है।',
    typeQuestionTitle: 'अपना सवाल लिखें',
    typeQuestionBody: 'अगर दवा का नाम बोलना मुश्किल हो, तो यहां टाइप करें।',
    chatbotTitle: '💬 चैटबॉट',
    chatbotBody: 'दवा का नाम, साइड इफेक्ट, मौसम, समय, या लक्षण लिखकर पूछें।',
    chatbotPlaceholder: 'उदाहरण: Benadryl क्या करता है? या लंदन में अभी मौसम कैसा है?',
    chatbotReady: 'MedAssist तैयार है। दवा, साइड इफेक्ट, लक्षण, मौसम, समय या रिपोर्ट के बारे में पूछिए।',
    thinking: 'सोच रहा है...',
    genericPainWord: 'दर्द',
  },
  es: {
    brandSub: 'Ayuda con medicinas, sintomas y revision de reportes',
    heroMedicineLabel: '💊 Preguntas de medicina',
    heroMedicineTitle: 'Uso, efectos secundarios y relacion con sintomas',
    heroMedicineBody: 'Pregunta para que sirve una medicina, sus efectos secundarios o si un sintoma podria estar relacionado.',
    heroReportLabel: '🧪 Analizador de reportes',
    heroReportTitle: 'Doctor ahora, pronto o control rutinario',
    heroReportBody: 'Los valores se convierten en una guia mas clara: seguro, advertencia o urgente.',
    heroVoiceLabel: '🌍 Idioma y voz',
    heroVoiceTitle: 'Hindi, espanol, italiano, ingles',
    heroVoiceBody: 'Las opciones de idioma y voz ayudan a que la asistencia sea mas clara.',
    medicineStat: 'Medicinas',
    adherenceStat: 'Adherencia',
    reportsStat: 'Reportes',
    warningsStat: 'Alertas',
    voiceTitle: 'Asistente de voz',
    voiceLoading: 'Escuchando...',
    voiceTap: 'Toca para hablar',
    voiceThinking: 'Pensando...',
    voiceHeard: 'Dijiste',
    assistantName: 'MedAssist',
    readAgain: 'Leer otra vez',
    voiceBrowserHint: 'Chrome o Edge funcionan mejor para reconocimiento de voz.',
    typeQuestionTitle: 'Escribe tu pregunta',
    typeQuestionBody: 'Usa el chat si un nombre de medicina es dificil de pronunciar o quieres escribir mas.',
    chatbotTitle: '💬 Chatbot',
    chatbotBody: 'Escribe nombres de medicinas, efectos secundarios, clima, hora o sintomas.',
    chatbotPlaceholder: 'Prueba: Que hace Benadryl? o Como esta el clima ahora en Londres?',
    chatbotReady: 'MedAssist esta listo. Pregunta sobre medicinas, efectos secundarios, sintomas, clima, hora o tu reporte.',
    thinking: 'Pensando...',
    genericPainWord: 'dolor',
  },
  it: {
    brandSub: 'Aiuto con farmaci, sintomi e revisione referti',
    heroMedicineLabel: '💊 Domande sui farmaci',
    heroMedicineTitle: 'Uso, effetti collaterali e sintomi',
    heroMedicineBody: 'Chiedi a cosa serve un farmaco, quali effetti collaterali ha o se un sintomo puo essere collegato.',
    heroReportLabel: '🧪 Analisi referti',
    heroReportTitle: 'Medico adesso, presto o controllo normale',
    heroReportBody: 'I valori vengono trasformati in una guida piu chiara: sicuro, avviso o urgente.',
    heroVoiceLabel: '🌍 Lingua e voce',
    heroVoiceTitle: 'Hindi, spagnolo, italiano, inglese',
    heroVoiceBody: 'Le impostazioni di lingua e voce aiutano persone diverse a capire meglio.',
    medicineStat: 'Farmaci',
    adherenceStat: 'Aderenza',
    reportsStat: 'Referti',
    warningsStat: 'Avvisi',
    voiceTitle: 'Assistente vocale',
    voiceLoading: 'In ascolto...',
    voiceTap: 'Tocca per parlare',
    voiceThinking: 'Sto pensando...',
    voiceHeard: 'Hai detto',
    assistantName: 'MedAssist',
    readAgain: 'Leggi di nuovo',
    voiceBrowserHint: 'Chrome o Edge funzionano meglio per il riconoscimento vocale.',
    typeQuestionTitle: 'Scrivi la tua domanda',
    typeQuestionBody: 'Usa la chat se il nome di un farmaco e difficile da pronunciare o vuoi scrivere di piu.',
    chatbotTitle: '💬 Chatbot',
    chatbotBody: 'Scrivi nomi di farmaci, effetti collaterali, meteo, ora o sintomi.',
    chatbotPlaceholder: 'Prova: Cosa fa Benadryl? oppure Com e il meteo adesso a Londra?',
    chatbotReady: 'MedAssist e pronto. Chiedi di farmaci, effetti collaterali, sintomi, meteo, ora o referti.',
    thinking: 'Sto pensando...',
    genericPainWord: 'dolore',
  },
}

const VOICE_PROFILES: Record<LangKey, VoiceProfile[]> = {
  en: [
    { id: 'en-us', label: 'US', lang: 'en-US', keywords: ['jenny', 'aria', 'samantha', 'ava', 'zira', 'female', 'woman', 'google us english'], rate: 0.93, pitch: 1.02 },
    { id: 'en-uk', label: 'UK', lang: 'en-GB', keywords: ['english uk', 'british', 'libby', 'hazel'], rate: 0.92, pitch: 0.98 },
    { id: 'en-au', label: 'Australia', lang: 'en-AU', keywords: ['english au', 'australia'], rate: 0.94, pitch: 1.02 },
  ],
  hi: [
    { id: 'hi-clear', label: 'Hindi Clear', lang: 'hi-IN', keywords: ['hindi', 'india', 'hi-in'], rate: 0.82, pitch: 1.02 },
    { id: 'hi-soft', label: 'Hindi Soft', lang: 'hi-IN', keywords: ['hindi', 'india', 'hi-in'], rate: 0.76, pitch: 1.08 },
  ],
  es: [
    { id: 'es-spain', label: 'Spain', lang: 'es-ES', keywords: ['spanish spain', 'es-es', 'jorge', 'helena'], rate: 0.9, pitch: 1 },
    { id: 'es-mx', label: 'Mexico', lang: 'es-MX', keywords: ['spanish mexico', 'es-mx', 'mexico'], rate: 0.9, pitch: 1.02 },
    { id: 'es-us', label: 'Latino', lang: 'es-US', keywords: ['spanish united states', 'es-us', 'latino'], rate: 0.9, pitch: 1.03 },
  ],
  it: [
    { id: 'it-it', label: 'Italy', lang: 'it-IT', keywords: ['italian', 'it-it', 'italy'], rate: 0.9, pitch: 1 },
    { id: 'it-warm', label: 'Italy Warm', lang: 'it-IT', keywords: ['italian', 'it-it', 'italy'], rate: 0.86, pitch: 1.05 },
  ],
}

const MEDICINE_LIBRARY: Record<string, MedicineInfo> = {
  metformin: {
    uses: 'Metformin helps lower blood sugar in type 2 diabetes.',
    sideEffects: ['nausea', 'diarrhea', 'stomach upset', 'reduced appetite', 'metallic taste'],
    urgentEffects: ['trouble breathing', 'severe weakness', 'confusion', 'severe vomiting'],
    foodTip: 'Take Metformin with food to reduce stomach upset.',
    symptomLinks: ['nausea', 'diarrhea', 'stomach pain', 'metallic taste', 'weakness'],
  },
  amlodipine: {
    uses: 'Amlodipine helps relax blood vessels and lower blood pressure.',
    sideEffects: ['dizziness', 'ankle swelling', 'flushing', 'headache', 'tiredness'],
    urgentEffects: ['chest pain', 'fainting', 'trouble breathing'],
    foodTip: 'Amlodipine can be taken with or without food.',
    symptomLinks: ['dizziness', 'swelling', 'headache', 'fatigue'],
  },
  aspirin: {
    uses: 'Aspirin helps reduce pain and can lower clot risk when prescribed in low dose.',
    sideEffects: ['stomach upset', 'heartburn', 'nausea', 'easy bruising', 'bleeding'],
    urgentEffects: ['black stool', 'vomiting blood', 'severe allergic reaction'],
    foodTip: 'Take Aspirin after food if it irritates the stomach.',
    symptomLinks: ['stomach pain', 'nausea', 'heartburn', 'bleeding', 'bruising'],
  },
  ibuprofen: {
    uses: 'Ibuprofen helps reduce pain, swelling, and fever.',
    sideEffects: ['stomach upset', 'heartburn', 'nausea', 'dizziness'],
    urgentEffects: ['vomiting blood', 'black stool', 'swelling of face', 'trouble breathing'],
    foodTip: 'Take Ibuprofen with food or milk to reduce stomach irritation.',
    symptomLinks: ['stomach pain', 'nausea', 'heartburn', 'dizziness'],
  },
  paracetamol: {
    uses: 'Paracetamol helps reduce fever and mild pain.',
    sideEffects: ['nausea', 'rash'],
    urgentEffects: ['yellow eyes', 'severe rash', 'trouble breathing'],
    foodTip: 'Paracetamol is usually fine with or without food.',
    symptomLinks: ['nausea', 'rash'],
  },
  diphenhydramine: {
    uses: 'Diphenhydramine is an antihistamine often used for allergy symptoms, itching, sneezing, and sometimes short-term sleep support.',
    sideEffects: ['sleepiness', 'dry mouth', 'dizziness', 'blurred vision', 'constipation'],
    urgentEffects: ['trouble breathing', 'fast heartbeat', 'severe confusion'],
    foodTip: 'Diphenhydramine can be taken with or without food, but it can make some people very sleepy.',
    symptomLinks: ['sleepiness', 'dizziness', 'dry mouth', 'blurred vision'],
  },
  cetirizine: {
    uses: 'Cetirizine is an antihistamine used for allergy symptoms like runny nose, sneezing, and itching.',
    sideEffects: ['sleepiness', 'dry mouth', 'tiredness', 'headache'],
    urgentEffects: ['trouble breathing', 'severe allergic reaction'],
    foodTip: 'Cetirizine can be taken with or without food.',
    symptomLinks: ['sleepiness', 'tiredness', 'headache', 'dry mouth'],
  },
  diclofenac: {
    uses: 'Diclofenac is an anti-inflammatory pain reliever used for muscle aches, joint pain, and strains.',
    sideEffects: ['stomach upset', 'heartburn', 'nausea', 'dizziness'],
    urgentEffects: ['vomiting blood', 'black stool', 'trouble breathing', 'severe rash'],
    foodTip: 'Oral diclofenac is usually taken with food; topical gels and balms can be applied on intact skin only.',
    symptomLinks: ['stomach pain', 'nausea', 'heartburn', 'dizziness'],
  },
  'methyl salicylate': {
    uses: 'Methyl salicylate (in many balms) gives a warming effect for muscle or joint aches.',
    sideEffects: ['skin warmth', 'mild redness', 'tingling'],
    urgentEffects: ['severe irritation', 'breathing trouble', 'widespread rash'],
    foodTip: 'Topical only; do not ingest. Avoid broken skin.',
    symptomLinks: ['redness', 'tingling'],
  },
  'camphor menthol': {
    uses: 'Camphor and menthol rubs such as some Vicks products are commonly used for temporary relief of cough, congestion, and body aches.',
    sideEffects: ['skin irritation', 'burning sensation', 'redness'],
    urgentEffects: ['trouble breathing', 'severe rash', 'swelling of face'],
    foodTip: 'Topical only; avoid eyes, mouth, broken skin, and do not swallow.',
    symptomLinks: ['burning', 'redness', 'rash'],
  },
  simethicone: {
    uses: 'Simethicone is used for gas, bloating, and stomach fullness.',
    sideEffects: ['mild nausea', 'loose stool'],
    urgentEffects: ['severe allergic reaction', 'trouble breathing'],
    foodTip: 'Usually taken after meals or as directed on the label.',
    symptomLinks: ['bloating', 'gas', 'stomach fullness'],
  },
  antacid: {
    uses: 'Common antacids are used for acidity, heartburn, sour stomach, and indigestion.',
    sideEffects: ['constipation', 'diarrhea', 'chalky taste', 'nausea'],
    urgentEffects: ['severe vomiting', 'black stool', 'trouble swallowing'],
    foodTip: 'Use as directed on the label and separate from other medicines when needed.',
    symptomLinks: ['heartburn', 'acidity', 'indigestion', 'stomach upset'],
  },
  digestives: {
    uses: 'Digestive tablets or candies are used for mild indigestion, gas, and post-meal discomfort.',
    sideEffects: ['mouth irritation', 'stomach upset', 'diarrhea'],
    urgentEffects: ['severe abdominal pain', 'vomiting', 'allergic reaction'],
    foodTip: 'Use in moderation, especially if it contains a lot of salt or spices.',
    symptomLinks: ['indigestion', 'gas', 'bloating'],
  },
  menthol: {
    uses: 'Menthol products are often used for cough, cold, congestion, and soothing throat or chest discomfort.',
    sideEffects: ['burning sensation', 'skin irritation', 'eye irritation'],
    urgentEffects: ['breathing trouble', 'severe rash', 'swelling'],
    foodTip: 'Use only as directed for topical or lozenge use.',
    symptomLinks: ['congestion', 'cough', 'burning', 'irritation'],
  },
  lozenges: {
    uses: 'Lozenges are used to soothe sore throat, throat irritation, and cough.',
    sideEffects: ['mouth irritation', 'nausea', 'altered taste'],
    urgentEffects: ['trouble breathing', 'swelling', 'severe rash'],
    foodTip: 'Do not chew quickly unless the label says it is chewable.',
    symptomLinks: ['sore throat', 'cough', 'throat irritation'],
  },
  'oral rehydration salts': {
    uses: 'Oral rehydration salts are used to replace fluids and salts during diarrhea, vomiting, or dehydration.',
    sideEffects: ['nausea', 'bloating'],
    urgentEffects: ['confusion', 'fainting', 'severe weakness'],
    foodTip: 'Mix exactly as directed in clean water and use within the recommended time.',
    symptomLinks: ['dehydration', 'diarrhea', 'vomiting', 'weakness'],
  },
  probiotics: {
    uses: 'Probiotics are used to support gut health and may help with mild diarrhea or antibiotic-related stomach upset.',
    sideEffects: ['gas', 'bloating', 'mild stomach discomfort'],
    urgentEffects: ['severe allergic reaction', 'high fever', 'bloody stool'],
    foodTip: 'Use as directed; some products suggest taking after meals.',
    symptomLinks: ['gas', 'bloating', 'diarrhea'],
  },
  antiseptic: {
    uses: 'Antiseptic liquids and creams are used to clean minor cuts, scrapes, and small skin wounds.',
    sideEffects: ['skin irritation', 'burning', 'dryness'],
    urgentEffects: ['worsening redness', 'swelling', 'trouble breathing'],
    foodTip: 'External use only. Do not swallow.',
    symptomLinks: ['burning', 'redness', 'skin irritation'],
  },
  moisturizer: {
    uses: 'Barrier creams and moisturizers are used for dry, cracked, or irritated skin.',
    sideEffects: ['greasiness', 'mild irritation', 'rash'],
    urgentEffects: ['severe rash', 'swelling', 'breathing trouble'],
    foodTip: 'External use only.',
    symptomLinks: ['dry skin', 'cracking', 'rash', 'itching'],
  },
  'nasal decongestant': {
    uses: 'Nasal decongestants are used for blocked nose and congestion during colds or allergies.',
    sideEffects: ['dry nose', 'burning', 'restlessness', 'headache'],
    urgentEffects: ['chest pain', 'severe dizziness', 'breathing trouble'],
    foodTip: 'Use only as directed and avoid overuse of nasal drops or sprays.',
    symptomLinks: ['congestion', 'runny nose', 'headache'],
  },
}

const MEDICINE_ALIASES: Record<string, string> = {
  crocin: 'paracetamol',
  dolo: 'paracetamol',
  calpol: 'paracetamol',
  acetaminophen: 'paracetamol',
  pcm: 'paracetamol',
  disprin: 'aspirin',
  benadryl: 'diphenhydramine',
  zyrtec: 'cetirizine',
  allegra: 'fexofenadine',
  claritin: 'loratadine',
  moov: 'diclofenac',
  'moov balm': 'diclofenac',
  zandu: 'methyl salicylate',
  'zandu balm': 'methyl salicylate',
  vicks: 'camphor menthol',
  'vicks vaporub': 'camphor menthol',
  'vicks action 500': 'paracetamol',
  strepsils: 'lozenges',
  halls: 'lozenges',
  fishermans: 'lozenges',
  'fisherman\'s friend': 'lozenges',
  hajmola: 'digestives',
  'hajmola candy': 'digestives',
  pudin: 'digestives',
  'pudin hara': 'digestives',
  eno: 'antacid',
  digene: 'antacid',
  gelusil: 'antacid',
  gaviscon: 'antacid',
  'electral': 'oral rehydration salts',
  ors: 'oral rehydration salts',
  'enterogermina': 'probiotics',
  'sporlac': 'probiotics',
  volini: 'diclofenac',
  iodex: 'methyl salicylate',
  tiger: 'methyl salicylate',
  'tiger balm': 'methyl salicylate',
  amrutanjan: 'menthol',
  burnol: 'antiseptic',
  boroline: 'moisturizer',
  dettol: 'antiseptic',
  savlon: 'antiseptic',
  otrivin: 'nasal decongestant',
  nasivion: 'nasal decongestant',
}

const DEMO_MEDS: Med[] = [
  { id: 'm1', name: 'Metformin', dosage: '500 mg', notes: 'Take with breakfast and dinner.', alert: true, times: [{ time: '08:00', taken: false }, { time: '20:00', taken: false }] },
  { id: 'm2', name: 'Amlodipine', dosage: '5 mg', notes: 'Once daily for blood pressure.', alert: true, times: [{ time: '09:00', taken: false }] },
  { id: 'm3', name: 'Aspirin', dosage: '75 mg', notes: 'Take after breakfast.', alert: false, times: [{ time: '08:00', taken: false }] },
]

const EMPTY_BLOOD_VALUES: BloodValues = {
  hb: '',
  wbc: '',
  platelets: '',
  glucose: '',
  hba1c: '',
  cholesterol: '',
  ldl: '',
  creatinine: '',
}

const CARETAKER_KEY = 'medassist-caretaker-v2'

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fullDate() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function phoneUriValue(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const cleaned = trimmed.replace(/[^\d+]/g, '')
  return cleaned
}

function extractRecordedNote(text: string) {
  const match = text.match(/^(?:please\s+)?(?:record|log|note|remember)\s+(.+)$/i)
  if (!match?.[1]) return null
  const cleaned = match[1].trim().replace(/\s+/g, ' ')
  if (!cleaned) return null
  return cleaned.length > 110 ? `${cleaned.slice(0, 107)}...` : cleaned
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the uploaded file.'))
    reader.readAsDataURL(file)
  })
}



class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('MedAssist UI crash:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <main className="main-content">
            <section className="panel">
              <div className="card">
                <h2>Something went wrong</h2>
                <p>The page hit an unexpected error. Please refresh and try a smaller or clearer report image again.</p>
              </div>
            </section>
          </main>
        </div>
      )
    }
    return this.props.children
  }
}

const LEGAL_CONTENT: Record<Exclude<LegalKey, 'account' | null>, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'MedAssist keeps your caretaker data in local browser storage for this demo.',
      'Voice uses your browser speech tools, and uploaded reports are only sent to Claude when an API key is configured.',
      'Saved patient cards, notes, and report summaries stay in this browser unless you clear them.',
      'Sensitive questions should still be discussed directly with a doctor or care team.',
    ],
  },
  terms: {
    title: 'Terms of Use',
    body: [
      'MedAssist is a demo support application and not a medical device.',
      'Always confirm medication or treatment decisions with a qualified clinician.',
      'This app is meant to support understanding, reminders, and clearer communication, not replace medical judgment.',
      'Using the app means you understand it may be incomplete if an external data source is unavailable.',
    ],
  },
  disclaimer: {
    title: 'Medical Disclaimer',
    body: [
      'This product offers educational guidance only and cannot diagnose or prescribe.',
      'Emergency symptoms should always be handled by emergency services or a doctor immediately.',
      'Do not stop chemotherapy, blood pressure medicine, diabetes medicine, or any prescription treatment based only on this screen.',
      'If symptoms are severe, new, rapidly worsening, or frightening, seek care urgently.',
    ],
  },
  contact: {
    title: 'Contact',
    body: [
      'General support: support@medassist.health',
      'Bug reports: bugs@medassist.health',
      'Accessibility support: access@medassist.health',
      'Patient onboarding help: onboarding@medassist.health',
      'Caretaker workflow help: caretaker@medassist.health',
    ],
  },
  help: {
    title: 'Help Center',
    body: [
      'Use the mic button in Chrome or Edge, allow microphone access, then speak naturally.',
      'You can ask what a medicine does, what side effects it has, whether a symptom may be caused by it, when the next dose is due, or ask the analyzer to review a report.',
      'Brand names like Crocin are supported through alias and live lookup logic.',
    ],
  },
  accessibility: {
    title: 'Accessibility',
    body: [
      'Large touch targets, readable typography, and multilingual voice playback are built in.',
      'Hindi, Spanish, Italian, and English voice profiles can be changed from the patient voice panel.',
      'Color, motion, and spacing are being tuned to feel more supportive and less clinical.',
      'We aim to keep the interface calmer and more encouraging for older adults and patients under stress.',
    ],
  },
}

function getApiKey() {
  return ''
}

function normalize(text: string) {
  return text.toLowerCase().trim()
}

function findKnownMedicine(name: string) {
  const normalized = normalize(name)
  const aliasHit = Object.entries(MEDICINE_ALIASES).find(([alias]) => normalized.includes(alias))?.[1]
  const directHit = Object.keys(MEDICINE_LIBRARY).find((libKey) => normalized.includes(libKey))
  const key = aliasHit ?? directHit ?? MEDICINE_ALIASES[normalized] ?? normalized
  return Object.entries(MEDICINE_LIBRARY).find(([libKey]) => key.includes(libKey) || libKey.includes(key))
}

function findAliasMention(text: string) {
  const normalized = normalize(text)
  return Object.keys(MEDICINE_ALIASES).find((alias) => normalized.includes(alias)) ?? ''
}

function formatMedicineLabel(text: string, knownKey: string) {
  const alias = findAliasMention(text)
  if (alias) return alias.replace(/\b\w/g, (char) => char.toUpperCase())
  return knownKey.replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveMedicineAlias(name: string) {
  const clean = normalize(name)
  return MEDICINE_ALIASES[clean] ?? clean
}

function extractMedicineCandidate(text: string, meds: Med[]) {
  const fromSaved = findMedicineFromText(text, meds)
  if (fromSaved) return fromSaved.name
  const aliasHit = Object.keys(MEDICINE_ALIASES).find((alias) => normalize(text).includes(alias))
  if (aliasHit) return aliasHit
  const patterns = [
    /what does\s+([A-Za-z][A-Za-z0-9\s-]{1,40}?)\s+do/i,
    /what is\s+([A-Za-z][A-Za-z0-9\s-]{1,40}?)\s+used for/i,
    /side effects? of\s+([A-Za-z][A-Za-z0-9\s-]{1,40})/i,
    /who should(?: not|n't)? use\s+([A-Za-z][A-Za-z0-9\s-]{1,40})/i,
    /about\s+([A-Za-z][A-Za-z0-9\s-]{1,40})/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim()
    if (match) return match
  }
  return ''
}

async function fetchDrugKnowledge(query: string): Promise<RemoteDrugInfo | null> {
  const resolved = resolveMedicineAlias(query)
  if (!resolved) return null

  try {
    const rxResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(resolved)}&maxEntries=1`)
    const rxData = rxResponse.ok ? await rxResponse.json() : null
    const rxName = rxData?.approximateGroup?.candidate?.[0]?.name || resolved
    // eslint-disable-next-line no-useless-escape
    const labelUrl = `https://api.fda.gov/drug/label.json?search=(openfda.brand_name:\"${encodeURIComponent(rxName)}\"+openfda.generic_name:\"${encodeURIComponent(rxName)}\")&limit=1`
    const response = await fetch(labelUrl)
    if (!response.ok) return null
    const data = await response.json()
    const item = data?.results?.[0]
    if (!item) return null

    const genericName = item.openfda?.generic_name?.[0] || rxName
    const brandName = item.openfda?.brand_name?.[0] || query || rxName
    const uses = item.purpose?.[0] || item.indications_and_usage?.[0] || `${brandName} is a medicine that should be used only as directed.`
    const sideEffects = ((item.adverse_reactions?.[0] || '') as string)
      .split(/[.;•\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6)
    const warnings = ((item.warnings?.[0] || item.do_not_use?.[0] || '') as string)
      .split(/[.;•\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4)

    return {
      name: brandName,
      genericName,
      uses,
      sideEffects,
      warnings,
    }
  } catch {
    return null
  }
}

async function fetchBackendMedicineAnswer(question: string, medicine: string, lang: LangKey) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/medicine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, medicine, lang: LANG_META[lang].label }),
    })
    if (!response.ok) return ''
    const data = await response.json()
    return data.answer || ''
  } catch {
    return ''
  }
}

async function analyzeReportImageWithBackend(imageBase64: string, mime: string, age: string, manualValues: BloodValues) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/report-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mime, age, manualValues }),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function resolveDrugQuery(text: string, meds: Med[]) {
  const saved = findMedicineFromText(text, meds)
  if (saved) return saved.name

  const aliasHit = Object.keys(MEDICINE_ALIASES).find((alias) => normalize(text).includes(alias))
  if (aliasHit) return aliasHit

  const candidates = [
    text.match(/(?:side effects? of|what does|what is|use of|about|for|taking|using)\s+([A-Za-z][A-Za-z0-9\s-]{1,40})/i)?.[1],
    text.match(/^([A-Za-z][A-Za-z0-9\s-]{1,30})$/)?.[1],
    extractMedicineCandidate(text, meds),
  ]
    .map((item) => item?.trim())
    .filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const rxResponse = await fetch(`https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(candidate)}`)
      if (!rxResponse.ok) continue
      const rxData = await rxResponse.json()
      const suggestion = rxData?.suggestionGroup?.suggestionList?.suggestion?.[0]
      if (suggestion) return suggestion
    } catch {
      // Continue to next candidate on error
    }
  }

  return candidates[0] || ''
}

function findMedicineFromText(text: string, meds: Med[]) {
  const lower = normalize(text)
  return meds.find((med) => {
    const medName = normalize(med.name)
    const alias = Object.entries(MEDICINE_ALIASES).find(([, generic]) => generic === medName && lower.includes(normalize(generic)))?.[0]
    return lower.includes(medName) || (!!alias && lower.includes(alias))
  })
}

function weatherCodeLabel(code: number) {
  if ([0].includes(code)) return 'clear'
  if ([1, 2].includes(code)) return 'partly cloudy'
  if ([3].includes(code)) return 'cloudy'
  if ([45, 48].includes(code)) return 'foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzly'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy'
  if ([95, 96, 99].includes(code)) return 'stormy'
  return 'mixed'
}

function extractWeatherLocation(text: string) {
  const cleaned = text.replace(/\?+/g, '').trim()
  const patterns = [
    /weather(?: right now| now| today)? in ([A-Za-z\s,.'-]{2,50})$/i,
    /temperature(?: right now| now| today)? in ([A-Za-z\s,.'-]{2,50})$/i,
    /forecast(?: right now| now| today)? for ([A-Za-z\s,.'-]{2,50})$/i,
    /how is the weather in ([A-Za-z\s,.'-]{2,50})$/i,
  ]
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)?.[1]?.trim()
    if (match) return match
  }
  return ''
}

function extractPainArea(text: string, lang: LangKey) {
  const normalized = normalize(text)
  const map: Array<[string, Record<LangKey, string>]> = [
    ['head', { en: 'headache', hi: 'sir dard', es: 'dolor de cabeza', it: 'mal di testa' }],
    ['leg', { en: 'leg pain', hi: 'pair ka dard', es: 'dolor de pierna', it: 'dolore alla gamba' }],
    ['knee', { en: 'knee pain', hi: 'ghutne ka dard', es: 'dolor de rodilla', it: 'dolore al ginocchio' }],
    ['back', { en: 'back pain', hi: 'peeth dard', es: 'dolor de espalda', it: 'mal di schiena' }],
    ['stomach', { en: 'stomach pain', hi: 'pet dard', es: 'dolor de estomago', it: 'mal di stomaco' }],
    ['body', { en: 'body pain', hi: 'sharir dard', es: 'dolor corporal', it: 'dolore al corpo' }],
  ]
  const hit = map.find(([needle]) => normalized.includes(needle))
  return hit?.[1][lang] || VIEW_TEXT[lang].genericPainWord
}

async function fetchWeather(location: string): Promise<WeatherInfo | null> {
  try {
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`)
    if (!geoResponse.ok) return null
    const geoData = await geoResponse.json()
    const place = geoData?.results?.[0]
    if (!place) return null

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
    )
    if (!weatherResponse.ok) return null
    const weatherData = await weatherResponse.json()
    const current = weatherData?.current
    if (!current) return null

    return {
      name: place.name,
      country: place.country || '',
      temperature: Number(current.temperature_2m),
      apparent: Number(current.apparent_temperature),
      wind: Number(current.wind_speed_10m),
      code: Number(current.weather_code),
    }
  } catch {
    return null
  }
}

function parseJsonBlock<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

async function callClaude(system: string, content: unknown, maxTokens = 500) {
  const key = getApiKey()
  if (!key) return ''

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) return ''
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

async function callBackendChat(question: string, lang: LangKey, meds: Med[], patient: Patient) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        lang: LANG_META[lang].label,
        patient,
        medicines: meds.map((med) => ({
          name: med.name,
          dosage: med.dosage,
          notes: med.notes,
          times: med.times.map((time) => time.time),
        })),
      }),
    })
    if (!response.ok) return ''
    const data = await response.json()
    return data.answer || ''
  } catch {
    return ''
  }
}

function selectVoice(voices: SpeechSynthesisVoice[], profile: VoiceProfile) {
  const exact = voices.find((voice) => voice.lang.toLowerCase() === profile.lang.toLowerCase())
  if (exact) return exact

  const keywordMatch = voices.find((voice) => {
    const target = `${voice.name} ${voice.lang}`.toLowerCase()
    return profile.keywords.some((keyword) => target.includes(keyword))
  })
  if (keywordMatch) return keywordMatch

  const prefix = profile.lang.split('-')[0].toLowerCase()
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? voices[0] ?? null
}

function listMedicineNames(meds: Med[]) {
  return meds.map((med) => `${med.name} ${med.dosage}`).join(', ')
}

function getNextDose(meds: Med[]) {
  return meds
    .flatMap((med) => med.times.filter((time) => !time.taken).map((time) => ({ med: med.name, time: time.time })))
    .sort((a, b) => a.time.localeCompare(b.time))[0]
}

function symptomKeyword(text: string) {
  const lower = normalize(text)
  const symptoms = ['burn', 'burning', 'dizzy', 'dizziness', 'nausea', 'stomach pain', 'vomiting', 'diarrhea', 'headache', 'swelling', 'rash', 'heartburn', 'bleeding', 'weakness', 'fatigue']
  return symptoms.find((symptom) => lower.includes(symptom))
}

function looksLikeBareProductQuery(text: string) {
  const trimmed = normalize(text).replace(/[?.!,]/g, '').trim()
  if (!trimmed) return false
  if (trimmed.length > 40) return false
  return !/\b(what|why|how|when|where|can|should|is|are|do|does|did|who)\b/.test(trimmed)
}

function translateReply(lang: LangKey, english: string, fallback?: string) {
  if (lang === 'en') return english
  return fallback ?? english
}

function genericFallbackReply(text: string, lang: LangKey) {
  const lower = normalize(text)
  const healthWords = [
    'medicine', 'medicines', 'tablet', 'capsule', 'syrup', 'balm', 'ointment', 'gel', 'rub', 'drop', 'spray',
    'antacid', 'digestive', 'pain', 'fever', 'cough', 'cold', 'allergy', 'throat', 'gas', 'bloating', 'vomiting',
    'diarrhea', 'burn', 'rash', 'itch', 'headache', 'acidity', 'indigestion', 'product', 'hajmola', 'eno', 'digene',
    'gelusil', 'vicks', 'moov', 'zandu', 'dettol', 'savlon', 'boroline', 'burnol', 'volini', 'strepsils', 'electral',
    'ors', 'otrivin', 'hb', 'hbc', 'hemoglobin', 'hba1c', 'report', 'doctor', 'symptom', 'side effect'
  ]
  const looksHealthRelated = healthWords.some((word) => lower.includes(word))

  if (!looksHealthRelated) {
    return translateReply(
      lang,
      'I could not get a model answer just now. Please make sure the local Ollama model is running and the API server has been restarted.',
      lang === 'hi'
        ? 'Abhi model se jawab nahin mila. Kripya dekhiye ki local Ollama model chal raha ho aur API server restart kiya gaya ho.'
        : lang === 'es'
          ? 'No pude obtener respuesta del modelo en este momento. Asegurate de que el modelo local de Ollama este en ejecucion y que el servidor API se haya reiniciado.'
          : 'Non sono riuscito a ottenere una risposta dal modello in questo momento. Assicurati che il modello locale Ollama sia in esecuzione e che il server API sia stato riavviato.'
    )
  }

  return translateReply(
    lang,
    'I can help with medicine purpose, side effects, symptom checks, dose reminders, and blood report guidance. Try asking about a specific medicine or symptom.',
    lang === 'hi'
      ? 'Main medicine ka use, side effects, symptom check, dose reminder aur blood report guidance mein help kar sakta hoon. Kisi specific medicine ya symptom ke baare mein puchhiye.'
      : lang === 'es'
        ? 'Puedo ayudar con uso de medicinas, efectos secundarios, sintomas, recordatorios y orientacion del reporte.'
        : 'Posso aiutare con uso dei farmaci, effetti collaterali, sintomi, promemoria e guida sul referto.'
  )
}

function sanitizeSpeechText(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, ' ')
    .replace(/[?!.]{2,}/g, '. ')
    .replace(/\s*[?]+\s*/g, '. ')
    .replace(/\s*[!]+\s*/g, '. ')
    .replace(/\s*[;:]+\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function buildLocalReply(text: string, lang: LangKey, meds: Med[], patient: Patient, selectedVoiceLabel?: string): LocalReply {
  const matchedMed = findMedicineFromText(text, meds)
  const known = matchedMed ? findKnownMedicine(matchedMed.name) : findKnownMedicine(text)
  const knownLabel = known ? formatMedicineLabel(text, known[0]) : ''
  const nextDose = getNextDose(meds)
  const symptom = symptomKeyword(text)
  const patientName = patient.name.trim() || 'the patient'
  const now = new Date()
  const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const currentDate = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  if (/(what time|current time|time right now|time is it)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `It is ${currentTime} right now.`,
        lang === 'hi'
          ? `Abhi samay ${currentTime} hai.`
          : lang === 'es'
            ? `Ahora mismo son las ${currentTime}.`
            : `Adesso sono le ${currentTime}.`
      ),
    }
  }

  if (/(what date|today's date|date today|which day is it)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `Today is ${currentDate}.`,
        lang === 'hi'
          ? `Aaj ${currentDate} hai.`
          : lang === 'es'
            ? `Hoy es ${currentDate}.`
            : `Oggi e ${currentDate}.`
      ),
    }
  }

  if (/(normal hbc|normal hb|normal hemoglobin|hb normal|hemoglobin normal)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        'Normal hemoglobin often falls around 12 to 16 g/dL for many adult women and about 13 to 17 g/dL for many adult men. Ranges can vary by lab, age, pregnancy, and health conditions, so your report range is the best reference.',
        lang === 'hi'
          ? 'Normal hemoglobin kai adult mahilaon mein lagbhag 12 se 16 g/dL aur kai adult purushon mein lagbhag 13 se 17 g/dL hota hai. Lab, umar, pregnancy aur health condition ke hisaab se range badal sakti hai, isliye report par di gayi reference range sabse achchi hoti hai.'
          : lang === 'es'
            ? 'La hemoglobina normal suele estar alrededor de 12 a 16 g/dL en muchas mujeres adultas y de 13 a 17 g/dL en muchos hombres adultos. El rango puede variar segun el laboratorio, la edad, el embarazo y la salud, por lo que el rango de tu reporte es la mejor referencia.'
            : 'L emoglobina normale e spesso intorno a 12-16 g/dL per molte donne adulte e circa 13-17 g/dL per molti uomini adulti. Il range puo variare in base al laboratorio, all eta, alla gravidanza e alle condizioni di salute, quindi il range sul referto e il riferimento migliore.'
      ),
    }
  }

  if (/(normal hba1c|hba1c normal|normal a1c|a1c normal)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        'HbA1c is often considered normal below about 5.7 percent. Around 5.7 to 6.4 percent may suggest prediabetes, and 6.5 percent or higher can suggest diabetes, but a doctor should interpret it with the full picture.',
        lang === 'hi'
          ? 'HbA1c ko aksar lagbhag 5.7 percent se neeche normal maana jata hai. 5.7 se 6.4 percent prediabetes dikha sakta hai, aur 6.5 percent ya usse zyada diabetes ka sanket ho sakta hai, lekin doctor ko poori report ke saath dekhna chahiye.'
          : lang === 'es'
            ? 'La HbA1c suele considerarse normal por debajo de aproximadamente 5.7 por ciento. Entre 5.7 y 6.4 por ciento puede sugerir prediabetes, y 6.5 por ciento o mas puede sugerir diabetes, pero un medico debe interpretarlo con el contexto completo.'
            : 'L HbA1c e spesso considerata normale sotto circa il 5.7 percento. Tra 5.7 e 6.4 percento puo suggerire prediabete, e 6.5 percento o piu puo suggerire diabete, ma un medico dovrebbe interpretarla nel contesto completo.'
      ),
    }
  }

  if (/(weather|temperature|raining|forecast)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        'I cannot check live weather from this local fallback yet, but I can answer medicine and time questions right away.',
        lang === 'hi'
          ? 'Main abhi is local fallback se live mausam nahin dekh sakta, lekin dawai aur samay ke sawaalon ka turant jawab de sakta hoon.'
          : lang === 'es'
            ? 'Todavia no puedo consultar el clima en vivo desde este modo local, pero si puedo responder sobre medicinas y hora.'
            : 'Non posso ancora controllare il meteo in tempo reale da questo fallback locale, ma posso rispondere subito su farmaci e orario.'
      ),
    }
  }

  if (/(generic medicine|generic tablet|pain medicine|painkiller|medicine for pain|pain in legs|leg pain)/i.test(text)) {
    const painArea = extractPainArea(text, lang)
    return {
      handled: true,
      text: translateReply(
        lang,
        `For mild ${painArea}, common generic options are paracetamol (acetaminophen) or ibuprofen. The safest choice depends on the cause and your health history, so ask a doctor or pharmacist before repeated use, especially if the pain is strong, keeps returning, or comes with swelling, fever, numbness, or injury.`,
        lang === 'hi'
          ? `Halki ${painArea} ke liye paracetamol ya ibuprofen jaise generic options use kiye jaate hain. Sabse sahi dawa kaaran aur health history par depend karti hai, isliye agar dard baar-baar ho, zyada ho, ya sujan, bukhar, sunnpan ya chot ke saath ho to doctor ya pharmacist se poochna zaroori hai.`
          : lang === 'es'
            ? `Para ${painArea} leve, opciones genericas comunes son paracetamol o ibuprofeno. La opcion mas segura depende de la causa y de tu salud, asi que si el dolor es fuerte, vuelve seguido o aparece con hinchazon, fiebre, entumecimiento o lesion, consulta a un medico o farmaceutico.`
            : `Per ${painArea} lieve, opzioni generiche comuni sono paracetamolo o ibuprofene. La scelta piu sicura dipende dalla causa e dalla tua salute, quindi se il dolore e forte, ritorna spesso o arriva con gonfiore, febbre, intorpidimento o trauma, consulta un medico o farmacista.`
      ),
    }
  }

  if (/(burn|burned|burnt|scald)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        'For a small mild burn, cool the area under cool running water for about 20 minutes, remove tight rings or jewelry, and keep it clean. Do not use ice, toothpaste, or butter. Get urgent medical help if the burn is large, deep, on the face, genitals, or a major joint, or if there is severe pain, blistering, numbness, or signs of infection.',
        lang === 'hi'
          ? 'Halki chhoti jalan ke liye jagah ko lagbhag 20 minute tak thande bahte paani ke neeche rakhiye, aur tight ring ya jewelry hata dijiye. Barf, toothpaste ya butter mat lagaiye. Agar jalan gehri ho, badi ho, chehre, private area ya joint par ho, ya zyada dard, chhale, sunnpan ya infection dikhe to turant doctor ko dikhaiye.'
          : lang === 'es'
            ? 'Para una quemadura pequena y leve, enfria la zona con agua corriente fresca durante unos 20 minutos y quita anillos o joyas apretadas. No uses hielo, pasta dental ni mantequilla. Busca ayuda medica urgente si la quemadura es grande, profunda, esta en la cara, genitales o una articulacion importante, o si hay dolor intenso, ampollas, entumecimiento o signos de infeccion.'
            : 'Per una piccola ustione lieve, raffredda la zona sotto acqua corrente fresca per circa 20 minuti e rimuovi anelli o gioielli stretti. Non usare ghiaccio, dentifricio o burro. Cerca assistenza urgente se l ustione e grande, profonda, sul viso, sui genitali o su un articolazione importante, o se ci sono dolore forte, vesciche, intorpidimento o segni di infezione.'
      ),
    }
  }

  if (/(what medicines|which medicines|my medicines|meri dawa|mis medicinas|farmaci)/i.test(text)) {
    if (!meds.length) {
      return { handled: true, text: translateReply(lang, 'You do not have any medicines saved yet.', lang === 'hi' ? 'Abhi koi medicine saved nahin hai.' : lang === 'es' ? 'Todavia no hay medicinas guardadas.' : 'Non ci sono medicine salvate.') }
    }
    return {
      handled: true,
      text: translateReply(
        lang,
        `${patientName} currently has ${listMedicineNames(meds)}.`,
        lang === 'hi'
          ? `${patientName} ke medicines hain: ${listMedicineNames(meds)}.`
          : lang === 'es'
            ? `${patientName} tiene estas medicinas: ${listMedicineNames(meds)}.`
            : `${patientName} ha questi farmaci: ${listMedicineNames(meds)}.`
      ),
    }
  }

  if (meds.length && /(all (three|these)|all of (these|them)|these medicines|these meds)/i.test(text) && /(help with|used for|do|purpose|for what)/i.test(text)) {
    const summaries = meds
      .map((med) => {
        const info = findKnownMedicine(med.name)?.[1]
        return info ? `${med.name} helps with ${info.uses.replace(/\.$/, '')}` : `${med.name} should be used as directed by a doctor or pharmacist`
      })
      .join(' ')

    return {
      handled: true,
      text: translateReply(
        lang,
        summaries,
        lang === 'hi'
          ? meds.map((med) => {
              const info = findKnownMedicine(med.name)?.[1]
              return info ? `${med.name} ${info.uses.replace(/\.$/, '')} mein madad karti hai.` : `${med.name} ko doctor ya pharmacist ke kehne par use karna chahiye.`
            }).join(' ')
          : lang === 'es'
            ? meds.map((med) => {
                const info = findKnownMedicine(med.name)?.[1]
                return info ? `${med.name} ayuda con ${info.uses.replace(/\.$/, '')}.` : `${med.name} debe usarse segun indicacion medica o farmaceutica.`
              }).join(' ')
            : meds.map((med) => {
                const info = findKnownMedicine(med.name)?.[1]
                return info ? `${med.name} aiuta con ${info.uses.replace(/\.$/, '')}.` : `${med.name} va usato secondo le indicazioni di medico o farmacista.`
              }).join(' ')
      ),
    }
  }

  if (/(accent|voice profile|selected voice|current voice)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `The selected voice style is ${selectedVoiceLabel || 'default'} for ${LANG_META[lang].label}.`,
        lang === 'hi'
          ? `Abhi ${LANG_META[lang].label} ke liye ${selectedVoiceLabel || 'default'} voice select hai.`
          : lang === 'es'
            ? `La voz seleccionada es ${selectedVoiceLabel || 'predeterminada'} para ${LANG_META[lang].label}.`
            : `La voce selezionata e ${selectedVoiceLabel || 'predefinita'} per ${LANG_META[lang].label}.`
      ),
    }
  }

  if (/(next dose|when.*dose|next medicine|prossima dose|siguiente dosis)/i.test(text) && nextDose) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `The next pending dose is ${nextDose.med} at ${nextDose.time}.`,
        lang === 'hi'
          ? `Agli dose ${nextDose.med} ki hai, time ${nextDose.time}.`
          : lang === 'es'
            ? `La proxima dosis pendiente es ${nextDose.med} a las ${nextDose.time}.`
            : `La prossima dose in sospeso e ${nextDose.med} alle ${nextDose.time}.`
      ),
    }
  }

  if (/(i took|taken|just took|maine li|tome|ho preso)/i.test(text)) {
    if (matchedMed) {
      return {
        handled: true,
        markedMedicine: matchedMed.name,
        text: translateReply(
          lang,
          `I marked ${matchedMed.name} as taken.`,
          lang === 'hi'
            ? `${matchedMed.name} ko taken mark kar diya.`
            : lang === 'es'
              ? `Marque ${matchedMed.name} como tomada.`
              : `Ho segnato ${matchedMed.name} come presa.`
        ),
      }
    }
    return {
      handled: true,
      text: translateReply(
        lang,
        'Tell me which medicine you took and I can mark it for you.',
        lang === 'hi'
          ? 'Kaunsi medicine li hai batayiye, main mark kar dunga.'
          : lang === 'es'
            ? 'Dime que medicina tomaste y la marco.'
            : 'Dimmi quale farmaco hai preso e lo segno.'
      ),
    }
  }

  if (known && /(what.*do|what is|used for|purpose|tell me about|about this|kis liye|para que sirve|a cosa serve)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `${knownLabel} is commonly used for ${known[1].uses.replace(/\.$/, '')}.`,
        lang === 'hi'
          ? `${knownLabel} aam taur par ${known[1].uses.replace(/\.$/, '')} ke liye use hoti hai.`
          : lang === 'es'
            ? `${knownLabel} se usa comunmente para ${known[1].uses.replace(/\.$/, '')}.`
            : `${knownLabel} si usa comunemente per ${known[1].uses.replace(/\.$/, '')}.`
      ),
    }
  }

  if (known && looksLikeBareProductQuery(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `${knownLabel} is commonly used for ${known[1].uses.replace(/\.$/, '')}. Common side effects can include ${known[1].sideEffects.slice(0, 3).join(', ')}.`,
        lang === 'hi'
          ? `${knownLabel} aam taur par ${known[1].uses.replace(/\.$/, '')} ke liye use hoti hai. Common side effects mein ${known[1].sideEffects.slice(0, 3).join(', ')} ho sakte hain.`
          : lang === 'es'
            ? `${knownLabel} se usa comunmente para ${known[1].uses.replace(/\.$/, '')}. Los efectos secundarios comunes pueden incluir ${known[1].sideEffects.slice(0, 3).join(', ')}.`
            : `${knownLabel} si usa comunemente per ${known[1].uses.replace(/\.$/, '')}. Gli effetti collaterali comuni possono includere ${known[1].sideEffects.slice(0, 3).join(', ')}.`
      ),
    }
  }

  if (known && /(who should|who shouldn|should not use|avoid this medicine|avoid taking|who cannot take|who can't take|cannot take|can't take)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(
        lang,
        `This medicine may not be right for everyone. People with allergies to it, severe side effects before, or special conditions should ask a doctor or pharmacist before using it.`,
        lang === 'hi'
          ? 'Yeh medicine har kisi ke liye theek nahin hoti. Jinko isse allergy ho, pehle severe side effect hua ho, ya koi khaas medical condition ho, unhe use karne se pehle doctor ya pharmacist se poochna chahiye.'
          : lang === 'es'
            ? 'Esta medicina no es adecuada para todos. Las personas con alergia, efectos graves previos o condiciones especiales deben consultar a un medico o farmaceutico antes de usarla.'
            : 'Questo farmaco non va bene per tutti. Chi ha allergie, effetti gravi avuti in passato o condizioni particolari dovrebbe chiedere a un medico o farmacista prima di usarlo.'
      ),
    }
  }

  if (known && /(side effect|effects|nuksan|reaction|efecto|effetti)/i.test(text)) {
    const info = known[1]
    return {
      handled: true,
      text: translateReply(
        lang,
        `Common side effects can include ${info.sideEffects.join(', ')}. Get urgent help for ${info.urgentEffects.slice(0, 2).join(' or ')}.`,
        lang === 'hi'
          ? `Is medicine ke common side effects ${info.sideEffects.join(', ')} ho sakte hain. ${info.urgentEffects.slice(0, 2).join(' ya ')} ho to turant doctor se baat karein.`
          : lang === 'es'
            ? `Los efectos secundarios comunes pueden ser ${info.sideEffects.join(', ')}. Busca ayuda urgente si hay ${info.urgentEffects.slice(0, 2).join(' o ')}.`
            : `Gli effetti collaterali comuni possono essere ${info.sideEffects.join(', ')}. Chiedi aiuto urgente se compaiono ${info.urgentEffects.slice(0, 2).join(' o ')}.`
      ),
    }
  }

  if (known && /(food|khana|meal|comida|cibo)/i.test(text)) {
    return {
      handled: true,
      text: translateReply(lang, known[1].foodTip, lang === 'hi' ? `Khaane ke saath salah: ${known[1].foodTip}` : lang === 'es' ? `Consejo con comida: ${known[1].foodTip}` : `Consiglio sul cibo: ${known[1].foodTip}`),
    }
  }

  if (symptom) {
    const linked = meds.filter((med) => {
      const lib = findKnownMedicine(med.name)
      return lib?.[1].symptomLinks.some((entry) => entry.includes(symptom))
    })

    if (linked.length) {
      const joined = linked.map((med) => med.name).join(', ')
      return {
        handled: true,
        text: translateReply(
          lang,
          `${symptom} can happen with ${joined}. If it is severe, new, or getting worse, speak to a doctor today.`,
          lang === 'hi'
            ? `${symptom} ${joined} se ho sakta hai. Agar zyada ho raha hai ya naya hai to aaj doctor se baat karein.`
            : lang === 'es'
              ? `${symptom} puede ocurrir con ${joined}. Si es fuerte o empeora, habla con un medico hoy.`
              : `${symptom} puo comparire con ${joined}. Se e forte o peggiora, parla con un medico oggi.`
        ),
      }
    }

    return {
      handled: true,
      text: translateReply(
        lang,
        `I cannot clearly link ${symptom} to a saved medicine right now, but a clinician should review it if it is persistent or serious.`,
        lang === 'hi'
          ? `Abhi main ${symptom} ko kisi saved medicine se clearly link nahin kar pa raha. Agar symptom bana rahe to doctor ko dikhaiye.`
          : lang === 'es'
            ? `No puedo relacionar claramente ${symptom} con una medicina guardada ahora. Si sigue o es serio, consulta a un medico.`
            : `Non riesco a collegare con chiarezza ${symptom} a un farmaco salvato. Se continua o e serio, consulta un medico.`
      ),
    }
  }

  return {
    handled: false,
    text: genericFallbackReply(text, lang),
  }
}

function checkBloodValues(values: BloodValues, age: number): ReportResult {
  const parsed = {
    hb: Number(values.hb),
    wbc: Number(values.wbc),
    platelets: Number(values.platelets),
    glucose: Number(values.glucose),
    hba1c: Number(values.hba1c),
    cholesterol: Number(values.cholesterol),
    ldl: Number(values.ldl),
    creatinine: Number(values.creatinine),
  }

  const abnormal: string[] = []
  const normal: string[] = []
  const advice: string[] = []
  let urgent = false
  let warning = false
  const isOlder = age >= 65

  if (values.hb) {
    if (parsed.hb < 8) {
      abnormal.push(`Hemoglobin is very low at ${parsed.hb} g/dL.`)
      urgent = true
    } else if (parsed.hb < 12) {
      abnormal.push(`Hemoglobin is below range at ${parsed.hb} g/dL.`)
      warning = true
    } else {
      normal.push(`Hemoglobin looks acceptable at ${parsed.hb} g/dL.`)
    }
  }

  if (values.wbc) {
    if (parsed.wbc < 3000 || parsed.wbc > 15000) {
      abnormal.push(`White blood cell count is concerning at ${parsed.wbc}.`)
      warning = true
      if (parsed.wbc > 25000) urgent = true
    } else {
      normal.push('White blood cell count is within the usual range.')
    }
  }

  if (values.platelets) {
    if (parsed.platelets < 50000) {
      abnormal.push(`Platelets are critically low at ${parsed.platelets}.`)
      urgent = true
    } else if (parsed.platelets < 150000 || parsed.platelets > 450000) {
      abnormal.push(`Platelets are outside the usual range at ${parsed.platelets}.`)
      warning = true
    } else {
      normal.push('Platelets are in range.')
    }
  }

  if (values.glucose) {
    if (parsed.glucose >= 300) {
      abnormal.push(`Glucose is very high at ${parsed.glucose} mg/dL.`)
      urgent = true
    } else if (parsed.glucose >= 126) {
      abnormal.push(`Glucose is high at ${parsed.glucose} mg/dL.`)
      warning = true
    } else {
      normal.push('Glucose is not high based on the entered value.')
    }
  }

  if (values.hba1c) {
    if (parsed.hba1c >= 9) {
      abnormal.push(`HbA1c is very high at ${parsed.hba1c}%.`)
      urgent = true
    } else if (parsed.hba1c >= 6.5) {
      abnormal.push(`HbA1c is above goal at ${parsed.hba1c}%.`)
      warning = true
    } else {
      normal.push('HbA1c is near target.')
    }
  }

  if (values.cholesterol) {
    if (parsed.cholesterol >= 240) {
      abnormal.push(`Total cholesterol is high at ${parsed.cholesterol} mg/dL.`)
      warning = true
    } else {
      normal.push('Total cholesterol is not high.')
    }
  }

  if (values.ldl) {
    if (parsed.ldl >= 190) {
      abnormal.push(`LDL is very high at ${parsed.ldl} mg/dL.`)
      warning = true
    } else if (parsed.ldl >= 130) {
      abnormal.push(`LDL is above goal at ${parsed.ldl} mg/dL.`)
      warning = true
    } else {
      normal.push('LDL is within a safer range.')
    }
  }

  if (values.creatinine) {
    const highLimit = isOlder ? 1.4 : 1.3
    if (parsed.creatinine >= 2) {
      abnormal.push(`Creatinine is significantly raised at ${parsed.creatinine} mg/dL.`)
      urgent = true
    } else if (parsed.creatinine > highLimit) {
      abnormal.push(`Creatinine is mildly raised at ${parsed.creatinine} mg/dL.`)
      warning = true
    } else {
      normal.push('Creatinine is not elevated.')
    }
  }

  if (!abnormal.length && !normal.length) {
    return {
      level: 'WARNING',
      message: 'There is not enough numeric data to judge the report yet.',
      doctor: 'Please upload a clearer report or add values.',
      summary: ['I could not analyze the report because no readable blood values were entered.'],
      abnormal: [],
      normal: [],
      advice: ['Upload a clear PDF or image, or enter values manually.'],
    }
  }

  if (urgent) {
    advice.push('Please contact a doctor today or urgent care, especially if symptoms are present.')
  } else if (warning) {
    advice.push('Plan a doctor review soon and continue prescribed medicines unless told otherwise.')
  } else {
    advice.push('Continue routine follow-up and keep sharing reports with your doctor.')
  }

  if (warning || urgent) {
    advice.push('Do not change or stop medicines without clinician guidance.')
  }

  return {
    level: urgent ? 'URGENT' : warning ? 'WARNING' : 'SAFE',
    message: urgent
      ? 'Some entered values look concerning and need timely doctor review.'
      : warning
        ? 'A few values look outside the usual range and should be reviewed.'
        : 'The entered values look generally okay.',
    doctor: urgent ? 'See a doctor today.' : warning ? 'Book a doctor review within a week.' : 'No urgent visit suggested from entered values.',
    summary: [
      urgent
        ? 'This report has at least one result that may need prompt medical attention.'
        : warning
          ? 'This report has some values outside the usual range.'
          : 'The entered values are largely reassuring.',
      'This is only a support tool and not a diagnosis.',
    ],
    abnormal,
    normal,
    advice,
  }
}

function buildMedicationContext(meds: Med[]) {
  return meds
    .map((med) => {
      const lib = findKnownMedicine(med.name)
      const summary = lib ? `${lib[1].uses} Side effects: ${lib[1].sideEffects.join(', ')}.` : ''
      return `${med.name} ${med.dosage}. ${summary}`.trim()
    })
    .join(' ')
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ user?: Record<string, unknown>; profile?: unknown } | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [mode, setMode] = useState<Mode>('patient')
  const [patientTab, setPatientTab] = useState<PatientTab>('voice')
  const [careTab, setCareTab] = useState<CareTab>('medicines')
  const [lang, setLang] = useState<LangKey>('en')
  const [meds, setMeds] = useState<Med[]>(DEMO_MEDS)
  const [logs, setLogs] = useState<MedLog[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [patient, setPatient] = useState<Patient>({ name: '', age: '', condition: '', phone: '' })
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([])
  const [editingPatientId, setEditingPatientId] = useState('')
  const [account, setAccount] = useState<Account>({ name: '', email: '', role: 'Patient' })
  const [reports, setReports] = useState<Report[]>([])
  const [legalModal, setLegalModal] = useState<LegalKey>(null)
  const [clock, setClock] = useState(nowTime())
  const [date, setDate] = useState(fullDate())
  const [muted, setMuted] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showThemeControl, setShowThemeControl] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: uid(), role: 'ai', text: VIEW_TEXT.en.chatbotReady, time: nowTime() },
  ])
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState(LANG_META.en.greeting)
  const [listening, setListening] = useState(false)
  const [processingVoice, setProcessingVoice] = useState(false)
  const [micError, setMicError] = useState('')
  const [voicesLoaded, setVoicesLoaded] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<Record<LangKey, string>>({ en: 'en-us', hi: 'hi-clear', es: 'es-spain', it: 'it-it' })
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [newMedicine, setNewMedicine] = useState({ name: '', dosage: '', notes: '', alert: true })
  const [newTimes, setNewTimes] = useState<string[]>(['08:00'])
  const [timeInput, setTimeInput] = useState('12:00')
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [reportDataUrl, setReportDataUrl] = useState('')
  const [reportBase64, setReportBase64] = useState('')
  const [reportMime, setReportMime] = useState('')
  const [reportAge, setReportAge] = useState('')
  const [bloodValues, setBloodValues] = useState<BloodValues>(EMPTY_BLOOD_VALUES)
  const [analyzingReport, setAnalyzingReport] = useState(false)
  const [draggingReport, setDraggingReport] = useState(false)

  // Check Supabase session and backend profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsAuthenticated(true)
        try {
          const r = await fetch(`${BACKEND_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          })
          if (r.ok) {
            const payload = await r.json()
            setCurrentUser(payload)
          }
        } catch (err) {
          console.warn('Unable to fetch backend user profile', err)
        }
      }
    }

    checkAuth()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        setIsAuthenticated(true)
        try {
          const r = await fetch(`${BACKEND_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (r.ok) {
            setCurrentUser(await r.json())
          }
        } catch (err) {
          console.warn(err)
        }
      } else {
        setIsAuthenticated(false)
        setCurrentUser(null)
      }
    })

    return () => {
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setCurrentUser(null)
    setShowAuthModal(false)
  }

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const debounceRef = useRef<number | null>(null)
  const inlineChatBodyRef = useRef<HTMLDivElement>(null)
  const floatingChatBodyRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reportPreviewUrlRef = useRef('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(nowTime())
      setDate(fullDate())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(CARETAKER_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as { patient: Patient; patientProfiles?: PatientProfile[]; account?: Account; meds: Med[]; logs: MedLog[]; alerts: AlertItem[] }
      if (parsed.patient) setPatient(parsed.patient)
      if (parsed.patientProfiles) setPatientProfiles(parsed.patientProfiles)
      if (parsed.account) setAccount(parsed.account)
      if (parsed.meds?.length) setMeds(parsed.meds)
      if (parsed.logs) setLogs(parsed.logs)
      if (parsed.alerts) setAlerts(parsed.alerts)
    } catch {
      // Ignore parsing errors
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(CARETAKER_KEY, JSON.stringify({ patient, patientProfiles, account, meds, logs, alerts }))
    } catch {
      // Ignore storage errors
    }
  }, [patient, patientProfiles, account, meds, logs, alerts])

  useEffect(() => {
    document.documentElement.lang = LANG_META[lang].code
    document.documentElement.style.fontFamily = lang === 'hi' ? "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif" : "'Plus Jakarta Sans', sans-serif"
    setResponse(LANG_META[lang].greeting)
    setChatMessages((current) => {
      if (current.length === 1 && current[0]?.role === 'ai') {
        return [{ ...current[0], text: VIEW_TEXT[lang].chatbotReady }]
      }
      return current
    })
  }, [lang])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('hmai-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    document.body.dataset.theme = theme
    try {
      window.localStorage.setItem('hmai-theme', theme)
    } catch {
      // Ignore storage errors
    }
  }, [theme])

  useEffect(() => {
    const updateHeaderControl = () => {
      setShowThemeControl(window.scrollY < 220)
    }

    updateHeaderControl()
    window.addEventListener('scroll', updateHeaderControl, { passive: true })
    return () => window.removeEventListener('scroll', updateHeaderControl)
  }, [])

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      if (available.length) setVoicesLoaded(available)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    const t1 = window.setTimeout(loadVoices, 300)
    const t2 = window.setTimeout(loadVoices, 1200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    const bodies = [inlineChatBodyRef.current, floatingChatBodyRef.current].filter(Boolean) as HTMLDivElement[]
    bodies.forEach((body) => {
      body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' })
    })
  }, [chatMessages, chatLoading])

  function addAlert(msg: string, type: AlertItem['type']) {
    setAlerts((current) => [{ id: uid(), msg, type, time: nowTime() }, ...current].slice(0, 30))
  }

  function addLog(med: string, status: MedLog['status']) {
    setLogs((current) => [{ id: uid(), med, status, time: nowTime() }, ...current].slice(0, 40))
  }

  function addRecordedEntry(note: string) {
    addLog(note, 'recorded')
    addAlert(`Recorded for caretaker: ${note}`, 'info')
  }

  function markMedicineTaken(name: string) {
    let changed = false
    setMeds((current) =>
      current.map((med) => {
        if (normalize(med.name) !== normalize(name)) return med
        const nextIndex = med.times.findIndex((time) => !time.taken)
        if (nextIndex === -1) return med
        changed = true
        return { ...med, times: med.times.map((time, index) => (index === nextIndex ? { ...time, taken: true, takenAt: nowTime() } : time)) }
      })
    )
    if (changed) {
      addLog(name, 'taken')
      addAlert(`${name} marked as taken.`, 'success')
    }
  }

  function toggleDose(medId: string, timeIndex: number) {
    let updatedName = ''
    let becameMissed = false
    setMeds((current) =>
      current.map((med) => {
        if (med.id !== medId) return med
        updatedName = med.name
        return {
          ...med,
          times: med.times.map((time, index) => {
            if (index !== timeIndex) return time
            becameMissed = time.taken
            return { ...time, taken: !time.taken, takenAt: !time.taken ? nowTime() : undefined }
          }),
        }
      })
    )
    if (updatedName) {
      addLog(updatedName, becameMissed ? 'missed' : 'taken')
      addAlert(becameMissed ? `Dose missed: ${updatedName}` : `Dose taken: ${updatedName}`, becameMissed ? 'warning' : 'success')
    }
  }

  function speak(text: string) {
    if (!text.trim() || muted) return
    const spokenText = sanitizeSpeechText(text)
    if (!spokenText) return
    const profile = VOICE_PROFILES[lang].find((item) => item.id === selectedVoiceProfile[lang]) ?? VOICE_PROFILES[lang][0]
    const utterance = new SpeechSynthesisUtterance(spokenText)
    utterance.lang = profile.lang
    utterance.rate = profile.rate
    utterance.pitch = profile.pitch
    const voice = selectVoice(voicesLoaded, profile)
    if (voice) utterance.voice = voice
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  async function generateAssistantReply(text: string) {
    const currentVoiceLabel = VOICE_PROFILES[lang].find((profile) => profile.id === selectedVoiceProfile[lang])?.label
    const weatherLocation = extractWeatherLocation(text)
    if (weatherLocation) {
      const weather = await fetchWeather(weatherLocation)
      if (weather) {
        const condition = weatherCodeLabel(weather.code)
        return translateReply(
          lang,
          `Right now in ${weather.name}${weather.country ? `, ${weather.country}` : ''}, it is ${weather.temperature}°C and feels like ${weather.apparent}°C with ${condition} weather and wind around ${weather.wind} km/h.`,
          lang === 'hi'
            ? `Abhi ${weather.name}${weather.country ? `, ${weather.country}` : ''} mein taapman ${weather.temperature}°C hai, mehsoos ${weather.apparent}°C jaisa ho raha hai, mausam ${condition} hai aur hawa lagbhag ${weather.wind} km/h hai.`
            : lang === 'es'
              ? `Ahora en ${weather.name}${weather.country ? `, ${weather.country}` : ''} hay ${weather.temperature}°C, sensacion de ${weather.apparent}°C, clima ${condition} y viento de unos ${weather.wind} km/h.`
              : `Adesso a ${weather.name}${weather.country ? `, ${weather.country}` : ''} ci sono ${weather.temperature}°C, percepiti ${weather.apparent}°C, tempo ${condition} e vento intorno a ${weather.wind} km/h.`
        )
      }
    }

    const recordedNote = extractRecordedNote(text)
    if (recordedNote) {
      addRecordedEntry(recordedNote)
      return translateReply(
        lang,
        `I recorded this for the caretaker log: ${recordedNote}.`,
        lang === 'hi'
          ? `Maine caretaker log ke liye yeh note record kar diya: ${recordedNote}.`
          : lang === 'es'
            ? `Lo registre para el cuidador: ${recordedNote}.`
            : `L'ho registrato per il caregiver: ${recordedNote}.`
      )
    }

    const local = buildLocalReply(text, lang, meds, patient, currentVoiceLabel)
    if (local.markedMedicine) markMedicineTaken(local.markedMedicine)
    if (local.handled) return local.text

    const backendReply = await callBackendChat(text, lang, meds, patient)
    if (backendReply) {
      return backendReply
    }

    const candidateMedicine = await resolveDrugQuery(text, meds)
    const asksDrugInfo = /(what.*do|used for|purpose|side effect|effects|reaction|generic|brand|crocin|medicine|tablet|capsule)/i.test(text)
    if (candidateMedicine && asksDrugInfo) {
      const remoteDrug = await fetchDrugKnowledge(candidateMedicine)
      if (remoteDrug) {
        const remoteReply = `${remoteDrug.name} (${remoteDrug.genericName}) is used for ${remoteDrug.uses.replace(/\s+/g, ' ')} Common side effects may include ${remoteDrug.sideEffects.slice(0, 4).join(', ') || 'the leaflet should be checked'}. ${remoteDrug.warnings[0] ? `Important warning: ${remoteDrug.warnings[0]}.` : ''}`.trim()
        if (!getApiKey() || lang === 'en') return remoteReply
        const translated = await callClaude(`Translate the following medical helper reply into ${LANG_META[lang].label}. Keep the meaning and stay concise.`, remoteReply, 220)
        return translated || remoteReply
      }

      const backendReply = await fetchBackendMedicineAnswer(text, candidateMedicine, lang)
      if (backendReply) return backendReply
    }

    const matchedMed = findMedicineFromText(text, meds)
    const medInfo = matchedMed ? findKnownMedicine(matchedMed.name)?.[1] : undefined
    const system = `
You are MedAssist, a medication helper for patients and caretakers.
Reply in ${LANG_META[lang].label}.
Be concise, caring, and practical.
Never claim certainty for diagnosis.
Patient: ${patient.name || 'Unknown'}, age ${patient.age || 'Unknown'}, condition ${patient.condition || 'Unknown'}.
Saved medicines: ${listMedicineNames(meds) || 'None'}.
Medicine context: ${buildMedicationContext(meds)}
${medInfo ? `If the question is about ${matchedMed?.name}, you also know: uses=${medInfo.uses}; side effects=${medInfo.sideEffects.join(', ')}; urgent=${medInfo.urgentEffects.join(', ')}` : ''}
If asked whether a symptom can be caused by a medicine, answer with "can happen", "less likely", or "cannot tell".
Keep to 2-4 short sentences.
`.trim()
    const answer = await callClaude(system, candidateMedicine ? `Medicine query candidate: ${candidateMedicine}\nUser question: ${text}` : text, 320)
    return answer || local.text
  }

  async function handleVoiceQuestion(text: string) {
    setProcessingVoice(true)
    setTranscript(text)
    const answer = await generateAssistantReply(text)
    setResponse(answer)
    setProcessingVoice(false)
    speak(answer)
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setChatLoading(true)
    setChatMessages((current) => [...current, { id: uid(), role: 'user', text, time: nowTime() }])
    const answer = await generateAssistantReply(text)
    setChatMessages((current) => [...current, { id: uid(), role: 'ai', text: answer, time: nowTime() }])
    setChatLoading(false)
  }

  async function startListening() {
    if (processingVoice || listening) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) {
      setMicError('Speech recognition is only supported in Chrome or Edge right now.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setMicError('Microphone access is blocked. Please allow mic permission and try again.')
      return
    }

    window.speechSynthesis.cancel()
    const recognition = new Recognition()
    recognition.lang = LANG_META[lang].code
    recognition.continuous = false
    recognition.interimResults = true
    let finalized = false
    recognitionRef.current = recognition
    recognition.onstart = () => {
      setMicError('')
      setListening(true)
      setTranscript('')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0]?.transcript ?? ''
      }
      const heard = finalText.trim()
      if (heard && !finalized) {
        finalized = true
        setListening(false)
        await handleVoiceQuestion(heard)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setListening(false)
      if (event?.error === 'not-allowed' || event?.error === 'permission-denied') {
        setMicError('Microphone access is blocked. Please allow mic permission and try again.')
      } else if (event?.error === 'no-speech') {
        setMicError('I did not hear anything. Tap the mic and try again.')
      } else {
        setMicError('Voice recognition failed. Please try again.')
      }
    }
    recognition.onend = () => {
      setListening(false)
    }
    try {
      recognition.start()
    } catch {
      setListening(false)
      setMicError('Voice recognition failed. Please try again.')
    }
  }

  function stopListening() {
    recognitionRef.current?.stop?.()
    setListening(false)
  }

  function handleMedicineSearch(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(value)}&maxEntries=8`)
        const data = await response.json()
        const remote = (data?.approximateGroup?.candidate ?? []).map((item: { name?: string }) => item.name).filter(Boolean)
        const local = Object.keys(MEDICINE_LIBRARY)
          .filter((name) => name.includes(normalize(value)))
          .map((name) => `${name[0].toUpperCase()}${name.slice(1)}`)
        setSearchResults(Array.from(new Set([...local, ...remote])).slice(0, 8))
      } catch {
        const local = Object.keys(MEDICINE_LIBRARY)
          .filter((name) => name.includes(normalize(value)))
          .map((name) => `${name[0].toUpperCase()}${name.slice(1)}`)
        setSearchResults(local.slice(0, 8))
      }
      setSearchLoading(false)
    }, 320)
  }

  function addMedicine() {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim() || !newTimes.length) return
    const med: Med = {
      id: uid(),
      name: newMedicine.name.trim(),
      dosage: newMedicine.dosage.trim(),
      notes: newMedicine.notes.trim(),
      alert: newMedicine.alert,
      times: [...newTimes].sort().map((time) => ({ time, taken: false })),
    }
    setMeds((current) => [...current, med])
    setNewMedicine({ name: '', dosage: '', notes: '', alert: true })
    setNewTimes(['08:00'])
    setTimeInput('12:00')
    setSearchQuery('')
    setSearchResults([])
    setShowAddMedicine(false)
    addAlert(`Added ${med.name}.`, 'success')
  }

  function removeMedicine(id: string) {
    const target = meds.find((med) => med.id === id)
    setMeds((current) => current.filter((med) => med.id !== id))
    if (target) addAlert(`Removed ${target.name}.`, 'info')
  }

  function savePatientProfile() {
    if (!patient.name.trim()) {
      addAlert('Please enter a patient name first.', 'warning')
      return
    }
    const profile: PatientProfile = {
      ...patient,
      id: editingPatientId || uid(),
      savedAt: nowTime(),
    }
    setPatientProfiles((current) => {
      const exists = current.some((entry) => entry.id === profile.id)
      return exists ? current.map((entry) => (entry.id === profile.id ? profile : entry)) : [profile, ...current]
    })
    addAlert(`Patient profile saved for ${patient.name}.`, 'success')
    setPatient({ name: '', age: '', condition: '', phone: '' })
    setEditingPatientId('')
  }

  function deletePatientProfile() {
    if (!window.confirm('Delete this patient profile and related demo data?')) return
    setPatient({ name: '', age: '', condition: '', phone: '' })
    setPatientProfiles((current) => current.filter((entry) => entry.id !== editingPatientId))
    setEditingPatientId('')
    setMeds([])
    setLogs([])
    setReports([])
    setAlerts([])
  }

  function loadPatientProfile(profile: PatientProfile) {
    setPatient({ name: profile.name, age: profile.age, condition: profile.condition, phone: profile.phone })
    setEditingPatientId(profile.id)
    addAlert(`Loaded profile for ${profile.name}.`, 'info')
  }

  function removeSavedPatient(profileId: string) {
    const target = patientProfiles.find((entry) => entry.id === profileId)
    setPatientProfiles((current) => current.filter((entry) => entry.id !== profileId))
    if (editingPatientId === profileId) {
      setEditingPatientId('')
      setPatient({ name: '', age: '', condition: '', phone: '' })
    }
    if (target) addAlert(`Deleted saved patient ${target.name}.`, 'info')
  }

  function handleReportFile(file: File) {
    if (reportPreviewUrlRef.current) {
      URL.revokeObjectURL(reportPreviewUrlRef.current)
      reportPreviewUrlRef.current = ''
    }
    setReportFile(file)
    setReportMime(file.type)
    setReportBase64('')
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file)
      reportPreviewUrlRef.current = previewUrl
      setReportDataUrl(previewUrl)
      return
    }
    fileToDataUrl(file)
      .then((dataUrl) => {
        setReportDataUrl(dataUrl)
        setReportBase64(dataUrl.split(',')[1] || '')
      })
      .catch(() => addAlert('Could not preview this report file.', 'warning'))
  }

  async function analyzeReport() {
    setAnalyzingReport(true)
    try {
      let extractedValues = { ...bloodValues }
      let fileBase64 = reportBase64

      if (reportFile && !fileBase64) {
        const dataUrl = await fileToDataUrl(reportFile)
        fileBase64 = dataUrl.split(',')[1] || ''
        setReportBase64(fileBase64)
      }

      const canUseClaude = Boolean(getApiKey() && reportFile && fileBase64 && reportMime)
      const canUseLocalVision = Boolean(reportFile && fileBase64 && reportMime.startsWith('image/'))

      if (canUseClaude) {
        const extractionContent: object[] = []
        if (reportMime.startsWith('image/')) {
          extractionContent.push({ type: 'image', source: { type: 'base64', media_type: reportMime, data: fileBase64 } })
        } else {
          extractionContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } })
        }
        extractionContent.push({
          type: 'text',
          text: 'Extract blood test values as strict JSON with keys hb,wbc,platelets,glucose,hba1c,cholesterol,ldl,creatinine. Use empty strings when not found.',
        })
        const extractionRaw = await callClaude('You read lab reports and extract values only as JSON.', extractionContent, 300)
        const parsedExtract = parseJsonBlock<Partial<BloodValues>>(extractionRaw)
        if (parsedExtract) {
          extractedValues = {
            hb: parsedExtract.hb ?? bloodValues.hb,
            wbc: parsedExtract.wbc ?? bloodValues.wbc,
            platelets: parsedExtract.platelets ?? bloodValues.platelets,
            glucose: parsedExtract.glucose ?? bloodValues.glucose,
            hba1c: parsedExtract.hba1c ?? bloodValues.hba1c,
            cholesterol: parsedExtract.cholesterol ?? bloodValues.cholesterol,
            ldl: parsedExtract.ldl ?? bloodValues.ldl,
            creatinine: parsedExtract.creatinine ?? bloodValues.creatinine,
          }
          setBloodValues(extractedValues)
        }
      }

      const localResult = checkBloodValues(extractedValues, Number(reportAge || patient.age || 0))
      const hasManualValues = Object.values(extractedValues).some((value) => value.trim())

      if (!hasManualValues && !canUseClaude && !canUseLocalVision) {
        addAlert('Upload an image report, configure a cloud key, or enter blood values manually.', 'warning')
        return
      }

      let finalResult = localResult
      let raw = JSON.stringify(localResult, null, 2)

      if (!canUseClaude && canUseLocalVision) {
        const backendVision = await analyzeReportImageWithBackend(fileBase64, reportMime, reportAge || patient.age || '', extractedValues)
        if (backendVision?.values) {
          extractedValues = {
            hb: backendVision.values.hb ?? extractedValues.hb,
            wbc: backendVision.values.wbc ?? extractedValues.wbc,
            platelets: backendVision.values.platelets ?? extractedValues.platelets,
            glucose: backendVision.values.glucose ?? extractedValues.glucose,
            hba1c: backendVision.values.hba1c ?? extractedValues.hba1c,
            cholesterol: backendVision.values.cholesterol ?? extractedValues.cholesterol,
            ldl: backendVision.values.ldl ?? extractedValues.ldl,
            creatinine: backendVision.values.creatinine ?? extractedValues.creatinine,
          }
          setBloodValues(extractedValues)
        }
        if (backendVision?.result?.level && backendVision?.result?.message && backendVision?.result?.doctor) {
          finalResult = {
            level: backendVision.result.level,
            message: backendVision.result.message,
            doctor: backendVision.result.doctor,
            summary: backendVision.result.summary ?? [],
            abnormal: backendVision.result.abnormal ?? [],
            normal: backendVision.result.normal ?? [],
            advice: backendVision.result.advice ?? [],
          }
          raw = JSON.stringify(backendVision, null, 2)
        } else {
          finalResult = checkBloodValues(extractedValues, Number(reportAge || patient.age || 0))
          raw = JSON.stringify(finalResult, null, 2)
        }
      }

      if (canUseClaude) {
        const content: object[] = []
        if (reportMime.startsWith('image/')) {
          content.push({ type: 'image', source: { type: 'base64', media_type: reportMime, data: fileBase64 } })
        } else {
          content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } })
        }
        if (hasManualValues) content.push({ type: 'text', text: `Manual values: ${JSON.stringify(extractedValues)}` })
        content.push({
          type: 'text',
          text: `Return only valid JSON with this exact shape: {"level":"SAFE|WARNING|URGENT","message":"short sentence","doctor":"short recommendation","summary":["point 1"],"abnormal":["point"],"normal":["point"],"advice":["point 1"]}. Be cautious. If the report is unclear, say so in message and advice.`,
        })
        const system = `You analyze blood reports for patients. Age: ${reportAge || patient.age || 'unknown'}. Keep output strict JSON only.`
        const aiRaw = await callClaude(system, content, 900)
        const parsed = parseJsonBlock<ReportResult>(aiRaw)
        if (parsed?.level && parsed.message && parsed.doctor) {
          finalResult = {
            level: parsed.level,
            message: parsed.message,
            doctor: parsed.doctor,
            summary: parsed.summary ?? [],
            abnormal: parsed.abnormal ?? [],
            normal: parsed.normal ?? [],
            advice: parsed.advice ?? [],
          }
          raw = aiRaw
        }
      }

      const report: Report = {
        id: uid(),
        fileName: reportFile?.name || 'Manual blood review',
        size: reportFile?.size || 0,
        at: nowTime(),
        raw,
        notes: '',
        dataUrl: reportDataUrl,
        mime: reportMime,
        result: finalResult,
      }
      setReports((current) => [report, ...current])
      addAlert(`Blood report analyzed: ${finalResult.level}.`, finalResult.level === 'URGENT' ? 'warning' : 'info')
      setReportFile(null)
      setReportDataUrl('')
      setReportBase64('')
      setReportMime('')
      if (reportPreviewUrlRef.current) {
        URL.revokeObjectURL(reportPreviewUrlRef.current)
        reportPreviewUrlRef.current = ''
      }
    } catch (error) {
      addAlert(error instanceof Error ? error.message : 'Could not analyze this report image.', 'warning')
    } finally {
      setAnalyzingReport(false)
    }
  }

  const totalDoses = meds.flatMap((med) => med.times)
  const takenCount = totalDoses.filter((dose) => dose.taken).length
  const adherence = totalDoses.length ? Math.round((takenCount / totalDoses.length) * 100) : 0
  const warningCount = alerts.filter((alert) => alert.type === 'warning').length
  const latestReport = reports[0]
  const ui = UI_TEXT[lang]
  const view = VIEW_TEXT[lang]
  const emergencyPhone = phoneUriValue(patient.phone)
  const emergencySmsMessage = `Emergency alert from MedAssist: Please check on ${patient.name.trim() || 'the patient'}. Current concern: ${patient.condition.trim() || 'an urgent health concern'}.`
  const emergencyCallHref = emergencyPhone ? `tel:${emergencyPhone}` : ''
  const emergencySmsHref = emergencyPhone ? `sms:${emergencyPhone}?body=${encodeURIComponent(emergencySmsMessage)}` : ''

  return (
    <div className={`app-shell theme-${theme}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <FiHeart />
          </div>
          <div>
            <div className="brand-title">MedAssist</div>
            <div className="brand-sub">{view.brandSub}</div>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="mode-switch">
            <button className={mode === 'patient' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('patient')}>{ui.patient}</button>
            <button className={mode === 'caretaker' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('caretaker')}>{ui.caretaker}</button>
          </div>

          <div className="lang-switch">
            {(Object.keys(LANG_META) as LangKey[]).map((key) => (
              <button key={key} className={lang === key ? 'lang-btn active' : 'lang-btn'} onClick={() => setLang(key)}>
                {LANG_META[key].short}
              </button>
            ))}
          </div>

          {showThemeControl ? (
            <button
              className={theme === 'dark' ? 'theme-switch dark' : 'theme-switch'}
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-switch-track">
                <span className="theme-switch-thumb">{theme === 'dark' ? <FiMoon /> : <FiSun />}</span>
              </span>
            </button>
          ) : (
            <button
              className={muted ? 'sound-switch muted' : 'sound-switch'}
              onClick={() => {
                if (!muted) window.speechSynthesis.cancel()
                setMuted((current) => !current)
              }}
              aria-label={muted ? 'Unmute voice' : 'Mute voice'}
            >
              <span className="sound-switch-track">
                <span className="sound-switch-thumb">{muted ? <FiVolumeX /> : <FiVolume2 />}</span>
              </span>
            </button>
          )}

          <button
            className={isAuthenticated ? 'nurse-dog-trigger signed-in' : 'nurse-dog-trigger'}
            onClick={() => (isAuthenticated ? setLegalModal('account') : setShowAuthModal(true))}
            aria-label={isAuthenticated ? 'Open account' : 'Open sign in'}
            title={isAuthenticated ? String(currentUser?.user?.firstName ?? currentUser?.user?.email ?? 'Account') : 'Sign in'}
          >
            <span className="dog-ears" />
            <span className="dog-face">
              <span className="dog-eyes" />
              <span className="dog-nose" />
            </span>
            <span className="nurse-cap">
              <span className="nurse-cross" />
            </span>
            {isAuthenticated && <span className="nurse-status-dot" />}
          </button>

          {isAuthenticated && (
            <button className="ghost-btn compact-logout" onClick={handleLogout}>
              Sign Out
            </button>
          )}

          <div className="clock-box">
            <span>{clock}</span>
            <small>{date}</small>
          </div>
        </div>
      </header>
      <section className="hero">
        <div className="launch-scene" aria-hidden="true">
          <div className="launch-cube">
            <span className="cube-face front" />
            <span className="cube-face back" />
            <span className="cube-face left" />
            <span className="cube-face right" />
            <span className="cube-face top" />
            <span className="cube-face bottom" />
          </div>
        </div>
        <div className="hero-copy">
          <span className="eyebrow">{ui.heroEyebrow}</span>
          <h1>{ui.heroTitle}</h1>
          <p>{ui.heroBody}</p>
        </div>

        <div className="hero-grid">
          <article className="spotlight-card spotlight-medicine">
            <div className="spotlight-orb" />
            <div className="spotlight-header"><FiMessageCircle /><span>{view.heroMedicineLabel}</span></div>
            <h3>{view.heroMedicineTitle}</h3>
            <p>{view.heroMedicineBody}</p>
          </article>
          <article className="spotlight-card spotlight-report">
            <div className="spotlight-orb" />
            <div className="spotlight-header"><FiFileText /><span>{view.heroReportLabel}</span></div>
            <h3>{view.heroReportTitle}</h3>
            <p>{view.heroReportBody}</p>
          </article>
          <article className="spotlight-card spotlight-voice">
            <div className="spotlight-orb" />
            <div className="spotlight-header"><FiGlobe /><span>{view.heroVoiceLabel}</span></div>
            <h3>{view.heroVoiceTitle}</h3>
            <p>{view.heroVoiceBody}</p>
          </article>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stat-box"><strong>{meds.length}</strong><span>{view.medicineStat}</span></div>
        <div className="stat-box"><strong>{adherence}%</strong><span>{view.adherenceStat}</span></div>
        <div className="stat-box"><strong>{reports.length}</strong><span>{view.reportsStat}</span></div>
        <div className="stat-box"><strong>{warningCount}</strong><span>{view.warningsStat}</span></div>
      </section>

      <main className="main-content">
        {mode === 'patient' && (
          <>
            <nav className="tabbar">
              {(['voice', 'medicines', 'logs', 'alerts', 'reports'] as PatientTab[]).map((tab) => (
                <button key={tab} className={patientTab === tab ? 'tab-btn active' : 'tab-btn'} onClick={() => setPatientTab(tab)}>
                  {ui.patientTabs[tab]}
                </button>
              ))}
            </nav>

            {patientTab === 'voice' && (
              <section className="panel two-col">
                <div className="card voice-card">
                  <div className="section-head">
                    <div>
                      <h2>{view.voiceTitle}</h2>
                      <p>{LANG_META[lang].greeting}</p>
                    </div>
                  </div>

                  <div className="voice-profiles">
                    {VOICE_PROFILES[lang].map((profile) => (
                      <button key={profile.id} className={selectedVoiceProfile[lang] === profile.id ? 'chip active' : 'chip'} onClick={() => setSelectedVoiceProfile((current) => ({ ...current, [lang]: profile.id }))}>
                        {profile.label}
                      </button>
                    ))}
                  </div>

                  {micError && <div className="notice warning"><FiAlertCircle /><span>{micError}</span></div>}
                  {voicesLoaded.length === 0 && <div className="notice info"><FiBell /><span>Browser voices are still loading. Non-English voices may appear after a moment.</span></div>}

                  <div className="mic-wrap">
                    <button className={listening ? 'mic-btn live' : 'mic-btn'} onClick={listening ? stopListening : startListening}>
                      <FiMic />
                    </button>
                    <div>
                      <div className="mic-title">{listening ? view.voiceLoading : processingVoice ? view.voiceThinking : view.voiceTap}</div>
                      <p className="muted-copy">{view.voiceBrowserHint}</p>
                    </div>
                  </div>

                  <div className="conversation">
                    {transcript && <div className="speech-card user"><span>{view.voiceHeard}</span><p>{transcript}</p></div>}
                    {response && (
                      <div className="speech-card ai">
                        <span>{view.assistantName}</span>
                        <p>{response}</p>
                        <button className="text-btn" onClick={() => speak(response)}><FiVolume2 />{view.readAgain}</button>
                      </div>
                    )}
                  </div>

                  <div className="quick-actions">
                    {['What does Benadryl do?', 'What is the weather right now in London?', 'Name of some generic medicine for pain in legs.', 'When is my next dose?'].map((prompt) => (
                      <button key={prompt} className="chip" onClick={() => handleVoiceQuestion(prompt)}>{prompt}</button>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="section-head">
                    <div>
                      <h2>{view.typeQuestionTitle}</h2>
                      <p>{view.typeQuestionBody}</p>
                    </div>
                  </div>
                  <div className="chat-window inline-chat">
                    <div className="chat-head">
                      <strong>{view.chatbotTitle}</strong>
                      <span>{view.chatbotBody}</span>
                    </div>
                    <div className="chat-body" ref={inlineChatBodyRef}>
                      {chatMessages.map((message) => (
                        <div key={message.id} className={message.role === 'user' ? 'chat-bubble user' : 'chat-bubble ai'}>
                          <p>{message.text}</p>
                          <small>{message.time}</small>
                        </div>
                      ))}
                      {chatLoading && <div className="chat-bubble ai loading">{view.thinking}</div>}
                    </div>
                    <div className="chat-input-row">
                      <textarea
                        rows={3}
                        placeholder={view.chatbotPlaceholder}
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void sendChat()
                          }
                        }}
                      />
                      <button className="primary-icon-btn" onClick={() => void sendChat()} disabled={chatLoading || !chatInput.trim()}><FiSend /></button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {patientTab === 'medicines' && (
              <section className="panel">
                <div className="section-head"><div><h2>Medicines</h2><p>Track doses and review notes.</p></div></div>
                <div className="stack">
                  {meds.map((med) => (
                    <article key={med.id} className="med-card">
                      <div className="med-main">
                        <div className="med-icon"><FiHeart /></div>
                        <div>
                          <h3>{med.name}</h3>
                          <div className="med-sub">{med.dosage}</div>
                          <p>{med.notes}</p>
                        </div>
                      </div>
                      <div className="dose-list">
                        {med.times.map((time, index) => (
                          <button key={`${med.id}-${time.time}`} className={time.taken ? 'dose-chip done' : 'dose-chip'} onClick={() => toggleDose(med.id, index)}>
                            <FiClock />
                            {time.time}
                            {time.taken ? ` • ${time.takenAt}` : ''}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {patientTab === 'logs' && (
              <section className="panel">
                <div className="section-head"><div><h2>Medication log</h2><p>Recent taken and missed events.</p></div></div>
                <div className="stack">
                  {logs.length === 0 && <div className="empty-state">No dose log entries yet.</div>}
                  {logs.map((log) => <div key={log.id} className={`list-row ${log.status}`}><div><strong>{log.med}</strong><p>{log.time}</p></div><span className="pill">{log.status}</span></div>)}
                </div>
              </section>
            )}

            {patientTab === 'alerts' && (
              <section className="panel">
                <div className="section-head"><div><h2>Alerts</h2><p>Missed dose and system notifications.</p></div></div>
                <div className="stack">
                  {alerts.length === 0 && <div className="empty-state">No alerts right now.</div>}
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`alert-row ${alert.type}`}>
                      <div><strong>{alert.msg}</strong><p>{alert.time}</p></div>
                      <button className="icon-btn subtle" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}><FiX /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {patientTab === 'reports' && (
              <section className="panel two-col report-layout">
                <div className="card">
                  <div className="section-head">
                    <div>
                      <h2>Blood report analyzer</h2>
                      <p>Upload a report and or enter values to get clear next-step guidance. If a readable report is uploaded with an API key, MedAssist will try to scan and prefill the values below.</p>
                    </div>
                  </div>

                  {!reportFile && (
                    <button
                      className={draggingReport ? 'upload-zone drag' : 'upload-zone'}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(event) => { event.preventDefault(); setDraggingReport(true) }}
                      onDragLeave={() => setDraggingReport(false)}
                      onDrop={(event) => {
                        event.preventDefault()
                        setDraggingReport(false)
                        const file = event.dataTransfer.files?.[0]
                        if (file) handleReportFile(file)
                      }}
                    >
                      <FiUpload />
                      <strong>Drop PDF or image here</strong>
                      <span>Gemma can read uploaded report images locally. PDFs still work best with a cloud key or manual values.</span>
                    </button>
                  )}

                  {reportFile && (
                    <div className="file-chip">
                      <div><strong>{reportFile.name}</strong><p>{(reportFile.size / 1024).toFixed(1)} KB</p></div>
                      <button className="icon-btn subtle" onClick={() => setReportFile(null)}><FiX /></button>
                    </div>
                  )}

                  <div className="form-grid">
                    <label>Age <span className="unit-tag">years</span><input value={reportAge} onChange={(event) => setReportAge(event.target.value)} placeholder="68" /></label>
                    <label>Hemoglobin <span className="unit-tag">g/dL</span><input value={bloodValues.hb} onChange={(event) => setBloodValues((current) => ({ ...current, hb: event.target.value }))} placeholder="13.2" /></label>
                    <label>WBC <span className="unit-tag">cells/uL</span><input value={bloodValues.wbc} onChange={(event) => setBloodValues((current) => ({ ...current, wbc: event.target.value }))} placeholder="7800" /></label>
                    <label>Platelets <span className="unit-tag">per uL</span><input value={bloodValues.platelets} onChange={(event) => setBloodValues((current) => ({ ...current, platelets: event.target.value }))} placeholder="250000" /></label>
                    <label>Glucose <span className="unit-tag">mg/dL</span><input value={bloodValues.glucose} onChange={(event) => setBloodValues((current) => ({ ...current, glucose: event.target.value }))} placeholder="120" /></label>
                    <label>HbA1c <span className="unit-tag">percent</span><input value={bloodValues.hba1c} onChange={(event) => setBloodValues((current) => ({ ...current, hba1c: event.target.value }))} placeholder="6.8" /></label>
                    <label>Cholesterol <span className="unit-tag">mg/dL</span><input value={bloodValues.cholesterol} onChange={(event) => setBloodValues((current) => ({ ...current, cholesterol: event.target.value }))} placeholder="190" /></label>
                    <label>LDL <span className="unit-tag">mg/dL</span><input value={bloodValues.ldl} onChange={(event) => setBloodValues((current) => ({ ...current, ldl: event.target.value }))} placeholder="110" /></label>
                    <label>Creatinine <span className="unit-tag">mg/dL</span><input value={bloodValues.creatinine} onChange={(event) => setBloodValues((current) => ({ ...current, creatinine: event.target.value }))} placeholder="1.0" /></label>
                  </div>

                  <div className="action-row">
                    <button className="primary-btn" onClick={analyzeReport} disabled={analyzingReport}>{analyzingReport ? 'Analyzing...' : 'Analyze report'}</button>
                    <button className="ghost-btn" onClick={() => setBloodValues(EMPTY_BLOOD_VALUES)}>Clear values</button>
                  </div>

                  <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={(event) => event.target.files?.[0] && handleReportFile(event.target.files[0])} />
                </div>

                <div className="card">
                  <div className="section-head">
                    <div>
                      <h2>Latest result</h2>
                      <p>The analyzer now gives a clean action signal.</p>
                    </div>
                  </div>

                  {!latestReport && <div className="empty-state">No report has been analyzed yet.</div>}
                  {latestReport && (
                    <>
                      <div className={`result-banner ${latestReport.result.level.toLowerCase()}`}>
                        <strong>{latestReport.result.level}</strong>
                        <span>{latestReport.result.message}</span>
                        <small>{latestReport.result.doctor}</small>
                      </div>
                      <div className="result-section"><h3>Summary</h3><ul>{latestReport.result.summary.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div className="result-section"><h3>Abnormal</h3><ul>{latestReport.result.abnormal.length ? latestReport.result.abnormal.map((item) => <li key={item}>{item}</li>) : <li>No abnormal items flagged.</li>}</ul></div>
                      <div className="result-section"><h3>Advice</h3><ul>{latestReport.result.advice.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      {latestReport.notes.trim() && (
                        <div className="result-section caretaker-note">
                          <h3>Caretaker note</h3>
                          <p>{latestReport.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {mode === 'caretaker' && (
          <>
            <nav className="tabbar">
              {(['medicines', 'reports', 'logs', 'alerts', 'settings'] as CareTab[]).map((tab) => (
                <button key={tab} className={careTab === tab ? 'tab-btn active' : 'tab-btn'} onClick={() => setCareTab(tab)}>
                  {ui.careTabs[tab]}
                </button>
              ))}
            </nav>

            {careTab === 'medicines' && (
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Caretaker medicines</h2>
                    <p>The search icon is separated from the text now, so it no longer overlaps the input.</p>
                  </div>
                  <button className="primary-btn" onClick={() => setShowAddMedicine((current) => !current)}><FiPlus />{showAddMedicine ? 'Close' : 'Add medicine'}</button>
                </div>

                {showAddMedicine && (
                  <div className="card form-card">
                    <div className="search-field">
                      <label>Search medicine</label>
                      <div className="search-input-shell">
                        <div className="search-icon-box"><FiSearch /></div>
                        <input value={searchQuery} onChange={(event) => handleMedicineSearch(event.target.value)} placeholder="Search RxNorm or type a medicine name" />
                      </div>
                      {(searchLoading || searchResults.length > 0) && (
                        <div className="search-dropdown">
                          {searchLoading && <div className="search-option muted">Searching...</div>}
                          {searchResults.map((result) => (
                            <button
                              key={result}
                              className="search-option"
                              onMouseDown={() => {
                                setNewMedicine((current) => ({ ...current, name: result }))
                                setSearchQuery(result)
                                setSearchResults([])
                              }}
                            >
                              {result}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-grid">
                      <label>Medicine name<input value={newMedicine.name} onChange={(event) => setNewMedicine((current) => ({ ...current, name: event.target.value }))} /></label>
                      <label>Dosage<input value={newMedicine.dosage} onChange={(event) => setNewMedicine((current) => ({ ...current, dosage: event.target.value }))} /></label>
                      <label className="span-2">Notes<textarea value={newMedicine.notes} onChange={(event) => setNewMedicine((current) => ({ ...current, notes: event.target.value }))} rows={3} /></label>
                    </div>

                    <div className="times-wrap">
                      <div className="times-list">
                        {newTimes.map((time) => (
                          <span key={time} className="time-pill">
                            {time}
                            <button onClick={() => setNewTimes((current) => current.filter((entry) => entry !== time))}><FiX /></button>
                          </span>
                        ))}
                      </div>
                      <div className="action-row">
                        <input type="time" value={timeInput} onChange={(event) => setTimeInput(event.target.value)} />
                        <button className="ghost-btn" onClick={() => { if (timeInput && !newTimes.includes(timeInput)) setNewTimes((current) => [...current, timeInput].sort()) }}>Add time</button>
                      </div>
                    </div>

                    <label className="toggle-row"><span>Alert caretaker when dose is missed</span><input type="checkbox" checked={newMedicine.alert} onChange={(event) => setNewMedicine((current) => ({ ...current, alert: event.target.checked }))} /></label>
                    <button className="primary-btn" onClick={addMedicine}>Save medicine</button>
                  </div>
                )}

                <div className="stack">
                  {meds.map((med) => (
                    <article key={med.id} className="med-card caretaker">
                      <div className="med-main">
                        <div className="med-icon"><FiActivity /></div>
                        <div>
                          <h3>{med.name}</h3>
                          <div className="med-sub">{med.dosage}</div>
                          <p>{med.notes}</p>
                        </div>
                      </div>
                      <div className="caretaker-side">
                        <div className="dose-list">{med.times.map((time) => <span key={`${med.id}-${time.time}`} className={time.taken ? 'dose-chip done static' : 'dose-chip static'}>{time.time}</span>)}</div>
                        <button className="icon-btn danger" onClick={() => removeMedicine(med.id)}><FiTrash2 /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {careTab === 'reports' && (
              <section className="panel">
                <div className="section-head"><div><h2>Patient reports</h2><p>Reports and clinical notes for the caretaker side.</p></div></div>
                <div className="stack">
                  {reports.length === 0 && <div className="empty-state">No reports uploaded yet.</div>}
                  {reports.map((report) => (
                    <article key={report.id} className="report-card">
                      <div className={`result-banner ${report.result.level.toLowerCase()}`}>
                        <strong>{report.result.level}</strong>
                        <span>{report.result.message}</span>
                        <small>{report.result.doctor}</small>
                      </div>
                      <div className="report-meta"><strong>{report.fileName}</strong><span>{report.at}</span></div>
                      {report.dataUrl && <div className="report-preview">{report.mime.startsWith('image/') ? <img src={report.dataUrl} alt={report.fileName} /> : <iframe src={report.dataUrl} title={report.fileName} />}</div>}
                      <textarea
                        value={report.notes}
                        onChange={(event) => setReports((current) => current.map((entry) => (entry.id === report.id ? { ...entry, notes: event.target.value } : entry)))}
                        rows={4}
                        placeholder="Caretaker notes"
                      />
                    </article>
                  ))}
                </div>
              </section>
            )}

            {careTab === 'logs' && (
              <section className="panel">
                <div className="section-head"><div><h2>Activity log</h2><p>Recent medication adherence history.</p></div></div>
                <div className="stack">
                  {logs.length === 0 && <div className="empty-state">No logs yet.</div>}
                  {logs.map((log) => <div key={log.id} className={`list-row ${log.status}`}><div><strong>{log.med}</strong><p>{log.time}</p></div><span className="pill">{log.status}</span></div>)}
                </div>
              </section>
            )}

            {careTab === 'alerts' && (
              <section className="panel">
                <div className="section-head"><div><h2>Alerts</h2><p>Caretaker reminders and warning signals.</p></div><button className="ghost-btn" onClick={() => setAlerts([])}>Clear all</button></div>
                <div className="stack">
                  {alerts.length === 0 && <div className="empty-state">No active alerts.</div>}
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`alert-row ${alert.type}`}>
                      <div><strong>{alert.msg}</strong><p>{alert.time}</p></div>
                      <button className="icon-btn subtle" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}><FiX /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {careTab === 'settings' && (
              <section className="panel two-col">
                <div className="card" id="patient-profile-panel">
                  <div className="section-head"><div><h2>Patient profile</h2><p>This info is used in medicine and report answers.</p></div></div>
                  <div className="form-grid">
                    <label>Name<input value={patient.name} onChange={(event) => setPatient((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label>Age<input value={patient.age} onChange={(event) => setPatient((current) => ({ ...current, age: event.target.value }))} /></label>
                    <label>Condition<input value={patient.condition} onChange={(event) => setPatient((current) => ({ ...current, condition: event.target.value }))} /></label>
                    <label>Emergency phone<input value={patient.phone} onChange={(event) => setPatient((current) => ({ ...current, phone: event.target.value }))} /></label>
                  </div>
                  <div className="action-row">
                    <button className="primary-btn" onClick={savePatientProfile}><FiPlus />Add or Save Patient</button>
                    <button className="ghost-btn danger-text" onClick={deletePatientProfile}><FiTrash2 />Delete Patient</button>
                  </div>
                  <div className="emergency-strip">
                    <div>
                      <strong>Emergency contact</strong>
                      <p>{patient.phone.trim() || 'Add an emergency phone number to enable quick actions.'}</p>
                    </div>
                    <div className="emergency-actions">
                      {emergencyCallHref ? (
                        <a className="ghost-btn emergency-call emergency-link" href={emergencyCallHref}><FiPhoneCall />Call</a>
                      ) : (
                        <button className="ghost-btn emergency-call" onClick={() => addAlert('Please add an emergency phone number first.', 'warning')}><FiPhoneCall />Call</button>
                      )}
                      {emergencySmsHref ? (
                        <a className="ghost-btn emergency-message emergency-link" href={emergencySmsHref}><FiMessageSquare />Message</a>
                      ) : (
                        <button className="ghost-btn emergency-message" onClick={() => addAlert('Please add an emergency phone number first.', 'warning')}><FiMessageSquare />Message</button>
                      )}
                    </div>
                  </div>
                  <div className="saved-patients">
                    {patientProfiles.map((profile) => (
                      <div key={profile.id} className="patient-mini-card">
                        <div>
                          <strong>{profile.name}</strong>
                          <p>{profile.condition || 'No condition added'} • {profile.age || 'Age not set'}</p>
                        </div>
                        <div className="mini-actions">
                          <button className="ghost-btn small-btn" onClick={() => loadPatientProfile(profile)}>Open</button>
                          <button className="ghost-btn small-btn danger-text" onClick={() => removeSavedPatient(profile.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                    {patientProfiles.length === 0 && <div className="empty-state compact">Saved patient cards will appear here.</div>}
                  </div>
                </div>

                <div className="card">
                  <div className="section-head summary-head">
                    <div><h2>Summary</h2><p>High-level patient snapshot.</p></div>
                    <button className="icon-btn subtle" onClick={() => document.getElementById('patient-profile-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      <FiSettings />
                    </button>
                  </div>
                  <div className="summary-grid">
                    <div className="summary-box"><span>Medicines</span><strong>{meds.length}</strong></div>
                    <div className="summary-box"><span>Total doses</span><strong>{totalDoses.length}</strong></div>
                    <div className="summary-box"><span>Reports</span><strong>{reports.length}</strong></div>
                    <div className="summary-box"><span>Warnings</span><strong>{warningCount}</strong></div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <div className="chat-fab-wrap">
        {chatOpen && (
          <div className="chat-window">
            <div className="chat-head">
              <div><strong>{view.chatbotTitle}</strong><span>{view.chatbotBody}</span></div>
              <button className="icon-btn subtle" onClick={() => setChatOpen(false)}><FiX /></button>
            </div>

            <div className="chat-body" ref={floatingChatBodyRef}>
              {chatMessages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'chat-bubble user' : 'chat-bubble ai'}>
                  <p>{message.text}</p>
                  <small>{message.time}</small>
                </div>
              ))}
              {chatLoading && <div className="chat-bubble ai loading">{view.thinking}</div>}
            </div>

            <div className="chat-input-row">
              <textarea
                rows={1}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendChat()
                  }
                }}
                placeholder={view.chatbotPlaceholder}
              />
              <button className="primary-icon-btn" onClick={() => void sendChat()} disabled={chatLoading || !chatInput.trim()}><FiSend /></button>
            </div>
          </div>
        )}

        <button className="chat-fab" onClick={() => setChatOpen((current) => !current)}><FiMessageCircle /></button>
      </div>

      <footer className="footer">
        <div className="footer-main-grid">
          <div className="footer-brand">
            <div className="brand-mark small"><FiHeart /></div>
            <div>
              <strong>MedAssist</strong>
              <p>Cleaner answers, stronger report review, and better multilingual voices.</p>
            </div>
          </div>

          <div className="footer-col">
            <h4>Features</h4>
            <button onClick={() => { setMode('patient'); setPatientTab('voice') }}><FiMic />Voice Assistant</button>
            <button onClick={() => { setMode('patient'); setPatientTab('medicines') }}><FiHeart />Medicine Tracker</button>
            <button onClick={() => { setMode('patient'); setPatientTab('reports') }}><FiFileText />Blood Reports</button>
            <button onClick={() => { setMode('caretaker'); setCareTab('medicines') }}><FiSettings />Caretaker Mode</button>
          </div>

          <div className="footer-col">
            <h4>Languages</h4>
            {(Object.keys(LANG_META) as LangKey[]).map((key) => (
              <button key={key} onClick={() => setLang(key)}>
                <FiGlobe />
                {LANG_META[key].label}
              </button>
            ))}
          </div>

          <div className="footer-col">
            <h4>Legal &amp; Support</h4>
            <button onClick={() => setLegalModal('help')}><FiMessageCircle />Help Center</button>
            <button onClick={() => setLegalModal('contact')}><FiUser />Contact</button>
            <button onClick={() => setLegalModal('accessibility')}><FiShield />Accessibility</button>
            <button onClick={() => setLegalModal('privacy')}><FiShield />Privacy</button>
            <button onClick={() => setLegalModal('terms')}><FiFileText />Terms</button>
            <button onClick={() => setLegalModal('disclaimer')}><FiAlertCircle />Disclaimer</button>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MedAssist. Built for patient and caretaker medication support.</span>
          <div className="footer-inline-links">
            <button onClick={() => setLegalModal('privacy')}>Privacy</button>
            <button onClick={() => setLegalModal('terms')}>Terms</button>
            <button onClick={() => setLegalModal('disclaimer')}>Disclaimer</button>
            <button onClick={() => setLegalModal('contact')}>Contact</button>
          </div>
          <span>{clock} - {date}</span>
        </div>
      </footer>

      {legalModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setLegalModal(null)}>
          <div className={`modal-card ${legalModal === 'account' ? 'theme-account' : `theme-${legalModal}`}`}>
            <div className="modal-head">
              <h3>{legalModal === 'account' ? 'Account' : LEGAL_CONTENT[legalModal].title}</h3>
              <button className="icon-btn subtle" onClick={() => setLegalModal(null)}><FiX /></button>
            </div>

            {legalModal === 'account' ? (
              <div className="modal-body">
                <div className="form-grid">
                  <label>Name<input value={account.name} onChange={(event) => setAccount((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" /></label>
                  <label>Email<input value={account.email} onChange={(event) => setAccount((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" /></label>
                  <label className="span-2">Role<input value={account.role} onChange={(event) => setAccount((current) => ({ ...current, role: event.target.value }))} placeholder="Patient or caretaker" /></label>
                </div>
                <div className="action-row">
                  <button className="primary-btn" onClick={async () => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: account.email,
      password: 'HmaiDefault2025!',
    })
    if (error) throw error
    if (data.session) {
      await apiCall('/api/auth/complete-profile', {
        method: 'POST',
        body: JSON.stringify({
          role: account.role === 'Doctor' ? 'doctor' : 'patient',
          firstName: account.name.split(' ')[0] || account.name,
          lastName: account.name.split(' ')[1] || '',
          email: account.email,
        })
      })
    }
    addAlert('Account saved!', 'success')
    setLegalModal(null)
  } catch {
    addAlert('Could not save account. Try again.', 'error')
  }
}}>Save account</button>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                {LEGAL_CONTENT[legalModal].body.map((line) => <p key={line}>{line}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowAuthModal(false)}>
          <AuthGate onAuthenticated={() => { setIsAuthenticated(true); setShowAuthModal(false) }} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  )
}
