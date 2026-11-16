-- AlterTable : Q-414, contact destinataire édité à la main (non écrasé par le flux Broadcast, RG-COO-119).
ALTER TABLE "tr_destinataire" ADD COLUMN "dest_contact_modifie" BOOLEAN NOT NULL DEFAULT false;
