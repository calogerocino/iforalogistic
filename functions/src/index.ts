import { onRequest, HttpsOptions } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from 'firebase-admin';
import axios from 'axios';

if (!admin.apps.length) {
  admin.initializeApp();
}

const httpsOptions: HttpsOptions = {
  region: 'us-central1',
};

const DISCORD_EMBED_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382102405319233636/w4bQRcIqAcBT5BegNVRvkxRaNxHTR0hqHLN4lZNXrP1-WvNuMX1gR0vEeX09s6zL9ul5';

function setCorsHeaders(res: any, req: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

export const discordWebhookListener = onRequest(httpsOptions, async (req, res) => {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    logger.warn("Metodo non permesso per discordWebhookListener:", req.method);
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const incomingData = req.body;
    logger.info("Dati ricevuti da discordWebhookListener (v2):", { payload: incomingData });

    if (!incomingData || !incomingData.messageId || !incomingData.authorTag) {
      logger.error("Dati mancanti o malformati per discordWebhookListener (v2):", { payload: incomingData });
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

    logger.info("Oggetto pronto per Firestore (v2):", { payload: dataToSaveInFirestore });

    const firestoreDocRef = admin.firestore()
      .collection('discordChannelMessages')
      .doc(incomingData.messageId);

    await firestoreDocRef.set(dataToSaveInFirestore, { merge: true });
    logger.info(`Dati salvati/aggiornati in Firestore per il documento (v2): ${incomingData.messageId}`);

    res.status(200).send({ success: true, message: "Dati ricevuti e salvati (v2).", docId: incomingData.messageId });
    return;

  } catch (error: unknown) {
    logger.error("Errore grave nella Cloud Function discordWebhookListener (v2):", error);
    if (req && req.body) {
        logger.error("Corpo della richiesta che ha causato l'errore (v2):", { payload: req.body });
    }

    let errorMessage = "Errore interno del server sconosciuto.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    res.status(500).send(`Internal Server Error: ${errorMessage}`);
    return;
  }
});

export const eventSubscriptionWebhook = onRequest(httpsOptions, async (req, res) => {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    logger.warn("Metodo non permesso per eventSubscriptionWebhook:", req.method);
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const eventData = req.body;
    logger.info("Dati di iscrizione evento VTC ricevuti:", { payload: eventData });

    if (!eventData.eventName || !eventData.vtcName || !eventData.registeredByUsername ||
        !eventData.mainSlotName || !eventData.subSlotName ||
        !eventData.contactName || !eventData.contactEmail || !eventData.appLink) {
      logger.error("Dati mancanti o malformati per l'iscrizione all'evento VTC:", { payload: eventData });
      res.status(400).send('Bad Request: Missing essential event subscription data (eventName, vtcName, registeredByUsername, mainSlotName, subSlotName, contactName, contactEmail, appLink).');
      return;
    }

    const embed = {
      color: 0x0099ff,
      author: {
        name: `Nuova Iscrizione Evento VTC`,
        icon_url: eventData.vtcLogo || 'https://placehold.co/64x64/0099ff/ffffff?text=VTC',
      },
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
      footer: {
        text: `Iscritto da: ${eventData.registeredByUsername}`,
        icon_url: eventData.registeredByUserAvatar || 'https://placehold.co/32x32/0099ff/ffffff?text=User',
      },
    };

    const discordPayload = {
      embeds: [embed],
    };

    logger.info("Invio embed a Discord:", { payload: discordPayload });

    await axios.post(DISCORD_EMBED_WEBHOOK_URL, discordPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info("Embed inviato con successo a Discord.");

    res.status(200).send({ success: true, message: "Dati di iscrizione ricevuti e embed inviato a Discord." });
    return;

  } catch (error: unknown) {
    logger.error("Errore grave nella Cloud Function eventSubscriptionWebhook:", error);
    if (req && req.body) {
        logger.error("Corpo della richiesta che ha causato l'errore:", { payload: req.body });
    }

    let errorMessage = "Errore interno del server sconosciuto.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    res.status(500).send(`Internal Server Error: ${errorMessage}`);
    return;
  }
});
