import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, updateProfile, updatePassword as firebaseUpdatePassword, onAuthStateChanged, authState, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, docData, updateDoc } from '@angular/fire/firestore';
import { Storage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from '@angular/fire/storage'; // Nuove importazioni per Storage
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, catchError, finalize } from 'rxjs/operators';

export interface AppUser {
  uid: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
  photoURL?: string | null; // Può essere null
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage); // Inietta Storage

  readonly defaultPhotoURL = 'assets/img/default-profile.jpeg';

  readonly currentUser$ = authState(this.auth).pipe(
    switchMap((user: User | null) => {
      if (user) {
        return this.getUserProfile(user.uid);
      } else {
        return of(null);
      }
    })
  );

  async register(email: string, password: string, firstName: string, lastName: string): Promise<User | null> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      if (user) {
        await updateProfile(user, { displayName: `${firstName} ${lastName}`, photoURL: this.defaultPhotoURL });
        await setDoc(doc(this.firestore, `users/${user.uid}`), {
          uid: user.uid,
          email: user.email,
          firstName: firstName,
          lastName: lastName,
          photoURL: this.defaultPhotoURL
        });
        return user;
      }
      return null;
    } catch (error) {
      console.error("Registration error: ", error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<User | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Login error: ", error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error("Logout error: ", error);
      throw error;
    }
  }

  private getUserProfile(uid: string): Observable<AppUser | null> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    return docData(userDocRef) as Observable<AppUser | null>;
  }

  getCurrentUserFirebase(): User | null {
    return this.auth.currentUser;
  }

  async updateUserProfileData(uid: string, data: Partial<AppUser>): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    try {
      await updateDoc(userDocRef, data);
      const firebaseUser = this.auth.currentUser;
      if (firebaseUser) {
        const profileUpdate: { displayName?: string, photoURL?: string | null } = {};
        if (data.firstName && data.lastName) {
          profileUpdate.displayName = `${data.firstName} ${data.lastName}`;
        } else if (data.firstName && firebaseUser.displayName) {
           const currentLastName = firebaseUser.displayName.split(' ').slice(1).join(' ');
           profileUpdate.displayName = `${data.firstName} ${currentLastName}`;
        } else if (data.lastName && firebaseUser.displayName) {
           const currentFirstName = firebaseUser.displayName.split(' ')[0];
           profileUpdate.displayName = `${currentFirstName} ${data.lastName}`;
        }

        if (data.hasOwnProperty('photoURL')) { // Controlla se photoURL è esplicitamente nel payload
          profileUpdate.photoURL = data.photoURL;
        }

        if (Object.keys(profileUpdate).length > 0) {
          await updateProfile(firebaseUser, profileUpdate);
        }
      }
    } catch (error) {
      console.error("Error updating user profile data:", error);
      throw error;
    }
  }

  async updateUserPassword(oldPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (user && user.email) {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      try {
        await reauthenticateWithCredential(user, credential);
        await firebaseUpdatePassword(user, newPassword);
      } catch (error) {
        console.error("Error updating password (reauthentication or update failed):", error);
        throw error;
      }
    } else if (!user) {
      throw new Error('Nessun utente attualmente loggato.');
    } else {
      throw new Error("L'email dell'utente non è disponibile per la riautenticazione.");
    }
  }

  uploadProfileImage(userId: string, file: File): { uploadProgress$: Observable<number | undefined>, downloadUrl$: Promise<string> } {
    const filePath = `profile_pictures/${userId}/${file.name}`;
    const fileRef = storageRef(this.storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    const uploadProgress$ = new Observable<number | undefined>(observer => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          observer.error(error);
        },
        () => {
          observer.complete();
        }
      );
    });

    const downloadUrl$ = getDownloadURL(uploadTask.snapshot.ref);
    return { uploadProgress$, downloadUrl$ };
  }

  async deleteProfileImage(userId: string, photoURL: string | null | undefined): Promise<void> {
    if (!photoURL || photoURL === this.defaultPhotoURL) {
      console.log('No custom image to delete or it is the default image.');
      // Se l'immagine corrente è quella di default, aggiorniamo solo Firestore/Auth a null o default
      await this.updateUserProfileData(userId, { photoURL: this.defaultPhotoURL });
      return;
    }

    try {
      const imageRef = storageRef(this.storage, photoURL); // Tenta di ottenere il riferimento dall'URL completo
      await deleteObject(imageRef);
      console.log('Profile image deleted from Storage.');
    } catch (error) {
      // Potrebbe fallire se l'URL non è un URL di storage diretto o per permessi
      console.error('Error deleting profile image from Storage, it might not exist or path is incorrect:', error);
    } finally {
      // Imposta photoURL a default in Firestore e Auth Profile indipendentemente dal successo dell'eliminazione da Storage
      await this.updateUserProfileData(userId, { photoURL: this.defaultPhotoURL });
    }
  }


  isLoggedIn(): Observable<boolean> {
    return authState(this.auth).pipe(
      switchMap(user => of(!!user))
    );
  }
}
