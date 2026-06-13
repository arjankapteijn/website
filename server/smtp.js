// Minimale SMTP-client (zero-dependency) voor SMTP2GO over impliciete
// TLS (poort 465/8465/443). Voldoende voor één transactie: AUTH LOGIN,
// MAIL FROM, RCPT TO, DATA.

import tls from 'node:tls'

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

/** Onderwerp met niet-ASCII tekens veilig encoderen (RFC 2047). */
function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`
}

/**
 * Verstuur één e-mail. Gooit een Error met de SMTP-respons bij weigering.
 * opts: { host, port, user, pass, from, to, subject, text, replyTo? }
 */
export function sendMail(opts) {
  const { host, port, user, pass, from, to, subject, text, replyTo } = opts

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => {})
    socket.setEncoding('utf8')
    socket.setTimeout(15_000, () => {
      socket.destroy()
      reject(new Error('SMTP-timeout'))
    })
    socket.on('error', reject)

    // SMTP is regel-gebaseerd; we werken de transactie stap voor stap af.
    let buffer = ''
    let step = 0
    const fromAddr = from.replace(/^.*</, '').replace(/>.*$/, '')

    const message =
      [
        `From: ${from}`,
        `To: ${to}`,
        replyTo ? `Reply-To: ${replyTo}` : null,
        `Subject: ${encodeHeader(subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@arjankapteijn.nl>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        b64(text).replace(/(.{76})/g, '$1\r\n'),
      ]
        .filter((l) => l !== null)
        .join('\r\n') + '\r\n.\r\n'

    const steps = [
      { expect: 220, send: () => `EHLO arjankapteijn.nl\r\n` },
      { expect: 250, send: () => `AUTH LOGIN\r\n` },
      { expect: 334, send: () => `${b64(user)}\r\n` },
      { expect: 334, send: () => `${b64(pass)}\r\n` },
      { expect: 235, send: () => `MAIL FROM:<${fromAddr}>\r\n` },
      { expect: 250, send: () => `RCPT TO:<${to}>\r\n` },
      { expect: 250, send: () => `DATA\r\n` },
      { expect: 354, send: () => message },
      // 250 na DATA = mail geaccepteerd → klaar (QUIT is beleefdheid)
      { expect: 250, send: null },
    ]

    socket.on('data', (chunk) => {
      buffer += chunk
      // multiline-responses (250-…) afwachten tot de afsluitende "250 "
      const lines = buffer.split('\r\n').filter(Boolean)
      const last = lines[lines.length - 1]
      if (!last || /^\d{3}-/.test(last)) return
      buffer = ''

      const code = Number(last.slice(0, 3))
      const current = steps[step]
      if (code !== current.expect) {
        socket.destroy()
        reject(new Error(`SMTP-stap ${step} verwachtte ${current.expect}, kreeg: ${last}`))
        return
      }
      if (current.send === null) {
        socket.write('QUIT\r\n')
        socket.end()
        resolve(undefined)
        return
      }
      socket.write(current.send())
      step += 1
    })
  })
}
