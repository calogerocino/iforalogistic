import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, DocumentData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Delivery {
  id: string;
  jobDetails: {
    sourceCity: string;
    destinationCity: string;
    cargoName: string;
  };
  acceptedDistance: number;
  startTime: any;
  endTime: any;
}

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private firestore: Firestore = inject(Firestore);

  getTripsForUser(userId: string): Observable<Delivery[]> {
    const tripsCollectionPath = `telemetry/${userId}/trips`;
    const tripsCollection = collection(this.firestore, tripsCollectionPath);

    return collectionData(tripsCollection, { idField: 'id' }) as Observable<Delivery[]>;
  }
}
