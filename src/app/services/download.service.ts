import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  getDownloadUrl(): Observable<string | null> {
    const appInfoDocRef = doc(this.firestore, 'app_info/version');
    return from(getDoc(appInfoDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return data['download_url'] || null;
        } else {
          return null;
        }
      })
    );
  }
}
