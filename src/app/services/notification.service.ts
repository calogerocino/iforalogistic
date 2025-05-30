import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, serverTimestamp, Timestamp, doc, updateDoc, query, where, orderBy, limit, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AppEvent, EventSlot, EventSubSlot, SubSlotBookingInfo } from './event.service';

export interface AppNotification {
  id?: string;
  eventId: string;
  eventName: string;
  mainSlotId: string;
  mainSlotName: string;
  subSlotId: string;
  subSlotName: string;
  companyName: string;
  message: string;
  timestamp: Timestamp;
  isRead: boolean;
  interacted?: boolean;
  navigateTo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore: Firestore = inject(Firestore);
  private notificationsCollectionPath = 'notifications';
  private notificationsCollection = collection(this.firestore, this.notificationsCollectionPath);

  constructor() { }

  async createSubSlotBookingNotification(
    event: Pick<AppEvent, 'id' | 'name'>,
    mainSlot: Pick<EventSlot, 'id' | 'name'>,
    subSlot: Pick<EventSubSlot, 'id' | 'name'>,
    booking: Pick<SubSlotBookingInfo, 'companyName'>
  ): Promise<void> {
    if (!event.id || !mainSlot.id || !subSlot.id) {
      console.error('Event ID, Main Slot ID, or Sub Slot ID is missing for notification creation');
      return;
    }
    const message = `La VTC "${booking.companyName}" si è registrata alla postazione "${subSlot.name}" nella zona "${mainSlot.name}" per l'evento "${event.name}".`;
    const newNotification: Omit<AppNotification, 'id'> = {
      eventId: event.id,
      eventName: event.name,
      mainSlotId: mainSlot.id,
      mainSlotName: mainSlot.name,
      subSlotId: subSlot.id,
      subSlotName: subSlot.name,
      companyName: booking.companyName,
      message: message,
      timestamp: Timestamp.now(),
      isRead: false,
      interacted: false,
      navigateTo: `/dashboard/eventi/${event.id}`
    };
    try {
      await addDoc(this.notificationsCollection, newNotification);
    } catch (error) {
      console.error("Errore durante la creazione della notifica:", error);
    }
  }

  getUnreadNotifications(count: number = 10): Observable<AppNotification[]> {
    const q = query(
      this.notificationsCollection,
      where('isRead', '==', false),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }

  getAllNotifications(count: number = 20): Observable<AppNotification[]> {
    const q = query(
      this.notificationsCollection,
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notificationDocRef = doc(this.firestore, this.notificationsCollectionPath, notificationId);
    try {
      await updateDoc(notificationDocRef, { isRead: true, interacted: true });
    } catch (error) {
      console.error("Errore durante l'aggiornamento della notifica come letta:", error);
    }
  }

  async markMultipleAsRead(notifications: AppNotification[]): Promise<void> {
    const batch = [];
    for (const notification of notifications) {
      if (notification.id && !notification.isRead) {
        const notificationDocRef = doc(this.firestore, this.notificationsCollectionPath, notification.id);
        batch.push(updateDoc(notificationDocRef, { isRead: true, interacted: true }));
      }
    }
    try {
        await Promise.all(batch);
    } catch (error) {
        console.error("Errore durante l'aggiornamento di multiple notifiche come lette:", error);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const notificationDocRef = doc(this.firestore, this.notificationsCollectionPath, notificationId);
    try {
      await deleteDoc(notificationDocRef);
    } catch (error) {
      console.error("Errore durante l'eliminazione della notifica:", error);
    }
  }
}
