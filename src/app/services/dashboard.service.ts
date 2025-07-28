import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError, take } from 'rxjs/operators';
import {
  Firestore,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from '@angular/fire/firestore';
import { UserService, DisplayUser } from './user.service';
import { AuthService } from './auth.service';

export interface Stats {
  distance: number;
  deliveryCount: number;
}

export interface CompanyStats extends Stats {
  employeeCount: number;
}

export interface DailyDelivery {
  id: string;
  userName: string;
  distance: number;
  jobDetails: {
    sourceCity: string;
    destinationCity: string;
    cargoName: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private firestore: Firestore = inject(Firestore);
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);

  getPersonalStats(period: 'month' | 'all-time', date: Date): Observable<Stats> {
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return of({ distance: 0, deliveryCount: 0 });

        const tripsCollectionPath = `telemetry/${user.uid}/trips`;
        const dateFilters = this.getDateFilters(period, date);
        const q = query(
          collection(this.firestore, tripsCollectionPath),
          where('status', '==', 'Consegnato'),
          ...dateFilters
        );

        return from(getDocs(q)).pipe(
          map(snapshot => this.calculateStatsFromSnapshot(snapshot)),
          catchError(err => {
            console.error("Errore nel recupero delle statistiche personali:", err);
            return of({ distance: 0, deliveryCount: 0 });
          })
        );
      })
    );
  }

  getCompanyStats(period: 'month' | 'all-time', date: Date): Observable<CompanyStats> {
    const dateFilters = this.getDateFilters(period, date);
    const q = query(
      collectionGroup(this.firestore, 'trips'),
      where('status', '==', 'Consegnato'),
      ...dateFilters
    );

    return forkJoin({
      statsSnapshot: from(getDocs(q)),
      users: this.userService.getUsers().pipe(take(1))
    }).pipe(
      map(({ statsSnapshot, users }) => ({
        ...this.calculateStatsFromSnapshot(statsSnapshot),
        employeeCount: users.length
      })),
      catchError(err => {
        console.error("Errore nel recupero delle statistiche aziendali:", err);
        return of({ distance: 0, deliveryCount: 0, employeeCount: 0 });
      })
    );
  }

  async getDailyOverview(day: Date): Promise<DailyDelivery[]> {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`[DEBUG] Sto cercando consegne tra ${startOfDay.toISOString()} e ${endOfDay.toISOString()}`);

    const q = query(
      collectionGroup(this.firestore, 'trips'),
      where('status', '==', 'Consegnato'),
      where('startTime', '>=', Timestamp.fromDate(startOfDay)),
      where('startTime', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('startTime', 'desc')
    );

    const [tripsSnapshot, users] = await Promise.all([
      getDocs(q),
      firstValueFrom(this.userService.getUsers().pipe(take(1)))
    ]);

    console.log(`[DEBUG] Query ha trovato ${tripsSnapshot.size} consegne per oggi.`);

    const userMap = new Map(users.map(u => [u.id, u.name]));
    console.log(`[DEBUG] Mappa utenti creata con ${userMap.size} utenti.`);

    const deliveries = tripsSnapshot.docs.map(doc => {
      const tripData = doc.data();
      const userId = doc.ref.parent.parent?.id;

      if (!userId) {
        console.error(`[DEBUG] CONSEGNA SCARTATA: ID documento=${doc.id}. Motivo: Impossibile estrarre userId dal percorso.`);
        return null;
      }

      const userName = userMap.get(userId);

      return {
        id: doc.id,
        userName: userName || 'Autista non trovato',
        distance: Math.floor(tripData['acceptedDistance'] || 0),
        jobDetails: tripData['jobDetails'] || { sourceCity: 'N/D', destinationCity: 'N/D', cargoName: 'N/D' }
      };
    }).filter((d): d is DailyDelivery => d !== null);

    console.log(`[DEBUG] ${deliveries.length} consegne valide verranno mostrate.`);
    return deliveries;
  }

  private calculateStatsFromSnapshot(snapshot: any): Stats {
    let totalDistance = 0;
    snapshot.docs.forEach((doc: any) => {
      totalDistance += Math.floor(doc.data()['acceptedDistance'] || 0);
    });
    return {
      distance: totalDistance,
      deliveryCount: snapshot.size
    };
  }

  private getDateFilters(period: 'month' | 'all-time', date: Date) {
    if (period === 'all-time') return [];

    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return [
      where('startTime', '>=', Timestamp.fromDate(startOfMonth)),
      where('startTime', '<=', Timestamp.fromDate(endOfMonth))
    ];
  }
}
