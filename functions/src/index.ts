import { onRequest, HttpsOptions } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from 'firebase-admin';
import axios from 'axios'; // Importa axios

if (!admin.apps.length) {
  admin.initializeApp();
}

// Configurazione per le funzioni HTTPS
const httpsOptions: HttpsOptions = {
  region: 'us-central1', // Assicurati che questa regione corrisponda alla tua configurazione
};

// URL del webhook Discord per l'invio degli embed
// IMPORTANTISSIMO: SOSTITUISCI QUESTO URL CON IL TUO WEBHOOK REALE DI DISCORD PER IL CANALE TARGET (ID: 1316924842867425290)
const DISCORD_EMBED_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382102405319233636/w4bQRcIqAcBT5BegNVRvkxRaNxHTR0hqHLN4lZNXrP1-WvNuMX1gR0vEeX09s6zL9ul5';

// Funzione Firebase per ricevere e salvare i messaggi Discord (esistente)
export const discordWebhookListener = onRequest(httpsOptions, async (req, res) => {
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

// Nuova funzione Firebase per la gestione dell'iscrizione delle VTC agli eventi e l'invio dell'embed su Discord
export const eventSubscriptionWebhook = onRequest(httpsOptions, async (req, res) => {
  if (req.method !== 'POST') {
    logger.warn("Metodo non permesso per eventSubscriptionWebhook:", req.method);
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const eventData = req.body;
    logger.info("Dati di iscrizione evento VTC ricevuti:", { payload: eventData });

    // Validazione dei dati essenziali
    if (!eventData.eventName || !eventData.vtcName || !eventData.registeredByUsername) {
      logger.error("Dati mancanti o malformati per l'iscrizione all'evento VTC:", { payload: eventData });
      res.status(400).send('Bad Request: Missing essential event subscription data (eventName, vtcName, registeredByUsername).');
      return;
    }

    // Costruzione dell'embed di Discord basato sull'immagine fornita
    const embed = {
      color: 0x0099ff, // Un colore blu simile a quello dell'immagine
      author: {
        name: `VTC iscritta all'evento`,
        icon_url: eventData.vtcLogo || 'https://placehold.co/64x64/0099ff/ffffff?text=VTC', // Usa il logo della VTC o un placeholder
      },
      title: `Nome Evento: ${eventData.eventName}`,
      description: `Nuova VTC iscritta: **${eventData.vtcName}**`,
      fields: [
        { name: 'Server', value: eventData.server || 'N/D', inline: true },
        { name: 'Punto di Ritrovo', value: eventData.meetingPoint || 'N/D', inline: true },
        { name: 'Ora di Partenza', value: eventData.departureTime || 'N/D', inline: true },
        { name: 'Luogo di Partenza', value: eventData.departureLocation || 'N/D', inline: true },
        { name: 'Destinazione', value: eventData.destination || 'N/D', inline: true },
        { name: 'Note per l\'evento', value: eventData.notes || 'Nessuna nota', inline: false },
      ],
      timestamp: new Date().toISOString(), // Timestamp attuale
      footer: {
        text: `Iscritto da: ${eventData.registeredByUsername}`,
        icon_url: eventData.registeredByUserAvatar || 'https://placehold.co/32x32/0099ff/ffffff?text=User', // Avatar dell'utente o placeholder
      },
    };

    // Payload per il webhook di Discord
    const discordPayload = {
      embeds: [embed],
    };

    // Invio dell'embed a Discord
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

