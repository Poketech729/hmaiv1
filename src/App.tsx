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
    }))
  }

  const addLog = (medication: string, status: 'taken' | 'missed') => {
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
    }
  }

  const toggleDose = (medId: string, i: number) => {
    setMeds(prev => prev.map(m => {
      if (m.id !== medId) return m
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
