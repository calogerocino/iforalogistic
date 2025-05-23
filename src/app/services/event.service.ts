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
  where
} from '@angular/fire/firestore';
import {
  Storage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from '@angular/fire/storage';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export type EventState = 'nuovo' | 'programmato' | 'adesso' | 'concluso';
export type ServerType = 'Simulation 1' | 'Simulation 2' | 'Server privato';
export type TrailerType = 'Standard' | 'Pianale' | 'Bestiame';

export interface EventDLCs {
  goingEast: boolean;
  scandinavia: boolean;
  viveLaFrance: boolean;
  italia: boolean;
  beyondTheBalticSea: boolean;
  roadToTheBlackSea: boolean;
  iberia: boolean;
  westBalkans: boolean;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage);
  private eventsCollectionPath = 'events';
  private eventsCollection = collection(this.firestore, this.eventsCollectionPath);
  readonly defaultEventPhotoAreaUrl = 'assets/img/default-placeholder.png';
  readonly defaultEventRouteUrl = 'assets/img/default-placeholder.png';

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

  async addEvent(eventData: Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
    const dataToSave = {
      ...eventData,
      startDate: eventData.startDate instanceof Date ? Timestamp.fromDate(eventData.startDate) : eventData.startDate,
      endDate: eventData.endDate instanceof Date ? Timestamp.fromDate(eventData.endDate) : eventData.endDate,
      photoAreaImageUrl: eventData.photoAreaImageUrl || null,
      routeImageUrl: eventData.routeImageUrl || null,
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
        dataToUpdate.photoAreaImageUrl = eventData.photoAreaImageUrl;
    }
    if (eventData.hasOwnProperty('routeImageUrl')) {
        dataToUpdate.routeImageUrl = eventData.routeImageUrl;
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
    imageType: 'photoArea' | 'routePath'
  ): { uploadProgress$: Observable<number | undefined>; downloadUrlPromise: Promise<string> } {
    const filePath = `event_images/${eventId}/${imageType}/${file.name}`;
    const fileRef = storageRef(this.storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    const uploadProgress$ = new Observable<number | undefined>((observer) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next(progress);
        },
        (error) => {
          observer.error(error);
        },
        () => {
          observer.next(100);
          observer.complete();
        }
      );
      return () => uploadTask.cancel();
    });

    const downloadUrlPromise = new Promise<string>((resolve, reject) => {
      uploadTask.then(
        async (snapshot: UploadTaskSnapshot) => {
          try {
            const downloadURL = await getDownloadURL(snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });

    return { uploadProgress$, downloadUrlPromise };
  }

  async deleteEventImage(
    eventId: string,
    imageUrl: string | null | undefined,
    imageType: 'photoArea' | 'routePath',
    updateDbToDefault: boolean = true
  ): Promise<void> {
    if (!imageUrl || imageUrl.startsWith('assets/')) {
      if (updateDbToDefault) {
        const updateData: Partial<AppEvent> = {};
        if (imageType === 'photoArea') updateData.photoAreaImageUrl = this.defaultEventPhotoAreaUrl;
        if (imageType === 'routePath') updateData.routeImageUrl = this.defaultEventRouteUrl;
        await this.updateEvent(eventId, updateData);
      }
      return;
    }
    try {
      const imageRef = storageRef(this.storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error(`Error deleting ${imageType} image from Storage:`, error);
    } finally {
      if (updateDbToDefault) {
        const updateData: Partial<AppEvent> = {};
        if (imageType === 'photoArea') updateData.photoAreaImageUrl = this.defaultEventPhotoAreaUrl;
        if (imageType === 'routePath') updateData.routeImageUrl = this.defaultEventRouteUrl;
        await this.updateEvent(eventId, updateData);
      }
    }
  }
}
