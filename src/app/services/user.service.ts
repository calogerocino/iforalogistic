import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
} from '@angular/fire/firestore';

// Interfaccia corretta con i campi in camelCase
export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: 'Admin' | 'User' | 'Eventmanager' | 'Nuovo' | 'Bannato';
}

export interface DisplayUser extends User {
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private firestore: Firestore = inject(Firestore);

  constructor() {}

  getUsers(): Observable<DisplayUser[]> {
    const usersCollection = collection(this.firestore, 'users');

    return (
      collectionData(usersCollection, { idField: 'id' }) as Observable<User[]>
    ).pipe(
      tap((users) => console.log('Dati grezzi da Firestore:', users)),

      map((users) =>
        users.map((user) => ({
          ...user,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        }))
      )
    );
  }

  updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User' | 'Nuovo' | 'Eventmanager' | 'Bannato'
  ): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${userId}`);
    return updateDoc(userDocRef, { role: newRole });
  }
}
