import { useEffect, useMemo, useState } from 'react'
import { FiMail, FiSmartphone } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { hasSupabaseConfig, supabase, supabaseConfigError } from './lib/supabaseClient'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').trim()

type AuthGateProps = {
  onAuthenticated: () => void
}

type AuthMode = 'signin' | 'signup'
type ProviderStatus = {
  google: boolean
  password: boolean
  emailOtp: boolean
  phoneOtp: boolean
  emailProvider: string
  messageProvider: string
  emailMockMode: boolean
  phoneMockMode: boolean
}

type ContactMode = 'email' | 'phone'

type CountryOption = {
  label: string
  code: string
}

const COUNTRY_OPTIONS: CountryOption[] = [
  { label: 'India', code: '+91' },
  { label: 'United States', code: '+1' },
  { label: 'United Kingdom', code: '+44' },
  { label: 'Canada', code: '+1' },
  { label: 'Australia', code: '+61' },
  { label: 'Spain', code: '+34' },
  { label: 'Italy', code: '+39' },
  { label: 'Germany', code: '+49' },
  { label: 'France', code: '+33' },
  { label: 'United Arab Emirates', code: '+971' },
  { label: 'Saudi Arabia', code: '+966' },
  { label: 'Singapore', code: '+65' },
]

const DEFAULT_PROVIDER_STATUS: ProviderStatus = {
  google: true,
  password: true,
  emailOtp: true,
  phoneOtp: true,
  emailProvider: 'unknown',
  messageProvider: 'unknown',
  emailMockMode: false,
  phoneMockMode: false,
}

async function postJson(path: string, body: unknown) {
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(payload.message || payload.error || 'Something went wrong')
  }

  return payload
}

async function ensureBackendProfile(payload: {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  role: 'patient' | 'doctor'
}) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  await fetch(`${BACKEND_URL}/api/auth/complete-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

function formatSeconds(total: number) {
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [contactMode, setContactMode] = useState<ContactMode>('email')
  const [otpStage, setOtpStage] = useState<'entry' | 'verify'>('entry')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>(DEFAULT_PROVIDER_STATUS)
  const [resendIn, setResendIn] = useState(0)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')

  const contactLabel = useMemo(
    () => (contactMode === 'email' ? email.trim() : `${countryCode} ${phone.trim()}`.trim()),
    [contactMode, email, countryCode, phone],
  )

  const fullPhone = useMemo(() => {
    const digits = phone.replace(/[^\d]/g, '')
    return digits ? `${countryCode}${digits}` : ''
  }, [countryCode, phone])

  useEffect(() => {
    const loadProviderStatus = async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/auth/providers/status`)
        if (!resp.ok) return
        const payload = await resp.json()
        setProviderStatus({ ...DEFAULT_PROVIDER_STATUS, ...payload })
      } catch {
        // ignore
      }
    }

    void loadProviderStatus()
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError(supabaseConfigError)
    }
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const resetMessages = () => {
    setError('')
    setInfo('')
    setDevOtp('')
  }

  const switchAuthMode = (nextMode: AuthMode) => {
    setAuthMode(nextMode)
    setOtpStage('entry')
    setOtpCode('')
    setResendIn(0)
    resetMessages()
  }

  const completeMagicLinkSignIn = (actionLink: string, successMessage: string) => {
    setInfo(successMessage)
    window.location.href = actionLink
  }

  const finishAuthenticatedSession = async () => {
    await ensureBackendProfile({
      firstName: firstName.trim() || 'User',
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: fullPhone || undefined,
      role,
    })
    onAuthenticated()
  }

  const showDevOtp =
    (contactMode === 'email' && providerStatus.emailMockMode) ||
    (contactMode === 'phone' && providerStatus.phoneMockMode)

  const handleGoogleSignIn = async () => {
    resetMessages()
    if (!supabase) {
      setError(supabaseConfigError)
      return
    }
    setLoading(true)
    try {
      const { supabase } = await import('./lib/supabaseClient')
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (googleError) {
        throw googleError
      }
      setInfo('Redirecting to Google sign in...')
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. If Google is enabled in Supabase, also make sure the redirect URL matches this site.`
          : 'Google sign in failed. Check Supabase Google provider setup and redirect URLs.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    resetMessages()
    if (!supabase && contactMode === 'email') {
      setError(supabaseConfigError)
      return
    }
    if (authMode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Please enter your first and last name to create an account.')
        return
      }
    }
    if (contactMode === 'email' && !email.trim()) {
      setError('Please enter your email first.')
      return
    }
    if (contactMode === 'phone' && !phone.trim()) {
      setError('Please enter your mobile number first.')
      return
    }

    setLoading(true)
    try {
      if (contactMode === 'email') {
        const payload =
          authMode === 'signup'
            ? {
                email,
                options: {
                  shouldCreateUser: true,
                  emailRedirectTo: window.location.origin,
                  data: {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    role,
                    phone: fullPhone,
                  },
                },
              }
            : {
                email,
                options: {
                  shouldCreateUser: false,
                  emailRedirectTo: window.location.origin,
                },
              }

        const { error: otpError } = await supabase.auth.signInWithOtp(payload)
        if (otpError) throw otpError
        setInfo(authMode === 'signup' ? 'Email OTP sent. Enter the code from your inbox.' : 'Email OTP sent. Enter the code from your inbox.')
        setOtpStage('verify')
        setResendIn(60)
        return
      }

      const path =
        authMode === 'signup'
          ? '/api/auth/otp/phone/send'
          : '/api/auth/signin/phone-otp/send'
      const payload = await postJson(path, { phone: fullPhone })
      setInfo(payload.message || 'OTP sent successfully.')
      setDevOtp(payload.devOtp || '')
      setOtpStage('verify')
      setResendIn(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    resetMessages()
    if (!supabase && contactMode === 'email') {
      setError(supabaseConfigError)
      return
    }
    if (!otpCode.trim()) {
      setError('Please enter the OTP code.')
      return
    }

    setLoading(true)
    try {
      if (contactMode === 'email') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'email',
        })

        if (verifyError || !data.session) {
          throw verifyError || new Error('Email OTP verification failed.')
        }

        await finishAuthenticatedSession()
        return
      }

      if (authMode === 'signup') {
        const path = '/api/auth/signup/phone-otp'
        const payload = await postJson(
          path,
          { firstName, lastName, email, phone: fullPhone, role, otp: otpCode },
        )
        if (payload.resetLink) {
          completeMagicLinkSignIn(payload.resetLink, 'Account created. Finishing secure setup...')
          return
        }
        setInfo(payload.message || 'Account created successfully. You can sign in now.')
        switchAuthMode('signin')
        return
      }

      const path = '/api/auth/signin/phone-otp/verify'
      const payload = await postJson(path, { phone: fullPhone, otp: otpCode })
      completeMagicLinkSignIn(payload.actionLink, payload.message || 'OTP verified. Completing sign in...')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendIn > 0 || loading) return
    await handleSendOtp()
  }

  return (
    <div className="auth-card traditional-auth">
      <div className="traditional-auth-head">
        <h2>{authMode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <p>{authMode === 'signin' ? 'Access your medication help, caretaker tools, and reports.' : 'Create your account with Google or OTP.'}</p>
      </div>

      <div className="auth-top-switch">
        <span>{authMode === 'signin' ? "Don't have an account?" : 'Already have an account?'}</span>
        <button className="text-btn" onClick={() => switchAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
          {authMode === 'signin' ? 'Register' : 'Sign in'}
        </button>
      </div>

      <div className="social-auth-grid">
        <button className="social-auth-btn" disabled={loading || !providerStatus.google} onClick={() => void handleGoogleSignIn()}>
          <FcGoogle />
          <span>Google</span>
        </button>
      </div>

      <div className="auth-or-divider">
        <span>or continue with OTP</span>
      </div>

      <div className="info" style={{ marginTop: '-6px', marginBottom: '10px' }}>
        {contactMode === 'email'
          ? 'Email OTP is sent using Supabase auth for a more reliable sign-in flow.'
          : providerStatus.phoneMockMode
            ? 'Mobile OTP is in test mode on this machine, so the code is shown below instead of being sent by SMS.'
            : `Mobile OTP will be sent using ${providerStatus.messageProvider}.`}
      </div>

      <div className="otp-choice-row">
        <button className={contactMode === 'email' ? 'otp-choice active' : 'otp-choice'} onClick={() => { setContactMode('email'); setOtpStage('entry'); setOtpCode(''); resetMessages() }}>
          <FiMail />
          <span>Email</span>
        </button>
        <button className={contactMode === 'phone' ? 'otp-choice active' : 'otp-choice'} onClick={() => { setContactMode('phone'); setOtpStage('entry'); setOtpCode(''); resetMessages() }}>
          <FiSmartphone />
          <span>Mobile</span>
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      {contactMode === 'phone' && showDevOtp && devOtp && <p className="info">Test OTP: <strong>{devOtp}</strong></p>}

      <div className="traditional-auth-form">
        {authMode === 'signup' && (
          <>
            <div className="signup-name-row">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={loading || otpStage === 'verify'}
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                disabled={loading || otpStage === 'verify'}
              />
            </div>
            <select value={role} onChange={(event) => setRole(event.target.value as 'patient' | 'doctor')} disabled={loading || otpStage === 'verify'}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </>
        )}

        {contactMode === 'email' ? (
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading || otpStage === 'verify'}
          />
        ) : (
          <div className="phone-field">
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              disabled={loading || otpStage === 'verify'}
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={`${option.label}-${option.code}`} value={option.code}>
                  {option.label} ({option.code})
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Mobile number"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, ''))}
              disabled={loading || otpStage === 'verify'}
            />
          </div>
        )}

        {otpStage === 'verify' && (
          <>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter OTP"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            />
            <div className="otp-inline-meta">
              <span>{contactLabel || 'Contact entered'}</span>
              <button className="text-btn" disabled={resendIn > 0 || loading} onClick={() => void handleResendOtp()}>
                {resendIn > 0 ? `Resend in ${formatSeconds(resendIn)}` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}

        <button className="traditional-submit-btn" disabled={loading} onClick={() => void (otpStage === 'entry' ? handleSendOtp() : handleVerifyOtp())}>
          {loading ? 'Please wait...' : otpStage === 'entry' ? 'Get OTP' : 'Verify OTP'}
        </button>
      </div>

      <small>
        {authMode === 'signin'
          ? 'Use OTP to sign into an existing account. If you are new here, switch to Register first.'
          : 'Use OTP to create a new account. After verification, your secure account setup will finish automatically.'}
      </small>
    </div>
  )
}
