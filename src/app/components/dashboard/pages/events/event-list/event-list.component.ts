import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { EventService, AppEvent } from '../../../../../services/event.service';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule],
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss']
})
export class EventListComponent implements OnInit {
  events$: Observable<AppEvent[]>;
  isLoading = true;
  error: string | null = null;
  isCreateDropdownOpen = false;
  showExternalEventWarning = false;
  deleteError: string | null = null;
  deleteSuccess: string | null = null;


  private eventService = inject(EventService);
  private router = inject(Router);

  constructor() {
    this.events$ = this.eventService.getAllEvents();
  }

  ngOnInit(): void {
    this.events$.subscribe({
      next: () => this.isLoading = false,
      error: (err) => {
        this.error = 'Errore nel caricamento degli eventi.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  toggleCreateDropdown(): void {
    this.isCreateDropdownOpen = !this.isCreateDropdownOpen;
    if (!this.isCreateDropdownOpen) {
        this.showExternalEventWarning = false;
    }
  }

  closeCreateDropdown(): void {
    this.isCreateDropdownOpen = false;
    this.showExternalEventWarning = false;
  }

  navigateToCreateEvent(type: 'internal' | 'external'): void {
    this.isCreateDropdownOpen = false;
    if (type === 'external') {
      this.showExternalEventWarning = true;
      setTimeout(() => {
        this.showExternalEventWarning = false;
      }, 3000);
    } else {
      this.showExternalEventWarning = false;
      this.router.navigate(['/dashboard/eventi/nuovo'], { queryParams: { type: type } });
    }
  }

  async deleteEvent(eventId: string | undefined, eventName: string): Promise<void> {
    if (!eventId) {
      this.deleteError = "ID evento non valido.";
      setTimeout(() => this.deleteError = null, 3000);
      return;
    }

    // TODO: Implementare un modale di conferma qui per una migliore UX
    // const confirmed = confirm(`Sei sicuro di voler eliminare l'evento "${eventName}"?`);
    // if (!confirmed) {
    //   return;
    // }

    this.isLoading = true; // Potrebbe essere utile un loader specifico per l'eliminazione
    this.deleteError = null;
    this.deleteSuccess = null;

    try {
      await this.eventService.deleteEvent(eventId);
      this.deleteSuccess = `Evento "${eventName}" eliminato con successo.`;
      // L'Observable events$ dovrebbe aggiornarsi automaticamente grazie a collectionData
      // Se non lo fa, potresti dover forzare un ricaricamento o gestire lo stato localmente.
    } catch (err: any) {
      this.deleteError = `Errore durante l'eliminazione dell'evento: ${err.message || 'Riprova.'}`;
      console.error(err);
    } finally {
      this.isLoading = false; // Resetta il loader generale
      setTimeout(() => { // Nascondi messaggi dopo un po'
        this.deleteSuccess = null;
        this.deleteError = null;
      }, 4000);
    }
  }

  getEventStateClass(state: string): string {
    return `event-state-${state.toLowerCase().replace(' ', '-')}`;
  }
}
