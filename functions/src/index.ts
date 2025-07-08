import { onRequest, HttpsOptions } from "firebase-functions/v2/https";
import { onObjectFinalized, onObjectDeleted, StorageEvent } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions/v2";
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import sharp from "sharp";

if (!admin.apps.length) {
  admin.initializeApp();
}

const THUMB_PREFIX = "thumb_";
const THUMB_MAX_WIDTH = 400;

const BUCKET_NAME = 'iforalogistics.firebasestorage.app';

const httpsOptions: HttpsOptions = {
  region: 'us-central1',
  cors: true,
};

const storageOptions = {
    bucket: BUCKET_NAME,
    region: 'europe-west1',
};

const DISCORD_EMBED_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382102405319233636/w4bQRcIqAcBT5BegNVRvkxRaNxHTR0hqHLN4lZNXrP1-WvNuMX1gR0vEeX09s6zL9ul5';

export const discordWebhookListener = onRequest(httpsOptions, async (req, res) => {
  if (req.method === 'POST') {
    try {
      const incomingData = req.body;
      if (!incomingData || !incomingData.messageId || !incomingData.authorTag) {
        res.status(400).send('Bad Request: Missing essential data.');
        return;
      }
      const dataToSaveInFirestore = {
        authorId: incomingData.authorId,
        authorTag: incomingData.authorTag,
        authorAvatar: incomingData.authorAvatar,
        content: incomingData.content,
        channelId: incomingData.channelId,
        channelName: incomingData.channelName,
        messageId: incomingData.messageId,
        timestamp: incomingData.timestamp,
        embeds: (incomingData.embeds && Array.isArray(incomingData.embeds)) ? incomingData.embeds : [],
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const firestoreDocRef = admin.firestore().collection('discordChannelMessages').doc(incomingData.messageId);
      await firestoreDocRef.set(dataToSaveInFirestore, { merge: true });
      res.status(200).send({ success: true, message: "Dati ricevuti e salvati (v2).", docId: incomingData.messageId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Errore interno del server sconosciuto.";
      res.status(500).send(`Internal Server Error: ${errorMessage}`);
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
});

export const eventSubscriptionWebhook = onRequest(httpsOptions, async (req, res) => {
  if (req.method === 'POST') {
    try {
      const eventData = req.body;
      if (!eventData.eventName || !eventData.vtcName || !eventData.registeredByUsername ||
          !eventData.mainSlotName || !eventData.subSlotName ||
          !eventData.contactName || !eventData.contactEmail || !eventData.appLink) {
        res.status(400).send('Bad Request: Missing essential event subscription data.');
        return;
      }
      const embed = {
        color: 0x0099ff,
        author: { name: `Nuova Iscrizione Evento VTC`, icon_url: eventData.vtcLogo || 'https://placehold.co/64x64/0099ff/ffffff?text=VTC' },
        title: `Evento: ${eventData.eventName}`,
        url: eventData.appLink,
        description: `Dettagli dell'iscrizione:`,
        fields: [
          { name: 'VTC Iscritta', value: eventData.vtcName, inline: true },
          { name: 'Referente', value: eventData.contactName, inline: true },
          { name: 'Email Referente', value: eventData.contactEmail, inline: true },
          { name: 'Zona Scelta', value: eventData.mainSlotName, inline: true },
          { name: 'Postazione Scelta', value: eventData.subSlotName, inline: true },
          { name: 'Server', value: eventData.server || 'N/D', inline: true },
          { name: 'Punto di Ritrovo', value: eventData.meetingPoint || 'N/D', inline: true },
          { name: 'Ora di Partenza', value: eventData.departureTime || 'N/D', inline: true },
          { name: 'Luogo di Partenza', value: eventData.departureLocation || 'N/D', inline: true },
          { name: 'Destinazione', value: eventData.destination || 'N/D', inline: true },
          { name: 'Note Evento', value: eventData.notes || 'Nessuna nota', inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `Iscritto da: ${eventData.registeredByUsername}`, icon_url: eventData.registeredByUserAvatar || 'https://placehold.co/32x32/0099ff/ffffff?text=User' },
      };
      await axios.post(DISCORD_EMBED_WEBHOOK_URL, { embeds: [embed] }, { headers: { 'Content-Type': 'application/json' } });
      res.status(200).send({ success: true, message: "Dati di iscrizione ricevuti e embed inviato a Discord." });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Errore interno del server sconosciuto.";
      res.status(500).send(`Internal Server Error: ${errorMessage}`);
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
});

export const generateEventThumbnail = onObjectFinalized(storageOptions, async (event: StorageEvent): Promise<void> => {
    const fileBucket = event.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!filePath || !contentType || !contentType.startsWith("image/")) {
        return;
    }

    const fileName = path.basename(filePath);
    if (fileName.startsWith(THUMB_PREFIX)) {
        return;
    }

    if (!filePath.startsWith("events/")) {
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

        const destinationThumbPath = path.join(path.dirname(filePath), thumbFileName);
        await bucket.upload(thumbFilePath, {
            destination: destinationThumbPath,
            metadata: metadata,
        });

        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(thumbFilePath);

        const originalFile = bucket.file(filePath);
        const thumbFile = bucket.file(destinationThumbPath);

        const [originalUrl] = await originalFile.getSignedUrl({ action: "read", expires: "03-09-2491" });
        const [thumbnailUrl] = await thumbFile.getSignedUrl({ action: "read", expires: "03-09-2491" });

        const pathParts = filePath.split("/");
        const eventId = pathParts[1];

        if (!eventId) {
            logger.error("ID dell'evento non trovato nel percorso", { path: filePath });
            return;
        }

        const eventRef = admin.firestore().collection("events").doc(eventId);
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
                logger.error(`Slot con ID ${slotId} non trovato nell'evento ${eventId}.`);
                return;
            }

            slots[slotIndex].imageUrl = originalUrl;
            slots[slotIndex].imageThumbnailUrl = thumbnailUrl;

            await eventRef.update({ slots: slots });
            logger.info(`Firestore aggiornato per lo slot ${slotId} dell'evento: ${eventId}`);

        } else {
            const imageIdentifier = path.basename(fileName, path.extname(fileName)).replace("_original", "");
            if (!imageIdentifier) {
                logger.error("Impossibile determinare imageIdentifier", { path: filePath });
                return;
            }
            const updateData: { [key: string]: string } = {};
            const originalUrlField = `${imageIdentifier}Url`;
            const thumbnailUrlField = `${imageIdentifier}ThumbnailUrl`;
            updateData[originalUrlField] = originalUrl;
            updateData[thumbnailUrlField] = thumbnailUrl;
            await eventRef.update(updateData);
            logger.info("Firestore aggiornato per evento:", eventId, "con i campi", updateData);
        }

    } catch (error) {
        logger.error("Errore durante la creazione della thumbnail:", error);
    }
});

export const cleanupEventThumbnail = onObjectDeleted(storageOptions, async (event: StorageEvent): Promise<void> => {
    const filePath = event.data.name;
    const fileBucket = event.bucket;

    if (!filePath || !filePath.startsWith("events/") || !filePath.includes("_original.")) {
        return;
    }

    const fileName = path.basename(filePath);
    const thumbFileName = `${THUMB_PREFIX}${fileName}`;
    const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
    const bucket = admin.storage().bucket(fileBucket);

    try {
        await bucket.file(thumbFilePath).delete();
    } catch (error) {
        logger.log(`La thumbnail ${thumbFilePath} non esisteva o non è stato possibile eliminarla.`);
    }
});
