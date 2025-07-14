import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Interfaccia completa con tutti i campi della telemetria
export interface Delivery {
  id: string;
  userId: string;
  status: 'In Corso' | 'Consegnato' | 'Annullato';
  startTime: any; // Firebase Timestamp
  endTime?: any;

  // Dati calcolati o principali
  distanceKm?: number;
  acceptedDistance?: number;
  profit?: number;
  maxSpeedKmh?: number;
  // Dettagli del lavoro
  jobDetails: {
    sourceCity: string;
    destinationCity: string;
    cargoName: string;
    cargoWeight: number;
    cargoDamage: number;
    initialCompany: string;
    targetCompany: string;
    plannedDistance: number;
    truckModel: string;
    truckLicensePlate?: string;
    trailerLicensePlate?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TelemetryService {
  private firestore: Firestore = inject(Firestore);

  getTripsForUser(userId: string): Observable<Delivery[]> {
    const tripsCollectionPath = `telemetry/${userId}/trips`;
    const tripsCollection = collection(this.firestore, tripsCollectionPath);
    const q = query(tripsCollection, orderBy('startTime', 'desc'));

    return collectionData(q, { idField: 'id' }) as Observable<Delivery[]>;
  }
}
