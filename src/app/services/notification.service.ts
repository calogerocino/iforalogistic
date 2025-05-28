import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, serverTimestamp, Timestamp, doc, updateDoc, query, where, orderBy, limit, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AppEvent, EventSlot, SlotParticipantInfo } from './event.service'; // Importa interfacce necessarie

export interface AppNotification {
  id?: string;
  eventId: string;
  eventName: string;
  slotId: string;
  slotName: string;
  companyName: string;
  participantsCount: number;
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

  // Crea una notifica per una nuova prenotazione di slot
  async createSlotBookingNotification(
    event: Pick<AppEvent, 'id' | 'name'>,
    slot: Pick<EventSlot, 'id' | 'name'>,
    booking: Pick<SlotParticipantInfo, 'companyName' | 'participantsCount'>
  ): Promise<void> {
    if (!event.id || !slot.id) {
      console.error('Event ID or Slot ID is missing for notification creation');
      return;
    }
    const message = `La VTC "${booking.companyName}" si è registrata con ${booking.participantsCount} partecipanti allo slot "${slot.name}" per l'evento "${event.name}".`;
    const newNotification: Omit<AppNotification, 'id'> = {
      eventId: event.id,
      eventName: event.name,
      slotId: slot.id,
      slotName: slot.name,
      companyName: booking.companyName,
      participantsCount: booking.participantsCount,
      message: message,
      timestamp: Timestamp.now(),
      isRead: false,
      interacted: false, // Initialize as not interacted
      navigateTo: `/dashboard/eventi/${event.id}`
    };
    try {
      await addDoc(this.notificationsCollection, newNotification);
    } catch (error) {
      console.error("Errore durante la creazione della notifica:", error);
    }
  }

  // Ottiene le notifiche non lette, ordinate per data (le più recenti prima)
  getUnreadNotifications(count: number = 10): Observable<AppNotification[]> {
    const q = query(
      this.notificationsCollection,
      where('isRead', '==', false),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }

  // Ottiene tutte le notifiche, ordinate per data (le più recenti prima)
  getAllNotifications(count: number = 20): Observable<AppNotification[]> {
    const q = query(
      this.notificationsCollection,
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }


  // Segna una notifica come letta e come interagita
  async markAsRead(notificationId: string): Promise<void> {
    const notificationDocRef = doc(this.firestore, this.notificationsCollectionPath, notificationId);
    try {
      await updateDoc(notificationDocRef, { isRead: true, interacted: true });
    } catch (error) {
      console.error("Errore durante l'aggiornamento della notifica come letta:", error);
    }
  }

  // Segna tutte le notifiche (visibili) come lette e interagite
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

  // Elimina una notifica
  async deleteNotification(notificationId: string): Promise<void> {
    const notificationDocRef = doc(this.firestore, this.notificationsCollectionPath, notificationId);
    try {
      await deleteDoc(notificationDocRef);
    } catch (error) {
      console.error("Errore durante l'eliminazione della notifica:", error);
    }
  }
}
