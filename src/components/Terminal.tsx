import { useEffect, useRef, useState } from 'react'
import { profile } from '../config'
import { strings, type Lang, type TermLine } from '../i18n'
import { fetchIss } from '../hooks/useIss'
import { logCommand, useIp } from '../lib/log'
import { mailtoUrl, sendEmail } from '../lib/mail'

type EmailStep = 'none' | 'subject' | 'body' | 'reply' | 'confirm'

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

  // bootregels staan los van de rest: de opstartanimatie zet steeds de
  // eerste n regels (idempotent) zodat een dubbele effect-run — StrictMode
  // of een Suspense-replay tijdens het 3D-laden — nooit dubbele regels geeft
  const [bootLines, setBootLines] = useState<TermLine[]>([])
  const [lines, setLines] = useState<TermLine[]>([])
  const [input, setInput] = useState('')
  const [booted, setBooted] = useState(false)
  const [emailStep, setEmailStep] = useState<EmailStep>('none')
  const emailDraft = useRef({ subject: '', body: '', replyTo: '' })
  const history = useRef<string[]>([])
  const historyIdx = useRef(-1)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // de boot-taal is de taal op het moment van mounten
  const initialLang = useRef(lang)

  // opstart-animatie (in de taal waarmee de pagina opent)
  useEffect(() => {
    const boot = strings[initialLang.current].term.boot
    let i = 0
    const id = setInterval(() => {
      i += 1
      setBootLines(boot.slice(0, i))
      if (i >= boot.length) {
        clearInterval(id)
        setBooted(true)
      }
    }, 220)
    return () => clearInterval(id)
  }, [])

  // automatisch naar beneden scrollen
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [bootLines, lines])

  const print = (...newLines: TermLine[]) => setLines((prev) => [...prev, ...newLines])

  const prompt =
    emailStep === 'subject'
      ? t.promptSubject
      : emailStep === 'body'
        ? t.promptBody
        : emailStep === 'reply'
          ? t.promptReply
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
      setEmailStep('reply')
      print({ text: t.emailReplyAsk, cls: 'accent' })
    } else if (emailStep === 'reply') {
      if (value && !/^\S+@\S+\.\S+$/.test(value)) {
        print({ text: t.emailReplyInvalid, cls: 'warn' })
        return
      }
      emailDraft.current.replyTo = value
      setEmailStep('confirm')
      print(
        { text: '' },
        { text: `  ${t.emailTo}:      ${profile.email}` },
        { text: `  ${t.emailSubject}: ${emailDraft.current.subject}` },
        { text: `  ${t.emailBody}:    ${emailDraft.current.body}` },
        ...(value ? [{ text: `  Reply-to:  ${value}` }] : []),
        { text: '' },
      )
    } else if (emailStep === 'confirm') {
      if (t.yes.includes(value.toLowerCase())) {
        print({ text: t.emailSending, cls: 'dim' })
        const draft = {
          subject: emailDraft.current.subject,
          body: emailDraft.current.body,
          replyTo: emailDraft.current.replyTo || undefined,
        }
        void sendEmail(draft, lang).then((ok) => {
          if (ok) {
            print({ text: t.emailSent, cls: 'ok' }, { text: '' })
          } else {
            // statische hosting of SMTP-storing: val terug op mailto
            print({ text: t.emailFallback, cls: 'warn' }, { text: '' })
            window.location.href = mailtoUrl(draft)
          }
        })
      } else {
        print({ text: t.emailCancelled, cls: 'dim' }, { text: '' })
      }
      setEmailStep('none')
    }
  }

  const startEmail = () => {
    if (emailStep !== 'none') {
      inputRef.current?.focus()
      return
    }
    print(
      { text: `${t.emailIntro} ${profile.email}`, cls: 'accent' },
      { text: t.emailSubjectAsk, cls: 'dim' },
    )
    setEmailStep('subject')
  }

  // de e-mailknop in de foto-modal start de e-mailflow hier in de terminal
  const startEmailRef = useRef(startEmail)
  useEffect(() => {
    startEmailRef.current = startEmail
  })
  useEffect(() => {
    const onStartEmail = () => {
      startEmailRef.current()
      inputRef.current?.focus()
    }
    window.addEventListener('ak:start-email', onStartEmail)
    return () => window.removeEventListener('ak:start-email', onStartEmail)
  }, [])

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
      case 'email':
      case 'mail':
        startEmail()
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
        // easter-egg: sudo ontgrendelt het 'geheime' bestand
        if (arg === 'cat .geheimen' || arg === 'cat .secrets') {
          print(...t.catSecretUnlocked)
        } else {
          print(...t.sudo)
        }
        break
      case 'coffee':
      case 'koffie':
        print(...t.coffee)
        break
      case 'exit':
      case 'logout':
        print(...t.exit)
        break
      case 'clear':
        setBootLines([])
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
      {[...bootLines, ...lines].map((line, i) => (
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
