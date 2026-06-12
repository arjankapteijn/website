import { useEffect, useRef, useState } from 'react'
import { profile } from '../config'
import { strings, type Lang, type TermLine } from '../i18n'
import { fetchIss } from '../hooks/useIss'
import { logAvailable, logCommand, useIp } from '../lib/log'

type EmailStep = 'none' | 'subject' | 'body' | 'confirm'

// Breedte vast op 20 tekens zodat de infokolom strak uitlijnt en de
// regel (20 + 2 + ~24) binnen het terminalvenster past zonder te wrappen.
const APPLE_ART = [
  '         ##         ',
  '       ###          ',
  '      ##            ',
  '  ####### #######   ',
  ' ################## ',
  '#################   ',
  '################    ',
  '################    ',
  '#################   ',
  ' ################## ',
  '  ################  ',
  '   ##############   ',
  '    ####   ####     ',
].map((l) => l.padEnd(20))

interface TerminalProps {
  lang: Lang
  setLang: (lang: Lang) => void
  onOpenPhoto: () => void
}

export default function Terminal({ lang, setLang, onOpenPhoto }: TerminalProps) {
  const t = strings[lang].term
  const ip = useIp()
  const user = ip ?? (lang === 'nl' ? 'bezoeker' : 'visitor')

  const [lines, setLines] = useState<TermLine[]>([])
  const [input, setInput] = useState('')
  const [booted, setBooted] = useState(false)
  const [emailStep, setEmailStep] = useState<EmailStep>('none')
  const emailDraft = useRef({ subject: '', body: '' })
  const history = useRef<string[]>([])
  const historyIdx = useRef(-1)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // de boot-taal is de taal op het moment van mounten
  const initialLang = useRef(lang)

  // opstart-animatie (in de taal waarmee de pagina opent); de
  // privacymelding over het logboek verschijnt alleen als het logbestand
  // op deze hosting echt bestaat
  useEffect(() => {
    setLines([]) // voorkomt dubbele boot-regels bij StrictMode-remount in dev
    const bootStrings = strings[initialLang.current].term
    let boot = bootStrings.boot
    let i = 0
    let id: ReturnType<typeof setInterval>
    void logAvailable().then((available) => {
      if (available) {
        boot = [...boot.slice(0, -1), { text: bootStrings.bootLogNotice, cls: 'dim' }, { text: '' }]
      }
      id = setInterval(() => {
        setLines((prev) => [...prev, boot[i]])
        i += 1
        if (i >= boot.length) {
          clearInterval(id)
          setBooted(true)
        }
      }, 220)
    })
    return () => clearInterval(id)
  }, [])

  // automatisch naar beneden scrollen
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [lines])

  const print = (...newLines: TermLine[]) => setLines((prev) => [...prev, ...newLines])

  const prompt =
    emailStep === 'subject'
      ? t.promptSubject
      : emailStep === 'body'
        ? t.promptBody
        : emailStep === 'confirm'
          ? t.promptConfirm
          : `${user}@ak-01 ~ % `

  const runEmailStep = (value: string) => {
    if (emailStep === 'subject') {
      if (!value) {
        print({ text: t.emailSubjectEmpty, cls: 'warn' })
        return
      }
      emailDraft.current.subject = value
      setEmailStep('body')
      print({ text: t.emailBodyAsk, cls: 'accent' })
    } else if (emailStep === 'body') {
      if (!value) {
        print({ text: t.emailBodyEmpty, cls: 'warn' })
        return
      }
      emailDraft.current.body = value
      setEmailStep('confirm')
      print(
        { text: '' },
        { text: `  ${t.emailTo}:      ${profile.email}` },
        { text: `  ${t.emailSubject}: ${emailDraft.current.subject}` },
        { text: `  ${t.emailBody}:    ${emailDraft.current.body}` },
        { text: '' },
      )
    } else if (emailStep === 'confirm') {
      if (t.yes.includes(value.toLowerCase())) {
        const url = `mailto:${profile.email}?subject=${encodeURIComponent(
          emailDraft.current.subject,
        )}&body=${encodeURIComponent(emailDraft.current.body)}`
        window.location.href = url
        print({ text: t.emailSending, cls: 'ok' }, { text: '' })
      } else {
        print({ text: t.emailCancelled, cls: 'dim' }, { text: '' })
      }
      setEmailStep('none')
    }
  }

  const neofetch = (): TermLine[] => {
    const info = [`${user}@ak-01`, '---------------', ...t.neofetchLines]
    return APPLE_ART.map((art, i) => ({
      text: art + '   ' + (info[i] ?? ''),
      cls: 'accent',
    }))
  }

  const showIss = async () => {
    print({ text: t.issFetching, cls: 'dim' })
    const data = await fetchIss()
    if (data) {
      print(...t.issReport(data), { text: '' })
    } else {
      print({ text: t.issError, cls: 'err' }, { text: '' })
    }
  }

  const run = (raw: string) => {
    const cmd = raw.trim()
    const lower = cmd.toLowerCase()
    const [name, ...rest] = lower.split(/\s+/)
    const arg = rest.join(' ')
    const profileStrings = strings[lang]

    switch (name) {
      case '':
        break
      case 'help':
      case '?':
        print(...t.help)
        break
      case 'about':
      case 'bio':
        print(...profileStrings.bio.map((text) => ({ text })), { text: '' })
        break
      case 'whoami':
        print({ text: t.whoamiYou(ip), cls: 'accent' }, { text: '' })
        break
      case 'skills':
        print(
          { text: t.skillsHeader, cls: 'accent' },
          ...profileStrings.skills.map((s) => ({ text: `  ▸ ${s}` })),
          { text: '' },
        )
        break
      case 'contact':
        print(
          { text: `  e-mail    ${profile.email}`, cls: 'accent' },
          { text: `  linkedin  ${profile.linkedin}`, cls: 'accent' },
          { text: '' },
          { text: t.contactTip, cls: 'dim' },
          { text: '' },
        )
        break
      case 'email':
      case 'mail':
        print(
          { text: `${t.emailIntro} ${profile.email}`, cls: 'accent' },
          { text: t.emailPrivacy, cls: 'warn' },
          { text: t.emailSubjectAsk, cls: 'dim' },
        )
        setEmailStep('subject')
        break
      case 'linkedin':
        window.open(profile.linkedin, '_blank', 'noopener')
        print({ text: t.linkedinOpening, cls: 'ok' }, { text: '' })
        break
      case 'photo':
      case 'foto':
        print({ text: t.photoOpening, cls: 'ok' }, { text: '' })
        onOpenPhoto()
        break
      case 'open':
        if (arg.includes('arjan') || arg.includes('photo') || arg.includes('foto')) {
          print({ text: t.photoOpening, cls: 'ok' }, { text: '' })
          onOpenPhoto()
        } else {
          print({ text: t.openNotFound(arg), cls: 'err' }, { text: '' })
        }
        break
      case 'iss':
        void showIss()
        break
      case 'fortune':
        print({ text: t.fortune, cls: 'accent' }, { text: '' })
        break
      case 'lang':
      case 'language':
      case 'taal':
        if (arg === 'en' || arg === 'nl') {
          setLang(arg)
          print({ text: strings[arg].term.langSwitched, cls: 'ok' }, { text: '' })
        } else {
          print({ text: t.langCurrent, cls: 'accent' }, { text: '' })
        }
        break
      case 'ls':
        print({ text: t.lsFiles }, { text: '' })
        break
      case 'cat':
        if (arg === t.catAboutFile) {
          print(...profileStrings.bio.map((text) => ({ text })), { text: '' })
        } else if (arg === '.geheimen' || arg === '.secrets') {
          print({ text: t.catSecret, cls: 'err' }, { text: '' })
        } else if (arg === 'arjan.jpg') {
          print({ text: t.catPhoto, cls: 'warn' }, { text: '' })
        } else {
          print({ text: t.catNotFound(arg), cls: 'err' }, { text: '' })
        }
        break
      case 'neofetch':
        print(...neofetch(), { text: '' })
        break
      case 'date':
        print(
          { text: new Date().toLocaleString(profileStrings.locale, { dateStyle: 'full', timeStyle: 'short' }) },
          { text: '' },
        )
        break
      case 'echo':
        print({ text: cmd.slice(5) }, { text: '' })
        break
      case 'pwd':
        print({ text: t.pwd }, { text: '' })
        break
      case 'sudo':
        print(...t.sudo)
        break
      case 'exit':
      case 'logout':
        print(...t.exit)
        break
      case 'clear':
        setLines([])
        return
      default:
        print(...t.notFound(name))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value
      setInput('')
      print({ text: prompt + value, cls: 'cmd' })
      if (emailStep !== 'none') {
        // e-mailinhoud wordt bewust nooit gelogd (privacy)
        runEmailStep(value.trim())
      } else {
        if (value.trim()) {
          history.current.push(value)
          historyIdx.current = history.current.length
          logCommand(value.trim(), lang)
        }
        run(value)
      }
    } else if (e.key === 'ArrowUp' && emailStep === 'none') {
      e.preventDefault()
      if (history.current.length === 0) return
      historyIdx.current = Math.max(0, historyIdx.current - 1)
      setInput(history.current[historyIdx.current] ?? '')
    } else if (e.key === 'ArrowDown' && emailStep === 'none') {
      e.preventDefault()
      historyIdx.current = Math.min(history.current.length, historyIdx.current + 1)
      setInput(history.current[historyIdx.current] ?? '')
    } else if (e.key === 'c' && e.ctrlKey && emailStep !== 'none') {
      print({ text: prompt + input + '^C', cls: 'cmd' }, { text: t.emailCancelled, cls: 'dim' }, { text: '' })
      setInput('')
      setEmailStep('none')
    }
  }

  return (
    <div className="term-body" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
      {lines.map((line, i) => (
        <div key={i} className={`term-line${line?.cls ? ` term-line--${line.cls}` : ''}`}>
          {line?.text}
        </div>
      ))}
      {booted && (
        <div className="term-prompt-row">
          <span className="term-prompt">{prompt}</span>
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Terminal input"
          />
        </div>
      )}
    </div>
  )
}
