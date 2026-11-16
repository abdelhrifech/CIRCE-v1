/** Agent local d'impression des plateformes (Q-002 : mode d'appel non tranché). Interface vide. */
export interface SiteAgentPort {
  readonly name: string
}

export class MockSiteAgent implements SiteAgentPort {
  readonly name = 'mock'
}
