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
wwwwwwwwwwwwwwwwwwwwwwwwwwwww  runTransaction
} from '@angular/fire/firestore';
import {
  Storage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from '@angular/fire/storage';
import { Observable, from, firstValueFrom } from 'rxjs';
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
  companyName: string;
  contactName: string;
  contactEmail: string;
  bookedAt: Timestamp;
}

export interface EventSubSlot {
  id: string;
  name: string;
  isBooked: boolean;
  bookingInfo?: SubSlotBookingInfo | null;
}

export interface EventSlot {
  id: string;
  name: string;
  imageUrl?: string | null;
  thumbimageUrl?: string | null;
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
  thumbphotoAreaImageUrl?: string | null;
  trailerType?: TrailerType;
  cargo?: string;
  routeImageUrl?: string | null;
  thumbrouteImageUrl?: string | null;
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
      thumbphotoAreaImageUrl: eventData.thumbphotoAreaImageUrl || this.defaultEventPhotoAreaUrl, // Initialize thumbnail field
      routeImageUrl: eventData.routeImageUrl || this.defaultEventRouteUrl,
      thumbrouteImageUrl: eventData.thumbrouteImageUrl || this.defaultEventRouteUrl, // Initialize thumbnail field
      slots: eventData.slots?.map(slot => ({
        ...slot,
        imageUrl: slot.imageUrl || this.defaultSlotImageUrl,
        thumbimageUrl: slot.thumbimageUrl || this.defaultSlotImageUrl, // Initialize thumbnail field for slots
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

    // Remove thumbnail properties from dataToUpdate if they were present in eventData.
    // This ensures Angular doesn't try to update them directly.
    // The Cloud Function will handle setting these.
    delete dataToUpdate.thumbphotoAreaImageUrl;
    delete dataToUpdate.thumbrouteImageUrl;
    // Slots will be handled in the loop below.

    if (eventData.startDate && eventData.startDate instanceof Date) {
      dataToUpdate.startDate = Timestamp.fromDate(eventData.startDate);
    }
    if (eventData.endDate && eventData.endDate instanceof Date) {
      dataToUpdate.endDate = Timestamp.fromDate(eventData.endDate);
    } else if (eventData.hasOwnProperty('endDate') && eventData.endDate === null) {
        dataToUpdate.endDate = null;
    }

    // Handle photoAreaImageUrl
    if (eventData.hasOwnProperty('photoAreaImageUrl')) {
        const newPhotoAreaImageUrl = eventData.photoAreaImageUrl === '' || eventData.photoAreaImageUrl === null ? this.defaultEventPhotoAreaUrl : eventData.photoAreaImageUrl;
        dataToUpdate.photoAreaImageUrl = newPhotoAreaImageUrl;

        if (newPhotoAreaImageUrl === this.defaultEventPhotoAreaUrl) {
            // If original is set to default, thumbnail should also be default
            dataToUpdate.thumbphotoAreaImageUrl = this.defaultEventPhotoAreaUrl;
        }
        // If newPhotoAreaImageUrl is NOT default, thumbphotoAreaImageUrl is omitted
        // from dataToUpdate, letting the Cloud Function handle it.
    }

    // Handle routeImageUrl
    if (eventData.hasOwnProperty('routeImageUrl')) {
        const newRouteImageUrl = eventData.routeImageUrl === '' || eventData.routeImageUrl === null ? this.defaultEventRouteUrl : eventData.routeImageUrl;
        dataToUpdate.routeImageUrl = newRouteImageUrl;

        if (newRouteImageUrl === this.defaultEventRouteUrl) {
            dataToUpdate.thumbrouteImageUrl = this.defaultEventRouteUrl;
        }
        // If newRouteImageUrl is NOT default, thumbrouteImageUrl is omitted
        // from dataToUpdate, letting the Cloud Function handle it.
    }

    if (eventData.hasOwnProperty('slots')) {
      const currentEventSnapshot = await getDoc(eventDocRef);
      const currentEventData = currentEventSnapshot.data() as AppEvent | undefined;

      dataToUpdate.slots = eventData.slots?.map(updatedSlot => {
        const existingMainSlot = currentEventData?.slots?.find(s => s.id === updatedSlot.id);
        const imageUrl = updatedSlot.imageUrl === '' || updatedSlot.imageUrl === null ? this.defaultSlotImageUrl : updatedSlot.imageUrl;

        const slotUpdate: EventSlot = {
          ...updatedSlot,
          imageUrl: imageUrl,
          subSlots: this.generateSubSlots(updatedSlot.numberOfSubSlots, existingMainSlot?.subSlots)
        };

        if (imageUrl === this.defaultSlotImageUrl) {
          slotUpdate.thumbimageUrl = this.defaultSlotImageUrl;
        }
        // If imageUrl is NOT default, thumbimageUrl is omitted from slotUpdate,
        // relying on CF.
        return slotUpdate;
      }) || [];
    }
    return updateDoc(eventDocRef, dataToUpdate);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const eventDocRef = doc(this.firestore, this.eventsCollectionPath, eventId);
    // Before deleting the event document, you might want to delete all associated images from storage.
    // This requires fetching the event to get image URLs.
    const eventSnap = await getDoc(eventDocRef);
    if (eventSnap.exists()) {
      const eventData = eventSnap.data() as AppEvent;
      const imageUrlsToDelete: string[] = [];

      if (eventData.photoAreaImageUrl && eventData.photoAreaImageUrl !== this.defaultEventPhotoAreaUrl) {
        imageUrlsToDelete.push(eventData.photoAreaImageUrl);
      }
      if (eventData.routeImageUrl && eventData.routeImageUrl !== this.defaultEventRouteUrl) {
        imageUrlsToDelete.push(eventData.routeImageUrl);
      }
      eventData.slots?.forEach(slot => {
        if (slot.imageUrl && slot.imageUrl !== this.defaultSlotImageUrl) {
          imageUrlsToDelete.push(slot.imageUrl);
        }
      });

      // Delete all collected images
      const deletePromises = imageUrlsToDelete.map(url => this.deleteEventImage(url));
      await Promise.all(deletePromises);
    }

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
      filePath += `slots/${slotId}/original/${Date.now()}_${file.name}`; // Path for slot original image
    } else {
      filePath += `${imageType}/original/${Date.now()}_${file.name}`; // Path for event original image
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
      // The Firebase Cloud Function `deleteThumbnail` will handle deleting the thumbnail and updating Firestore.
    } catch (error) {
      console.error(`Error deleting image ${imageUrl} from Storage (it might not exist or path is incorrect):`, error);
    }
  }

  async registerVtcToEventSubSlot(
    eventId: string,
    mainSlotId: string,
    subSlotId: string,
    bookingDetails: Omit<SubSlotBookingInfo, 'bookingId' | 'bookedAt'>,
    appLink: string
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

      try {
        const eventDataForDiscord = {
          eventName: eventData.name,
          vtcName: newBooking.companyName,
          registeredByUsername: newBooking.contactName,
          vtcLogo: '',
          registeredByUserAvatar: '',
          server: eventData.server || 'N/D',
          meetingPoint: eventData.departure || 'N/D',
          departureTime: eventData.startDate.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) || 'N/D',
          departureLocation: eventData.departure || 'N/D',
          destination: eventData.destination || 'N/D',
          notes: eventData.description || 'Nessuna nota specifica per l\'evento.',
          mainSlotName: targetMainSlot.name,
          subSlotName: targetSubSlot.name,
          contactName: newBooking.contactName,
          contactEmail: newBooking.contactEmail,
          appLink: appLink
        };
        await this.sendVtcSubscriptionToDiscord(eventDataForDiscord);
        console.log('Notifica Discord per iscrizione VTC inviata con successo.');
      } catch (discordError) {
        console.error('Errore durante l\'invio della notifica Discord per iscrizione VTC:', discordError);
      }
    });
  }

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
