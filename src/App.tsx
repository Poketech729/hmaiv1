<<<<<<< HEAD
import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface DoseTime   { time: string; taken: boolean; takenAt?: string }
interface Medication { id: string; name: string; dosage: string; times: DoseTime[]; notes: string; alertIfMissed: boolean }
interface Log        { id: string; medication: string; time: string; status: 'taken' | 'missed' }
interface AppAlert   { id: string; message: string; time: string; type: 'warning' | 'info' | 'success' }
interface PatientInfo{ name: string; age: string; condition: string; emergency: string }
type Tab    = 'voice' | 'medications' | 'logs' | 'alerts'
type CTTab  = 'medicines' | 'logs' | 'alerts' | 'settings'
type LangKey= 'en' | 'hi' | 'es' | 'it'
type Mode   = 'patient' | 'caretaker'
type ModalKey = 'privacy' | 'terms' | 'disclaimer' | 'contact' | 'help' | 'accessibility' | null

// ═══════════════════════════════════════════════════════════
// LANGUAGE CONFIG
// ═══════════════════════════════════════════════════════════
const L = {
  en: {
    code:'en-US', bcp:'en', flag:'🇺🇸', label:'English',
    greeting:"Hello! I'm MedAssist, your caring medication helper. Ask me about your medicines, tell me you've taken a dose, or ask about side effects. I'm always here for you! 💊",
    ui:{
      tapToSpeak:'Tap to Speak',listening:'Listening… tap to stop',thinking:'Thinking…',
      youSaid:'👤 You said',assistantSays:'💊 MedAssist says',readAloud:'🔊 Read Again',
      quickQ:'Quick Questions',quickDesc:'Tap any question to ask instantly — no mic needed.',
      noLogs:'No logs yet. Mark medicines as taken to start tracking.',
      noAlerts:'No alerts! Everything is on track. Great job!',
      patientMode:'🧓 Patient',caretakerMode:'👨‍⚕️ Caretaker',
      speakTitle:'Speak to MedAssist',speakDesc:'Tap the big microphone and speak naturally in English.',
      micWarn:'⚠️ Please use Google Chrome or Microsoft Edge for voice features.',
      micDenied:'⚠️ Microphone access was denied. Please allow microphone in your browser settings.',
      convTitle:'Conversation',convDesc:'Your words and my response appear here.',
      myMeds:'💊 My Medicines',myLog:'📋 My Medication Log',myAlerts:'🔔 Caregiver Alerts',
      tabVoice:'🎙️ Voice',tabMeds:'💊 Medicines',tabLogs:'📋 Log',tabAlerts:'🔔 Alerts',
    },
    quick:['What medicines do I have today?','I just took my morning medicine','What are the side effects of Aspirin?','When is my next dose?','I forgot to take my medicine','Is it safe to take Metformin with food?'],
  },
  hi: {
    code:'hi-IN', bcp:'hi', flag:'🇮🇳', label:'हिंदी',
    greeting:"नमस्ते! मैं MedAssist हूं। आप मुझसे अपनी दवाओं के बारे में पूछ सकते हैं या बता सकते हैं कि आपने दवा ली। मैं हमेशा आपकी मदद के लिए हूं! 💊",
    ui:{
      tapToSpeak:'बोलने के लिए दबाएं',listening:'सुन रहा हूं… रुकने के लिए दबाएं',thinking:'सोच रहा हूं…',
      youSaid:'👤 आपने कहा',assistantSays:'💊 MedAssist कहता है',readAloud:'🔊 फिर से सुनें',
      quickQ:'जल्दी प्रश्न',quickDesc:'नीचे कोई प्रश्न दबाएं — माइक की ज़रूरत नहीं।',
      noLogs:'अभी कोई रिकॉर्ड नहीं है।',noAlerts:'कोई अलर्ट नहीं! सब ठीक है।',
      patientMode:'🧓 मरीज़',caretakerMode:'👨‍⚕️ देखभालकर्ता',
      speakTitle:'MedAssist से बात करें',speakDesc:'बड़े माइक्रोफोन को दबाएं और हिंदी में बोलें।',
      micWarn:'⚠️ आवाज़ के लिए Google Chrome उपयोग करें।',
      micDenied:'⚠️ माइक्रोफोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दें।',
      convTitle:'बातचीत',convDesc:'आपकी बात और मेरा जवाब यहां दिखेगा।',
      myMeds:'💊 मेरी दवाएं',myLog:'📋 दवा रिकॉर्ड',myAlerts:'🔔 देखभालकर्ता अलर्ट',
      tabVoice:'🎙️ आवाज़',tabMeds:'💊 दवाएं',tabLogs:'📋 रिकॉर्ड',tabAlerts:'🔔 अलर्ट',
    },
    quick:['आज मेरी कौन सी दवाएं हैं?','मैंने सुबह की दवा ली','Aspirin के दुष्प्रभाव क्या हैं?','अगली खुराक कब है?','मैं दवा लेना भूल गया','क्या Metformin खाने के साथ ले सकते हैं?'],
  },
  es: {
    code:'es-ES', bcp:'es', flag:'🇪🇸', label:'Español',
    greeting:"¡Hola! Soy MedAssist, tu asistente de medicamentos. Puedes preguntarme sobre tus medicinas o decirme que tomaste una dosis. ¡Estoy aquí para ayudarte! 💊",
    ui:{
      tapToSpeak:'Toca para hablar',listening:'Escuchando… toca para parar',thinking:'Pensando…',
      youSaid:'👤 Dijiste',assistantSays:'💊 MedAssist dice',readAloud:'🔊 Leer de nuevo',
      quickQ:'Preguntas rápidas',quickDesc:'Toca una pregunta para hacerla al instante.',
      noLogs:'Sin registros aún.',noAlerts:'¡Sin alertas! Todo va bien.',
      patientMode:'🧓 Paciente',caretakerMode:'👨‍⚕️ Cuidador',
      speakTitle:'Habla con MedAssist',speakDesc:'Toca el micrófono y habla en español.',
      micWarn:'⚠️ Usa Google Chrome para las funciones de voz.',
      micDenied:'⚠️ Acceso al micrófono denegado. Permite el micrófono en la configuración.',
      convTitle:'Conversación',convDesc:'Tus palabras y mi respuesta aparecen aquí.',
      myMeds:'💊 Mis Medicamentos',myLog:'📋 Mi Registro',myAlerts:'🔔 Alertas',
      tabVoice:'🎙️ Voz',tabMeds:'💊 Medicamentos',tabLogs:'📋 Registro',tabAlerts:'🔔 Alertas',
    },
    quick:['¿Qué medicamentos tengo hoy?','Acabo de tomar mi medicamento','¿Efectos secundarios de la Aspirina?','¿Cuándo es mi próxima dosis?','Olvidé tomar mi medicamento','¿Puedo tomar Metformina con comida?'],
  },
  it: {
    code:'it-IT', bcp:'it', flag:'🇮🇹', label:'Italiano',
    greeting:"Ciao! Sono MedAssist, il tuo assistente per i farmaci. Puoi chiedermi dei tuoi medicinali o dirmi che hai preso una dose. Sono qui per aiutarti! 💊",
    ui:{
      tapToSpeak:'Tocca per parlare',listening:'Ascolto… tocca per fermare',thinking:'Sto pensando…',
      youSaid:'👤 Hai detto',assistantSays:'💊 MedAssist dice',readAloud:'🔊 Leggi ancora',
      quickQ:'Domande rapide',quickDesc:'Tocca una domanda per farla subito.',
      noLogs:'Nessun registro ancora.',noAlerts:'Nessun avviso! Tutto in ordine.',
      patientMode:'🧓 Paziente',caretakerMode:'👨‍⚕️ Badante',
      speakTitle:'Parla con MedAssist',speakDesc:'Tocca il grande microfono e parla in italiano.',
      micWarn:'⚠️ Usa Google Chrome per le funzioni vocali.',
      micDenied:'⚠️ Accesso al microfono negato. Consenti il microfono nelle impostazioni.',
      convTitle:'Conversazione',convDesc:'Le tue parole e la mia risposta appaiono qui.',
      myMeds:'💊 I Miei Farmaci',myLog:'📋 Registro Farmaci',myAlerts:'🔔 Avvisi',
      tabVoice:'🎙️ Voce',tabMeds:'💊 Farmaci',tabLogs:'📋 Registro',tabAlerts:'🔔 Avvisi',
    },
    quick:['Quali farmaci ho oggi?','Ho appena preso la medicina','Effetti collaterali Aspirina?','Quando è la prossima dose?','Ho dimenticato il farmaco','Posso prendere Metformina con cibo?'],
  },
} as const

// ═══════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════
const SAMPLE_MEDS: Medication[] = [
  { id:'1', name:'Metformin',   dosage:'500mg',  times:[{time:'08:00',taken:false},{time:'20:00',taken:false}], notes:'Take with meals',          alertIfMissed:true  },
  { id:'2', name:'Amlodipine',  dosage:'5mg',    times:[{time:'09:00',taken:false}],                            notes:'For blood pressure',       alertIfMissed:true  },
  { id:'3', name:'Aspirin',     dosage:'75mg',   times:[{time:'08:00',taken:false}],                            notes:'After breakfast',          alertIfMissed:false },
]

// ═══════════════════════════════════════════════════════════
// MODAL CONTENT
// ═══════════════════════════════════════════════════════════
const MODALS: Record<NonNullable<ModalKey>, { title: string; body: JSX.Element }> = {
  privacy: {
    title: '🔒 Privacy Policy',
    body: <><p>MedAssist is committed to protecting your privacy. This app runs entirely in your browser — no personal health data is sent to any server or stored in the cloud.</p><h3>What We Collect</h3><p>All medication data, logs, and settings are stored locally in your browser session only and are cleared when you close or refresh the page. We do not collect, sell, or share any personal information.</p><h3>Voice Data</h3><p>Voice input is processed by your browser's built-in Speech Recognition API. On Chrome, audio may be processed by Google's servers briefly for recognition. This is controlled by your browser, not by MedAssist.</p><h3>AI Queries</h3><p>When you ask a question, it is sent to the Anthropic Claude API for processing. The query does not include any personally identifiable information beyond the medication names you have entered.</p><h3>Contact</h3><p>For privacy concerns, please contact us through the Contact page.</p></>
  },
  terms: {
    title: '📄 Terms of Use',
    body: <><p>By using MedAssist, you agree to these terms of use.</p><h3>Purpose</h3><p>MedAssist is a demonstration tool built for a healthcare hackathon. It is intended to show how AI and voice technology can assist elderly patients with medication reminders.</p><h3>Not Medical Advice</h3><p>MedAssist does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making any health decisions.</p><h3>Accuracy</h3><p>While we strive for accuracy, medication information provided by the AI may not always be complete or up to date. Always verify with your doctor or pharmacist.</p><h3>Liability</h3><p>MedAssist and its creators accept no liability for any harm arising from the use of this application.</p></>
  },
  disclaimer: {
    title: '⚕️ Medical Disclaimer',
    body: <><p><strong>IMPORTANT: Please read this disclaimer carefully before using MedAssist.</strong></p><h3>Not a Medical Device</h3><p>MedAssist is not a licensed medical device or service. It is an AI-powered reminder and information tool created for demonstration purposes.</p><h3>Consult Your Doctor</h3><p>Always consult your physician, pharmacist, or qualified healthcare provider before starting, stopping, or changing any medication regimen. The information provided by MedAssist should not replace professional medical advice.</p><h3>Emergency Situations</h3><p>In case of a medical emergency, call your local emergency services immediately (911 in USA, 999 in UK, 112 in Europe, 102 in India). Do not rely on MedAssist in emergencies.</p><h3>Allergies & Interactions</h3><p>MedAssist is not aware of your complete medical history. Always inform your doctor about all medications you are taking to avoid dangerous interactions.</p></>
  },
  contact: {
    title: '📬 Contact Us',
    body: <><p>We'd love to hear from you — whether it's feedback, a bug report, or a partnership inquiry.</p><h3>📧 Email</h3><p><strong>support@medassist.health</strong><br/>We respond within 24 hours on business days.</p><h3>🐛 Report a Bug</h3><p><strong>bugs@medassist.health</strong><br/>Please include your browser name and version.</p><h3>🤝 Partnerships</h3><p><strong>partnerships@medassist.health</strong><br/>For healthcare organizations and hospital integrations.</p><h3>💡 Feature Requests</h3><p>Have an idea? We're all ears. Email us at <strong>ideas@medassist.health</strong></p><p style={{marginTop:16,padding:'14px',background:'var(--green-ll)',borderRadius:'10px',fontSize:'14px',color:'var(--green)',fontWeight:600}}>MedAssist is currently in beta — built with ❤️ at a healthcare hackathon.</p></>
  },
  help: {
    title: '❓ Help Center',
    body: <><h3>🎙️ How to use the Voice Assistant</h3><p>Tap the big green microphone button and speak clearly. Say things like "What medicines do I have?" or "I just took my Aspirin." Make sure to use Google Chrome or Microsoft Edge for voice features.</p><h3>🌐 Changing Language</h3><p>Tap the language buttons in the top right corner (🇺🇸 🇮🇳 🇪🇸 🇮🇹). The entire interface, voice responses, and quick questions will switch to your chosen language.</p><h3>💊 Marking Medicine as Taken</h3><p>Go to the Medicines tab and tap "Mark as Taken" next to the dose. You can also tell the voice assistant "I took my [medicine name]" and it will mark it automatically.</p><h3>👨‍⚕️ Caretaker Mode</h3><p>Switch to Caretaker mode using the toggle in the header. This gives you full control to add medications, set schedules, add notes, and configure alerts.</p><h3>🔍 Searching for Medicines</h3><p>In Caretaker mode, use the medicine search bar to find any medicine in the world powered by the RxNorm database (US National Library of Medicine).</p></>
  },
  accessibility: {
    title: '♿ Accessibility',
    body: <><p>MedAssist is designed with elderly and differently-abled users in mind.</p><h3>Large Text</h3><p>All text is minimum 18px to ensure readability for users with visual impairments.</p><h3>Large Touch Targets</h3><p>All buttons are large and easy to tap, designed for users with reduced motor control.</p><h3>Voice Control</h3><p>The entire patient interface can be operated by voice — no typing required. Available in English, Hindi, Spanish, and Italian.</p><h3>High Contrast</h3><p>The color palette uses high-contrast combinations to ensure visibility for users with color blindness or low vision.</p><h3>Screen Reader Support</h3><p>All interactive elements have appropriate ARIA labels for screen reader compatibility.</p><h3>Need More Help?</h3><p>If you need additional accessibility accommodations, please contact us at <strong>access@medassist.health</strong></p></>
  },
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const pad = (n:number) => String(n).padStart(2,'0')
const nowTime = () => new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
const tickTime = () => { const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
const todayDate = () => new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [mode, setMode]           = useState<Mode>('patient')
  const [lang, setLang]           = useState<LangKey>('en')
  const [tab, setTab]             = useState<Tab>('voice')
  const [ctTab, setCtTab]         = useState<CTTab>('medicines')
  const [meds, setMeds]           = useState<Medication[]>(SAMPLE_MEDS)
  const [logs, setLogs]           = useState<Log[]>([])
  const [alerts, setAlerts]       = useState<AppAlert[]>([])
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({ name:'', age:'', condition:'', emergency:'' })
  const [modal, setModal]         = useState<ModalKey>(null)

  // Voice state
  const [listening, setListening] = useState(false)
  const [processing, setProc]     = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse]   = useState('')
  const [voiceOk, setVoiceOk]     = useState(true)
  const [micDenied, setMicDenied] = useState(false)

  // UI
  const [clock, setClock]         = useState(tickTime())
  const [date]                    = useState(todayDate())

  // Caretaker - add med
  const [showAdd, setShowAdd]     = useState(false)
  const [medSearch, setMedSearch] = useState('')
  const [searchRes, setSearchRes] = useState<string[]>([])
  const [searchLoad, setSearchLoad] = useState(false)
  const [newMed, setNewMed]       = useState({ name:'', dosage:'', notes:'', alertIfMissed:true })
  const [newTimes, setNewTimes]   = useState<string[]>(['08:00'])
  const [timeInput, setTimeInput] = useState('')

  const recRef    = useRef<any>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const debRef    = useRef<ReturnType<typeof setTimeout>|null>(null)

  // ── CLOCK ────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(tickTime()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── LOAD VOICES ──────────────────────────────────────────
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.onvoiceschanged = load
    // Retry to catch delayed loading
    const t = setTimeout(load, 1000)
    return () => clearTimeout(t)
  }, [])

  // ── SET GREETING on lang change ──────────────────────────
  useEffect(() => {
    const g = L[lang].greeting
    setResponse(g)
    setTranscript('')
    // Speak greeting after small delay to allow voice list to settle
    setTimeout(() => speak(g, lang), 400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // ── SPEAK ────────────────────────────────────────────────
  const speak = useCallback((text: string, langKey: LangKey = lang) => {
    if (!text) return
    window.speechSynthesis.cancel()
    const cfg  = L[langKey]
    const all  = voicesRef.current
    const utt  = new SpeechSynthesisUtterance(text)

    // Priority: Google voice in exact lang > any Google in language > exact lang > starts with lang
    const voice =
      all.find(v => v.name.toLowerCase().includes('google') && v.lang === cfg.code) ||
      all.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith(cfg.bcp)) ||
      all.find(v => v.lang === cfg.code) ||
      all.find(v => v.lang.startsWith(cfg.bcp)) ||
      null

    if (voice) utt.voice = voice
    utt.lang   = cfg.code
    utt.rate   = langKey === 'hi' ? 0.82 : langKey === 'es' ? 0.88 : langKey === 'it' ? 0.87 : 0.88
    utt.pitch  = langKey === 'hi' ? 1.10 : langKey === 'es' ? 1.05 : langKey === 'it' ? 1.05 : 1.0
    utt.volume = 1

    window.speechSynthesis.speak(utt)
  }, [lang])

  // ── MIC ──────────────────────────────────────────────────
  const initRecognition = useCallback((langKey: LangKey) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceOk(false); return }

    const rec          = new SR()
    rec.continuous     = false
    rec.interimResults = true
    rec.lang           = L[langKey].code

    rec.onstart = () => setListening(true)

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          setTranscript(t)
          setListening(false)
          askClaude(t, langKey)
          return
        }
        interim += t
      }
      if (interim) setTranscript(interim)
    }

    rec.onerror = (e: any) => {
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        setMicDenied(true)
        setVoiceOk(false)
      }
    }

    rec.onend = () => setListening(false)
    recRef.current = rec
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { initRecognition(lang) }, [lang, initRecognition])

  const startListening = async () => {
    if (!voiceOk || listening || processing) return
    try {
      // Explicitly request mic permission — this triggers the browser dialog
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicDenied(false)
      setVoiceOk(true)
      if (!recRef.current) initRecognition(lang)
      recRef.current.lang = L[lang].code
      recRef.current.start()
    } catch {
      setMicDenied(true)
      setVoiceOk(false)
    }
  }

  const stopListening = () => {
    recRef.current?.stop()
    setListening(false)
  }

  // ── CLAUDE API ────────────────────────────────────────────
  const askClaude = async (text: string, langKey: LangKey = lang) => {
    setProc(true)
    const medList = meds.map(m =>
      `${m.name} ${m.dosage} at ${m.times.map(t=>t.time).join(' and ')}`
    ).join('; ')

    const sys = `You are MedAssist, a warm and deeply compassionate voice assistant for elderly patients. Many users have serious conditions including Alzheimer's, heart disease, cancer, and diabetes.

Patient's medications: ${medList}.
Patient info: ${patientInfo.name ? `Name: ${patientInfo.name}, Age: ${patientInfo.age}, Condition: ${patientInfo.condition}` : 'Not provided'}.

CRITICAL RULES:
1. ALWAYS respond ONLY in ${L[langKey].label}. Not a single word of any other language.
2. Use SHORT, SIMPLE sentences. Maximum 3 sentences total.
3. Be extremely warm, patient, gentle. Like speaking to a beloved grandparent.
4. NEVER use medical jargon.
5. If patient says they took a medication, include MARK_TAKEN:[exact medication name] at the end.
6. If patient expresses confusion, pain, or distress — be extra gentle and suggest they call their doctor.
7. Speak in a reassuring, calm tone always.`

    try {
=======
import { useState, useEffect, useRef } from 'react'
import './App.css'

// ── TYPES ──────────────────────────────────────────────
interface Medication {
  id: string
  name: string
  dosage: string
  times: string[]
  taken: boolean[]
}

interface AdherenceLog {
  id: string
  medication: string
  time: string
  status: 'taken' | 'missed'
}

interface CaregiverAlert {
  id: string
  message: string
  time: string
  type: 'warning' | 'info'
}

type TabType = 'voice' | 'medications' | 'logs' | 'alerts'
type LangKey = 'en' | 'hi' | 'es' | 'it'

// ── LANGUAGE CONFIG ─────────────────────────────────────
const LANGUAGES: Record<LangKey, { code: string; label: string; flag: string; greeting: string }> = {
  en: { code: 'en-US', label: 'English',  flag: '🇺🇸', greeting: "Hello! I'm MedAssist. How can I help with your medications today?" },
  hi: { code: 'hi-IN', label: 'हिंदी',    flag: '🇮🇳', greeting: "नमस्ते! मैं MedAssist हूं। आज आपकी दवाओं के बारे में कैसे मदद करूं?" },
  es: { code: 'es-ES', label: 'Español',  flag: '🇪🇸', greeting: "¡Hola! Soy MedAssist. ¿Cómo puedo ayudarte con tus medicamentos hoy?" },
  it: { code: 'it-IT', label: 'Italiano', flag: '🇮🇹', greeting: "Ciao! Sono MedAssist. Come posso aiutarti con i tuoi farmaci oggi?" },
}

// ── SAMPLE DATA ─────────────────────────────────────────
const SAMPLE_MEDS: Medication[] = [
  { id: '1', name: 'Metformin',   dosage: '500mg', times: ['08:00', '20:00'], taken: [false, false] },
  { id: '2', name: 'Amlodipine',  dosage: '5mg',   times: ['09:00'],          taken: [false] },
  { id: '3', name: 'Aspirin',     dosage: '75mg',  times: ['08:00'],          taken: [false] },
]

// ── APP ──────────────────────────────────────────────────
export default function App() {
  const [lang, setLang]             = useState<LangKey>('en')
  const [isListening, setListening] = useState(false)
  const [isProcessing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState(LANGUAGES.en.greeting)
  const [meds, setMeds]             = useState<Medication[]>(SAMPLE_MEDS)
  const [logs, setLogs]             = useState<AdherenceLog[]>([])
  const [alerts, setAlerts]         = useState<CaregiverAlert[]>([])
  const [tab, setTab]               = useState<TabType>('voice')
  const [showAdd, setShowAdd]       = useState(false)
  const [newMed, setNewMed]         = useState({ name: '', dosage: '', time: '' })

  const recognitionRef = useRef<any>(null)

  // ── INIT SPEECH RECOGNITION ──────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous     = false
    rec.interimResults = true
    rec.lang           = LANGUAGES[lang].code

    rec.onresult = (e: any) => {
      const idx  = e.resultIndex
      const text = e.results[idx][0].transcript
      setTranscript(text)
      if (e.results[idx].isFinal) handleVoiceInput(text)
    }

    rec.onend   = () => setListening(false)
    rec.onerror = () => setListening(false)

    recognitionRef.current = rec
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // Update greeting when language changes
  useEffect(() => {
    setAiResponse(LANGUAGES[lang].greeting)
    setTranscript('')
  }, [lang])

  // ── VOICE CONTROLS ──────────────────────────────────
  const startListening = () => {
    if (!recognitionRef.current || isListening) return
    recognitionRef.current.lang = LANGUAGES[lang].code
    recognitionRef.current.start()
    setListening(true)
    setTranscript('')
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang  = LANGUAGES[lang].code
    utt.rate  = 0.9
    window.speechSynthesis.speak(utt)
  }

  // ── CLAUDE API CALL ──────────────────────────────────
  const handleVoiceInput = async (text: string) => {
    setProcessing(true)
    try {
      const medSummary = meds
        .map(m => `${m.name} ${m.dosage} at ${m.times.join(' and ')}`)
        .join('; ')

      const systemPrompt = `You are MedAssist, a warm and compassionate voice medication assistant for elderly patients.
Patient medications: ${medSummary}.
IMPORTANT: Always respond ONLY in ${LANGUAGES[lang].label}. Keep replies brief (2-3 sentences), warm, and clear.
You help with: medication reminders, dosage queries, side effect information, and adherence encouragement.
If the patient says they took a medication, end your reply with MARK_TAKEN:[medication name].
Example: "Great job taking your Aspirin! MARK_TAKEN:Aspirin"`

>>>>>>> bc07e339e4081bc31ecc19ed38ad8a86c90ff937
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
<<<<<<< HEAD
          max_tokens: 320,
          system: sys,
          messages: [{ role: 'user', content: text }]
        })
      })
      const data   = await res.json()
      let reply: string = data.content?.[0]?.text || ''

      if (reply.includes('MARK_TAKEN:')) {
        const name = reply.split('MARK_TAKEN:')[1].trim().split(/[\n\r]/)[0].trim()
        autoMark(name)
        reply = reply.replace(/MARK_TAKEN:[^\n\r]*/g, '').trim()
      }

      setResponse(reply)
      speak(reply, langKey)
    } catch {
      const err: Record<LangKey,string> = {
        en:'Sorry, I had trouble connecting. Please try again.',
        hi:'माफ करें, कनेक्शन में समस्या है। फिर से कोशिश करें।',
        es:'Lo siento, hubo un problema. Por favor inténtalo de nuevo.',
        it:'Mi dispiace, problema di connessione. Riprova.',
      }
      setResponse(err[langKey])
      speak(err[langKey], langKey)
    }
    setProc(false)
  }

  // ── MED HELPERS ──────────────────────────────────────────
  const autoMark = (name: string) => {
    setMeds(prev => prev.map(m => {
      if (!m.name.toLowerCase().includes(name.toLowerCase())) return m
      const times = m.times.map((t,i) => (!t.taken && i === m.times.findIndex(x=>!x.taken)) ? {...t, taken:true, takenAt:nowTime()} : t)
      if (JSON.stringify(times) !== JSON.stringify(m.times)) addLog(m.name, 'taken')
      return {...m, times}
=======
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: text }],
        }),
      })

      const data  = await res.json()
      const reply: string = data.content?.[0]?.text || 'Sorry, I could not process that. Please try again.'

      // Parse MARK_TAKEN command
      if (reply.includes('MARK_TAKEN:')) {
        const medName = reply.split('MARK_TAKEN:')[1].trim().split('\n')[0]
        markTaken(medName)
      }

      const cleanReply = reply.replace(/MARK_TAKEN:[^\n]*/g, '').trim()
      setAiResponse(cleanReply)
      speak(cleanReply)

    } catch {
      const err = lang === 'hi' ? 'माफ करें, कनेक्शन में समस्या है।'
                : lang === 'es' ? 'Lo siento, hay un problema de conexión.'
                : lang === 'it' ? 'Mi dispiace, c\'è un problema di connessione.'
                : 'Sorry, there was a connection issue. Please try again.'
      setAiResponse(err)
      speak(err)
    }
    setProcessing(false)
  }

  // ── MEDICATION HELPERS ───────────────────────────────
  const markTaken = (medName: string) => {
    setMeds(prev => prev.map(m => {
      if (!m.name.toLowerCase().includes(medName.toLowerCase())) return m
      const taken = [...m.taken]
      const i     = taken.findIndex(t => !t)
      if (i !== -1) {
        taken[i] = true
        addLog(m.name, 'taken')
      }
      return { ...m, taken }
>>>>>>> bc07e339e4081bc31ecc19ed38ad8a86c90ff937
    }))
  }

  const addLog = (medication: string, status: 'taken' | 'missed') => {
<<<<<<< HEAD
    const l: Log = { id: uid(), medication, time: nowTime(), status }
    setLogs(p => [l, ...p].slice(0, 50))
    if (status === 'missed' && meds.find(m=>m.name===medication)?.alertIfMissed) {
      setAlerts(p => [{
        id: uid(), message: `⚠️ ${medication} dose was missed`, time: nowTime(), type: 'warning'
      }, ...p].slice(0, 40))
=======
    const log: AdherenceLog = {
      id: Date.now().toString(),
      medication,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status,
    }
    setLogs(p => [log, ...p].slice(0, 30))

    if (status === 'missed') {
      const alert: CaregiverAlert = {
        id: Date.now().toString(),
        message: `${medication} dose was missed`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'warning',
      }
      setAlerts(p => [alert, ...p].slice(0, 20))
>>>>>>> bc07e339e4081bc31ecc19ed38ad8a86c90ff937
    }
  }

  const toggleDose = (medId: string, i: number) => {
    setMeds(prev => prev.map(m => {
      if (m.id !== medId) return m
<<<<<<< HEAD
      const times = m.times.map((t,j) => j===i ? {...t, taken:!t.taken, takenAt: !t.taken ? nowTime() : undefined} : t)
      const wasNowTaken = !m.times[i].taken
      addLog(m.name, wasNowTaken ? 'taken' : 'missed')
      return {...m, times}
    }))
  }

  // ── MEDICINE SEARCH (RxNorm API - free, no key needed) ───
  const searchMedicine = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchRes([]); return }
    setSearchLoad(true)
    try {
      const res = await fetch(
        `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`
      )
      const data = await res.json()
      const suggs: string[] = data?.suggestionGroup?.suggestionList?.suggestion || []
      // Also do an approximateTerm search for more results
      const res2 = await fetch(
        `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=6`
      )
      const data2 = await res2.json()
      const approx: string[] = (data2?.approximateGroup?.candidate || []).map((c:any) => c.name).filter(Boolean)
      const combined = [...new Set([...suggs, ...approx])].slice(0, 10)
      setSearchRes(combined)
    } catch {
      setSearchRes([])
    }
    setSearchLoad(false)
  }, [])

  const handleMedSearchChange = (v: string) => {
    setMedSearch(v)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => searchMedicine(v), 380)
  }

  const selectMed = (name: string) => {
    setNewMed(p => ({...p, name}))
    setMedSearch(name)
    setSearchRes([])
  }

  const addMedication = () => {
    if (!newMed.name || !newMed.dosage || newTimes.length === 0) return
    const med: Medication = {
      id: uid(),
      name: newMed.name, dosage: newMed.dosage,
      times: newTimes.map(t => ({time: t, taken: false})),
      notes: newMed.notes,
      alertIfMissed: newMed.alertIfMissed,
    }
    setMeds(p => [...p, med])
    setAlerts(p => [{ id:uid(), message:`✅ New medication added: ${med.name} ${med.dosage}`, time:nowTime(), type:'success' }, ...p])
    setNewMed({ name:'', dosage:'', notes:'', alertIfMissed:true })
    setNewTimes(['08:00'])
    setMedSearch('')
    setShowAdd(false)
  }

  const removeMed = (id: string) => {
    const m = meds.find(x=>x.id===id)
    setMeds(p => p.filter(x=>x.id!==id))
    if (m) setAlerts(p => [{id:uid(), message:`🗑️ Removed: ${m.name}`, time:nowTime(), type:'info'}, ...p])
  }

  const addTimeSlot = () => {
    if (!timeInput || newTimes.includes(timeInput)) return
    setNewTimes(p => [...p, timeInput].sort())
    setTimeInput('')
  }

  // ── COMPUTED ─────────────────────────────────────────────
  const allDoses    = meds.flatMap(m => m.times)
  const takenCount  = allDoses.filter(d => d.taken).length
  const adherence   = allDoses.length ? Math.round((takenCount / allDoses.length) * 100) : 0
  const warnings    = alerts.filter(a => a.type === 'warning').length
  const micState    = listening ? 'is-listening' : processing ? 'is-processing' : ''
  const t           = L[lang].ui

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="app">

      {/* ══ HEADER ══ */}
      <header className="hdr">
        <div className="hdr-in">
          <div className="logo">
            <span className="logo-ico">💊</span>
            <div>
              <div className="logo-name">MedAssist</div>
              <div className="logo-sub">Voice-Driven Medication Helper</div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button className={`mode-btn ${mode==='patient'?'active':''}`} onClick={() => setMode('patient')}>{t.patientMode}</button>
            <button className={`mode-btn ${mode==='caretaker'?'active':''}`} onClick={() => setMode('caretaker')}>{t.caretakerMode}</button>
          </div>

          <div className="hdr-right">
            <div className="hdr-clock">
              <span className="clock-big">{clock}</span>
              <span className="clock-date">{date}</span>
            </div>
            <div className="lang-bar">
              {(Object.keys(L) as LangKey[]).map(k => (
                <button key={k} className={`lang-btn ${lang===k?'active':''}`} onClick={() => setLang(k)}>
                  {L[k].flag} {L[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <div className="hero">
        <h1>
          {mode === 'patient'
            ? (lang==='hi' ? 'आपका व्यक्तिगत दवाई सहायक' : lang==='es' ? 'Tu Asistente Personal de Medicamentos' : lang==='it' ? 'Il Tuo Assistente Personale per i Farmaci' : 'Your Personal Medication Companion')
            : 'Caretaker Dashboard — Full Control'}
        </h1>
        <p>
          {mode === 'patient'
            ? (lang==='hi' ? 'हर दिन, हर खुराक — आपकी देखभाल के साथ।' : lang==='es' ? 'Cada día, cada dosis — con cuidado y compasión.' : lang==='it' ? 'Ogni giorno, ogni dose — con cura e compassione.' : 'Every day, every dose — helping you stay safe and healthy.')
            : 'Manage medications, schedules, alerts, and patient information.'}
        </p>
      </div>

      {/* ══ STATS ══ */}
      <div className="stats">
        <div className="stats-in">
          <div className="stat"><span className="stat-n">{meds.length}</span><span className="stat-l">Medications</span></div>
          <div className="stat"><span className={`stat-n ${adherence<60?'red':adherence<80?'amber':''}`}>{adherence}%</span><span className="stat-l">Adherence Today</span></div>
          <div className="stat"><span className="stat-n">{takenCount}</span><span className="stat-l">Doses Taken</span></div>
          <div className="stat"><span className={`stat-n ${warnings>0?'red':''}`}>{warnings}</span><span className="stat-l">Missed Alerts</span></div>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="tabs-wrap">
        <div className="tabs-in">
          {mode === 'patient' ? (
            (['voice','medications','logs','alerts'] as Tab[]).map(tb => (
              <button key={tb} className={`tab-btn ${tab===tb?'on':''}`} onClick={() => setTab(tb)}>
                {tb==='voice'?t.tabVoice:tb==='medications'?t.tabMeds:tb==='logs'?t.tabLogs:t.tabAlerts}
                {tb==='alerts' && warnings>0 && <span className="tbadge">{warnings}</span>}
              </button>
            ))
          ) : (
            (['medicines','logs','alerts','settings'] as CTTab[]).map(tb => (
              <button key={tb} className={`tab-btn ${ctTab===tb?'on':''}`} onClick={() => setCtTab(tb)}>
                {tb==='medicines'?'💊 Medicines':tb==='logs'?'📋 Logs':tb==='alerts'?'🔔 Alerts':'⚙️ Settings'}
                {tb==='alerts' && warnings>0 && <span className="tbadge">{warnings}</span>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div className="main">
        <div className="main-in">

          {/* ─────────────── PATIENT MODE ─────────────── */}
          {mode === 'patient' && (<>

            {/* VOICE TAB */}
            {tab === 'voice' && (
              <div className="voice-grid">

                {/* Mic card */}
                <div className="card">
                  <div className="card-body">
                    <div className="card-title">🎙️ {t.speakTitle}</div>
                    <p className="card-desc">{t.speakDesc}</p>

                    {!voiceOk && !micDenied && (
                      <div className="voice-warn">{t.micWarn}</div>
                    )}
                    {micDenied && (
                      <div className="voice-warn">{t.micDenied}</div>
                    )}

                    <div className="mic-wrap">
                      <div className="mic-ring">
                        {listening && <><div className="pring"/><div className="pring"/><div className="pring"/></>}
                        <button
                          className={`mic-btn ${micState}`}
                          onClick={listening ? stopListening : startListening}
                          disabled={processing}
                          aria-label="Press to speak"
                        >
                          {listening ? '🔴' : processing ? '⏳' : '🎙️'}
                        </button>
                      </div>
                      <p className={`mic-lbl ${micState}`}>
                        {listening ? t.listening : processing ? t.thinking : t.tapToSpeak}
                      </p>
                      <p className="mic-tip">
                        {listening ? (lang==='hi'?'साफ़ और धीरे बोलें':lang==='es'?'Habla claro y despacio':lang==='it'?'Parla chiaramente':'Speak clearly at a normal pace')
                          : (lang==='hi'?'अपनी दवाओं के बारे में कुछ भी पूछें':lang==='es'?'Pregunta lo que quieras sobre tus medicamentos':lang==='it'?'Chiedi qualsiasi cosa sui tuoi farmaci':'Ask me anything about your medications')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Conversation card */}
                <div className="card">
                  <div className="card-body">
                    <div className="card-title">💬 {t.convTitle}</div>
                    <p className="card-desc">{t.convDesc}</p>
                    <div>
                      {transcript && (
                        <div className="sbox sbox-you">
                          <span className="sbox-who">{t.youSaid}</span>
                          <p className="sbox-text">{transcript}</p>
                        </div>
                      )}
                      {response && (
                        <div className="sbox sbox-ai">
                          <span className="sbox-who">{t.assistantSays}</span>
                          <p className="sbox-text">{response}</p>
                          <button className="replay-btn" onClick={() => speak(response)}>
                            {t.readAloud}
                          </button>
                        </div>
                      )}
                      {!transcript && !response && (
                        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)',fontSize:'16px'}}>
                          {lang==='hi'?'आपकी बातचीत यहां दिखेगी…':lang==='es'?'Tu conversación aparecerá aquí…':lang==='it'?'La tua conversazione apparirà qui…':'Your conversation will appear here…'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick phrases */}
                <div className="card voice-full">
                  <div className="card-body">
                    <div className="card-title">⚡ {t.quickQ}</div>
                    <p className="card-desc">{t.quickDesc}</p>
                    <div className="phrases">
                      {L[lang].quick.map(q => (
                        <button key={q} className="phrase-btn" onClick={() => { setTranscript(q); askClaude(q) }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MEDICATIONS TAB - Patient */}
            {tab === 'medications' && (
              <div>
                <div className="sh">
                  <span className="sh-title">{t.myMeds}</span>
                </div>
                <div className="med-grid">
                  {meds.map(med => (
                    <div key={med.id} className="med-card">
                      <div className="med-left">
                        <div className="med-ico">💊</div>
                        <div>
                          <div className="med-name">{med.name}</div>
                          <span className="med-dose-badge">{med.dosage}</span>
                          {med.notes && <div className="med-notes">📝 {med.notes}</div>}
                        </div>
                      </div>
                      <div className="dose-chips">
                        {med.times.map((dt,i) => (
                          <div key={i} className="dose-chip">
                            <span className="dose-time">⏰ {dt.time}</span>
                            <button className={`dose-take ${dt.taken?'done':''}`} onClick={() => toggleDose(med.id,i)}>
                              {dt.taken ? `✅ Taken ${dt.takenAt||''}` : lang==='hi'?'ली हुई बताएं':lang==='es'?'Marcar tomado':lang==='it'?'Segna preso':'Mark as Taken'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LOGS TAB */}
            {tab === 'logs' && (
              <div>
                <div className="sh"><span className="sh-title">{t.myLog}</span></div>
                {logs.length === 0
                  ? <div className="empty-state"><span>📋</span>{t.noLogs}</div>
                  : <div className="log-list">
                      {logs.map(l => (
                        <div key={l.id} className={`log-item ${l.status}`}>
                          <div className="log-ico">{l.status==='taken'?'✅':'❌'}</div>
                          <div className="log-info">
                            <div className="log-med">{l.medication}</div>
                            <div className="log-when">{l.time}</div>
                          </div>
                          <span className={`log-pill ${l.status}`}>{l.status}</span>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* ALERTS TAB */}
            {tab === 'alerts' && (
              <div>
                <div className="sh"><span className="sh-title">{t.myAlerts}</span></div>
                {alerts.length === 0
                  ? <div className="empty-state"><span>✅</span>{t.noAlerts}</div>
                  : <div className="alert-list">
                      {alerts.map(a => (
                        <div key={a.id} className={`alert-item ${a.type}`}>
                          <div className="alert-ico">{a.type==='warning'?'⚠️':a.type==='success'?'✅':'ℹ️'}</div>
                          <div>
                            <div className="alert-msg">{a.message}</div>
                            <div className="alert-when">{a.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}
          </>)}

          {/* ─────────────── CARETAKER MODE ─────────────── */}
          {mode === 'caretaker' && (<>

            {/* MEDICINES TAB */}
            {ctTab === 'medicines' && (
              <div>
                <div className="sh">
                  <span className="sh-title">💊 Manage Medications</span>
                  <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
                    {showAdd ? '✕ Cancel' : '+ Add Medication'}
                  </button>
                </div>

                {showAdd && (
                  <div className="ct-form">
                    <h3 style={{fontFamily:"'Fraunces',serif",fontSize:20,color:'var(--green)',marginBottom:20}}>
                      ➕ Add New Medication
                    </h3>

                    {/* Medicine search */}
                    <div className="form-row one">
                      <div className="fg">
                        <label>Search Medicine (powered by RxNorm / NIH database)</label>
                        <div className="med-search-wrap">
                          <span className="search-ico">🔍</span>
                          <input
                            className="med-search"
                            placeholder="Search any medicine in the world…"
                            value={medSearch}
                            onChange={e => handleMedSearchChange(e.target.value)}
                            onBlur={() => setTimeout(() => setSearchRes([]), 200)}
                          />
                          {(searchRes.length > 0 || searchLoad) && (
                            <div className="search-drop">
                              {searchLoad && <div className="search-loading">🔍 Searching…</div>}
                              {searchRes.map(s => (
                                <div key={s} className="search-item" onMouseDown={() => selectMed(s)}>
                                  💊 {s}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="fg">
                        <label>Medication Name *</label>
                        <input placeholder="e.g. Metformin" value={newMed.name} onChange={e => setNewMed({...newMed, name:e.target.value})} />
                      </div>
                      <div className="fg">
                        <label>Dosage *</label>
                        <input placeholder="e.g. 500mg or 1 tablet" value={newMed.dosage} onChange={e => setNewMed({...newMed, dosage:e.target.value})} />
                      </div>
                    </div>

                    <div className="form-row one">
                      <div className="fg">
                        <label>Notes for Patient</label>
                        <textarea placeholder="e.g. Take with food, avoid alcohol, store in cool place…" value={newMed.notes} onChange={e => setNewMed({...newMed, notes:e.target.value})} />
                      </div>
                    </div>

                    {/* Time slots */}
                    <div className="fg" style={{marginBottom:16}}>
                      <label>Dose Times * (add one or more)</label>
                      <div className="time-slots">
                        {newTimes.map(ti => (
                          <div key={ti} className="time-slot">
                            ⏰ {ti}
                            <button onClick={() => setNewTimes(p => p.filter(x=>x!==ti))}>✕</button>
                          </div>
                        ))}
                      </div>
                      <div className="add-time-row">
                        <input type="time" className="time-inp" value={timeInput} onChange={e => setTimeInput(e.target.value)} />
                        <button className="btn-ghost" onClick={addTimeSlot}>+ Add Time</button>
                      </div>
                    </div>

                    {/* Alert toggle */}
                    <div className="toggle-row" style={{marginBottom:20}}>
                      <div>
                        <div className="toggle-lbl">🔔 Alert if dose is missed</div>
                        <div className="toggle-sub">Caretaker will be notified if patient doesn't mark this medicine as taken</div>
                      </div>
                      <button
                        className={`toggle ${newMed.alertIfMissed?'on':''}`}
                        onClick={() => setNewMed(p => ({...p, alertIfMissed:!p.alertIfMissed}))}
                        aria-label="Toggle alert"
                      />
                    </div>

                    <button className="btn-primary" onClick={addMedication}>
                      ✅ Add Medication
                    </button>
                  </div>
                )}

                {/* Medicine list */}
                <div className="med-grid">
                  {meds.map(med => (
                    <div key={med.id} className="ct-med-card">
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                          <span style={{fontSize:28}}>💊</span>
                          <div>
                            <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:'var(--text)'}}>{med.name}</div>
                            <div style={{fontSize:14,color:'var(--text3)',marginTop:2}}>{med.dosage}</div>
                          </div>
                        </div>
                        <div className="ct-med-badges">
                          {med.times.map((dt,i) => (
                            <span key={i} className={`ct-badge ${dt.taken?'green':'amber'}`}>
                              ⏰ {dt.time} {dt.taken ? `✓ ${dt.takenAt||''}` : '— Pending'}
                            </span>
                          ))}
                          {med.alertIfMissed && <span className="ct-badge red">🔔 Alert if missed</span>}
                          {med.notes && <span className="ct-badge blue">📝 Has notes</span>}
                        </div>
                        {med.notes && (
                          <div style={{marginTop:10,fontSize:14,color:'var(--text3)',fontStyle:'italic',background:'var(--surface2)',padding:'8px 14px',borderRadius:8}}>
                            📝 {med.notes}
                          </div>
                        )}
                      </div>
                      <div className="ct-actions">
                        <button className="btn-danger" onClick={() => removeMed(med.id)}>🗑️ Remove</button>
                      </div>
                    </div>
                  ))}
                  {meds.length === 0 && (
                    <div className="empty-state"><span>💊</span>No medications added yet. Click "Add Medication" to get started.</div>
                  )}
                </div>
              </div>
            )}

            {/* LOGS TAB - Caretaker */}
            {ctTab === 'logs' && (
              <div>
                <div className="sh"><span className="sh-title">📋 Adherence Log</span></div>
                {logs.length === 0
                  ? <div className="empty-state"><span>📋</span>No logs yet. Patient must mark medicines as taken to start logging.</div>
                  : <div className="log-list">
                      {logs.map(l => (
                        <div key={l.id} className={`log-item ${l.status}`}>
                          <div className="log-ico">{l.status==='taken'?'✅':'❌'}</div>
                          <div className="log-info">
                            <div className="log-med">{l.medication}</div>
                            <div className="log-when">{l.time}</div>
                          </div>
                          <span className={`log-pill ${l.status}`}>{l.status}</span>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* ALERTS TAB - Caretaker */}
            {ctTab === 'alerts' && (
              <div>
                <div className="sh">
                  <span className="sh-title">🔔 Caretaker Alerts</span>
                  {alerts.length > 0 && (
                    <button className="btn-ghost" onClick={() => setAlerts([])}>Clear All</button>
                  )}
                </div>
                {alerts.length === 0
                  ? <div className="empty-state"><span>✅</span>No alerts. Patient is taking all medications on time!</div>
                  : <div className="alert-list">
                      {alerts.map(a => (
                        <div key={a.id} className={`alert-item ${a.type}`}>
                          <div className="alert-ico">{a.type==='warning'?'⚠️':a.type==='success'?'✅':'ℹ️'}</div>
                          <div style={{flex:1}}>
                            <div className="alert-msg">{a.message}</div>
                            <div className="alert-when">{a.time}</div>
                          </div>
                          <button className="btn-ghost" onClick={() => setAlerts(p=>p.filter(x=>x.id!==a.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* SETTINGS TAB */}
            {ctTab === 'settings' && (
              <div className="ct-grid">
                <div className="card ct-full">
                  <div className="card-body">
                    <div className="card-title">⚙️ Patient Information</div>
                    <p className="card-desc">Set patient details to personalize the voice assistant's responses.</p>
                    <div className="form-row">
                      <div className="fg">
                        <label>Patient Name</label>
                        <input placeholder="e.g. Ramesh Kumar" value={patientInfo.name} onChange={e => setPatientInfo(p=>({...p,name:e.target.value}))} />
                      </div>
                      <div className="fg">
                        <label>Age</label>
                        <input placeholder="e.g. 72" value={patientInfo.age} onChange={e => setPatientInfo(p=>({...p,age:e.target.value}))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="fg">
                        <label>Primary Condition</label>
                        <input placeholder="e.g. Type 2 Diabetes, Hypertension" value={patientInfo.condition} onChange={e => setPatientInfo(p=>({...p,condition:e.target.value}))} />
                      </div>
                      <div className="fg">
                        <label>Emergency Contact</label>
                        <input placeholder="e.g. +91 98765 43210" value={patientInfo.emergency} onChange={e => setPatientInfo(p=>({...p,emergency:e.target.value}))} />
                      </div>
                    </div>
                    {patientInfo.name && (
                      <div style={{background:'var(--green-ll)',padding:'16px 20px',borderRadius:'var(--radius-sm)',marginTop:12,fontSize:15,color:'var(--green)',fontWeight:600}}>
                        ✅ Patient profile saved! The voice assistant will now address {patientInfo.name} by name.
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="card-title">📊 Today's Summary</div>
                    <div style={{display:'flex',flexDirection:'column',gap:14,marginTop:8}}>
                      {[
                        { l:'Total Medications', v: meds.length, icon:'💊' },
                        { l:'Total Doses Today', v: allDoses.length, icon:'📅' },
                        { l:'Doses Taken', v: takenCount, icon:'✅' },
                        { l:'Doses Pending', v: allDoses.length - takenCount, icon:'⏳' },
                        { l:'Adherence Rate', v: `${adherence}%`, icon:'📈' },
                        { l:'Active Alerts', v: warnings, icon:'🔔' },
                      ].map(row => (
                        <div key={row.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'var(--surface2)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                          <span style={{fontSize:15,color:'var(--text2)',fontWeight:600}}>{row.icon} {row.l}</span>
                          <span style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:'var(--green)'}}>{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="card-title">🌐 Voice Language Info</div>
                    <p style={{fontSize:15,color:'var(--text3)',marginBottom:16,lineHeight:1.6}}>
                      The patient's voice interface is currently set to <strong>{L[lang].label}</strong>. Switch languages using the buttons in the header — this changes the entire UI, voice responses, and quick questions.
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {(Object.keys(L) as LangKey[]).map(k => (
                        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:lang===k?'var(--green-ll)':'var(--surface2)',borderRadius:'var(--radius-sm)',border:`1.5px solid ${lang===k?'var(--green)':'var(--border)'}`}}>
                          <span style={{fontSize:16,fontWeight:700}}>{L[k].flag} {L[k].label}</span>
                          <span style={{fontSize:13,color:'var(--text3)'}}>{L[k].code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="footer">
        <div className="footer-main">
          <div className="ft-brand">
            <div className="ft-logo"><span>💊</span><span>MedAssist</span></div>
            <p className="ft-about">
              A compassionate, voice-driven medication assistant designed for elderly patients with serious conditions. Built with care at a healthcare hackathon to help people live safer, healthier lives.
            </p>
            <div className="ft-socials">
              <a className="soc" title="Twitter / X" href="https://twitter.com" target="_blank" rel="noreferrer">𝕏</a>
              <a className="soc" title="Facebook" href="https://facebook.com" target="_blank" rel="noreferrer">f</a>
              <a className="soc" title="LinkedIn" href="https://linkedin.com" target="_blank" rel="noreferrer">in</a>
              <a className="soc" title="GitHub" href="https://github.com" target="_blank" rel="noreferrer">⌥</a>
              <a className="soc" title="YouTube" href="https://youtube.com" target="_blank" rel="noreferrer">▶</a>
            </div>
          </div>
          <div className="ft-col">
            <h4>Features</h4>
            <ul>
              <li><a onClick={() => { setMode('patient'); setTab('voice') }}>🎙️ Voice Assistant</a></li>
              <li><a onClick={() => { setMode('patient'); setTab('medications') }}>💊 Medication Tracker</a></li>
              <li><a onClick={() => { setMode('patient'); setTab('logs') }}>📋 Adherence Logs</a></li>
              <li><a onClick={() => { setMode('caretaker'); setCtTab('medicines') }}>👨‍⚕️ Caretaker Dashboard</a></li>
              <li><a onClick={() => { setMode('caretaker'); setCtTab('settings') }}>⚙️ Patient Settings</a></li>
            </ul>
          </div>
          <div className="ft-col">
            <h4>Languages</h4>
            <ul>
              <li><a onClick={() => setLang('en')}>🇺🇸 English</a></li>
              <li><a onClick={() => setLang('hi')}>🇮🇳 हिंदी</a></li>
              <li><a onClick={() => setLang('es')}>🇪🇸 Español</a></li>
              <li><a onClick={() => setLang('it')}>🇮🇹 Italiano</a></li>
            </ul>
          </div>
          <div className="ft-col">
            <h4>Support & Legal</h4>
            <ul>
              <li><a onClick={() => setModal('help')}>❓ Help Center</a></li>
              <li><a onClick={() => setModal('contact')}>📬 Contact Us</a></li>
              <li><a onClick={() => setModal('accessibility')}>♿ Accessibility</a></li>
              <li><a onClick={() => setModal('privacy')}>🔒 Privacy Policy</a></li>
              <li><a onClick={() => setModal('terms')}>📄 Terms of Use</a></li>
              <li><a onClick={() => setModal('disclaimer')}>⚕️ Medical Disclaimer</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-btm">
          <span className="ft-copy">© {new Date().getFullYear()} MedAssist. All rights reserved. Built with ❤️ for elderly care.</span>
          <div className="ft-legal">
            <a onClick={() => setModal('privacy')}>Privacy</a>
            <a onClick={() => setModal('terms')}>Terms</a>
            <a onClick={() => setModal('disclaimer')}>Medical Disclaimer</a>
            <a onClick={() => setModal('contact')}>Contact</a>
          </div>
          <span className="ft-clock">🕐 {clock} — {date}</span>
        </div>
      </footer>

      {/* ══ MODAL ══ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setModal(null) }}>
          <div className="modal">
            <div className="modal-hdr">
              <h2>{MODALS[modal].title}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">{MODALS[modal].body}</div>
          </div>
        </div>
      )}

    </div>
  )
}
=======
      const taken = [...m.taken]
      taken[i]    = !taken[i]
      addLog(m.name, taken[i] ? 'taken' : 'missed')
      return { ...m, taken }
    }))
  }

  const addMedication = () => {
    if (!newMed.name || !newMed.dosage || !newMed.time) return
    const med: Medication = {
      id: Date.now().toString(),
      name: newMed.name,
      dosage: newMed.dosage,
      times: [newMed.time],
      taken: [false],
    }
    setMeds(p => [...p, med])
    setAlerts(p => [{
      id: Date.now().toString(),
      message: `New medication added: ${med.name} ${med.dosage}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
    }, ...p])
    setNewMed({ name: '', dosage: '', time: '' })
    setShowAdd(false)
  }

  // ── COMPUTED ─────────────────────────────────────────
  const allDoses   = meds.flatMap(m => m.taken)
  const takenCount = allDoses.filter(Boolean).length
  const adherence  = allDoses.length > 0 ? Math.round((takenCount / allDoses.length) * 100) : 0
  const warnings   = alerts.filter(a => a.type === 'warning').length

  // Quick phrases per language
  const quickPhrases: Record<LangKey, string[]> = {
    en: ['What medications do I have?', 'I took my Metformin', 'When is my next dose?', 'Side effects of Aspirin?'],
    hi: ['मेरी कौन सी दवाएं हैं?', 'मैंने Metformin ली', 'अगली खुराक कब है?', 'Aspirin के दुष्प्रभाव?'],
    es: ['¿Qué medicamentos tengo?', 'Tomé mi Metformina', '¿Cuándo es mi próxima dosis?', '¿Efectos de la Aspirina?'],
    it: ['Quali farmaci ho?', 'Ho preso la Metformina', 'Quando è la prossima dose?', 'Effetti collaterali Aspirina?'],
  }

  // ── RENDER ────────────────────────────────────────────
  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">💊</span>
            <span className="logo-text">MedAssist</span>
          </div>
          <span className="tagline">Voice-Driven Medication Helper</span>
        </div>
        <div className="lang-selector">
          {(Object.entries(LANGUAGES) as [LangKey, typeof LANGUAGES[LangKey]][]).map(([key, l]) => (
            <button
              key={key}
              className={`lang-btn ${lang === key ? 'active' : ''}`}
              onClick={() => setLang(key)}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* STATS */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{meds.length}</span>
          <span className="stat-label">Medications</span>
        </div>
        <div className="stat">
          <span className="stat-value">{adherence}%</span>
          <span className="stat-label">Adherence</span>
        </div>
        <div className="stat">
          <span className="stat-value">{logs.length}</span>
          <span className="stat-label">Logged</span>
        </div>
        <div className="stat">
          <span className={`stat-value ${warnings > 0 ? 'alert' : ''}`}>{warnings}</span>
          <span className="stat-label">Alerts</span>
        </div>
      </div>

      {/* TABS */}
      <nav className="tabs">
        {(['voice', 'medications', 'logs', 'alerts'] as TabType[]).map(t => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'voice'       && '🎙️ '}
            {t === 'medications' && '💊 '}
            {t === 'logs'        && '📋 '}
            {t === 'alerts'      && '🔔 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'alerts' && warnings > 0 && <span className="badge">{warnings}</span>}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className="main">

        {/* ── VOICE TAB ── */}
        {tab === 'voice' && (
          <div className="voice-section">
            <div className="voice-card">
              <h2>🎙️ Voice Assistant</h2>
              <p className="voice-hint">
                Speak naturally about your medications. Currently in <strong>{LANGUAGES[lang].label}</strong>.
              </p>

              <div className="mic-container">
                <button
                  className={`mic-btn ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  aria-label="Microphone"
                >
                  <span className="mic-icon">
                    {isListening ? '🔴' : isProcessing ? '⏳' : '🎙️'}
                  </span>
                  {isListening && <div className="pulse-ring" />}
                  {isListening && <div className="pulse-ring pulse-ring-2" />}
                </button>
                <p className="mic-status">
                  {isListening   ? 'Listening… Tap to stop'
                  : isProcessing ? 'Processing…'
                  : 'Tap to speak'}
                </p>
              </div>

              {transcript && (
                <div className="transcript-box">
                  <span className="transcript-label">You said</span>
                  <p>{transcript}</p>
                </div>
              )}

              {aiResponse && (
                <div className="response-box">
                  <span className="response-label">MedAssist</span>
                  <p>{aiResponse}</p>
                  <button className="replay-btn" onClick={() => speak(aiResponse)}>
                    🔊 Replay
                  </button>
                </div>
              )}

              <div className="quick-phrases">
                <p className="quick-label">Quick phrases</p>
                <div className="phrases">
                  {quickPhrases[lang].map(phrase => (
                    <button key={phrase} className="phrase-btn" onClick={() => {
                      setTranscript(phrase)
                      handleVoiceInput(phrase)
                    }}>
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MEDICATIONS TAB ── */}
        {tab === 'medications' && (
          <div className="medications-section">
            <div className="section-header">
              <h2>💊 My Medications</h2>
              <button className="add-btn" onClick={() => setShowAdd(!showAdd)}>
                {showAdd ? '✕ Cancel' : '+ Add'}
              </button>
            </div>

            {showAdd && (
              <div className="add-med-form">
                <input
                  placeholder="Medication name"
                  value={newMed.name}
                  onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                />
                <input
                  placeholder="Dosage (e.g. 500mg)"
                  value={newMed.dosage}
                  onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                />
                <input
                  type="time"
                  value={newMed.time}
                  onChange={e => setNewMed({ ...newMed, time: e.target.value })}
                />
                <button onClick={addMedication}>Add</button>
              </div>
            )}

            <div className="med-list">
              {meds.map(med => (
                <div key={med.id} className="med-card">
                  <div className="med-info">
                    <span className="med-name">{med.name}</span>
                    <span className="med-dosage">{med.dosage}</span>
                  </div>
                  <div className="med-doses">
                    {med.times.map((time, i) => (
                      <div key={i} className="dose-item">
                        <span className="dose-time">⏰ {time}</span>
                        <button
                          className={`dose-btn ${med.taken[i] ? 'taken' : ''}`}
                          onClick={() => toggleDose(med.id, i)}
                        >
                          {med.taken[i] ? '✓ Taken' : 'Mark Taken'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab === 'logs' && (
          <div className="logs-section">
            <h2>📋 Adherence Log</h2>
            {logs.length === 0
              ? <div className="empty-state"><p>📋 No logs yet. Mark medications as taken to start tracking.</p></div>
              : (
                <div className="log-list">
                  {logs.map(log => (
                    <div key={log.id} className={`log-item ${log.status}`}>
                      <div className="log-icon">{log.status === 'taken' ? '✅' : '❌'}</div>
                      <div className="log-details">
                        <span className="log-med">{log.medication}</span>
                        <span className="log-time">{log.time}</span>
                      </div>
                      <span className={`log-status ${log.status}`}>{log.status}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div className="alerts-section">
            <h2>🔔 Caregiver Alerts</h2>
            {alerts.length === 0
              ? <div className="empty-state"><p>🔔 No alerts. Everything is on track!</p></div>
              : (
                <div className="alert-list">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`alert-item ${alert.type}`}>
                      <div className="alert-icon">{alert.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
                      <div className="alert-details">
                        <span className="alert-msg">{alert.message}</span>
                        <span className="alert-time">{alert.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </main>
    </div>
  )
}
```

---

## 📁 FILE 4: Create a `.env` file in your **project root** (same level as `package.json`)
```
VITE_ANTHROPIC_API_KEY=your_actual_api_key_here
>>>>>>> bc07e339e4081bc31ecc19ed38ad8a86c90ff937
