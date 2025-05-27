import { Injectable, inject } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { DiscordMessage } from '../models/discord-message.model';
import {
  Firestore,
  collection,
  query,
  orderBy,
  collectionData,
  where,
} from '@angular/fire/firestore';
import { PlayerStat } from '../models/player-stat.model';

@Injectable({
  providedIn: 'root',
})
export class DiscordMessageService {
  private firestore: Firestore = inject(Firestore);
  private readonly collectionName = 'discordChannelMessages';
  messages$: Observable<DiscordMessage[]>;

  constructor() {
    const messagesCollectionRef = collection(
      this.firestore,
      this.collectionName
    );
    const q = query(messagesCollectionRef, orderBy('timestamp', 'desc'));
    this.messages$ = collectionData(q, { idField: 'id' }) as Observable<
      DiscordMessage[]
    >;
  }

  getMessages(): Observable<DiscordMessage[]> {
    const messagesCollection = collection(this.firestore, this.collectionName);
    return collectionData(messagesCollection, { idField: 'id' }) as Observable<
      DiscordMessage[]
    >;
  }
}
