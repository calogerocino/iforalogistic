// src/app/services/discord-message.service.ts (REFACTORIZZATO PER API MODULARE)
import { Injectable, inject } from '@angular/core'; // inject per la DI
import { Observable } from 'rxjs';
import { DiscordMessage } from '../models/discord-message.model';

// Importazioni specifiche dall'SDK modulare di Firestore
import {
  Firestore, // Il servizio Firestore
  collection, // Funzione per ottenere un riferimento a una collezione
  query,      // Funzione per creare una query
  orderBy,    // Funzione per ordinare i risultati
  collectionData // Funzione per ottenere i dati della collezione come Observable
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class DiscordMessageService {
  // Inietta il servizio Firestore modulare
  private firestore: Firestore = inject(Firestore);

  private readonly collectionName = 'discordChannelMessages';
  messages$: Observable<DiscordMessage[]>;

  constructor() {
    // Ottieni un riferimento alla collezione
    const messagesCollectionRef = collection(this.firestore, this.collectionName);

    // Crea una query per ordinare i messaggi
    const q = query(messagesCollectionRef, orderBy('discordTimestamp', 'desc'));

    // Ottieni i dati della collezione come Observable.
    // collectionData mappa automaticamente l'ID del documento al campo 'id' se specificato.
    this.messages$ = collectionData(q, { idField: 'id' }) as Observable<DiscordMessage[]>;
  }

  getMessages(): Observable<DiscordMessage[]> {
    return this.messages$;
  }
}
