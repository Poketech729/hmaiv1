import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ══════════ TYPES ══════════
interface DoseTime { time:string; taken:boolean; takenAt?:string }
interface Med      { id:string; name:string; dosage:string; times:DoseTime[]; notes:string; alert:boolean }
interface MedLog   { id:string; med:string; time:string; status:'taken'|'missed' }
interface Alert    { id:string; msg:string; time:string; type:'warning'|'info'|'success' }
interface Patient  { name:string; age:string; condition:string; phone:string }
interface Report   { id:string; fileName:string; size:number; at:string; raw:string; risk:string; notes:string; dataUrl:string; mime:string }
interface Msg      { id:string; role:'user'|'ai'; text:string; time:string }

type Mode  = 'patient'|'caretaker'
type PTab  = 'voice'|'meds'|'logs'|'alerts'|'report'
type CTab  = 'meds'|'reports'|'logs'|'alerts'|'settings'
type LK    = 'en'|'hi'|'es'|'it'
type MKey  = 'privacy'|'terms'|'disclaimer'|'contact'|'help'|'accessibility'|null

// ══════════ LANGS ══════════
const L = {
  en:{code:'en-US',bcp:'en',flag:'🇺🇸',label:'English',
    greeting:"Hello! I'm MedAssist, your caring companion. Ask me about your medicines, tell me you've taken a dose, or ask about side effects. I'm always here! 💊",
    ui:{tap:'Tap to Speak',listening:'Listening… tap to stop',thinking:'Thinking…',
      youSaid:'👤 You said',aiSays:'💊 MedAssist',readAgain:'🔊 Read Again',
      patient:'🧓 Patient',caretaker:'👨‍⚕️ Caretaker',
      micWarn:'Voice requires Google Chrome or Edge on desktop.',
      micDenied:'Microphone blocked. Click the 🔒 lock icon in your browser bar → allow microphone → refresh page.',
      noSR:'Your browser does not support voice recognition. Please use Google Chrome.',
    },
    quick:["What medicines do I have?","I took my morning medicine","Side effects of Aspirin?","When is my next dose?","I feel dizzy — is it my medicine?","Can I take Metformin with food?"],
  },
  hi:{code:'hi-IN',bcp:'hi',flag:'🇮🇳',label:'हिंदी',
    greeting:'नमस्ते! मैं MedAssist हूं। दवाओं के बारे में पूछें या बताएं कि आपने दवा ली। मैं हमेशा यहां हूं! 💊',
    ui:{tap:'बोलने के लिए दबाएं',listening:'सुन रहा हूं… रोकने के लिए दबाएं',thinking:'सोच रहा हूं…',
      youSaid:'👤 आपने कहा',aiSays:'💊 MedAssist',readAgain:'🔊 फिर सुनें',
      patient:'🧓 मरीज़',caretaker:'👨‍⚕️ देखभालकर्ता',
      micWarn:'Google Chrome में माइक्रोफोन उपयोग करें।',
      micDenied:'माइक्रोफोन बंद है। ब्राउज़र में 🔒 दबाएं → माइक्रोफोन दें → पेज रीफ्रेश करें।',
      noSR:'आपका ब्राउज़र आवाज़ नहीं पहचानता। Google Chrome उपयोग करें।',
    },
    quick:['आज मेरी कौन सी दवाएं हैं?','मैंने सुबह की दवा ली','Aspirin के दुष्प्रभाव?','अगली खुराक कब है?','मुझे चक्कर आ रहे हैं','Metformin खाने के साथ लें?'],
  },
  es:{code:'es-ES',bcp:'es',flag:'🇪🇸',label:'Español',
    greeting:'¡Hola! Soy MedAssist, tu asistente de medicamentos. ¡Pregúntame sobre tus medicinas o dime que tomaste una dosis! 💊',
    ui:{tap:'Toca para hablar',listening:'Escuchando… toca para detener',thinking:'Pensando…',
      youSaid:'👤 Dijiste',aiSays:'💊 MedAssist',readAgain:'🔊 Leer de nuevo',
      patient:'🧓 Paciente',caretaker:'👨‍⚕️ Cuidador',
      micWarn:'Las funciones de voz requieren Google Chrome o Edge.',
      micDenied:'Micrófono bloqueado. Toca 🔒 en la barra del navegador → permitir micrófono → actualizar.',
      noSR:'Tu navegador no soporta reconocimiento de voz. Usa Google Chrome.',
    },
    quick:['¿Qué medicamentos tengo?','Tomé mi medicina de la mañana','¿Efectos secundarios de la Aspirina?','¿Cuándo es mi próxima dosis?','Me siento mareado','¿Puedo tomar Metformina con comida?'],
  },
  it:{code:'it-IT',bcp:'it',flag:'🇮🇹',label:'Italiano',
    greeting:'Ciao! Sono MedAssist, il tuo assistente per i farmaci. Chiedimi dei tuoi farmaci o dimmi che hai preso una dose! 💊',
    ui:{tap:'Tocca per parlare',listening:'Ascolto… tocca per fermare',thinking:'Sto pensando…',
      youSaid:'👤 Hai detto',aiSays:'💊 MedAssist',readAgain:'🔊 Leggi ancora',
      patient:'🧓 Paziente',caretaker:'👨‍⚕️ Badante',
      micWarn:'Le funzioni vocali richiedono Google Chrome o Edge.',
      micDenied:'Microfono bloccato. Clicca 🔒 nella barra → consenti microfono → aggiorna pagina.',
      noSR:'Il tuo browser non supporta il riconoscimento vocale. Usa Google Chrome.',
    },
    quick:['Quali farmaci ho?','Ho preso la medicina del mattino','Effetti collaterali Aspirina?','Quando è la prossima dose?','Mi sento stordito','Metformina con il cibo?'],
  },
} as const

// ══════════ SAMPLE MEDS ══════════
const INIT_MEDS: Med[] = [
  {id:'1',name:'Metformin',  dosage:'500mg', times:[{time:'08:00',taken:false},{time:'20:00',taken:false}], notes:'Take with meals to avoid nausea', alert:true},
  {id:'2',name:'Amlodipine', dosage:'5mg',   times:[{time:'09:00',taken:false}],                            notes:'For blood pressure — once daily',  alert:true},
  {id:'3',name:'Aspirin',    dosage:'75mg',  times:[{time:'08:00',taken:false}],                            notes:'After breakfast with water',        alert:false},
]

// ══════════ MODAL CONTENT ══════════
const MODALS: Record<NonNullable<MKey>,{title:string;body:JSX.Element}> = {
  privacy:{title:'🔒 Privacy Policy',body:<><p>MedAssist is committed to your privacy. All data lives only in your browser session — nothing is stored on any external server.</p><h3>Your Data</h3><p>Medication lists, logs, and patient info exist only in memory and clear when you close the tab.</p><h3>Voice</h3><p>Voice uses your browser's built-in Web Speech API. On Chrome, brief audio may pass through Google for recognition.</p><h3>Reports</h3><p>Blood reports are sent to Anthropic's Claude API for analysis only — not stored by MedAssist.</p></>},
  terms:{title:'📄 Terms of Use',body:<><p>By using MedAssist you agree to these terms.</p><h3>Purpose</h3><p>MedAssist is a demonstration tool built at a healthcare hackathon.</p><h3>Not Medical Advice</h3><p>MedAssist does not provide medical advice. Always consult a qualified healthcare professional.</p><h3>Liability</h3><p>MedAssist accepts no liability for harm from using this application.</p></>},
  disclaimer:{title:'⚕️ Medical Disclaimer',body:<><p><strong>Read carefully before use.</strong></p><h3>Not a Medical Device</h3><p>MedAssist is not a licensed medical device. It is an AI reminder and information tool for demonstration only.</p><h3>Consult Your Doctor</h3><p>Never start, stop, or change medication based on MedAssist responses.</p><h3>Emergencies</h3><p>In a medical emergency call: 911 (USA) · 999 (UK) · 112 (Europe) · 102 (India).</p><h3>Blood Report Analysis</h3><p>AI analysis of blood reports is informational only and cannot replace professional diagnosis.</p></>},
  contact:{title:'📬 Contact Us',body:<><h3>📧 General</h3><p><strong>support@medassist.health</strong> — 24hr reply</p><h3>🐛 Bugs</h3><p><strong>bugs@medassist.health</strong></p><h3>🤝 Partnerships</h3><p><strong>partnerships@medassist.health</strong></p><h3>💡 Ideas</h3><p><strong>ideas@medassist.health</strong> — Built with ❤️ at a healthcare hackathon.</p></>},
  help:{title:'❓ Help Center',body:<><h3>🎙️ Voice Assistant</h3><p>Tap the big glowing mic button. Your browser asks for mic permission — click Allow. Then speak naturally. Must use Google Chrome or Edge. If mic doesn't respond after allowing, refresh the page.</p><h3>🔇 Mute</h3><p>The speaker icon in the header mutes all voice responses. The AI still replies in text.</p><h3>🌐 Language</h3><p>Tap any flag in the header to switch language. Everything changes — UI, voice, quick questions.</p><h3>💊 Mark Medicine Taken</h3><p>In Medicines tab tap "Mark as Taken". Or tell the voice "I took my [medicine name]" and it auto-checks it.</p><h3>🩸 Blood Report</h3><p>Upload a blood test PDF or image. Enter key values if you have them. AI analyzes against age-appropriate normal ranges and tells you if you need to see a doctor.</p><h3>💬 Chat Widget</h3><p>The floating button bottom-right opens an AI chat where you can ask anything, anytime.</p></>},
  accessibility:{title:'♿ Accessibility',body:<><p>MedAssist is designed for elderly and differently-abled users.</p><h3>Large Text & Targets</h3><p>Minimum 15px font, large buttons for users with reduced motor control.</p><h3>Voice Control</h3><p>Entire patient interface can be used by voice alone in 4 languages.</p><h3>High Contrast</h3><p>Dark theme with high-contrast colors designed for visual accessibility.</p><h3>Contact</h3><p>For additional support: <strong>access@medassist.health</strong></p></>},
}

// ══════════ HELPERS ══════════
const p2 = (n:number) => String(n).padStart(2,'0')
const nowT = () => new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
const tickT = () => {const d=new Date();return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`}
const dateStr = () => new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2)
const KEY = () => (import.meta.env.VITE_ANTHROPIC_API_KEY as string)||''

async function claude(system:string, content:unknown, maxT=400):Promise<string> {
  const key = KEY()
  if (!key) {
    console.error('ERROR: VITE_ANTHROPIC_API_KEY is not set. Please set your API key in .env file')
    return ''
  }
  const r = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:maxT,system,messages:[{role:'user',content}]}),
  })
  if (!r.ok) {
    console.error(`API Error: ${r.status} ${r.statusText}`)
    const errText = await r.text()
    console.error('Response:', errText)
    return ''
  }
  const d = await r.json()
  const text = d.content?.[0]?.text ?? ''
  if (!text) {
    console.warn('API returned empty response. Check your API key and quota.')
  }
  return text
}

// ══════════ TTS ENGINE ══════════
// Finds the best available voice for a language
function pickVoice(voices:SpeechSynthesisVoice[], langCode:string, langBcp:string):SpeechSynthesisVoice|null {
  if (!voices || voices.length === 0) return null
  
  // Try exact match first (e.g., en-US, hi-IN)
  let v = voices.find(v=>v.lang.toLowerCase() === langCode.toLowerCase())
  if (v) return v
  
  // Try BCP code match (e.g., hi, en, es) — case insensitive
  v = voices.find(v=>v.lang.toLowerCase().startsWith(langBcp.toLowerCase()))
  if (v) return v
  
  // For Hindi specifically, try variations
  if (langBcp === 'hi') {
    v = voices.find(v=>{
      const l = v.lang.toLowerCase()
      return l.includes('hindi') || (l.startsWith('hi') && !l.startsWith('hong'))
    })
    if (v) return v
  }
  
  // For Spanish, try any es variant
  if (langBcp === 'es') {
    v = voices.find(v=>v.lang.toLowerCase().startsWith('es'))
    if (v) return v
  }
  
  // Last resort: just use first voice available
  return voices[0]
}

// ══════════ APP ══════════
export default function App() {
  const [mode,setMode]  = useState<Mode>('patient')
  const [lang,setLang]  = useState<LK>('en')
  const [ptab,setPtab]  = useState<PTab>('voice')
  const [ctab,setCtab]  = useState<CTab>('meds')
  const [meds,setMeds]  = useState<Med[]>(INIT_MEDS)
  const [logs,setLogs]  = useState<MedLog[]>([])
  const [alerts,setAlerts] = useState<Alert[]>([])
  const [patient,setPatient] = useState<Patient>({name:'',age:'',condition:'',phone:''})
  const [reports,setReports] = useState<Report[]>([])
  const [modal,setModal] = useState<MKey>(null)
  const [clock,setClock] = useState(tickT())
  const [date]           = useState(dateStr())
  const [muted,setMuted] = useState(false)

  // Voice state
  const [listening,setListening] = useState(false)
  const [proc,setProc]     = useState(false)
  const [transcript,setTranscript] = useState('')
  const [interim,setInterim] = useState('')
  const [response,setResponse] = useState('')
  const [micErr,setMicErr]   = useState<''|'denied'|'nosupport'>('')

  // Report state
  const [repFile,setRepFile] = useState<File|null>(null)
  const [repB64,setRepB64]   = useState('')
  const [repMime,setRepMime] = useState('')
  const [repDataUrl,setRepDataUrl] = useState('')
  const [analyzing,setAnalyzing] = useState(false)
  const [drag,setDrag]       = useState(false)
  // Blood params manual input
  const [bloodAge,setBloodAge] = useState('')
  const [bloodVals,setBloodVals] = useState({hb:'',wbc:'',rbc:'',platelets:'',glucose:'',hba1c:'',cholesterol:'',hdl:'',ldl:'',triglycerides:'',creatinine:'',urea:'',sgpt:'',tsh:''})

  // Chat
  const [chatOpen,setChatOpen] = useState(false)
  const [chatMsgs,setChatMsgs] = useState<Msg[]>([{id:uid(),role:'ai',text:"Hi! I'm MedAssist AI. Ask me anything about your medications, health, or this app. 💊",time:nowT()}])
  const [chatIn,setChatIn]     = useState('')
  const [chatLoad,setChatLoad] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Caretaker
  const [showAdd,setShowAdd] = useState(false)
  const [medQ,setMedQ]       = useState('')
  const [srRes,setSrRes]     = useState<string[]>([])
  const [srLoad,setSrLoad]   = useState(false)
  const [newM,setNewM]       = useState({name:'',dosage:'',notes:'',alert:true})
  const [newTimes,setNewTimes] = useState<string[]>(['08:00'])
  const [timeInp,setTimeInp]  = useState('')

  // Refs — these never go stale in callbacks
  const mutedR    = useRef(false)
  const langR     = useRef<LK>('en')
  const respR     = useRef('')
  const listeningR= useRef(false)
  const recR      = useRef<any>(null)
  const voicesR   = useRef<SpeechSynthesisVoice[]>([])
  const debR      = useRef<ReturnType<typeof setTimeout>|null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const speakingNowR = useRef(false) // Track if TTS is active

  // Keep refs in sync
  useEffect(()=>{ mutedR.current = muted },[muted])
  useEffect(()=>{ langR.current = lang },[lang])
  useEffect(()=>{ respR.current = response },[response])

  // ── CLOCK ──
  useEffect(()=>{
    const t = setInterval(()=>setClock(tickT()),1000)
    return ()=>clearInterval(t)
  },[])

  // ── LOAD VOICES (poll until available) ──
  useEffect(()=>{
    const load = () => { voicesR.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.onvoiceschanged = load
    // Chrome loads voices asynchronously
    const t1=setTimeout(load,300)
    const t2=setTimeout(load,1000)
    const t3=setTimeout(load,3000)
    return ()=>{ clearTimeout(t1);clearTimeout(t2);clearTimeout(t3) }
  },[])

  // ── SPEAK — Simple, clean, no feedback loop ──
  const speak = useCallback((text:string, lk?:LK)=>{
    // NEVER speak if no valid text
    if (!text || !text.trim()) return
    if (mutedR.current) return
    if (speakingNowR.current) return // Prevent overlapping
    
    // Cancel any existing speech
    window.speechSynthesis.cancel()
    
    const key = lk ?? langR.current
    const cfg = L[key]
    const utt = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(voicesR.current, cfg.code, cfg.bcp)
    if (voice) utt.voice = voice
    utt.lang   = cfg.code
    
    // ACCENT SETTINGS FOR EACH LANGUAGE
    if (key === 'hi') {
      utt.rate   = 0.75  // Slower for Hindi
      utt.pitch  = 1.2   // Slightly higher pitch
    } else if (key === 'es') {
      utt.rate   = 0.85
      utt.pitch  = 1.05
    } else if (key === 'it') {
      utt.rate   = 0.85
      utt.pitch  = 1.04
    } else {
      utt.rate   = 0.90  // English slightly slower
      utt.pitch  = 1.0
    }
    
    utt.volume = 0.95
    
    speakingNowR.current = true
    utt.onend = () => {
      speakingNowR.current = false
    }
    utt.onerror = () => {
      speakingNowR.current = false
    }
    
    // Queue it
    window.speechSynthesis.speak(utt)
  },[mutedR])
  
  // Cancel speech when mute is toggled
  useEffect(()=>{
    if (muted) {
      window.speechSynthesis.cancel()
    }
  },[muted])
  
  // Set greeting text ONLY - NEVER auto-speak
  useEffect(()=>{
    const g = L[lang].greeting
    setResponse(g)
    setTranscript('')
    setInterim('')
    // DO NOT call speak() - voice should stay silent on load and language change
  },[lang])

  // ── MIC START — Single-result mode (NOT continuous) ──
  const startMic = async () => {
    if (listening||proc) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setMicErr('nosupport'); return }

    // Step 1: explicitly request permission → shows browser dialog
    try {
      const s = await navigator.mediaDevices.getUserMedia({audio:true})
      s.getTracks().forEach(t=>t.stop()) // release immediately, we only needed permission
    } catch {
      setMicErr('denied')
      return
    }

    // Step 2: stop any current TTS completely
    window.speechSynthesis.cancel()
    speakingNowR.current = false

    // Step 3: build fresh SpeechRecognition SINGLE-RESULT MODE (no continuous mode!)
    const rec = new SR()
    rec.lang           = L[langR.current].code
    rec.continuous     = false  // CRITICAL: Single result only, then stops
    rec.interimResults = true

    rec.onresult = (e:any) => {
      let fin='', inr=''
      for (let i=0;i<e.results.length;i++){
        if (e.results[i].isFinal) fin += e.results[i][0].transcript
        else inr += e.results[i][0].transcript
      }
      // Show live interim text
      if (inr) setInterim(inr)
      // On final result, process it
      if (fin.trim()) {
        setTranscript(fin.trim())
        setInterim('')
        // Stop mic after getting result
        listeningR.current = false
        setListening(false)
        // Now ask Claude
        askClaude(fin.trim(), langR.current)
      }
    }

    rec.onerror = (e:any) => {
      setListening(false); listeningR.current=false
      if (e.error==='not-allowed'||e.error==='permission-denied') {
        setMicErr('denied')
      }
    }

    rec.onend = () => {
      // Don't auto-restart — user clicks mic again
      if (listeningR.current) {
        // User still has mic on, so restart it
        try { rec.start() } catch {}
      } else {
        setListening(false)
        setInterim('')
      }
    }

    recR.current = rec
    listeningR.current = true
    setListening(true)
    setTranscript('')
    setInterim('')
    setMicErr('')
    try { rec.start() } catch { setListening(false); listeningR.current=false }
  }

  const stopMic = () => {
    listeningR.current = false
    setListening(false)
    setInterim('')
    try { recR.current?.stop() } catch {}
    window.speechSynthesis.cancel()
    speakingNowR.current = false
  }

  // ── CLAUDE VOICE ──
  const askClaude = async (text:string, lk:LK=langR.current) => {
    setProc(true)
    setMicErr('')
    const ml = meds.map(m=>`${m.name} ${m.dosage} at ${m.times.map(t=>t.time).join(' & ')}`).join('; ')
    const sys = `You are MedAssist, a warm compassionate voice assistant for elderly patients.
Many have serious conditions: Alzheimer's, diabetes, cancer, heart disease. Treat every user like a beloved grandparent.
Patient medications: ${ml}.
${patient.name?`Patient: ${patient.name}, age ${patient.age}, condition: ${patient.condition}.`:''}
STRICT RULES:
1. RESPOND ONLY IN ${L[lk].label}. Not one word of any other language.
2. MAX 2-3 short simple sentences. No medical jargon.
3. Be warm, gentle, patient.
4. If they say they took a medicine, end your reply (on its own line) with: MARK_TAKEN:[medicine name]`
    try {
      let r = await claude(sys, text, 280)
      if (r.includes('MARK_TAKEN:')) {
        const n = r.split('MARK_TAKEN:')[1].trim().split(/[\n\r]/)[0]
        autoMark(n)
        r = r.replace(/MARK_TAKEN:[^\n\r]*/g,'').trim()
      }
      // Make sure we have a valid response from Claude
      if (r && r.trim().length > 0 && r.toLowerCase() !== 'undefined') {
        setResponse(r)
        speak(r, lk)
      } else {
        // If API fails or returns empty, provide helpful response based on context
        const userText = text.toLowerCase()
        let fallback = {en:'I heard you. How can I help?',hi:'मैंने आपको सुना। मैं कैसे मदद कर सकता हूँ?',es:'Te escuché. ¿Cómo puedo ayudar?',it:'Ti ho sentito. Come posso aiutare?'}[lk]
        
        // Smart fallback based on input
        if (userText.includes('medicine') || userText.includes('tablet') || userText.includes('दवा')) {
          fallback = {en:'Tell me which medicine you took.',hi:'बताइए कौन सी दवा ली।',es:'Dime qué medicina tomaste.',it:'Dimmi quale medicina hai preso.'}[lk]
        } else if (userText.includes('took') || userText.includes('ली') || userText.includes('tomé')) {
          fallback = {en:'Great! I marked it down for you.',hi:'बहुत अच्छा! मैंने इसे नोट कर दिया।',es:'¡Excelente! Lo anotí.',it:'Ottimo! L\'ho registrato.'}[lk]
        } else if (userText.includes('side effect') || userText.includes('साइड')) {
          fallback = {en:'Tell me more about how you feel.',hi:'अपनी तकलीफ सुनाइए।',es:'Cuéntame más sobre cómo te sientes.',it:'Tell me come ti senti.'}[lk]
        }
        
        setResponse(fallback)
        speak(fallback, lk)
      }
    } catch (err) {
      const e={en:'Sorry, connection issue. Please try again.',hi:'माफ करें, फिर कोशिश करें।',es:'Lo siento, inténtalo de nuevo.',it:'Mi dispiace, riprova.'}[lk]
      setResponse(e); speak(e,lk)
    }
    setProc(false)
  }

  // ── AUTO MARK ──
  const autoMark = (name:string) => {
    setMeds(p=>p.map(m=>{
      if (!m.name.toLowerCase().includes(name.toLowerCase())) return m
      const times=m.times.map((t,i)=>(!t.taken&&i===m.times.findIndex(x=>!x.taken))?{...t,taken:true,takenAt:nowT()}:t)
      if(JSON.stringify(times)!==JSON.stringify(m.times)) addLog(m.name,'taken')
      return {...m,times}
    }))
  }

  const addLog = (med:string, status:'taken'|'missed') => {
    setLogs(p=>[{id:uid(),med,time:nowT(),status},...p].slice(0,50))
    if(status==='missed'&&meds.find(m=>m.name===med)?.alert) {
      const alertType: 'warning'|'info'|'success' = 'warning'
      setAlerts(p=>[{id:uid(),msg:`⚠️ Missed dose: ${med}`,time:nowT(),type:alertType},...p].slice(0,40))
    }
  }

  const toggleDose = (medId:string, i:number) => {
    setMeds(p=>p.map(m=>{
      if(m.id!==medId) return m
      const times=m.times.map((t,j)=>j===i?{...t,taken:!t.taken,takenAt:!t.taken?nowT():undefined}:t)
      addLog(m.name,!m.times[i].taken?'taken':'missed')
      return {...m,times}
    }))
  }

  // ── BLOOD REPORT ──
  const handleFile = (file:File) => {
    if(!file) return
    setRepFile(file)
    setRepMime(file.type)
    const reader = new FileReader()
    reader.onload = ()=>{
      const du = reader.result as string
      setRepDataUrl(du)
      setRepB64(du.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const analyzeBlood = async () => {
    setAnalyzing(true)
    const age = bloodAge ? parseInt(bloodAge) : (patient.age ? parseInt(patient.age) : 0)
    // Build normal ranges based on age
    const ageGroup = age < 18 ? 'child' : age < 65 ? 'adult' : 'elderly'
    const manualVals = Object.entries(bloodVals).filter(([,v])=>v.trim()).map(([k,v])=>`${k}: ${v}`).join(', ')

    let imageBlock: object | null = null
    if (repB64 && repMime) {
      imageBlock = repMime.startsWith('image/')
        ? {type:'image',source:{type:'base64',media_type:repMime,data:repB64}}
        : {type:'document',source:{type:'base64',media_type:'application/pdf',data:repB64}}
    }

    const sys = `You are a HARSH medical analyzer for blood tests. Age: ${age} years (${ageGroup}).
${patient.name ? `Patient: ${patient.name}, condition: ${patient.condition}.` : ''}

MANDATORY RESPONSE FORMAT - COPY THIS EXACTLY:

RISK_LEVEL: WRITE_HERE_ONE_WORD_ONLY
RISK_MSG: Write one sentence summary here
DOCTOR: Write one of these EXACTLY: "Not needed" or "Within a week" or "Today - urgent"

SUMMARY:
Write 2-3 sentences here

ABNORMAL:
- Item 1
- Item 2

NORMAL:
- Item 1
- Item 2

ADVICE:
- Action 1
- Action 2

RULES YOU MUST FOLLOW:
1. RISK_LEVEL LINE 1 - WRITE EXACTLY: SAFE or WARNING or URGENT (capital letters)
2. If ANY value is abnormal → must be WARNING or URGENT
3. If ANY value is life-threatening or critical → must be URGENT
4. DEFAULT TO URGENT if unsure - do NOT default to SAFE
5. If there are abnormal values, RISK_LEVEL CANNOT be SAFE
6. Copy the format EXACTLY or your response fails
7. Start with "RISK_LEVEL:" on line 1`

    try {
      const contentArr: object[] = []
      if (imageBlock) contentArr.push(imageBlock)
      if (manualVals) contentArr.push({type:'text',text:`Manual values entered: ${manualVals}`})
      contentArr.push({type:'text',text:'Analyze this blood test report.'})

      const raw = await claude(sys, contentArr, 1000)
      const newRpt:Report = {
        id:uid(), fileName:repFile?.name||'Blood Report', size:repFile?.size||0,
        at:nowT(), raw, risk:parseR(raw).level, notes:'', dataUrl:repDataUrl, mime:repMime,
      }
      setReports(p=>[newRpt,...p])
      const alertType: 'warning'|'info'|'success' = newRpt.risk==='URGENT'?'warning':'info'
      setAlerts(p=>[{id:uid(),msg:`📊 New blood report: Risk ${newRpt.risk}`,time:nowT(),type:alertType},...p])
      // Switch to show result
      setRepFile(null); setRepB64(''); setRepDataUrl('')
    } catch {
      setAlerts(p=>[{id:uid(),msg:'Report analysis failed. Check API key.',time:nowT(),type:'warning'},...p])
    }
    setAnalyzing(false)
  }

  const parseR = (raw:string) => {
    // Extract RISK_LEVEL - match any capitalization
    let levelMatch = raw.match(/RISK_LEVEL:\s*([A-Za-z_]+)/i)
    let level = 'SAFE'
    
    if (levelMatch) {
      const extracted = levelMatch[1].toUpperCase().trim()
      if (extracted === 'SAFE') {
        level = 'SAFE'
      } else if (extracted === 'WARNING') {
        level = 'WARNING'
      } else if (extracted === 'URGENT') {
        level = 'URGENT'
      }
    }
    
    return {
      level: level,
      msg:   raw.match(/RISK_MSG:\s*(.+?)(?=\nDOCTOR:|\n\n|\nRISK|[A-Z_]+:|$)/i)?.[1]?.trim() ?? 'Analysis complete',
      doc:   raw.match(/DOCTOR:\s*(.+?)(?=\nSUMMARY:|\n\n|\n[A-Z_]+:|$)/i)?.[1]?.trim() ?? 'Consult physician',
      sum:   raw.match(/SUMMARY:\n([\s\S]*?)(?=\nABNORMAL:|\nNORMAL:|\n\n|[A-Z_]+:|$)/i)?.[1]?.trim() ?? '',
      abn:   raw.match(/ABNORMAL:\n([\s\S]*?)(?=\nNORMAL:|\nADVICE:|\n\n|[A-Z_]+:|$)/i)?.[1]?.trim() ?? 'None found',
      nor:   raw.match(/NORMAL:\n([\s\S]*?)(?=\nADVICE:|\n\n|[A-Z_]+:|$)/i)?.[1]?.trim() ?? '',
      adv:   raw.match(/ADVICE:\n([\s\S]*?)(?=\n\n|[A-Z_]+:|$)/i)?.[1]?.trim() ?? '',
    }
  }

  // ── MED SEARCH (NIH RxNorm) ──
  const searchMed = useCallback(async (q:string)=>{
    if(q.length<2){setSrRes([]);return}
    setSrLoad(true)
    try {
      const [r1,r2]=await Promise.all([
        fetch(`https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`),
        fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=5`),
      ])
      const d1=await r1.json(), d2=await r2.json()
      const s1:string[]=d1?.suggestionGroup?.suggestionList?.suggestion??[]
      const s2:string[]=(d2?.approximateGroup?.candidate??[]).map((c:any)=>c.name).filter(Boolean)
      setSrRes([...new Set([...s1,...s2])].slice(0,10))
    } catch { setSrRes([]) }
    setSrLoad(false)
  },[])

  const handleMedQ = (v:string) => {
    setMedQ(v)
    if(debR.current) clearTimeout(debR.current)
    debR.current=setTimeout(()=>searchMed(v),380)
  }

  const addMed = () => {
    if(!newM.name||!newM.dosage||!newTimes.length) return
    const m:Med={id:uid(),name:newM.name,dosage:newM.dosage,times:newTimes.map(t=>({time:t,taken:false})),notes:newM.notes,alert:newM.alert}
    setMeds(p=>[...p,m])
    setAlerts(p=>[{id:uid(),msg:`✅ Added: ${m.name} ${m.dosage}`,time:nowT(),type:'success'},...p])
    setNewM({name:'',dosage:'',notes:'',alert:true}); setNewTimes(['08:00']); setMedQ(''); setShowAdd(false)
  }

  const removeMed = (id:string) => {
    const m=meds.find(x=>x.id===id)
    setMeds(p=>p.filter(x=>x.id!==id))
    if(m) setAlerts(p=>[{id:uid(),msg:`🗑️ Removed: ${m.name}`,time:nowT(),type:'info'},...p])
  }

  // ── CHAT ──
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}) },[chatMsgs,chatLoad])

  const sendChat = async () => {
    const txt = chatIn.trim()
    if(!txt||chatLoad) return
    setChatIn('')
    const um:Msg={id:uid(),role:'user',text:txt,time:nowT()}
    setChatMsgs(p=>[...p,um])
    setChatLoad(true)
    const ml=meds.map(m=>`${m.name} ${m.dosage}`).join(', ')
    const sys=`You are MedAssist AI, a helpful warm medical assistant. Keep replies concise (2-4 sentences). Patient medications: ${ml}. ${patient.name?`Patient: ${patient.name}.`:''} Be friendly. Never give dangerous advice.`
    try {
      const r=await claude(sys,txt,280)
      setChatMsgs(p=>[...p,{id:uid(),role:'ai',text:r,time:nowT()}])
    } catch {
      setChatMsgs(p=>[...p,{id:uid(),role:'ai',text:'Sorry, connection issue. Try again.',time:nowT()}])
    }
    setChatLoad(false)
  }

  // ── COMPUTED ──
  const allDoses  = meds.flatMap(m=>m.times)
  const taken     = allDoses.filter(d=>d.taken).length
  const adherence = allDoses.length?Math.round((taken/allDoses.length)*100):0
  const warns     = alerts.filter(a=>a.type==='warning').length
  const mState    = listening?'son':proc?'sproc':''
  const u         = L[lang].ui
  const hasSR     = typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window)

  // ══════════ RENDER ══════════
  return (
    <div className="app">

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-in">
          <div className="logo">
            <div className="logo-ico">💊</div>
            <div>
              <div className="logo-name">MedAssist</div>
              <div className="logo-sub">Voice-Driven Medication Helper</div>
            </div>
          </div>

          <div className="mode-pill">
            <button className={`mode-btn ${mode==='patient'?'on':''}`} onClick={()=>setMode('patient')}>{u.patient}</button>
            <button className={`mode-btn ${mode==='caretaker'?'on':''}`} onClick={()=>setMode('caretaker')}>{u.caretaker}</button>
          </div>

          <div className="hdr-r">
            <div className="clk">
              <span className="clk-t">{clock}</span>
              <span className="clk-d">{date}</span>
            </div>
            <button className={`mute-btn ${muted?'muted':''}`} onClick={()=>{setMuted(m=>!m);if(!muted)window.speechSynthesis.cancel()}} title={muted?'Unmute':'Mute'}>
              {muted?'🔇':'🔊'}
            </button>
            <div className="lang-bar">
              {(Object.keys(L) as LK[]).map(k=>(
                <button key={k} className={`lang-btn ${lang===k?'on':''}`} onClick={()=>setLang(k)}>
                  {L[k].flag} {L[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <div className="hero">
        <div className="hero-in">
          <h1>{mode==='patient'
            ?(lang==='hi'?'आपका व्यक्तिगत दवाई साथी':lang==='es'?'Tu Compañero de Medicamentos':lang==='it'?'Il Tuo Compagno per i Farmaci':'Your Personal Medication Companion')
            :'Caretaker Dashboard — Full Control'}
          </h1>
          <p>{mode==='patient'
            ?(lang==='hi'?'हर दिन, हर खुराक — प्यार और देखभाल के साथ।':lang==='es'?'Cada día, cada dosis — con cuidado.':lang==='it'?'Ogni giorno, ogni dose — con cura.':'Every day, every dose — staying safe and healthy, together.')
            :'Manage medications, review blood reports, configure schedules and alerts.'}
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stats-in">
          <div className="stat t1"><span className={`stat-n cyan`}>{meds.length}</span><span className="stat-l">Medications</span></div>
          <div className="stat t2"><span className={`stat-n ${adherence<60?'rose':adherence<80?'amb':'grn'}`}>{adherence}%</span><span className="stat-l">Adherence</span></div>
          <div className="stat t3"><span className="stat-n grn">{taken}</span><span className="stat-l">Taken Today</span></div>
          <div className="stat t4"><span className={`stat-n ${warns>0?'rose':'grn'}`}>{warns}</span><span className="stat-l">Alerts</span></div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs-wrap">
        <div className="tabs-in">
          {mode==='patient'
            ?(['voice','meds','logs','alerts','report'] as PTab[]).map(t=>(
              <button key={t} className={`tab-btn ${ptab===t?'on':''}`} onClick={()=>setPtab(t)}>
                {t==='voice'?(lang==='hi'?'🎙️ आवाज़':lang==='es'?'🎙️ Voz':lang==='it'?'🎙️ Voce':'🎙️ Voice')
                :t==='meds'?(lang==='hi'?'💊 दवाएं':lang==='es'?'💊 Medicamentos':lang==='it'?'💊 Farmaci':'💊 Medicines')
                :t==='logs'?(lang==='hi'?'📋 रिकॉर्ड':lang==='es'?'📋 Registro':lang==='it'?'📋 Registro':'📋 Log')
                :t==='alerts'?(lang==='hi'?'🔔 अलर्ट':lang==='es'?'🔔 Alertas':lang==='it'?'🔔 Avvisi':'🔔 Alerts')
                :'🩸 Blood Report'}
                {t==='alerts'&&warns>0&&<span className="tbadge">{warns}</span>}
              </button>
            ))
            :(['meds','reports','logs','alerts','settings'] as CTab[]).map(t=>(
              <button key={t} className={`tab-btn ${ctab===t?'on':''}`} onClick={()=>setCtab(t)}>
                {t==='meds'?'💊 Medicines':t==='reports'?`📊 Reports${reports.length?` (${reports.length})`:''}`:t==='logs'?'📋 Logs':t==='alerts'?'🔔 Alerts':'⚙️ Settings'}
                {t==='alerts'&&warns>0&&<span className="tbadge">{warns}</span>}
              </button>
            ))
          }
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="wrap">

          {/* ═══ PATIENT ═══ */}
          {mode==='patient'&&<>

            {/* VOICE */}
            {ptab==='voice'&&(
              <div className="g2">
                {/* Mic card */}
                <div className="card">
                  <div className="stripe cyan"/>
                  <div className="cb">
                    <div className="card-title">🎙️ {u.tap}</div>
                    <p className="card-desc">{lang==='hi'?'नीचे बड़े बटन को दबाएं और बोलें।':lang==='es'?'Toca el botón y habla.':lang==='it'?'Tocca il pulsante e parla.':'Tap the glowing mic and speak naturally.'}</p>

                    {!hasSR&&<div className="voice-warn">⚠️ {u.noSR}</div>}
                    {micErr==='denied'&&<div className="voice-warn">🚫 {u.micDenied}</div>}
                    {micErr===''&&hasSR&&!listening&&!proc&&<div className="voice-warn" style={{fontSize:12,padding:'8px 12px'}}>💡 {u.micWarn}</div>}
                    {muted&&<div className="voice-warn">🔇 {lang==='hi'?'आवाज़ बंद है। ऊपर 🔊 दबाएं।':lang==='es'?'Voz silenciada. Toca 🔊 arriba.':lang==='it'?'Audio disattivato. Tocca 🔊 in alto.':'Voice muted. Tap 🔊 in the header to unmute.'}</div>}

                    <div className="mic-area">
                      <div className="mic-ring">
                        {listening&&<><div className="pring"/><div className="pring"/><div className="pring"/></>}
                        <button className={`mic-btn ${mState}`} onClick={listening?stopMic:startMic} disabled={proc||!hasSR} aria-label="Microphone">
                          {listening?'🔴':proc?'⏳':'🎙️'}
                        </button>
                      </div>
                      <p className={`mic-lbl ${mState}`}>{listening?u.listening:proc?u.thinking:u.tap}</p>
                      <p className="mic-tip">{listening?(lang==='hi'?'साफ़ बोलें':lang==='es'?'Habla claro':lang==='it'?'Parla chiaramente':'Speak clearly — I\'m listening'):(lang==='hi'?'दवाओं के बारे में कुछ भी पूछें':lang==='es'?'Pregunta lo que quieras':lang==='it'?'Chiedi qualsiasi cosa':'Ask me anything about your medicines')}</p>
                    </div>

                    {/* Live interim transcript */}
                    {interim&&<div className="live-t">🎙️ {interim}…</div>}
                  </div>
                </div>

                {/* Response card */}
                <div className="card">
                  <div className="stripe coral"/>
                  <div className="cb">
                    <div className="card-title">💬 {u.aiSays}</div>
                    <p className="card-desc">{lang==='hi'?'आपकी बात और जवाब यहां दिखेगा।':lang==='es'?'Tu mensaje y mi respuesta aparecen aquí.':lang==='it'?'Il tuo messaggio e la mia risposta.':'Your words and my response appear here.'}</p>
                    {transcript&&(
                      <div className="sbox sbox-you">
                        <span className="sbox-who">{u.youSaid}</span>
                        <p className="sbox-text">{transcript}</p>
                      </div>
                    )}
                    {response&&(
                      <div className="sbox sbox-ai">
                        <span className="sbox-who">{u.aiSays}</span>
                        <p className="sbox-text">{response}</p>
                        <button className="btn btn-coral btn-sm" style={{marginTop:10}} onClick={()=>speak(respR.current)} disabled={muted}>
                          {muted?'🔇 Muted':u.readAgain}
                        </button>
                      </div>
                    )}
                    {!transcript&&!response&&<div style={{textAlign:'center',padding:'32px 0',color:'var(--t3)',fontSize:13}}>{lang==='hi'?'बातचीत यहां दिखेगी…':lang==='es'?'La conversación aparecerá aquí…':lang==='it'?'La conversazione apparirà qui…':'Conversation will appear here…'}</div>}
                  </div>
                </div>

                {/* Quick phrases */}
                <div className="card gfull">
                  <div className="stripe purp"/>
                  <div className="cb">
                    <div className="card-title">⚡ {lang==='hi'?'जल्दी प्रश्न':lang==='es'?'Preguntas rápidas':lang==='it'?'Domande rapide':'Quick Questions'}</div>
                    <p className="card-desc">{lang==='hi'?'नीचे कोई भी प्रश्न दबाएं — माइक की ज़रूरत नहीं।':lang==='es'?'Toca cualquier pregunta — sin micrófono.':lang==='it'?'Tocca qualsiasi domanda — senza microfono.':'Tap any question below — no microphone needed.'}</p>
                    <div className="phrases">
                      {L[lang].quick.map(q=>(
                        <button key={q} className="phrase-btn" onClick={()=>{setTranscript(q);askClaude(q)}}>{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MEDICINES — Patient */}
            {ptab==='meds'&&(
              <div>
                <div className="sh"><span className="sh-title">{lang==='hi'?'💊 मेरी दवाएं':lang==='es'?'💊 Mis Medicamentos':lang==='it'?'💊 I Miei Farmaci':'💊 My Medicines'}</span></div>
                <div className="med-list">
                  {meds.map(m=>(
                    <div key={m.id} className="med-card">
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div className="med-ico">💊</div>
                        <div>
                          <div className="med-name">{m.name}</div>
                          <span className="med-badge">{m.dosage}</span>
                          {m.notes&&<div className="med-note">📝 {m.notes}</div>}
                        </div>
                      </div>
                      <div className="dose-chips">
                        {m.times.map((dt,i)=>(
                          <div key={i} className="dose-chip">
                            <span className="dose-t">⏰ {dt.time}</span>
                            <button className={`dose-btn ${dt.taken?'done':''}`} onClick={()=>toggleDose(m.id,i)}>
                              {dt.taken?`✅ ${lang==='hi'?'ली':lang==='es'?'Tomado':lang==='it'?'Preso':'Taken'} ${dt.takenAt??''}`:(lang==='hi'?'ली हुई बताएं':lang==='es'?'Marcar tomado':lang==='it'?'Segna preso':'Mark as Taken')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!meds.length&&<div className="empty-box"><span>💊</span>No medicines added yet.</div>}
                </div>
              </div>
            )}

            {/* LOGS — Patient */}
            {ptab==='logs'&&(
              <div>
                <div className="sh"><span className="sh-title">{lang==='hi'?'📋 दवा रिकॉर्ड':lang==='es'?'📋 Registro':lang==='it'?'📋 Registro':'📋 Adherence Log'}</span></div>
                {!logs.length?<div className="empty-box"><span>📋</span>No logs yet. Mark medicines as taken to start.</div>
                :<div className="log-list">{logs.map(l=>(
                  <div key={l.id} className={`log-item ${l.status}`}>
                    <div className="log-ico">{l.status==='taken'?'✅':'❌'}</div>
                    <div className="log-info"><div className="log-med">{l.med}</div><div className="log-when">{l.time}</div></div>
                    <span className={`log-pill ${l.status}`}>{l.status}</span>
                  </div>
                ))}</div>}
              </div>
            )}

            {/* ALERTS — Patient */}
            {ptab==='alerts'&&(
              <div>
                <div className="sh"><span className="sh-title">{lang==='hi'?'🔔 अलर्ट':lang==='es'?'🔔 Alertas':lang==='it'?'🔔 Avvisi':'🔔 Alerts'}</span></div>
                {!alerts.length?<div className="empty-box"><span>✅</span>{lang==='hi'?'कोई अलर्ट नहीं!':lang==='es'?'¡Sin alertas!':lang==='it'?'Nessun avviso!':'No alerts! Everything is on track.'}</div>
                :<div className="alert-list">{alerts.map(a=>(
                  <div key={a.id} className={`alrt ${a.type}`}>
                    <div className="alrt-ico">{a.type==='warning'?'⚠️':a.type==='success'?'✅':'ℹ️'}</div>
                    <div style={{flex:1}}><div className="alrt-msg">{a.msg}</div><div className="alrt-when">{a.time}</div></div>
                  </div>
                ))}</div>}
              </div>
            )}

            {/* BLOOD REPORT — Patient */}
            {ptab==='report'&&(
              <div>
                <div className="sh"><span className="sh-title">🩸 {lang==='hi'?'खून की जांच विश्लेषण':lang==='es'?'Análisis de Sangre':lang==='it'?'Analisi del Sangue':'Blood Report Analyzer'}</span></div>
                <p style={{color:'var(--t2)',fontSize:13,marginBottom:20,lineHeight:1.6}}>
                  {lang==='hi'?'अपनी खून की जांच रिपोर्ट अपलोड करें। हमारी AI आपकी उम्र के हिसाब से बताएगी कि डॉक्टर के पास जाना जरूरी है या नहीं।':lang==='es'?'Sube tu análisis de sangre. La IA lo analiza según tu edad y dice si necesitas ver un médico.':lang==='it'?'Carica il tuo esame del sangue. L\'AI lo analizza per la tua fascia d\'età.':'Upload your blood test report. AI analyzes it against age-appropriate normal ranges and tells you clearly if you need to see a doctor.'}
                </p>

                {/* Upload zone */}
                {!repFile&&(
                  <div className={`upload-zone ${drag?'drag':''}`} style={{marginBottom:18}}
                    onClick={()=>fileRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();setDrag(true)}}
                    onDragLeave={()=>setDrag(false)}
                    onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0])}}
                  >
                    <div className="upload-content">
                      <span className="upload-ico">🩸</span>
                      <div className="upload-ttl">{lang==='hi'?'खून की जांच यहां अपलोड करें':lang==='es'?'Sube tu análisis de sangre':lang==='it'?'Carica l\'esame del sangue':'Drop your blood test report here'}</div>
                      <p className="upload-sub">{lang==='hi'?'CBC, लिपिड पैनल, HbA1c, LFT, KFT, Thyroid — सब ठीक है':lang==='es'?'CBC, panel lipídico, HbA1c, LFT, KFT, Tiroides':lang==='it'?'CBC, pannello lipidico, HbA1c, LFT, KFT, Tiroide':'CBC, Lipid Panel, HbA1c, LFT, KFT, Thyroid — any blood test'}</p>
                      <button className="btn btn-purp" onClick={e=>{e.stopPropagation();fileRef.current?.click()}}>📎 {lang==='hi'?'फ़ाइल चुनें':lang==='es'?'Elegir archivo':lang==='it'?'Scegli file':'Choose File'}</button>
                      <div className="type-chips">{['PDF','JPG','PNG'].map(t=><span key={t} className="type-chip">.{t}</span>)}</div>
                    </div>
                  </div>
                )}

                {repFile&&!analyzing&&(
                  <div style={{background:'var(--card)',border:'1px solid rgba(139,92,246,.25)',borderRadius:'var(--r)',padding:'18px 22px',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
                    <div style={{fontSize:36}}>{repMime.includes('pdf')?'📄':'🖼️'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:'var(--text)'}}>{repFile.name}</div>
                      <div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>{(repFile.size/1024).toFixed(1)} KB · {repMime}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{setRepFile(null);setRepB64('');setRepDataUrl('')}}>✕ Remove</button>
                  </div>
                )}

                {/* Age input */}
                <div className="blood-form">
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:'var(--cyan)',marginBottom:14}}>
                    📋 Patient Details & Manual Values (optional — helps AI accuracy)
                  </div>
                  <div className="bf-grid" style={{gridTemplateColumns:'1fr 1fr 1fr',marginBottom:14}}>
                    <div className="bf-item">
                      <label>Patient Age</label>
                      <input placeholder="e.g. 68" value={bloodAge} onChange={e=>setBloodAge(e.target.value)} type="number"/>
                    </div>
                    <div className="bf-item">
                      <label>Hemoglobin (Hb)</label>
                      <input placeholder="e.g. 13.5" value={bloodVals.hb} onChange={e=>setBloodVals(p=>({...p,hb:e.target.value}))}/>
                      <span className="unit">g/dL</span>
                    </div>
                    <div className="bf-item">
                      <label>WBC Count</label>
                      <input placeholder="e.g. 7500" value={bloodVals.wbc} onChange={e=>setBloodVals(p=>({...p,wbc:e.target.value}))}/>
                      <span className="unit">cells/μL</span>
                    </div>
                    <div className="bf-item">
                      <label>Platelets</label>
                      <input placeholder="e.g. 230000" value={bloodVals.platelets} onChange={e=>setBloodVals(p=>({...p,platelets:e.target.value}))}/>
                      <span className="unit">/μL</span>
                    </div>
                    <div className="bf-item">
                      <label>Fasting Glucose</label>
                      <input placeholder="e.g. 95" value={bloodVals.glucose} onChange={e=>setBloodVals(p=>({...p,glucose:e.target.value}))}/>
                      <span className="unit">mg/dL</span>
                    </div>
                    <div className="bf-item">
                      <label>HbA1c</label>
                      <input placeholder="e.g. 6.2" value={bloodVals.hba1c} onChange={e=>setBloodVals(p=>({...p,hba1c:e.target.value}))}/>
                      <span className="unit">%</span>
                    </div>
                    <div className="bf-item">
                      <label>Total Cholesterol</label>
                      <input placeholder="e.g. 185" value={bloodVals.cholesterol} onChange={e=>setBloodVals(p=>({...p,cholesterol:e.target.value}))}/>
                      <span className="unit">mg/dL</span>
                    </div>
                    <div className="bf-item">
                      <label>LDL Cholesterol</label>
                      <input placeholder="e.g. 110" value={bloodVals.ldl} onChange={e=>setBloodVals(p=>({...p,ldl:e.target.value}))}/>
                      <span className="unit">mg/dL</span>
                    </div>
                    <div className="bf-item">
                      <label>Creatinine</label>
                      <input placeholder="e.g. 1.0" value={bloodVals.creatinine} onChange={e=>setBloodVals(p=>({...p,creatinine:e.target.value}))}/>
                      <span className="unit">mg/dL</span>
                    </div>
                  </div>
                  <button className="btn btn-purp" onClick={analyzeBlood} disabled={analyzing||(!repFile&&!Object.values(bloodVals).some(v=>v.trim()))}>
                    {analyzing?'⏳ Analyzing…':'🔍 Analyze Blood Report'}
                  </button>
                  {!repFile&&!Object.values(bloodVals).some(v=>v.trim())&&<span style={{marginLeft:12,fontSize:12,color:'var(--t3)'}}>Upload a file or enter at least one value to analyze</span>}
                </div>

                {/* 3D Scanner animation */}
                {analyzing&&(
                  <div className="card" style={{padding:0}}>
                    <div className="scanner-wrap">
                      <div className="scanner-3d">
                        <div className="scanner-face sf-front">🩸</div>
                        <div className="scanner-face sf-back">🧪</div>
                        <div className="scanner-face sf-right">🔬</div>
                        <div className="scanner-face sf-left">💉</div>
                        <div className="scanner-face sf-top">📊</div>
                        <div className="scanner-face sf-bot">🏥</div>
                      </div>
                      <div className="scanner-txt">Analyzing Blood Report…</div>
                      <p className="scanner-sub">AI is checking values against age-appropriate normal ranges. This takes 15–30 seconds.</p>
                      <div className="scan-bar"><div className="scan-fill"/></div>
                    </div>
                  </div>
                )}

                {/* Show latest result */}
                {reports.length>0&&!analyzing&&(()=>{
                  const r=reports[0]
                  const p=parseR(r.raw)
                  const levelUpper = String(p.level).toUpperCase().trim()
                  const rc=levelUpper==='URGENT'?'urgent':levelUpper==='WARNING'?'warning':'safe'
                  const ri=levelUpper==='URGENT'?'🚨':levelUpper==='WARNING'?'⚠️':'✅'
                  const riskLabel = levelUpper==='URGENT'?'Urgent — See Doctor Today':levelUpper==='WARNING'?'Attention Needed':levelUpper==='SAFE'?'Looking Good':'Results Analyzed'
                  return(
                    <div style={{animation:'fadein .4s ease'}}>
                      <div className={`risk-banner ${rc}`}>
                        <div className="risk-ico">{ri}</div>
                        <div>
                          <div className="risk-lbl">{riskLabel}</div>
                          <div className="risk-msg">{p.msg}</div>
                          <div className="risk-sub">👨‍⚕️ Doctor visit: <strong>{p.doc}</strong></div>
                        </div>
                      </div>
                      {p.sum&&<div className="asec"><div className="asec-hdr cyan">📋 Summary</div><div className="asec-body"><p>{p.sum}</p></div></div>}
                      {p.abn&&p.abn!=='None found'&&<div className="asec"><div className="asec-hdr rose">⚠️ Abnormal Values</div><div className="asec-body"><ul>{p.abn.split('\n').filter(Boolean).map((f,i)=><li key={i}>{f.replace(/^[-•*]\s*/,'')}</li>)}</ul></div></div>}
                      {p.nor&&<div className="asec"><div className="asec-hdr grn">✅ Normal Values</div><div className="asec-body"><ul>{p.nor.split('\n').filter(Boolean).map((f,i)=><li key={i}>{f.replace(/^[-•*]\s*/,'')}</li>)}</ul></div></div>}
                      {p.adv&&<div className="asec"><div className="asec-hdr purp">💡 What To Do</div><div className="asec-body"><ul>{p.adv.split('\n').filter(Boolean).map((f,i)=><li key={i}>{f.replace(/^[-•*\d.]\s*/,'')}</li>)}</ul></div></div>}
                      <div className="asec"><div className="asec-hdr amb">⚕️ Disclaimer</div><div className="asec-body"><p>This AI analysis is <strong>for information only</strong> and cannot replace a doctor's diagnosis. Always show your report to your physician.</p></div></div>
                    </div>
                  )
                })()}
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0])}}/>
              </div>
            )}
          </>}

          {/* ═══ CARETAKER ═══ */}
          {mode==='caretaker'&&<>

            {/* CT Hero band */}
            <div className="ct-hero" style={{marginBottom:22}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,background:'linear-gradient(90deg,var(--purpl),var(--cyanl))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                    👨‍⚕️ Caretaker Command Center
                  </div>
                  <p style={{color:'var(--t2)',fontSize:13,marginTop:4}}>
                    {patient.name?`Caring for ${patient.name}${patient.condition?` · ${patient.condition}`:''}`:'Set up patient profile in Settings ↗'}
                  </p>
                </div>
                <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                  {[{l:'Medications',v:meds.length,c:'var(--cyan)'},{l:'Adherence',v:`${adherence}%`,c:adherence<60?'var(--rose)':adherence<80?'var(--amb)':'var(--grn)'},{l:'Reports',v:reports.length,c:'var(--purpl)'},{l:'Alerts',v:warns,c:warns>0?'var(--rose)':'var(--grn)'}].map(s=>(
                    <div key={s.l} style={{textAlign:'center'}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:800,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:'var(--t3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px'}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MEDICINES — CT */}
            {ctab==='meds'&&(
              <div>
                <div className="sh">
                  <span className="sh-title">💊 Manage Medications</span>
                  <button className="btn btn-cyan" onClick={()=>setShowAdd(!showAdd)}>{showAdd?'✕ Cancel':'+ Add Medication'}</button>
                </div>
                {showAdd&&(
                  <div className="ct-form">
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:'var(--cyan)',marginBottom:16}}>➕ Add New Medication</div>
                    <div className="form-row form-1" style={{marginBottom:10}}>
                      <div className="fg">
                        <label>🔍 Search NIH RxNorm Medicine Database (worldwide)</label>
                        <div className="search-wrap">
                          <span className="s-ico">🔍</span>
                          <input className="search-inp" placeholder="Type any medicine name…" value={medQ} onChange={e=>handleMedQ(e.target.value)} onBlur={()=>setTimeout(()=>setSrRes([]),200)}/>
                          {(srRes.length>0||srLoad)&&(
                            <div className="search-drop">
                              {srLoad&&<div className="s-loading">🔍 Searching NIH database…</div>}
                              {srRes.map(s=><div key={s} className="s-opt" onMouseDown={()=>{setNewM(p=>({...p,name:s}));setMedQ(s);setSrRes([])}}>💊 {s}</div>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="fg"><label>Medicine Name *</label><input placeholder="e.g. Metformin" value={newM.name} onChange={e=>setNewM({...newM,name:e.target.value})}/></div>
                      <div className="fg"><label>Dosage *</label><input placeholder="e.g. 500mg" value={newM.dosage} onChange={e=>setNewM({...newM,dosage:e.target.value})}/></div>
                    </div>
                    <div className="form-row form-1">
                      <div className="fg"><label>Notes for Patient</label><textarea placeholder="e.g. Take with food, avoid alcohol, store below 25°C…" value={newM.notes} onChange={e=>setNewM({...newM,notes:e.target.value})}/></div>
                    </div>
                    <div className="fg" style={{marginBottom:10}}>
                      <label>Dose Times *</label>
                      <div className="tslots">{newTimes.map(t=><div key={t} className="tslot">⏰ {t}<button onClick={()=>setNewTimes(p=>p.filter(x=>x!==t))}>✕</button></div>)}</div>
                      <div className="time-row">
                        <input type="time" className="time-inp" value={timeInp} onChange={e=>setTimeInp(e.target.value)}/>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{if(timeInp&&!newTimes.includes(timeInp)){setNewTimes(p=>[...p,timeInp].sort());setTimeInp('')}}}>+ Add Time</button>
                      </div>
                    </div>
                    <div className="toggle-row">
                      <div className="toggle-info">
                        <div className="toggle-lbl">🔔 Alert if dose missed</div>
                        <div className="toggle-sub">Notified when patient doesn't mark this medicine as taken</div>
                      </div>
                      <button className={`toggle ${newM.alert?'on':''}`} onClick={()=>setNewM(p=>({...p,alert:!p.alert}))} aria-label="Toggle alert"/>
                    </div>
                    <button className="btn btn-cyan" onClick={addMed}>✅ Add Medication</button>
                  </div>
                )}
                <div className="med-list">
                  {meds.map(m=>(
                    <div key={m.id} className="ct-card">
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                          <span style={{fontSize:22}}>💊</span>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:'var(--text)'}}>{m.name}</div>
                            <div style={{fontSize:11,color:'var(--t3)'}}>{m.dosage}</div>
                          </div>
                        </div>
                        <div className="ct-chips">
                          {m.times.map((dt,i)=><span key={i} className={`ct-chip ${dt.taken?'grn':'amb'}`}>⏰ {dt.time} {dt.taken?`✓ ${dt.takenAt??''}`:'Pending'}</span>)}
                          {m.alert&&<span className="ct-chip rose">🔔 Alert if missed</span>}
                        </div>
                        {m.notes&&<div style={{marginTop:7,fontSize:11,color:'var(--t3)',fontStyle:'italic',background:'var(--bg2)',padding:'5px 10px',borderRadius:7}}>📝 {m.notes}</div>}
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={()=>removeMed(m.id)}>🗑️</button>
                    </div>
                  ))}
                  {!meds.length&&<div className="empty-box"><span>💊</span>No medications yet. Click "Add Medication" above.</div>}
                </div>
              </div>
            )}

            {/* REPORTS — CT */}
            {ctab==='reports'&&(
              <div>
                <div className="sh"><span className="sh-title">📊 Patient Blood Reports</span></div>
                <p style={{color:'var(--t2)',fontSize:13,marginBottom:18,lineHeight:1.6}}>
                  Blood reports uploaded by the patient appear here. Add your clinical notes to each report. The PDF/image is shown below each report.
                </p>
                {!reports.length
                  ?<div className="empty-box"><span>📊</span>No reports yet. Patient can upload from the Blood Report tab.</div>
                  :reports.map(r=>{
                    const p=parseR(r.raw)
                    const levelUpper = String(p.level).toUpperCase().trim()
                    const rc=levelUpper==='URGENT'?'urgent':levelUpper==='WARNING'?'warning':levelUpper==='SAFE'?'safe':'pending'
                    return(
                      <div key={r.id} className="rpt-card">
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
                          <div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:'var(--text)',marginBottom:3}}>
                              {r.mime.includes('pdf')?'📄':'🖼️'} {r.fileName}
                            </div>
                            <div style={{fontSize:11,color:'var(--t3)'}}>Uploaded {r.at} · {(r.size/1024).toFixed(1)} KB</div>
                          </div>
                          <span className={`rpt-badge ${rc}`}>{String(p.level).toUpperCase()||'Pending'}</span>
                        </div>

                        {p.msg&&(
                          <div style={{background:'var(--bg2)',padding:'9px 13px',borderRadius:'var(--rsm)',fontSize:13,color:'var(--t2)',marginBottom:8,borderLeft:'3px solid var(--cyan)'}}>
                            <strong>AI Summary:</strong> {p.msg}
                            {p.doc&&<span style={{marginLeft:10,color:'var(--cyan)',fontWeight:700}}>· Doctor: {p.doc}</span>}
                          </div>
                        )}

                        {p.abn&&p.abn!=='None found'&&(
                          <div style={{background:'rgba(244,63,94,.06)',border:'1px solid rgba(244,63,94,.2)',borderRadius:'var(--rsm)',padding:'9px 13px',fontSize:12,color:'var(--t2)',marginBottom:8}}>
                            <strong style={{color:'var(--rose)'}}>⚠️ Abnormal values:</strong>
                            <ul style={{paddingLeft:14,marginTop:4}}>{p.abn.split('\n').filter(Boolean).slice(0,5).map((f,i)=><li key={i}>{f.replace(/^[-•*]\s*/,'')}</li>)}</ul>
                          </div>
                        )}

                        {/* Show actual PDF/image */}
                        {r.dataUrl&&(
                          <div className="preview-wrap">
                            {r.mime.startsWith('image/')
                              ?<img src={r.dataUrl} alt="Blood report" style={{width:'100%',maxHeight:420,objectFit:'contain',display:'block'}}/>
                              :<iframe src={r.dataUrl} title="Blood report PDF" style={{width:'100%',height:400,border:'none',display:'block'}}/>
                            }
                          </div>
                        )}

                        <div style={{marginTop:10}}>
                          <label style={{fontSize:10,fontWeight:800,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',display:'block',marginBottom:5}}>📝 Caretaker Clinical Notes</label>
                          <textarea className="notes-area" placeholder="Add clinical observations, follow-up actions, notes for the patient…"
                            value={r.notes} onChange={e=>setReports(prev=>prev.map(x=>x.id===r.id?{...x,notes:e.target.value}:x))}/>
                          {r.notes&&<div style={{marginTop:4,fontSize:11,color:'var(--grn)',fontWeight:600}}>✅ Notes saved</div>}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* LOGS — CT */}
            {ctab==='logs'&&(
              <div>
                <div className="sh"><span className="sh-title">📋 Adherence Log</span></div>
                {!logs.length?<div className="empty-box"><span>📋</span>No logs yet.</div>
                :<div className="log-list">{logs.map(l=>(
                  <div key={l.id} className={`log-item ${l.status}`}>
                    <div className="log-ico">{l.status==='taken'?'✅':'❌'}</div>
                    <div className="log-info"><div className="log-med">{l.med}</div><div className="log-when">{l.time}</div></div>
                    <span className={`log-pill ${l.status}`}>{l.status}</span>
                  </div>
                ))}</div>}
              </div>
            )}

            {/* ALERTS — CT */}
            {ctab==='alerts'&&(
              <div>
                <div className="sh">
                  <span className="sh-title">🔔 Caretaker Alerts</span>
                  {alerts.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>setAlerts([])}>Clear All</button>}
                </div>
                {!alerts.length?<div className="empty-box"><span>✅</span>No alerts. Patient is on track!</div>
                :<div className="alert-list">{alerts.map(a=>(
                  <div key={a.id} className={`alrt ${a.type}`}>
                    <div className="alrt-ico">{a.type==='warning'?'⚠️':a.type==='success'?'✅':'ℹ️'}</div>
                    <div style={{flex:1}}><div className="alrt-msg">{a.msg}</div><div className="alrt-when">{a.time}</div></div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))}>✕</button>
                  </div>
                ))}</div>}
              </div>
            )}

            {/* SETTINGS — CT */}
            {ctab==='settings'&&(
              <div className="g2">
                <div className="card" style={{gridColumn:'1/-1'}}>
                  <div className="stripe purp"/>
                  <div className="cb">
                    <div className="card-title">⚙️ Patient Information</div>
                    <p className="card-desc">Personalizes AI voice responses with the patient's details.</p>
                    <div className="form-row">
                      <div className="fg"><label>Patient Name</label><input placeholder="e.g. Ramesh Kumar" value={patient.name} onChange={e=>setPatient(p=>({...p,name:e.target.value}))}/></div>
                      <div className="fg"><label>Age</label><input placeholder="e.g. 72" value={patient.age} onChange={e=>setPatient(p=>({...p,age:e.target.value}))}/></div>
                    </div>
                    <div className="form-row">
                      <div className="fg"><label>Primary Condition</label><input placeholder="e.g. Type 2 Diabetes, Hypertension" value={patient.condition} onChange={e=>setPatient(p=>({...p,condition:e.target.value}))}/></div>
                      <div className="fg"><label>Emergency Phone</label><input placeholder="e.g. +91 98765 43210" value={patient.phone} onChange={e=>setPatient(p=>({...p,phone:e.target.value}))}/></div>
                    </div>
                    {patient.name&&<div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',padding:'10px 14px',borderRadius:'var(--rsm)',fontSize:13,color:'var(--grn)',fontWeight:600}}>✅ Profile saved. AI will address {patient.name} by name.</div>}
                  </div>
                </div>
                <div className="card">
                  <div className="stripe grn"/>
                  <div className="cb">
                    <div className="card-title">📊 Summary</div>
                    <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
                      {[{k:'Total Medications',v:meds.length},{k:'Total Doses',v:allDoses.length},{k:'Doses Taken',v:taken},{k:'Doses Pending',v:allDoses.length-taken},{k:'Adherence',v:`${adherence}%`},{k:'Reports',v:reports.length},{k:'Active Alerts',v:warns}].map(r=>(
                        <div key={r.k} className="sum-row"><span className="sum-k">{r.k}</span><span className="sum-v">{r.v}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="stripe coral"/>
                  <div className="cb">
                    <div className="card-title">🌐 Languages</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                      {(Object.keys(L) as LK[]).map(k=>(
                        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:lang===k?'rgba(6,182,212,.08)':'var(--bg2)',borderRadius:'var(--rsm)',border:`1px solid ${lang===k?'rgba(6,182,212,.25)':'var(--bdr)'}`,cursor:'pointer',transition:'all .2s'}} onClick={()=>setLang(k)}>
                          <span style={{fontSize:13,fontWeight:700}}>{L[k].flag} {L[k].label}</span>
                          {lang===k&&<span style={{fontSize:10,color:'var(--cyan)',fontWeight:800}}>ACTIVE</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>}

        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-main">
          <div className="ft-brand">
            <div className="ft-logo"><div className="ft-ico">💊</div><span className="ft-logo-name">MedAssist</span></div>
            <p className="ft-about">A compassionate voice-driven medication assistant for elderly patients with serious conditions. Built with ❤️ at a healthcare hackathon.</p>
            <div className="ft-socials">
              <a className="soc" href="https://twitter.com" target="_blank" rel="noreferrer">𝕏</a>
              <a className="soc" href="https://facebook.com" target="_blank" rel="noreferrer">f</a>
              <a className="soc" href="https://linkedin.com" target="_blank" rel="noreferrer">in</a>
              <a className="soc" href="https://github.com" target="_blank" rel="noreferrer">⌥</a>
              <a className="soc" href="https://youtube.com" target="_blank" rel="noreferrer">▶</a>
            </div>
          </div>
          <div className="ft-col">
            <h4>Features</h4>
            <ul>
              <li><a onClick={()=>{setMode('patient');setPtab('voice')}}>🎙️ Voice Assistant</a></li>
              <li><a onClick={()=>{setMode('patient');setPtab('meds')}}>💊 Medicine Tracker</a></li>
              <li><a onClick={()=>{setMode('patient');setPtab('report')}}>🩸 Blood Report AI</a></li>
              <li><a onClick={()=>{setMode('caretaker');setCtab('meds')}}>👨‍⚕️ Caretaker Mode</a></li>
              <li><a onClick={()=>setChatOpen(true)}>💬 AI Chat</a></li>
            </ul>
          </div>
          <div className="ft-col">
            <h4>Languages</h4>
            <ul>
              <li><a onClick={()=>setLang('en')}>🇺🇸 English</a></li>
              <li><a onClick={()=>setLang('hi')}>🇮🇳 हिंदी</a></li>
              <li><a onClick={()=>setLang('es')}>🇪🇸 Español</a></li>
              <li><a onClick={()=>setLang('it')}>🇮🇹 Italiano</a></li>
            </ul>
          </div>
          <div className="ft-col">
            <h4>Legal & Support</h4>
            <ul>
              <li><a onClick={()=>setModal('help')}>❓ Help Center</a></li>
              <li><a onClick={()=>setModal('contact')}>📬 Contact</a></li>
              <li><a onClick={()=>setModal('accessibility')}>♿ Accessibility</a></li>
              <li><a onClick={()=>setModal('privacy')}>🔒 Privacy</a></li>
              <li><a onClick={()=>setModal('terms')}>📄 Terms</a></li>
              <li><a onClick={()=>setModal('disclaimer')}>⚕️ Disclaimer</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-btm">
          <span className="ft-copy">© {new Date().getFullYear()} MedAssist. All rights reserved. Built with ❤️ for elderly care.</span>
          <div className="ft-legal">
            <a onClick={()=>setModal('privacy')}>Privacy</a>
            <a onClick={()=>setModal('terms')}>Terms</a>
            <a onClick={()=>setModal('disclaimer')}>Disclaimer</a>
            <a onClick={()=>setModal('contact')}>Contact</a>
          </div>
          <span className="ft-clk">🕐 {clock} — {date}</span>
        </div>
      </footer>

      {/* FLOATING CHAT */}
      <div className="chat-fab">
        {chatOpen&&(
          <div className="chat-window">
            <div className="chat-hdr">
              <div style={{display:'flex',alignItems:'center',gap:9}}>
                <div className="chat-avatar">💊</div>
                <div>
                  <div className="chat-name">MedAssist AI</div>
                  <div className="chat-status"><div className="online-dot"/>Online — Ask anything</div>
                </div>
              </div>
              <button className="chat-close" onClick={()=>setChatOpen(false)}>✕</button>
            </div>
            <div className="chat-msgs">
              {chatMsgs.map(m=>(
                <div key={m.id} className={`msg ${m.role}`}>
                  <div className="msg-bubble">{m.text}</div>
                  <div className="msg-time">{m.time}</div>
                </div>
              ))}
              {chatLoad&&<div className="msg ai"><div className="chat-typing"><div className="tdot"/><div className="tdot"/><div className="tdot"/></div></div>}
              <div ref={chatEndRef}/>
            </div>
            <div className="chat-inp-row">
              <textarea className="chat-inp" placeholder="Ask about medicines, side effects, doses…" value={chatIn}
                onChange={e=>setChatIn(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}}
                rows={1}/>
              <button className="chat-send" onClick={sendChat} disabled={chatLoad||!chatIn.trim()}>➤</button>
            </div>
          </div>
        )}
        <button className="chat-fab-btn" onClick={()=>setChatOpen(o=>!o)} style={{position:'relative'}} aria-label="Open chat">
          {chatOpen?'✕':'💬'}
        </button>
      </div>

      {/* MODAL */}
      {modal&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div className="modal">
            <div className="modal-hdr">
              <h2>{MODALS[modal].title}</h2>
              <button className="modal-x" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-bd">{MODALS[modal].body}</div>
          </div>
        </div>
      )}
    </div>
  )
}