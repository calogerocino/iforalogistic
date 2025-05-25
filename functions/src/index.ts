// functions/src/index.ts (o index.js)
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const discordWebhookListener = functions.https.onRequest(async (request, response) => {
    if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
    }

    try {
        const messageData = request.body; // Dati inviati dal Discord Bot
        console.log("Dati ricevuti dal Discord Bot:", JSON.stringify(messageData));

        // Esempio: Salvare i messaggi in una collezione Firestore chiamata 'discordChannelMessages'
        await db.collection("discordChannelMessages").add({
            authorId: messageData.authorId,
            authorTag: messageData.authorTag,
            authorAvatar: messageData.authorAvatar,
            content: messageData.content,
            channelId: messageData.channelId,
            channelName: messageData.channelName,
            messageId: messageData.messageId,
            discordTimestamp: messageData.timestamp, // Timestamp dal messaggio Discord
            savedAt: admin.firestore.FieldValue.serverTimestamp() // Timestamp di quando è stato salvato
        });

        response.status(200).send("Dati ricevuti e salvati con successo!");
    } catch (error) {
        console.error("Errore nel processare la richiesta del bot:", error);
        response.status(500).send("Errore interno del server");
    }
});
