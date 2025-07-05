import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';

// Interfaccia corretta con i campi in camelCase
export interface User {
  id: string;
  firstName: string; // CORRETTO: da 'firstname' a 'firstName'
  lastName?: string;  // CORRETTO: aggiunto 'lastName' e reso opzionale
  email: string;
  role: 'Admin' | 'User' | 'Editor';
}

export interface DisplayUser extends User {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  getUsers(): Observable<DisplayUser[]> {
    const usersCollection = collection(this.firestore, 'users');

    return (collectionData(usersCollection, { idField: 'id' }) as Observable<User[]>).pipe(
      map(users => users.map(user => ({
        ...user,
        // Logica corretta che usa 'firstName' e 'lastName'
        // Gestisce anche il caso in cui 'lastName' non sia presente
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      })))
    );
  }
}
