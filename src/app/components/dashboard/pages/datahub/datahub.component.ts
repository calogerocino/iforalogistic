import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { UserService, DisplayUser } from '../../../../services/user.service';
import {
  Delivery,
  TelemetryService,
} from '../../../../services/telemetry.service';

@Component({
  selector: 'app-player-datahub',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './datahub.component.html',
  styleUrls: ['./datahub.component.scss'],
})
export class PlayerDatahubComponent implements OnInit {
  private userService = inject(UserService);
  users$!: Observable<DisplayUser[]>;
  selectedUserId: string | null = null;
  deliveries$!: Observable<Delivery[]>;
  private telemetryService = inject(TelemetryService);

  monthlySummary = {
    totalDistance: 0,
    totalProfit: 0,
  };

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
    this.deliveries$ = of([]);
  }

  onUserChange(): void {
    if (this.selectedUserId) {
      console.log(`Caricamento consegne per l'utente: ${this.selectedUserId}`);
      this.deliveries$ = this.telemetryService.getTripsForUser(
        this.selectedUserId
      );
    } else {
      this.deliveries$ = of([]);
    }
  }

  calculateRealTime(start: any, end: any): string {
    if (!start?.seconds || !end?.seconds) return 'N/D';
    const diffSeconds = end.seconds - start.seconds;
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
