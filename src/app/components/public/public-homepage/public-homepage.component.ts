import { Component, OnInit, inject } from '@angular/core';
import { PublicNavbarComponent } from '../public-navbar/public-navbar.component';
import { RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { EventService, AppEvent, EventDLCs } from '../../../services/event.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-public-homepage',
  standalone: true,
  imports: [PublicNavbarComponent, RouterModule, CommonModule, DatePipe],
  templateUrl: './public-homepage.component.html',
  styleUrls: ['./public-homepage.component.scss']
})
export class PublicHomepageComponent implements OnInit {
  currentYear: number;
  upcomingEvents$: Observable<AppEvent[]>;
  isLoadingEvents = true;
  selectedEventForModal: AppEvent | null = null;
  isEventModalOpen = false;
  isRegistrationPanelOpen = false;

  isVideoModalOpen = false;
  videoUrl: SafeResourceUrl | null = null;
  private rawVideoUrl = 'https://www.youtube.com/watch?v=amoh-Rlc6MU'; // Sostituisci con il tuo ID video VALIDO

  dlcOptions: { name: keyof EventDLCs, label: string }[] = [
    { name: 'goingEast', label: 'Going East!' },
    { name: 'scandinavia', label: 'Scandinavia' },
    { name: 'viveLaFrance', label: 'Vive la France!' },
    { name: 'italia', label: 'Italia' },
    { name: 'beyondTheBalticSea', label: 'Beyond the Baltic Sea' },
    { name: 'roadToTheBlackSea', label: 'Road to the Black Sea' },
    { name: 'iberia', label: 'Iberia' },
    { name: 'westBalkans', label: 'West Balkans' },
    { name: 'greece', label: 'Greece' }
  ];

  public eventService = inject(EventService);
  private sanitizer = inject(DomSanitizer);

  constructor() {
    this.currentYear = new Date().getFullYear();
    this.upcomingEvents$ = this.eventService.getUpcomingInternalEvents();
    if (this.rawVideoUrl.includes('youtube.com/embed/')) { // Controlla se è già un URL di embed
        this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawVideoUrl);
    } else { // Altrimenti, costruisci l'URL di embed (esempio per ID video)
        this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://m.youtube.com/watch?v=bviMJKuMKNM`);
    }
  }

  ngOnInit(): void {
    this.upcomingEvents$.subscribe({
      next: () => this.isLoadingEvents = false,
      error: (err) => {
        console.error("Errore caricamento eventi per homepage:", err);
        this.isLoadingEvents = false;
      }
    });
  }

  getEventStateClass(state: string | undefined): string {
    if (!state) return 'event-state-default';
    return `event-state-${state.toLowerCase().replace(' ', '-')}`;
  }

  openEventModal(event: AppEvent): void {
    console.log('Evento selezionato per il modale:', event); // LOG DI DEBUG
    this.selectedEventForModal = event;
    console.log('selectedEventForModal dopo assegnazione:', this.selectedEventForModal); // LOG DI DEBUG
    this.isEventModalOpen = true;
    this.isRegistrationPanelOpen = false;
    document.body.style.overflow = 'hidden';
  }

  closeEventModal(): void {
    this.isEventModalOpen = false;
    this.selectedEventForModal = null;
    this.isRegistrationPanelOpen = false;
    document.body.style.overflow = 'auto';
  }

  toggleRegistrationPanel(): void {
    this.isRegistrationPanelOpen = !this.isRegistrationPanelOpen;
  }

  openVideoModal(): void {
    this.isVideoModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeVideoModal(): void {
    this.isVideoModalOpen = false;
    document.body.style.overflow = 'auto';
  }

  hasSelectedDlcsForModal(dlcs: EventDLCs | undefined | null): boolean {
    if (!dlcs) {
      return false;
    }
    return Object.values(dlcs).some(isSelected => isSelected === true);
  }
}
