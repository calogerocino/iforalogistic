import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common'; // Assicurati di avere questi import
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { UserService, DisplayUser } from '../../../../services/user.service';
import { Delivery, TelemetryService } from '../../../../services/telemetry.service';

@Component({
  selector: 'app-player-datahub',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe], // Aggiungi i Pipe per la formattazione
  templateUrl: './datahub.component.html',
  styleUrls: ['./datahub.component.scss'],
})
export class PlayerDatahubComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private telemetryService = inject(TelemetryService);

  // Observable per la lista di utenti
  users$!: Observable<DisplayUser[]>;
  selectedUserId: string | null = null;

  // Proprietà per gestire lo stato dei dati
  private allUserDeliveries: Delivery[] = [];
  filteredDeliveries: Delivery[] = [];

  // Proprietà per la navigazione tra mesi
  currentDate = new Date();

  // Riepilogo calcolato
  monthlySummary = {
    totalDistance: 0,
    totalProfit: 0,
  };

  private tripsSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
  }

  ngOnDestroy(): void {
    // Pulisce la sottoscrizione per evitare memory leak
    this.tripsSubscription?.unsubscribe();
  }

  // Chiamato quando si seleziona un nuovo utente dal dropdown
  onUserChange(): void {
    this.tripsSubscription?.unsubscribe(); // Cancella la sottoscrizione precedente

    if (this.selectedUserId) {
      // Si sottoscrive per ricevere i dati dei viaggi
      this.tripsSubscription = this.telemetryService.getTripsForUser(this.selectedUserId)
        .subscribe(deliveries => {
          this.allUserDeliveries = deliveries; // Salva la lista completa
          this.filterAndProcessData(); // Esegue il primo filtraggio e calcolo
        });
    } else {
      this.allUserDeliveries = []; // Resetta se nessun utente è selezionato
      this.filterAndProcessData();
    }
  }

  // Permette di cambiare il mese visualizzato
  changeMonth(offset: number): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    this.currentDate = new Date(this.currentDate); // Forza Angular a rilevare il cambiamento
    this.filterAndProcessData(); // Riesegue il calcolo per il nuovo mese
  }

  // Funzione centrale che filtra i dati e calcola i riepiloghi
  filterAndProcessData(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Filtra i viaggi per mostrare solo quelli del mese e anno selezionati
    this.filteredDeliveries = this.allUserDeliveries.filter(d => {
      if (!d.startTime?.toDate) return false;
      const deliveryDate = d.startTime.toDate();
      return deliveryDate.getFullYear() === year && deliveryDate.getMonth() === month;
    });

    // Calcola i totali usando le consegne filtrate
    this.monthlySummary.totalDistance = this.filteredDeliveries.reduce((sum, d) => sum + (d.acceptedDistance || 0), 0);
    this.monthlySummary.totalProfit = this.filteredDeliveries.reduce((sum, d) => sum + (d.profit || 0), 0);
  }

  // Funzione di utilità per calcolare il tempo trascorso
  calculateRealTime(start: any, end: any): string {
    if (!start?.seconds || !end?.seconds) return 'N/D';
    const diffSeconds = end.seconds - start.seconds;
    if (diffSeconds < 0) return 'In corso';

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
