import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { UserService, DisplayUser } from '../../../../services/user.service';
import {
  Delivery,
  TelemetryService,
} from '../../../../services/telemetry.service';
import { ToastService } from '../../../../services/toast.service';
import { cityToCountryCode } from '../../../../data/city-data';
import {
  CARGO_ICON_MAP,
  DEFAULT_CARGO_ICON,
} from '../../../../data/cargo-data';

@Component({
  selector: 'app-player-datahub',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './datahub.component.html',
  styleUrls: ['./datahub.component.scss'],
})
export class PlayerDatahubComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private telemetryService = inject(TelemetryService);
  private toastService = inject(ToastService);
  protected cityCountryMap = cityToCountryCode;

  users$!: Observable<DisplayUser[]>;
  selectedUserId: string | null = null;

  private allUserDeliveries: Delivery[] = [];
  filteredDeliveries: Delivery[] = [];
  isLoading = false;
  currentDate = new Date();

  monthlySummary = {
    totalDistance: 0,
    totalProfit: 0,
    totalDistanceUnder100Kmh: 0,
  };

  private tripsSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
  }

  ngOnDestroy(): void {
    this.tripsSubscription?.unsubscribe();
  }

  onUserChange(): void {
    this.tripsSubscription?.unsubscribe();

    if (this.selectedUserId) {
      this.isLoading = true;
      this.tripsSubscription = this.telemetryService
        .getTripsForUser(this.selectedUserId)

        .subscribe((deliveries) => {
          this.allUserDeliveries = deliveries;
          this.filterAndProcessData();
        });
    } else {
      this.isLoading = false;
      this.allUserDeliveries = [];
      this.filterAndProcessData();
    }
  }

  changeMonth(offset: number): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    this.currentDate = new Date(this.currentDate);
    this.filterAndProcessData();
  }

  filterAndProcessData(): void {
    this.filteredDeliveries = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    this.filteredDeliveries = this.allUserDeliveries.filter((d) => {
      if (!d.startTime?.toDate) return false;
      const deliveryDate = d.startTime.toDate();
      return (
        deliveryDate.getFullYear() === year && deliveryDate.getMonth() === month
      );
    });

    this.monthlySummary.totalDistance = this.filteredDeliveries.reduce(
      (sum, d) => sum + (d.acceptedDistance || 0),
      0
    );
    this.monthlySummary.totalProfit = this.filteredDeliveries.reduce(
      (sum, d) => sum + (d.profit || 0),
      0
    );
    this.monthlySummary.totalDistanceUnder100Kmh = this.filteredDeliveries
      .filter((d) => (d.maxSpeedKmh || 0) <= 100)
      .reduce((sum, d) => sum + (d.acceptedDistance || 0), 0);

    this.isLoading = false;
  }

  calculateRealTime(start: any, end: any): string {
    if (!start?.seconds || !end?.seconds) return 'N/D';
    const diffSeconds = end.seconds - start.seconds;
    if (diffSeconds < 0) return 'In corso';

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  onShowDetails(): void {
    this.toastService.show('La pagina dei dettagli è in lavorazione', 'info');
  }

  getCountryCodeForCity(city: string | undefined): string | null {
    if (!city) {
      return null;
    }
    return this.cityCountryMap[city] || null;
  }
  getIconForCargo(cargoName?: string): string {
    if (!cargoName) {
      return DEFAULT_CARGO_ICON;
    }
    return CARGO_ICON_MAP[cargoName] || DEFAULT_CARGO_ICON;
  }
}
