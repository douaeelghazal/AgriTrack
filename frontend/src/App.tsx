import { useState, useEffect } from 'react'
import { LayoutDashboard, FileText, FilePlus, Map, BarChart3, AlertCircle, LogIn, LogOut, UserPlus, Search, Bell, User } from 'lucide-react'
import { useLang } from './i18n'
import AddContractFlow from './components/AddContractFlow'
import HistoryView from './components/HistoryView'
import RegionalAnalytics from './components/RegionalAnalytics'
import DashboardView from './components/DashboardView'
import ReclamationsView from './components/ReclamationsView'
import { getStoredAccess, setTokens, clearTokens } from './api'

type View = 'dashboard' | 'contrats' | 'map' | 'analytics' | 'reclamations'
type Screen = 'home' | 'login' | 'signup' | 'app'

interface HomeProps {
  onEnterApp: () => void
  onLogin: () => void
  onSignup: () => void
}

function HomeScreen({ onEnterApp, onLogin, onSignup }: HomeProps) {
  const { t } = useLang()
  return (
    <div className="min-h-screen bg-agri-dark text-gray-100 flex flex-col transition-opacity duration-300">
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-agri-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-agri-accent flex items-center justify-center text-agri-dark font-bold transition-transform hover:scale-105">
            AV
          </div>
          <div>
            <p className="text-sm font-semibold text-agri-accent">AgriTrack</p>
            <p className="text-[11px] text-gray-500">MAMDA • Crédit Agricole</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-agri-border transition-colors duration-200"
          >
            <LogIn size={16} />
            <span>{t('signIn')}</span>
          </button>
          <button
            onClick={onSignup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-agri-accent text-agri-dark text-sm font-semibold hover:bg-green-500 transition-colors duration-200"
          >
            <UserPlus size={16} />
            <span>{t('createAccount')}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 md:px-12 py-8">
        <div className="max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-agri-accent uppercase mb-3">
              {t('heroTag')}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {t('heroTitle')}
            </h1>
            <p className="text-sm md:text-base text-gray-400 mb-6">
              {t('heroDesc')}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onEnterApp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-agri-accent text-agri-dark text-sm font-semibold hover:bg-green-500 transition-all duration-200 hover:shadow-lg hover:shadow-agri-accent/20"
              >
                <Map size={18} />
                <span>{t('enterApp')}</span>
              </button>
              <button
                onClick={onLogin}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-agri-border text-sm text-gray-300 hover:bg-agri-border transition-colors duration-200"
              >
                <LogIn size={18} />
                <span>{t('signIn')}</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              {t('heroFooter')}
            </p>
          </div>

          <div className="bg-agri-card rounded-2xl border border-agri-border p-5 space-y-4 transition-shadow duration-200 hover:shadow-xl hover:shadow-black/20">
            <p className="text-xs font-semibold text-gray-400 uppercase">{t('lexique')}</p>
            <div className="space-y-3 text-xs text-gray-300">
              <div>
                <p className="font-semibold text-agri-accent">{t('lexNatural')}</p>
                <p>{t('lexNaturalDesc')}</p>
              </div>
              <div>
                <p className="font-semibold text-agri-accent">{t('lexNdvi')}</p>
                <p>{t('lexNdviDesc')}</p>
              </div>
              <div>
                <p className="font-semibold text-agri-accent">{t('lexBaseline')}</p>
                <p>{t('lexBaselineDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

interface AuthProps {
  mode: 'login' | 'signup'
  onBack: () => void
  onSwitchMode: () => void
  onAuthenticated: (accessToken: string, refreshToken?: string) => void
}

function AuthScreen({ mode, onBack, onSwitchMode, onAuthenticated }: AuthProps) {
  const { t } = useLang()
  const isLogin = mode === 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login/' : '/api/auth/register/'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }
      if (!data.access) {
        throw new Error('No token returned from server')
      }
      onAuthenticated(data.access as string, data.refresh as string | undefined)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-agri-dark text-gray-100 flex flex-col animate-in">
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-agri-border">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; {t('back')}
        </button>
        <p className="text-xs text-gray-500">MAMDA • Crédit Agricole</p>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-agri-card rounded-2xl border border-agri-border p-6 space-y-5 transition-shadow hover:shadow-xl hover:shadow-black/20">
          <div>
            <p className="text-xs font-semibold text-agri-accent uppercase mb-1">
              {isLogin ? t('connexion') : t('createCompte')}
            </p>
            <h2 className="text-xl font-bold">
              {isLogin ? t('accessAgri') : t('joinAgri')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {t('authDesc')}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-agri-dark border border-agri-border px-3 py-2 text-sm outline-none focus:border-agri-accent transition-colors"
                placeholder="prenom.nom@banque.ma"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('passwordLabel')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-agri-dark border border-agri-border px-3 py-2 text-sm outline-none focus:border-agri-accent transition-colors"
                placeholder="********"
                required
              />
            </div>
            {error && <p className="text-xs text-agri-danger">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 px-4 py-2.5 rounded-lg bg-agri-accent text-agri-dark text-sm font-semibold hover:bg-green-500 disabled:opacity-70 transition-all duration-200"
            >
              {submitting
                ? '...'
                : isLogin
                  ? t('signInCta')
                  : t('signUpCta')}
            </button>
            {/* Sign Up / Sign In CTA for conversion */}
            <div className="pt-2 text-center">
              <p className="text-xs text-gray-500 mb-2">
                {isLogin ? t('noAccount') : t('haveAccount')}
              </p>
              <button
                type="button"
                onClick={onSwitchMode}
                className="text-sm font-medium text-agri-accent hover:underline transition-opacity"
              >
                {isLogin ? t('createAccount') : t('signIn')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const { lang, setLang, t } = useLang()
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [screen, setScreen] = useState<Screen>('home')
  const [token, setToken] = useState<string | null>(() => getStoredAccess())
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (token) {
      setScreen('app')
    } else {
      setScreen((prev) => (prev === 'app' ? 'login' : prev))
    }
  }, [token])

  if (screen !== 'app') {
    if (screen === 'login' || screen === 'signup') {
      return (
        <AuthScreen
          mode={screen}
          onBack={() => setScreen('home')}
          onSwitchMode={() => setScreen(screen === 'login' ? 'signup' : 'login')}
          onAuthenticated={(accessToken, refreshToken) => {
            setTokens(accessToken, refreshToken)
            setToken(accessToken)
            setScreen('app')
          }}
        />
      )
    }
    return (
      <HomeScreen
        onEnterApp={() => setScreen(token ? 'app' : 'login')}
        onLogin={() => setScreen('login')}
        onSignup={() => setScreen('signup')}
      />
    )
  }

  const handleLogout = () => {
    clearTokens()
    setToken(null)
    setScreen('login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col animate-in">
      {/* Sidebar — Enterprise SaaS */}
      <aside className="w-20 md:w-56 bg-slate-900/95 border-r border-slate-700/80 flex flex-col fixed h-full z-40 no-print rounded-r-xl shadow-lg">
        <div className="p-4 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">AV</div>
            <div className="min-w-0 hidden md:block">
              <h1 className="text-base font-semibold text-slate-100 truncate">AgriTrack</h1>
              <p className="text-[11px] text-slate-500">{t('platform')}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentView === 'dashboard' ? 'bg-slate-700/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={20} className="flex-shrink-0" />
            <span className="hidden md:inline text-sm font-medium">{t('navDashboard')}</span>
          </button>
          <button
            onClick={() => setCurrentView('contrats')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentView === 'contrats' ? 'bg-slate-700/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <FileText size={20} className="flex-shrink-0" />
            <span className="hidden md:inline text-sm font-medium">{t('navContrats')}</span>
          </button>
          <button
            onClick={() => setCurrentView('map')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentView === 'map' ? 'bg-slate-700/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <FilePlus size={20} className="flex-shrink-0" />
            <span className="hidden md:inline text-sm font-medium">{t('navAddContract')}</span>
          </button>
          <button
            onClick={() => setCurrentView('reclamations')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentView === 'reclamations' ? 'bg-slate-700/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <AlertCircle size={20} className="flex-shrink-0" />
            <span className="hidden md:inline text-sm font-medium">{t('navReclamations')}</span>
          </button>
          <button
            onClick={() => setCurrentView('analytics')}
            className={`w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              currentView === 'analytics' ? 'bg-slate-700/60 text-emerald-400' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <BarChart3 size={20} className="flex-shrink-0" />
            <span className="hidden md:inline text-sm font-medium">{t('navAnalytics')}</span>
          </button>
        </nav>
        <div className="p-3 border-t border-slate-700/80 space-y-2">
          <div className="hidden md:flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'en' | 'fr' | 'ar')}
              className="flex-1 min-w-0 max-w-[72px] bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-200 focus:border-emerald-500 outline-none cursor-pointer"
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
              <option value="ar">AR</option>
            </select>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-xs text-slate-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition-all no-print"
            >
              <LogOut size={16} />
              <span>{t('navLogout')}</span>
            </button>
          </div>
          <button onClick={handleLogout} className="md:hidden w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400">
            <LogOut size={18} />
          </button>
          <p className="hidden md:block text-[10px] text-slate-500 px-2">MAMDA • Crédit Agricole</p>
        </div>
      </aside>

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 ml-20 md:ml-56 flex items-center gap-4 px-4 md:px-6 py-3 bg-slate-900/80 border-b border-slate-700/80 backdrop-blur-sm no-print">
        <div className="flex-1 flex items-center gap-2 max-w-xl">
          <Search size={18} className="text-slate-500 flex-shrink-0" />
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            className="w-full bg-slate-800/80 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors" title={t('notifications')}>
            <Bell size={20} />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          </button>
          <div className="h-8 w-8 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300" title={t('userMenu')}>
            <User size={18} />
          </div>
        </div>
      </header>

      <main className="flex-1 ml-20 md:ml-56 min-h-screen bg-slate-950/50">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'contrats' && (
          <HistoryView
            onShowToast={showToast}
            onNavigateToReclamations={() => setCurrentView('reclamations')}
          />
        )}
        {currentView === 'reclamations' && <ReclamationsView />}
        {currentView === 'map' && (
          <AddContractFlow
            onContractCreated={() => setCurrentView('contrats')}
            onShowToast={showToast}
          />
        )}
        {currentView === 'analytics' && <RegionalAnalytics />}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-in">
          {toast}
        </div>
      )}
    </div>
  )
}
