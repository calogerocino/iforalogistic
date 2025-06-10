import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  orderBy,
  query,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  FieldValue,
  UpdateData,
  where,
  runTransaction
} from '@angular/fire/firestore';
import {
  Storage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from '@angular/fire/storage';
import { Observable, from, firstValueFrom } from 'rxjs'; // Importa firstValueFrom
import { map } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type EventState = 'nuovo' | 'programmato' | 'adesso' | 'concluso';
export type ServerType = 'Simulation 1' | 'Simulation 2' | 'SCS Convoy' | 'Promods';
export type TrailerType = 'Standard' | 'Pianale' | 'Bestiame' | 'Refrigerato';

export interface EventDLCs {
  goingEast: boolean;
  scandinavia: boolean;
  viveLaFrance: boolean;
  italia: boolean;
  beyondTheBalticSea: boolean;
  roadToTheBlackSea: boolean;
  iberia: boolean;
  westBalkans: boolean;
  greece: boolean;
}

export interface SubSlotBookingInfo {
  bookingId: string;
  companyName: string; // Nome della VTC
  contactName: string; // Nome del referente VTC
  contactEmail: string; // Email del referente VTC
  bookedAt: Timestamp;
}

export interface EventSubSlot {
  id: string;
  name: string; // Es: "Postazione 1"
  isBooked: boolean;
  bookingInfo?: SubSlotBookingInfo | null;
}

export interface EventSlot {
  id: string;
  name: string; // Es: "Zona A"
  imageUrl?: string | null;
  numberOfSubSlots: number;
  subSlots: EventSubSlot[];
}

export interface AppEvent {
  id?: string;
  name: string;
  description?: string;
  startDate: any;
  endDate?: any;
  state: EventState;
  eventType?: 'internal' | 'external';
  server?: ServerType;
  dlcs?: EventDLCs;
  departure?: string;
  destination?: string;
  photoAreaImageUrl?: string | null;
  trailerType?: TrailerType;
  cargo?: string;
  routeImageUrl?: string | null;
  slots?: EventSlot[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage);
  private notificationService = inject(NotificationService);
  private http: HttpClient = inject(HttpClient);
  private eventsCollectionPath = 'events';
  private eventsCollection = collection(this.firestore, this.eventsCollectionPath);
  readonly defaultEventPhotoAreaUrl = 'assets/img/default-placeholder.png';
  readonly defaultEventRouteUrl = 'assets/img/default-placeholder.png';
  readonly defaultSlotImageUrl = 'assets/img/default-slot-placeholder.png';

  private firebaseEventWebhookUrl = environment.firebaseEventWebhookUrl;

  constructor() { }

  getAllEvents(): Observable<AppEvent[]> {
    const q = query(this.eventsCollection, orderBy('startDate', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<AppEvent[]>;
  }

  getUpcomingInternalEvents(): Observable<AppEvent[]> {
    const q = query(
      this.eventsCollection,
      where('eventType', '==', 'internal'),
      where('state', 'in', ['programmato', 'adesso']),
      orderBy('startDate', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<AppEvent[]>;
  }

  getEventById(eventId: string): Observable<AppEvent | null> {
    const eventDocRef = doc(this.firestore, this.eventsCollectionPath, eventId);
    return from(getDoc(eventDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as AppEvent;
        } else {
          return null;
        }
      })
    );
  }

  private generateSubSlots(count: number, existingSubSlots?: EventSubSlot[]): EventSubSlot[] {
    const newSubSlots: EventSubSlot[] = [];
    for (let i = 0; i < count; i++) {
      const existing = existingSubSlots?.find(es => es.name === `Postazione ${i + 1}`);
      if (existing) {
        newSubSlots.push(existing);
      } else {
        newSubSlots.push({
          id: uuidv4(),
          name: `Postazione ${i + 1}`,
          isBooked: false,
          bookingInfo: null
        });
      }
    }
    return newSubSlots;
  }

  async addEvent(eventData: Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
    const dataToSave = {
      ...eventData,
      startDate: eventData.startDate instanceof Date ? Timestamp.fromDate(eventData.startDate) : eventData.startDate,
      endDate: eventData.endDate instanceof Date ? Timestamp.fromDate(eventData.endDate) : eventData.endDate,
      photoAreaImageUrl: eventData.photoAreaImageUrl || this.defaultEventPhotoAreaUrl,
      routeImageUrl: eventData.routeImageUrl || this.defaultEventRouteUrl,
      slots: eventData.slots?.map(slot => ({
        ...slot,
        imageUrl: slot.imageUrl || this.defaultSlotImageUrl,
        subSlots: this.generateSubSlots(slot.numberOfSubSlots)
      })) || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    return addDoc(this.eventsCollection, dataToSave);
  }

  async updateEvent(eventId: string, eventData: Partial<AppEvent>): Promise<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollectionPath, eventId);
    const dataToUpdate: UpdateData<AppEvent> = {
      ...eventData,
      updatedAt: serverTimestamp()
    };
    if (eventData.startDate && eventData.startDate instanceof Date) {
      dataToUpdate.startDate = Timestamp.fromDate(eventData.startDate);
    }
    if (eventData.endDate && eventData.endDate instanceof Date) {
      dataToUpdate.endDate = Timestamp.fromDate(eventData.endDate);
    } else if (eventData.hasOwnProperty('endDate') && eventData.endDate === null) {
        dataToUpdate.endDate = null;
    }
    if (eventData.hasOwnProperty('photoAreaImageUrl')) {
        dataToUpdate.photoAreaImageUrl = eventData.photoAreaImageUrl === '' || eventData.photoAreaImageUrl === null ? this.defaultEventPhotoAreaUrl : eventData.photoAreaImageUrl;
    }
    if (eventData.hasOwnProperty('routeImageUrl')) {
        dataToUpdate.routeImageUrl = eventData.routeImageUrl === '' || eventData.routeImageUrl === null ? this.defaultEventRouteUrl : eventData.routeImageUrl;
    }

    if (eventData.hasOwnProperty('slots')) {
      const currentEventSnapshot = await getDoc(eventDocRef);
      const currentEventData = currentEventSnapshot.data() as AppEvent | undefined;

      dataToUpdate.slots = eventData.slots?.map(updatedSlot => {
        const existingMainSlot = currentEventData?.slots?.find(s => s.id === updatedSlot.id);
        return {
          ...updatedSlot,
          imageUrl: updatedSlot.imageUrl === '' || updatedSlot.imageUrl === null ? this.defaultSlotImageUrl : updatedSlot.imageUrl,
          subSlots: this.generateSubSlots(updatedSlot.numberOfSubSlots, existingMainSlot?.subSlots)
        };
      }) || [];
    }
    return updateDoc(eventDocRef, dataToUpdate);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollectionPath, eventId);
    return deleteDoc(eventDocRef);
  }

  uploadEventImage(
    eventId: string,
    file: File,
    imageType: 'photoArea' | 'routePath' | 'slotImage',
    slotId?: string
  ): { uploadProgress$: Observable<number | undefined>; downloadUrlPromise: Promise<string> } {
    let filePath = `event_images/${eventId}/`;
    if (imageType === 'slotImage' && slotId) {
      filePath += `slots/${slotId}/${Date.now()}_${file.name}`;
    } else {
      filePath += `${imageType}/${Date.now()}_${file.name}`;
    }

    const fileRef = storageRef(this.storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    const uploadProgress$ = new Observable<number | undefined>((observer) => {
      uploadTask.on('state_changed', (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next(progress);
        }, (error) => observer.error(error),
        () => { observer.next(100); observer.complete(); }
      );
      return () => uploadTask.cancel();
    });

    const downloadUrlPromise = new Promise<string>((resolve, reject) => {
      uploadTask.then(async (snapshot: UploadTaskSnapshot) => {
          try {
            const downloadURL = await getDownloadURL(snapshot.ref);
            resolve(downloadURL);
          } catch (error) { reject(error); }
        }, (error) => reject(error)
      );
    });
    return { uploadProgress$, downloadUrlPromise };
  }

  async deleteEventImage(imageUrl: string | null | undefined): Promise<void> {
    if (!imageUrl || imageUrl.startsWith('assets/')) {
      return;
    }
    try {
      const imageRef = storageRef(this.storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error(`Error deleting image ${imageUrl} from Storage:`, error);
    }
  }

  async registerVtcToEventSubSlot(
    eventId: string,
    mainSlotId: string,
    subSlotId: string,
    bookingDetails: Omit<SubSlotBookingInfo, 'bookingId' | 'bookedAt'>,
    appLink: string // Aggiunto appLink come parametro
  ): Promise<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollectionPath, eventId);
    return runTransaction(this.firestore, async (transaction) => {
      const eventSnap = await transaction.get(eventDocRef);
      if (!eventSnap.exists()) {
        throw new Error("Evento non trovato!");
      }
      const eventData = eventSnap.data() as AppEvent;
      const mainSlots = eventData.slots ? JSON.parse(JSON.stringify(eventData.slots)) as EventSlot[] : [];
      const mainSlotIndex = mainSlots.findIndex(ms => ms.id === mainSlotId);

      if (mainSlotIndex === -1) {
        throw new Error("Zona (Slot Principale) non trovata!");
      }
      const targetMainSlot = mainSlots[mainSlotIndex];
      if (!targetMainSlot.subSlots) {
        targetMainSlot.subSlots = [];
      }

      const subSlotIndex = targetMainSlot.subSlots.findIndex(ss => ss.id === subSlotId);
      if (subSlotIndex === -1) {
        throw new Error("Postazione (Sub Slot) non trovata!");
      }

      const targetSubSlot = targetMainSlot.subSlots[subSlotIndex];
      if (targetSubSlot.isBooked) {
        throw new Error(`La postazione "${targetSubSlot.name}" nella zona "${targetMainSlot.name}" è già prenotata.`);
      }

      const newBooking: SubSlotBookingInfo = {
        ...bookingDetails,
        bookingId: doc(collection(this.firestore, '_')).id,
        bookedAt: Timestamp.now()
      };

      targetSubSlot.isBooked = true;
      targetSubSlot.bookingInfo = newBooking;

      targetMainSlot.subSlots[subSlotIndex] = targetSubSlot;
      mainSlots[mainSlotIndex] = targetMainSlot;

      transaction.update(eventDocRef, { slots: mainSlots, updatedAt: serverTimestamp() });

      await this.notificationService.createSubSlotBookingNotification(
        { id: eventId, name: eventData.name },
        { id: targetMainSlot.id, name: targetMainSlot.name },
        { id: targetSubSlot.id, name: targetSubSlot.name },
        { companyName: newBooking.companyName }
      );

      // --- NUOVA LOGICA: Invio dell'embed a Discord dopo l'iscrizione riuscita ---
      try {
        const eventDataForDiscord = {
          eventName: eventData.name,
          vtcName: newBooking.companyName,
          registeredByUsername: newBooking.contactName,
          vtcLogo: '', // TODO: Aggiungi qui l'URL del logo della VTC se disponibile
          registeredByUserAvatar: '', // TODO: Aggiungi qui l'URL dell'avatar dell'utente se disponibile
          server: eventData.server || 'N/D',
          meetingPoint: eventData.departure || 'N/D',
          departureTime: eventData.startDate.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) || 'N/D',
          departureLocation: eventData.departure || 'N/D',
          destination: eventData.destination || 'N/D',
          notes: eventData.description || 'Nessuna nota specifica per l\'evento.',
          // Nuovi campi richiesti:
          mainSlotName: targetMainSlot.name,
          subSlotName: targetSubSlot.name,
          contactName: newBooking.contactName,
          contactEmail: newBooking.contactEmail,
          appLink: appLink // Il link all'app
        };
        await this.sendVtcSubscriptionToDiscord(eventDataForDiscord);
        console.log('Notifica Discord per iscrizione VTC inviata con successo.');
      } catch (discordError) {
        console.error('Errore durante l\'invio della notifica Discord per iscrizione VTC:', discordError);
      }
      // --- FINE NUOVA LOGICA ---
    });
  }

  /**
   * Invia i dati di iscrizione di una VTC a un evento al webhook di Discord.
   * @param eventData L'oggetto contenente le informazioni dell'evento e della VTC.
   * @returns Promise<any> che indica il successo o l'errore della richiesta HTTP.
   */
  async sendVtcSubscriptionToDiscord(eventData: any): Promise<any> {
    if (!this.firebaseEventWebhookUrl) {
      console.error('URL del webhook Firebase per eventi non configurato in environment.ts');
      return Promise.reject('URL del webhook non configurato.');
    }

    try {
      return await firstValueFrom(this.http.post(this.firebaseEventWebhookUrl, eventData));
    } catch (error) {
      console.error('Errore nella richiesta HTTP per Discord webhook:', error);
      throw error;
    }
  }
}
