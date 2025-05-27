import { onRequest, HttpsOptions } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const httpsOptions: HttpsOptions = {
  region: 'us-central1',
};

export const discordWebhookListener = onRequest(httpsOptions, async (req, res) => {
  if (req.method !== 'POST') {
    logger.warn("Metodo non permesso:", req.method);
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const incomingData = req.body;
    logger.info("Dati ricevuti (v2):", { payload: incomingData });

    if (!incomingData || !incomingData.messageId || !incomingData.authorTag) {
      logger.error("Dati mancanti o malformati (v2):", { payload: incomingData });
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
    logger.error("Errore grave nella Cloud Function (v2):", error);
    if (req && req.body) {
        logger.error("Corpo della richiesta che ha causato l'errore (v2):", { payload: req.body });
    }

    let errorMessage = "Errore interno del server sconosciuto.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    res.status(500).send({ success: false, error: "Errore interno del server (v2).", details: errorMessage });
    return; 
  }
});
