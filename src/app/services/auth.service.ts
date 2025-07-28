import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  updateProfile,
  updatePassword as firebaseUpdatePassword,
  onAuthStateChanged,
  authState,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  docData,
  updateDoc,
} from '@angular/fire/firestore';
import {
  Storage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from '@angular/fire/storage';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, catchError, finalize, tap } from 'rxjs/operators';
import { UpdateData } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  firstName?: string;
  photoURL?: string | null;
  role?: 'Admin' | 'User' | 'Eventmanager' | 'Nuovo' | 'SAdmin'| 'Bannato';
}

const REMEMBER_ME_KEY = 'rememberUserActive';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage);

  readonly defaultPhotoURL = 'assets/img/default-profile.jpeg';

  readonly currentUser$ = authState(this.auth).pipe(
    tap((user) => {
      if (!user && this.isRememberMeActive()) {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }),
    switchMap((user: User | null) => {
      if (user) {
        return this.getUserProfile(user.uid);
      } else {
        return of(null);
      }
    })
  );

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      if (!user && this.isRememberMeActive()) {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    });
  }

  async register(
    email: string,
    password: string,
    firstName: string
  ): Promise<User | null> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      const user = userCredential.user;
      if (user) {
        await updateProfile(user, {
          displayName: firstName,
          photoURL: this.defaultPhotoURL,
        });

        // MODIFICA: Aggiunto "role: 'Nuovo'" alla creazione del documento utente
        await setDoc(doc(this.firestore, `users/${user.uid}`), {
          uid: user.uid,
          email: user.email,
          firstName: firstName,
          photoURL: this.defaultPhotoURL,
          role: 'Nuovo',
        });
        return user;
      }
      return null;
    } catch (error) {
      console.error('Registration error: ', error);
      throw error;
    }
  }

  async login(
    email: string,
    password: string,
    rememberMe: boolean
  ): Promise<User | null> {
    try {
      await setPersistence(
        this.auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      if (userCredential.user) {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, 'true');
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
      }
      return userCredential.user;
    } catch (error) {
      localStorage.removeItem(REMEMBER_ME_KEY);
      console.error('Login error: ', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      localStorage.removeItem(REMEMBER_ME_KEY);
    } catch (error) {
      console.error('Logout error: ', error);
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

  async updateUserProfileData(
    uid: string,
    data: Partial<AppUser>
  ): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    try {
      const firestoreData: UpdateData<AppUser> = { ...data };
      delete (firestoreData as any).lastName;

      await updateDoc(userDocRef, firestoreData);

      const firebaseUser = this.auth.currentUser;
      if (firebaseUser) {
        const profileUpdateForAuth: {
          displayName?: string;
          photoURL?: string | null;
        } = {};
        if (data.firstName) {
          profileUpdateForAuth.displayName = data.firstName;
        }
        if (data.hasOwnProperty('photoURL')) {
          profileUpdateForAuth.photoURL = data.photoURL;
        }
        if (Object.keys(profileUpdateForAuth).length > 0) {
          await updateProfile(firebaseUser, profileUpdateForAuth);
        }
      }
    } catch (error) {
      console.error('Error updating user profile data:', error);
      throw error;
    }
  }

  async updateUserPassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = this.auth.currentUser;
    if (user && user.email) {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      try {
        await reauthenticateWithCredential(user, credential);
        await firebaseUpdatePassword(user, newPassword);
      } catch (error) {
        console.error(
          'Error updating password (reauthentication or update failed):',
          error
        );
        throw error;
      }
    } else if (!user) {
      throw new Error('Nessun utente attualmente loggato.');
    } else {
      throw new Error(
        "L'email dell'utente non è disponibile per la riautenticazione."
      );
    }
  }

  uploadProfileImage(
    userId: string,
    file: File
  ): {
    uploadProgress$: Observable<number | undefined>;
    downloadUrl$: Promise<string>;
  } {
    const filePath = `profile_pictures/${userId}/${file.name}`;
    const fileRef = storageRef(this.storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    const uploadProgress$ = new Observable<number | undefined>((observer) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
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

  async deleteProfileImage(
    userId: string,
    photoURL: string | null | undefined
  ): Promise<void> {
    if (!photoURL || photoURL === this.defaultPhotoURL) {
      await this.updateUserProfileData(userId, {
        photoURL: this.defaultPhotoURL,
      });
      return;
    }

    try {
      const imageRef = storageRef(this.storage, photoURL);
      await deleteObject(imageRef);
    } catch (error) {
      console.error(
        'Error deleting profile image from Storage, it might not exist or path is incorrect:',
        error
      );
    } finally {
      await this.updateUserProfileData(userId, {
        photoURL: this.defaultPhotoURL,
      });
    }
  }

  isLoggedIn(): Observable<boolean> {
    return authState(this.auth).pipe(switchMap((user) => of(!!user)));
  }

  isRememberMeActive(): boolean {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  }
}
