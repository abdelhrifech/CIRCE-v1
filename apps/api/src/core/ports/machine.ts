// Port d'envoi d'un fichier de production à la machine (COO-P10, ECR-GEN-03 « Envoyer à la machine »). Le format
// réel (Vendôme .ini) et le dépôt réseau relèvent de D-15 (étape 8) : en développement et en test l'adaptateur est
// SIMULÉ ; en production, sans adaptateur réel, l'envoi est refusé explicitement (jamais de succès simulé).

export interface FichierMachine {
  lot: string
  nomFichier: string
  contenu: string
}

export interface MachinePort {
  readonly nom: string
  /** Dépose le fichier à la machine ; lève en cas d'échec (le service annule alors tout changement de statut). */
  envoyer(fichier: FichierMachine): Promise<void>
}

/** Adaptateur simulé : mémorise les envois (développement, tests). */
export class MachineSimulee implements MachinePort {
  readonly nom = 'simulee'
  readonly envoyes: FichierMachine[] = []
  envoyer(fichier: FichierMachine): Promise<void> {
    this.envoyes.push(fichier)
    return Promise.resolve()
  }
}

export class MachineNonConfiguree implements MachinePort {
  readonly nom = 'non-configuree'
  envoyer(): Promise<void> {
    return Promise.reject(new Error('Envoi à la machine non configuré (D-15, Q-193).'))
  }
}
