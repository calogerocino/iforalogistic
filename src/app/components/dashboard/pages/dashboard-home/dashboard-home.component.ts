import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, Stats, CompanyStats, DailyDelivery } from '../../../../services/dashboard.service';
import { ToastService } from '../../../../services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.scss'
})
export class DashboardHomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private toastService = inject(ToastService);

  personalStats?: Stats;
  companyStats?: CompanyStats;
  dailyDeliveries: DailyDelivery[] = [];
  dailyTotals = { distance: 0, jobs: 0 };

  isLoadingPersonal = true;
  isLoadingCompany = true;
  isLoadingDaily = true;

  personalDate = new Date();
  companyDate = new Date();
  selectedDay = new Date();

  ngOnInit(): void {
    this.loadPersonalStats('month');
    this.loadCompanyStats('month');
    this.loadDailyData();
  }

  loadPersonalStats(period: 'month' | 'all-time'): void {
    this.isLoadingPersonal = true;
    this.dashboardService.getPersonalStats(period, this.personalDate)
      .pipe(finalize(() => this.isLoadingPersonal = false))
      .subscribe(data => {
        this.personalStats = data;
      });
  }

  changePersonalMonth(offset: number): void {
    this.personalDate.setMonth(this.personalDate.getMonth() + offset);
    this.personalDate = new Date(this.personalDate);
    this.loadPersonalStats('month');
  }

  loadCompanyStats(period: 'month' | 'all-time'): void {
    this.isLoadingCompany = true;
    this.dashboardService.getCompanyStats(period, this.companyDate)
      .pipe(finalize(() => this.isLoadingCompany = false))
      .subscribe(data => {
        this.companyStats = data;
      });
  }

  changeCompanyMonth(offset: number): void {
    this.companyDate.setMonth(this.companyDate.getMonth() + offset);
    this.companyDate = new Date(this.companyDate);
    this.loadCompanyStats('month');
  }

  loadDailyData(): void {
    this.isLoadingDaily = true;
    this.dashboardService.getDailyOverview(this.selectedDay)
      .then(data => {
        this.dailyDeliveries = data;
        this.calculateDailyTotals();
      })
      .catch(error => {
        console.error("Errore nel caricamento dei dati giornalieri:", error);
        this.dailyDeliveries = [];
        this.calculateDailyTotals();
      })
      .finally(() => {
        this.isLoadingDaily = false;
      });
  }

  changeDay(offset: number): void {
    this.selectedDay.setDate(this.selectedDay.getDate() + offset);
    this.selectedDay = new Date(this.selectedDay);
    this.loadDailyData();
  }

  calculateDailyTotals(): void {
    this.dailyTotals.distance = this.dailyDeliveries.reduce((sum, d) => sum + d.distance, 0);
    this.dailyTotals.jobs = this.dailyDeliveries.reduce((sum, d) => sum + d.jobs, 0);
  }

  onShowDetails(): void {
    this.toastService.show('La pagina dei dettagli è in lavorazione', 'info');
  }
}
