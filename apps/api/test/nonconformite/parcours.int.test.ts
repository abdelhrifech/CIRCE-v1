import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CasNcListeSchema,
  DeclarantsSchema,
  ListeAlertesSchema,
  ListeNcSchema,
  NcDonneesSchema,
  NcSchema,
} from '@circe/shared'
import {
  autre,
  contexteReception,
  get,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'
const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
const payload = (plateformeId: number) => ({
  plateformeId,
  type: 'RECEPTION',
  donnees: NcDonneesSchema.parse({
    annonceur: 'Annonceur fictif',
    theme: 'Saison',
    imprimeur: 'AUTRE',
    imprimeurAutre: 'Imprimeur fictif',
    transporteur: 'AUTRE',
    transporteurAutre: 'Transport fictif',
    formats: ['2 m² fixe'],
    avarie: 'NON',
    controle: ['Etat des affiches'],
  }),
})
async function contexte() {
  const s = await site(ctx)
  const coord = await autre(ctx, s.plateforme.id, ['coord'])
  const admin = await autre(ctx, s.plateforme.id, ['admin'])
  return { ...s, coord, admin }
}
describe('EX-NEW-NC-001 / RG-NEW-NC-002 non-conformités partagées', () => {
  it('EX-NEW16-NC-002 regroupe les affiches reçues par dossier et thème, recherche DA et protège les sites', async () => {
    const c = await contexte()
    const donnees = {
      contNum: 987654,
      idDaChapeau: 876543,
      theme: 'Été',
      annonceur: 'Annonceur préremplissage',
      format: '2 m² fixe',
    }
    await receptionValidee(ctx, c.headers, c.plateforme.id, 10, donnees)
    await receptionValidee(ctx, c.headers, c.plateforme.id, 7, donnees)
    await receptionValidee(ctx, c.headers, c.plateforme.id, 3, { ...donnees, theme: 'Hiver' })
    const liste = CasNcListeSchema.parse(
      (await get(ctx, '/api/non-conformites/cas?q=876543', c.headers)).json(),
    ).items
    expect(liste).toHaveLength(2)
    const ete = liste.find((l) => l.donnees.theme === 'Été')
    expect(ete?.donnees.quantite).toBe('17')
    expect(ete?.donnees.formats).toEqual(['2 m² fixe'])
    expect(ete?.donnees.dossier).toBe('987654')
    expect(
      CasNcListeSchema.parse((await get(ctx, '/api/non-conformites/cas?q=9876', c.headers)).json())
        .items,
    ).toHaveLength(2)
    const ailleurs = await contexte()
    expect(
      CasNcListeSchema.parse(
        (await get(ctx, '/api/non-conformites/cas?q=876543', ailleurs.headers)).json(),
      ).items,
    ).toHaveLength(0)
  })
  it('EX-NEW16-REC-001 mémorise l’impression NC sans changer son statut ni sa version, refuse version périmée et autre site', async () => {
    const c = await contexte()
    const nc = NcSchema.parse(
      (await post(ctx, '/api/non-conformites', c.headers, payload(c.plateforme.id))).json(),
    )
    expect(nc.feuilleImprimeeLe).toBeNull()
    const corps = { ncs: [{ id: nc.id, version: nc.version }] }
    expect(
      (
        await post(ctx, '/api/non-conformites/impressions', c.headers, {
          ncs: [{ id: nc.id, version: nc.version + 1 }],
        })
      ).statusCode,
    ).toBe(409)
    const ailleurs = await contexte()
    expect(
      (await post(ctx, '/api/non-conformites/impressions', ailleurs.headers, corps)).statusCode,
    ).toBe(403)
    expect((await post(ctx, '/api/non-conformites/impressions', c.headers, corps)).statusCode).toBe(
      200,
    )
    const apres = ListeNcSchema.parse(
      (await get(ctx, '/api/non-conformites', c.headers)).json(),
    ).items.find((n) => n.id === nc.id)
    expect(apres?.feuilleImprimeeLe).toBeTruthy()
    expect(apres?.version).toBe(nc.version)
    expect(apres?.statut).toBe(nc.statut)
  })
  it('RG-NEW16-NC-001 historise les réponses oui/non, contrôle version, décision et périmètre', async () => {
    const c = await contexte()
    let nc = NcSchema.parse(
      (await post(ctx, '/api/non-conformites', c.headers, payload(c.plateforme.id))).json(),
    )
    const url = `/api/non-conformites/${nc.id}/reponse`
    expect(
      (await post(ctx, url, c.admin.headers, { version: nc.version, traite: false })).statusCode,
    ).toBe(409)
    nc = NcSchema.parse(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.coord.headers, {
          version: nc.version,
          decisions: ['À traiter par la plateforme'],
        })
      ).json(),
    )
    const version = nc.version
    nc = NcSchema.parse(
      (
        await post(ctx, url, c.admin.headers, {
          version,
          traite: false,
          commentaire: 'Toujours en attente',
        })
      ).json(),
    )
    expect(nc.statut).toBe('En cours plateforme')
    expect(nc.reponses).toHaveLength(1)
    expect((await post(ctx, url, c.admin.headers, { version, traite: true })).statusCode).toBe(409)
    const ailleurs = await contexte()
    expect(
      (await post(ctx, url, ailleurs.headers, { version: nc.version, traite: true })).statusCode,
    ).toBe(403)
    const alertes = ListeAlertesSchema.parse(
      (await get(ctx, '/api/alertes', c.admin.headers)).json(),
    )
    expect(alertes.alertes.some((a) => a.cle === `NC-${nc.id}` && a.type === 'NC_PLATEFORME')).toBe(
      true,
    )
    nc = NcSchema.parse(
      (
        await post(ctx, url, c.admin.headers, {
          version: nc.version,
          traite: true,
          commentaire: 'Fait',
        })
      ).json(),
    )
    expect(nc.statut).toBe('Traitée')
    expect(nc.reponses).toHaveLength(2)
    expect(
      (await post(ctx, url, c.admin.headers, { version: nc.version, traite: true })).statusCode,
    ).toBe(409)
    nc = NcSchema.parse(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.coord.headers, {
          version: nc.version,
          decisions: ['Nouvelle préparation'],
        })
      ).json(),
    )
    expect(nc.statut).toBe('En cours plateforme')
    expect(nc.reponses).toHaveLength(2)
  })
  it('RG-NEW16-PIL-001 les archives résolues gardent les droits de la source', async () => {
    const c = await contexte()
    const nc = NcSchema.parse(
      (
        await post(ctx, '/api/non-conformites', c.headers, {
          ...payload(c.plateforme.id),
          bloquante: true,
        })
      ).json(),
    )
    const origine = ListeAlertesSchema.parse(
      (await get(ctx, '/api/alertes', c.admin.headers)).json(),
    ).alertes.find((a) => a.cle === `NC-${nc.id}`)
    expect(origine).toBeDefined()
    const cle = `INT-ECHEC-archive-test-${nc.id}`
    await ctx.db.alerteAcquittement.create({
      data: {
        cle,
        signature: 'archive',
        parId: c.admin.user.id,
        snapshot: JSON.stringify({ ...origine, cle, type: 'INTEGRATION', plateformeId: null }),
      },
    })
    expect(
      ListeAlertesSchema.parse(
        (await get(ctx, '/api/alertes?etat=ACQUITTEES', c.headers)).json(),
      ).alertes.some((a) => a.cle === cle),
    ).toBe(false)
    expect(
      ListeAlertesSchema.parse(
        (await get(ctx, '/api/alertes?etat=ACQUITTEES', c.admin.headers)).json(),
      ).alertes.some((a) => a.cle === cle),
    ).toBe(true)
  })
  it('RG-NEW16-PIL-001 archive et restaure une alerte sans changer la NC, droits conservés', async () => {
    const c = await contexte()
    const nc = NcSchema.parse(
      (
        await post(ctx, '/api/non-conformites', c.headers, {
          ...payload(c.plateforme.id),
          bloquante: true,
        })
      ).json(),
    )
    const cles = [`NC-${nc.id}`]
    expect(
      (await post(ctx, '/api/alertes/acquittements', c.admin.headers, { cles })).statusCode,
    ).toBe(200)
    let liste = ListeAlertesSchema.parse(
      (await get(ctx, '/api/alertes?etat=ACQUITTEES', c.admin.headers)).json(),
    )
    expect(liste.alertes.some((a) => a.cle === cles[0] && a.acquittee !== null)).toBe(true)
    expect(
      (await post(ctx, '/api/alertes/restaurations', c.admin.headers, { cles })).statusCode,
    ).toBe(200)
    liste = ListeAlertesSchema.parse((await get(ctx, '/api/alertes', c.admin.headers)).json())
    expect(liste.alertes.some((a) => a.cle === cles[0] && a.acquittee === null)).toBe(true)
    const apres = ListeNcSchema.parse(
      (await get(ctx, '/api/non-conformites', c.admin.headers)).json(),
    ).items.find((n) => n.id === nc.id)
    expect(apres?.version).toBe(nc.version)
  })
  it('EX-NEW-NC-001 crée un formulaire complet, conserve le justificatif et partage la liste avec la coordination', async () => {
    const c = await contexte()
    const r = await post(ctx, '/api/non-conformites', c.headers, {
      ...payload(c.plateforme.id),
      fichiers: [
        {
          nom: 'preuve.txt',
          mimeType: 'text/plain',
          contenuBase64: Buffer.from('Preuve fictive').toString('base64'),
        },
      ],
    })
    expect(r.statusCode).toBe(200)
    const nc = NcSchema.parse(r.json())
    expect(nc.statut).toBe('À décider')
    const liste = ListeNcSchema.parse(
      (await get(ctx, '/api/non-conformites', c.coord.headers)).json(),
    )
    expect(liste.items.map((n) => n.id)).toContain(nc.id)
    const fichier = await get(
      ctx,
      `/api/non-conformites/fichiers/${nc.fichiers[0]?.id}`,
      c.coord.headers,
    )
    expect(fichier.statusCode).toBe(200)
    expect(fichier.body).toBe('Preuve fictive')
    const horsSite = await contexte()
    expect(
      (await get(ctx, `/api/non-conformites/fichiers/${nc.fichiers[0]?.id}`, horsSite.headers))
        .statusCode,
    ).toBe(403)
  })
  it('EX-NEW-NC-001 rejette les champs et valeurs conditionnelles manquants, sans écriture', async () => {
    const c = await contexte()
    const p = payload(c.plateforme.id)
    const avant = await ctx.db.nonConformite.count()
    expect(
      (
        await post(ctx, '/api/non-conformites', c.headers, {
          ...p,
          donnees: { ...p.donnees, imprimeurAutre: '' },
        })
      ).statusCode,
    ).toBe(422)
    expect(
      (
        await post(ctx, '/api/non-conformites', c.headers, {
          ...p,
          donnees: { ...p.donnees, controle: [] },
        })
      ).statusCode,
    ).toBe(422)
    expect(await ctx.db.nonConformite.count()).toBe(avant)
  })
  it('RG-NEW-NC-002 déduit la portée bloquante et ouvre une alerte jusqu’à la décision, puis la plateforme traite', async () => {
    const c = await contexte()
    const rec = await receptionValidee(ctx, c.headers, c.plateforme.id, 10)
    const p = payload(c.plateforme.id)
    const r = await post(ctx, '/api/non-conformites', c.headers, {
      ...p,
      receptionId: rec.receptionId,
      afficheIds: [rec.afficheId],
      bloquante: false,
      donnees: { ...p.donnees, types: ['Affiches trempées ou abîmées'] },
    })
    expect(r.statusCode).toBe(200)
    const nc = NcSchema.parse(r.json())
    expect(nc.bloquante).toBe(true)
    const cles = async () =>
      ListeAlertesSchema.parse(
        (await get(ctx, '/api/alertes?type=NC_BLOQUANTE', c.coord.headers)).json(),
      ).alertes.map((a) => a.cle)
    expect(await cles()).toContain(`NC-${nc.id}`)
    expect(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.headers, {
          version: nc.version,
          decisions: ['OK préparation en l’état'],
        })
      ).statusCode,
    ).toBe(403)
    const decision = await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.coord.headers, {
      version: nc.version,
      decisions: ['Nouvelle impression/Livraison'],
      commentaire: 'Livraison jeudi',
    })
    expect(decision.statusCode).toBe(200)
    const nouvelle = NcSchema.parse(decision.json())
    expect(nouvelle.statut).toBe('En cours plateforme')
    expect(await cles()).not.toContain(`NC-${nc.id}`)
    const traite = await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.headers, {
      version: nouvelle.version,
      decisions: [...nouvelle.decisions, 'Traité par la plateforme'],
    })
    expect(traite.statusCode).toBe(200)
    expect(NcSchema.parse(traite.json()).statut).toBe('Traitée')
    expect(
      await ctx.db.statutHistorique.count({
        where: { typeEntite: 'NON_CONFORMITE', entiteId: String(nc.id) },
      }),
    ).toBe(3)
  })
  it('RG-NEW-NC-002 non bloquante = statistique, sans décision et sans alerte', async () => {
    const c = await contexte(),
      rec = await receptionValidee(ctx, c.headers, c.plateforme.id, 10),
      p = payload(c.plateforme.id)
    const r = await post(ctx, '/api/non-conformites', c.headers, {
      ...p,
      receptionId: rec.receptionId,
      afficheIds: [rec.afficheId],
      bloquante: true,
      donnees: { ...p.donnees, types: ['BL non conforme'] },
    })
    const nc = NcSchema.parse(r.json())
    expect(nc.bloquante).toBe(false)
    expect(nc.statut).toBe('Pour statistique')
    expect(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.coord.headers, {
          version: nc.version,
          decisions: ['RAF'],
        })
      ).statusCode,
    ).toBe(409)
    expect(
      ListeAlertesSchema.parse(
        (await get(ctx, '/api/alertes?type=NC_BLOQUANTE', c.coord.headers)).json(),
      ).alertes.some((a) => a.cle === `NC-${nc.id}`),
    ).toBe(false)
  })
  it('RG-NEW-NC-002 portée à préciser obligatoire, affiches d’une autre réception et plateforme refusées', async () => {
    const c = await contexte(),
      rec = await receptionValidee(ctx, c.headers, c.plateforme.id, 10),
      p = payload(c.plateforme.id)
    const autreRec = await receptionValidee(ctx, c.headers, c.plateforme.id, 2)
    const base = {
      ...p,
      receptionId: rec.receptionId,
      afficheIds: [rec.afficheId],
      donnees: { ...p.donnees, types: ['Écart de quantité'] },
    }
    expect((await post(ctx, '/api/non-conformites', c.headers, base)).statusCode).toBe(422)
    expect(
      (
        await post(ctx, '/api/non-conformites', c.headers, {
          ...base,
          bloquante: true,
          afficheIds: [autreRec.afficheId],
        })
      ).statusCode,
    ).toBe(422)
    const horsSite = await contexte()
    expect((await post(ctx, '/api/non-conformites', horsSite.headers, base)).statusCode).toBe(403)
  })
  it('RG-NEW-NC-002 refuse une décision concurrente et conserve le choix plus récent', async () => {
    const c = await contexte()
    const nc = NcSchema.parse(
      (await post(ctx, '/api/non-conformites', c.headers, payload(c.plateforme.id))).json(),
    )
    expect(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.coord.headers, {
          version: nc.version,
          decisions: ['RAF'],
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await post(ctx, `/api/non-conformites/${nc.id}/decision`, c.admin.headers, {
          version: nc.version,
          decisions: ['Nouvelle préparation'],
        })
      ).statusCode,
    ).toBe(409)
    expect((await ctx.db.nonConformite.findUniqueOrThrow({ where: { id: nc.id } })).decisions).toBe(
      '["RAF"]',
    )
  })
  it('EX-NEW-ADM-001 référentiel déclarants partagé, versionné, édition réservée', async () => {
    const c = await contexte()
    const refs = DeclarantsSchema.parse(
      (await get(ctx, '/api/non-conformites/declarants', c.headers)).json(),
    )
    const body = { version: refs.version, noms: ['Déclarant fictif', 'Déclarant fictif'] }
    expect((await post(ctx, '/api/non-conformites/declarants', c.headers, body)).statusCode).toBe(
      403,
    )
    const r = await post(ctx, '/api/non-conformites/declarants', c.admin.headers, body)
    expect(r.statusCode).toBe(200)
    expect(DeclarantsSchema.parse(r.json()).noms).toEqual(['Déclarant fictif'])
    expect(
      (await post(ctx, '/api/non-conformites/declarants', c.admin.headers, body)).statusCode,
    ).toBe(409)
  })
})
