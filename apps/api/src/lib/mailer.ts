import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../env';
import { logger } from '../logger';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** SMTP mailer; without SMTP_URL it only logs that an email would be sent (never its content). */
export function createMailer(config: Env): Mailer {
  if (!config.SMTP_URL) {
    return {
      async send(mail) {
        logger.warn({ subject: mail.subject }, 'SMTP_URL not set: email not sent');
      },
    };
  }
  const transport: Transporter = nodemailer.createTransport(config.SMTP_URL);
  return {
    async send(mail) {
      // One retry for transient SMTP errors; failures are logged (subject only, never content).
      for (let attempt = 1; ; attempt++) {
        try {
          await transport.sendMail({ from: config.MAIL_FROM, ...mail });
          return;
        } catch (err) {
          logger.error({ subject: mail.subject, attempt, err: (err as Error).message }, 'email send failed');
          if (attempt >= 2) throw err;
        }
      }
    },
  };
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
