// Port d'envoi de mails (D-19, Q-375 / Q-409). Aucun envoi n'est fait dans une transaction métier : les mails sont mis
// en file (table `mail_file`) puis envoyés par le traitement `ENVOI_MAILS`. Deux adaptateurs :
//  - `MailBoiteEnvoi` (développement et tests, défaut) : aucun envoi réel, les messages restent en mémoire ;
//  - `MailSmtp` : client SMTP minimal (EHLO, AUTH LOGIN, MAIL FROM, RCPT TO, DATA), NON ACTIVÉ par défaut ;
//  - `MailNonConfigure` : refuse explicitement (production sans SMTP configuré : jamais de succès simulé).
import { connect as connectTcp, type Socket } from 'node:net'
import { connect as connectTls } from 'node:tls'

export interface MessageMail {
  destinataires: string[]
  sujet: string
  corps: string
}

export type CanalMail = 'SIMULE' | 'SMTP'

export interface MailPort {
  readonly nom: string
  /** SIMULE : aucun mail ne part (les champs `mailEnvoye` des faits métier ne passent pas à vrai). */
  readonly canal: CanalMail
  /** Lève en cas d'échec ; ne doit jamais être appelé dans une transaction de base. */
  envoyer(message: MessageMail): Promise<void>
}

/** Boîte d'envoi de développement / test : conserve les messages en mémoire, n'ouvre aucune connexion. */
export class MailBoiteEnvoi implements MailPort {
  readonly nom = 'boite-envoi'
  readonly canal = 'SIMULE'
  readonly messages: MessageMail[] = []
  /** Tests : adresses à refuser (simule un échec d'envoi). */
  refuser: ((message: MessageMail) => string | null) | null = null
  envoyer(message: MessageMail): Promise<void> {
    const motif = this.refuser?.(message) ?? null
    if (motif) return Promise.reject(new Error(motif))
    this.messages.push(message)
    return Promise.resolve()
  }
}

export class MailNonConfigure implements MailPort {
  readonly nom = 'non-configure'
  readonly canal = 'SMTP'
  envoyer(): Promise<void> {
    return Promise.reject(new Error('Envoi de mails non configuré (SMTP absent, Q-375 / Q-409).'))
  }
}

export interface OptionsSmtp {
  hote: string
  port: number
  secure: boolean
  utilisateur?: string | undefined
  motDePasse?: string | undefined
  expediteur: string
  /** Préfixe d'objet hors production (legacy RG-ADM-043 : nom de l'environnement). */
  prefixeSujet?: string
  delaiMs?: number
}

export class MailSmtp implements MailPort {
  readonly nom = 'smtp'
  readonly canal = 'SMTP'
  constructor(private readonly o: OptionsSmtp) {}

  async envoyer(m: MessageMail): Promise<void> {
    // Q-413 : jamais d'identifiants (AUTH LOGIN = base64 en clair) sur une connexion non chiffrée ; STARTTLS non implémenté.
    if (this.o.utilisateur && !this.o.secure)
      throw new Error(
        'SMTP : authentification refusée sur une connexion non chiffrée (Q-413) : renseigner SMTP_SECURE=true (TLS implicite) ou retirer SMTP_USER.',
      )
    const delai = this.o.delaiMs ?? 15_000
    const socket: Socket = this.o.secure
      ? connectTls({ host: this.o.hote, port: this.o.port, servername: this.o.hote })
      : connectTcp({ host: this.o.hote, port: this.o.port })
    socket.setTimeout(delai)
    const lecteur = lecteurReponses(socket)
    try {
      await lecteur.attendre(220)
      await dialoguer(socket, lecteur, `EHLO circe`, 250)
      if (this.o.utilisateur) {
        await dialoguer(socket, lecteur, 'AUTH LOGIN', 334)
        await dialoguer(socket, lecteur, b64(this.o.utilisateur), 334)
        await dialoguer(socket, lecteur, b64(this.o.motDePasse ?? ''), 235)
      }
      await dialoguer(socket, lecteur, `MAIL FROM:<${nettoyer(this.o.expediteur)}>`, 250)
      for (const a of m.destinataires)
        await dialoguer(socket, lecteur, `RCPT TO:<${nettoyer(a)}>`, [250, 251])
      await dialoguer(socket, lecteur, 'DATA', 354)
      const sujet = `${this.o.prefixeSujet ?? ''}${m.sujet}`.replace(/[\r\n]+/g, ' ')
      const entetes = [
        `From: ${nettoyer(this.o.expediteur)}`,
        `To: ${m.destinataires.map(nettoyer).join(', ')}`,
        `Subject: =?UTF-8?B?${b64(sujet)}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
      ]
      const corps = (
        Buffer.from(m.corps, 'utf8')
          .toString('base64')
          .match(/.{1,76}/g) ?? []
      ).join('\r\n')
      await dialoguer(socket, lecteur, `${entetes.join('\r\n')}\r\n\r\n${corps}\r\n.`, 250)
      await dialoguer(socket, lecteur, 'QUIT', 221).catch(() => undefined)
    } finally {
      socket.destroy()
    }
  }
}

const b64 = (x: string) => Buffer.from(x, 'utf8').toString('base64')
const nettoyer = (x: string) => x.replace(/[\r\n<>]/g, '').trim()

function lecteurReponses(socket: Socket) {
  let tampon = ''
  let erreur: Error | null = null
  const attentes: (() => void)[] = []
  const reveiller = () => {
    for (const a of attentes.splice(0)) a()
  }
  socket.setEncoding('utf8')
  socket.on('data', (d: string) => {
    tampon += d
    reveiller()
  })
  socket.on('error', (e) => {
    erreur = e
    reveiller()
  })
  socket.on('timeout', () => {
    erreur = new Error('Délai SMTP dépassé')
    reveiller()
  })
  socket.on('close', () => {
    erreur ??= new Error('Connexion SMTP fermée')
    reveiller()
  })
  return {
    /** Attend une réponse complète (dernière ligne « NNN ») et vérifie son code. */
    async attendre(attendu: number | number[]): Promise<void> {
      for (;;) {
        const lignes = tampon.split('\r\n')
        const complete = lignes.findIndex((l) => /^\d{3} /.test(l))
        if (complete >= 0) {
          const ligne = lignes[complete] ?? ''
          tampon = lignes.slice(complete + 1).join('\r\n')
          const code = Number(ligne.slice(0, 3))
          if (![attendu].flat().includes(code))
            throw new Error(`Réponse SMTP inattendue : ${ligne}`)
          return
        }
        if (erreur) throw erreur
        await new Promise<void>((r) => attentes.push(r))
      }
    },
  }
}

async function dialoguer(
  socket: Socket,
  lecteur: ReturnType<typeof lecteurReponses>,
  commande: string,
  attendu: number | number[],
): Promise<void> {
  socket.write(`${commande}\r\n`)
  await lecteur.attendre(attendu)
}

export interface EnvMail {
  NODE_ENV: 'development' | 'test' | 'production'
  MAIL_MODE: 'dev' | 'smtp'
  SMTP_HOST?: string | undefined
  SMTP_PORT: number
  SMTP_SECURE: 'true' | 'false'
  SMTP_USER?: string | undefined
  SMTP_PASSWORD?: string | undefined
  MAIL_EXPEDITEUR?: string | undefined
}

/**
 * Choix de l'adaptateur (Q-409) : SMTP seulement si MAIL_MODE=smtp ET hôte et expéditeur renseignés. Sinon : boîte
 * d'envoi simulée hors production, adaptateur « non configuré » (refus explicite) en production.
 */
export function creerMailPort(env: EnvMail): MailPort {
  if (env.MAIL_MODE === 'smtp' && env.SMTP_HOST && env.MAIL_EXPEDITEUR) {
    return new MailSmtp({
      hote: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      utilisateur: env.SMTP_USER,
      motDePasse: env.SMTP_PASSWORD,
      expediteur: env.MAIL_EXPEDITEUR,
      ...(env.NODE_ENV === 'production' ? {} : { prefixeSujet: `[${env.NODE_ENV}] ` }),
    })
  }
  return env.NODE_ENV === 'production' ? new MailNonConfigure() : new MailBoiteEnvoi()
}
