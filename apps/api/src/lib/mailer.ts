import nodemailer, { type Transporter } from 'nodemailer';
import type { Database } from '../db/client';
import type { Env } from '../env';
import { logger } from '../logger';
import { getSettings, type Settings } from './ai-settings';
import { open } from './crypto';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Where outgoing email goes: the admin screen settings win over the SMTP_URL Secret. */
export type MailSource = 'admin' | 'secret' | null;

interface Resolved {
  key: string;
  source: Exclude<MailSource, null>;
  transport: Transporter;
  from: string;
}

export function transportFromSettings(row: Settings, config: Env): { transport: Transporter; from: string } | null {
  if (!row.mailHost || !row.mailPort) return null;
  const password =
    row.mailPasswordCiphertext && row.mailPasswordIv && row.mailPasswordTag
      ? open({ ciphertext: row.mailPasswordCiphertext, iv: row.mailPasswordIv, tag: row.mailPasswordTag }, config.APP_ENCRYPTION_KEY)
      : undefined;
  const transport = nodemailer.createTransport({
    host: row.mailHost,
    port: row.mailPort,
    secure: row.mailSecure ?? row.mailPort === 465,
    auth: row.mailUser ? { user: row.mailUser, pass: password ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return { transport, from: row.mailFrom || config.MAIL_FROM };
}

/**
 * SMTP mailer. Reads the admin settings at send time (cached until they change), so a new mail
 * server set from the admin screen works without a redeploy. Without any configuration it only
 * logs that an email would be sent (subject only, never the content).
 */
export function createMailer(config: Env, db?: Database): Mailer {
  let cached: Resolved | null = null;

  async function resolve(): Promise<Resolved | null> {
    const row = db ? await getSettings(db) : null;
    if (row?.mailHost) {
      const key = `admin:${row.mailUpdatedAt?.toISOString() ?? ''}`;
      if (cached?.key !== key) {
        const built = transportFromSettings(row, config);
        cached = built ? { key, source: 'admin', ...built } : null;
      }
      return cached;
    }
    if (config.SMTP_URL) {
      if (cached?.key !== 'secret') cached = { key: 'secret', source: 'secret', transport: nodemailer.createTransport(config.SMTP_URL), from: config.MAIL_FROM };
      return cached;
    }
    return null;
  }

  return {
    async send(mail) {
      const target = await resolve();
      if (!target) {
        logger.warn({ subject: mail.subject }, 'no mail server configured: email not sent');
        return;
      }
      // One retry for transient SMTP errors; failures are logged (subject only, never content).
      for (let attempt = 1; ; attempt++) {
        try {
          await target.transport.sendMail({ from: target.from, ...mail });
          return;
        } catch (err) {
          logger.error({ subject: mail.subject, attempt, source: target.source, err: (err as Error).message }, 'email send failed');
          if (attempt >= 2) throw err;
        }
      }
    },
  };
}

/** A short Spanish reason for the admin screen; never echoes credentials. */
export function mailErrorMessage(err: unknown): string {
  const e = err as { code?: string; responseCode?: number };
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'El servidor rechazó el usuario o la contraseña.';
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ECONNREFUSED' || e.code === 'EDNS' || e.code === 'ESOCKET')
    return 'No se pudo conectar con el servidor de correo. Revisa el servidor, el puerto y la seguridad.';
  if (e.code === 'EENVELOPE' || (e.responseCode && e.responseCode >= 550)) return 'El servidor no aceptó el remitente o el destinatario.';
  return 'No se pudo enviar el correo.';
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetPasswordMail(to: string, name: string, url: string): Mail {
  return {
    to,
    subject: 'Cambia tu contraseña de Gym',
    text: `Hola ${name}:\n\nPara elegir una contraseña nueva abre este enlace (vence en 1 hora):\n${url}\n\nSi no lo pediste, ignora este correo.`,
    html: `<p>Hola ${escape(name)}:</p><p>Para elegir una contraseña nueva abre este enlace (vence en 1 hora):</p><p><a href="${escape(url)}">Cambiar mi contraseña</a></p><p>Si no lo pediste, ignora este correo.</p>`,
  };
}

export function invitationMail(to: string, url: string, expiresAt: Date, invitedBy: string): Mail {
  const until = expiresAt.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  return {
    to,
    subject: 'Te invitaron a Gym',
    text: `Hola:\n\n${invitedBy} te invitó a Gym, la app para entrenar en casa o en el gimnasio.\n\nCrea tu cuenta con este enlace (vale hasta el ${until}):\n${url}\n\nSi no esperabas esta invitación, ignora este correo.`,
    html: `<p>Hola:</p><p>${escape(invitedBy)} te invitó a Gym, la app para entrenar en casa o en el gimnasio.</p><p><a href="${escape(url)}">Crear mi cuenta</a> (vale hasta el ${escape(until)}).</p><p>Si no esperabas esta invitación, ignora este correo.</p>`,
  };
}

export function testMail(to: string): Mail {
  return {
    to,
    subject: 'Prueba de correo de Gym',
    text: 'Si lees esto, el correo de Gym está bien configurado.',
    html: '<p>Si lees esto, el correo de Gym está bien configurado.</p>',
  };
}
