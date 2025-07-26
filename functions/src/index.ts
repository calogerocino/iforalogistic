import {
  onObjectFinalized,
  onObjectDeleted,
  StorageEvent,
} from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sharp from 'sharp';
import { onDocumentUpdated } from 'firebase-functions/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}

const THUMB_PREFIX = 'thumb_';
const THUMB_MAX_WIDTH = 400;

const BUCKET_NAME = 'iforalogistics.firebasestorage.app';



const storageOptions = {
  bucket: BUCKET_NAME,
  region: 'europe-west1',
};

const db = admin.firestore();
interface TripData {
  status: string;
  maxSpeedKmh: number;
  acceptedDistance: number;
  profit: number;
  jobDetails: {
    sourceCity: string;
    destinationCity: string;
    cargoName: string;
    truckModel: string;
    distanzaPianificata: number;
  };
}

interface UserData {
  firstName: string;
  photoURL: string;
}

export const consegnaCompletata = onDocumentUpdated(
    {
        document: "telemetry/{userId}/trips/{tripId}",
        region: "europe-west1",
    },
    async (event) => {
        logger.info(`Funzione 'consegnaCompletata' attivata per ${event.params.tripId}`);

        const snapshot = event.data;
        if (!snapshot) {
            logger.error("Nessun dato trovato nell'evento, la funzione non può procedere.");
            return;
        }

        const dataPrima = snapshot.before.data() as TripData;
        const dataDopo = snapshot.after.data() as TripData;

        if (dataDopo.status !== "Consegnato" || dataPrima.status === "Consegnato") {
            logger.log("Lo stato non è diventato 'Consegnato' in questo aggiornamento. Uscita.");
            return;
        }

        const { userId } = event.params;
        logger.log(`Nuova consegna rilevata per utente: ${userId}, viaggio: ${event.params.tripId}`);

        try {
            const userDoc = await db.collection("users").doc(userId).get();

            if (!userDoc.exists) {
                logger.error(`DIAGNOSI: Il documento per l'utente con ID ${userId} non è stato trovato in /users.`);
                return;
            }

            const userData = userDoc.data() as UserData;

            if (!userData.firstName || !userData.photoURL) {
                logger.warn(`DIAGNOSI: Il documento per l'utente ${userId} esiste, ma mancano i campi 'firstName' o 'photoURL'.`);
            }

            const stats = dataDopo.maxSpeedKmh <= 100 ? "[Reali]" : "[Gara]";
            const ricavo = dataDopo.profit || 0;
            const distanzaPianificata = dataDopo.jobDetails?.distanzaPianificata || 0;

            const embed = {
                author: {
                    name: userData.firstName || "Autista Sconosciuto",
                    icon_url: userData.photoURL || undefined,
                },
                title: "Consegna del lavoro",
                color: 15158332,
                description: `**${stats} - ${distanzaPianificata} km**\nDa **${dataDopo.jobDetails.sourceCity}** a **${dataDopo.jobDetails.destinationCity}**`,
                fields: [
                    { name: "Carico", value: dataDopo.jobDetails.cargoName, inline: true },
                    { name: "Distanza accettata", value: `${dataDopo.acceptedDistance || 0} km`, inline: true },
                    { name: "Ricavo", value: `${ricavo} €`, inline: true },
                    { name: "Camion", value: dataDopo.jobDetails.truckModel, inline: true },
                    { name: "Statistiche", value: stats, inline: true },
                    { name: "Posizione nell'azienda", value: "ND", inline: true },
                ],
                footer: {
                    text: "IFL Telemetry",
                    icon_url: "https://iforalogistics.web.app/assets/img/logo.png",
                },
                timestamp: new Date().toISOString(),
            };

            const webhookUrl = "https://discord.com/api/webhooks/1397927858571182281/Gc6wEDORmB_STwk6pCxToWVBkUeLtLUfLfRc1qhvCWWNK2yMTy2sQQ8wzQ9BiOvehPml";

            await axios.post(webhookUrl, { embeds: [embed] });
            logger.info(`Embed inviato a Discord con successo per il viaggio ${event.params.tripId}!`);

        } catch (error) {
            logger.error(`Errore imprevisto durante l'esecuzione della funzione per il viaggio ${event.params.tripId}:`, error);
        }
    }
);

export const updateAppUrls = onObjectFinalized(
  storageOptions,
  async (event) => {
    const filePath = event.data.name;
    const fileBucket = event.bucket;

    if (!filePath) {
      logger.info('Nessun percorso file specificato, la funzione termina.');
      return;
    }

    const fileName = path.basename(filePath);

    const targetFolder = 'download/';
    const targetFiles = ['IFL Telemetry.exe', 'IFL.rar'];

    if (!filePath.startsWith(targetFolder) || !targetFiles.includes(fileName)) {
      logger.info(
        `Il file "${fileName}" non si trova in "${targetFolder}" o non è un file di release rilevante. Uscita.`
      );
      return;
    }

    logger.info(
      `Rilevato nuovo file di release: "${fileName}". Inizio processo di aggiornamento URL.`
    );

    try {
      const bucket = admin.storage().bucket(fileBucket);
      const file = bucket.file(filePath);

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });

      const updateData: { [key: string]: string } = {};

      if (fileName === 'IFL Telemetry.exe') {
        updateData.update_url = signedUrl;
      } else if (fileName === 'IFL.rar') {
        updateData.download_url = signedUrl;
      }

      if (Object.keys(updateData).length === 0) {
        logger.warn(
          'Nessun campo corrispondente trovato da aggiornare per il file:',
          fileName
        );
        return;
      }
      const docRef = db.collection('app_info').doc('version');
      await docRef.update(updateData);

      logger.info(
        `Documento 'app_info/version' aggiornato con successo:`,
        updateData
      );
    } catch (error) {
      logger.error(
        "Errore durante l'aggiornamento dell'URL dell'applicazione:",
        error
      );
    }
  }
);

export const generateEventThumbnail = onObjectFinalized(
  storageOptions,
  async (event: StorageEvent): Promise<void> => {
    const fileBucket = event.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!filePath || !contentType || !contentType.startsWith('image/')) {
      return;
    }

    const fileName = path.basename(filePath);
    if (fileName.startsWith(THUMB_PREFIX)) {
      return;
    }

    if (!filePath.startsWith('events/')) {
      return;
    }

    const bucket = admin.storage().bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = { contentType: contentType };

    try {
      await bucket.file(filePath).download({ destination: tempFilePath });

      const thumbFileName = `${THUMB_PREFIX}${fileName}`;
      const thumbFilePath = path.join(os.tmpdir(), thumbFileName);

      await sharp(tempFilePath)
        .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
        .toFile(thumbFilePath);

      const destinationThumbPath = path.join(
        path.dirname(filePath),
        thumbFileName
      );
      await bucket.upload(thumbFilePath, {
        destination: destinationThumbPath,
        metadata: metadata,
      });

      fs.unlinkSync(tempFilePath);
      fs.unlinkSync(thumbFilePath);

      const originalFile = bucket.file(filePath);
      const thumbFile = bucket.file(destinationThumbPath);

      const [originalUrl] = await originalFile.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });
      const [thumbnailUrl] = await thumbFile.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });

      const pathParts = filePath.split('/');
      const eventId = pathParts[1];

      if (!eventId) {
        logger.error("ID dell'evento non trovato nel percorso", {
          path: filePath,
        });
        return;
      }

      const eventRef = admin.firestore().collection('events').doc(eventId);
      const isSlotImage = pathParts[2] === 'slots' && pathParts[3];

      if (isSlotImage) {
        const slotId = pathParts[3];
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
          logger.error(`Evento con ID ${eventId} non trovato in Firestore.`);
          return;
        }
        const eventData = eventDoc.data() as any;
        const slots = eventData.slots || [];
        const slotIndex = slots.findIndex((s: any) => s.id === slotId);

        if (slotIndex === -1) {
          logger.error(
            `Slot con ID ${slotId} non trovato nell'evento ${eventId}.`
          );
          return;
        }

        slots[slotIndex].imageUrl = originalUrl;
        slots[slotIndex].imageThumbnailUrl = thumbnailUrl;

        await eventRef.update({ slots: slots });
        logger.info(
          `Firestore aggiornato per lo slot ${slotId} dell'evento: ${eventId}`
        );
      } else {
        const imageIdentifier = path
          .basename(fileName, path.extname(fileName))
          .replace('_original', '');
        if (!imageIdentifier) {
          logger.error('Impossibile determinare imageIdentifier', {
            path: filePath,
          });
          return;
        }
        const updateData: { [key: string]: string } = {};
        const originalUrlField = `${imageIdentifier}Url`;
        const thumbnailUrlField = `${imageIdentifier}ThumbnailUrl`;
        updateData[originalUrlField] = originalUrl;
        updateData[thumbnailUrlField] = thumbnailUrl;
        await eventRef.update(updateData);
        logger.info(
          'Firestore aggiornato per evento:',
          eventId,
          'con i campi',
          updateData
        );
      }
    } catch (error) {
      logger.error('Errore durante la creazione della thumbnail:', error);
    }
  }
);

export const cleanupEventThumbnail = onObjectDeleted(
  storageOptions,
  async (event: StorageEvent): Promise<void> => {
    const filePath = event.data.name;
    const fileBucket = event.bucket;

    if (
      !filePath ||
      !filePath.startsWith('events/') ||
      !filePath.includes('_original.')
    ) {
      return;
    }

    const fileName = path.basename(filePath);
    const thumbFileName = `${THUMB_PREFIX}${fileName}`;
    const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
    const bucket = admin.storage().bucket(fileBucket);

    try {
      await bucket.file(thumbFilePath).delete();
    } catch (error) {
      logger.log(
        `La thumbnail ${thumbFilePath} non esisteva o non è stato possibile eliminarla.`
      );
    }
  }
);
