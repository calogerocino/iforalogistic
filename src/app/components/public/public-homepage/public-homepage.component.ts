import { Component, OnInit, inject } from '@angular/core';
import { PublicNavbarComponent } from '../public-navbar/public-navbar.component';
import { RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { EventService, AppEvent, EventDLCs, EventSlot, SlotParticipantInfo } from '../../../services/event.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ImageModalService } from '../../../services/image-modal.service';

@Component({
  selector: 'app-public-homepage',
  standalone: true,
  imports: [PublicNavbarComponent, RouterModule, CommonModule, DatePipe, ReactiveFormsModule],
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
  private youtubeVideoId = 'YOUR_YOUTUBE_VIDEO_ID';

  vtcRegistrationForm: FormGroup;
  availableSlotsForBooking: EventSlot[] = [];
  isLoadingRegistration = false;
  registrationMessage: { type: 'success' | 'error', text: string } | null = null;

  dlcOptions: { name: keyof EventDLCs, label: string }[] = [
    { name: 'goingEast', label: 'Going East!' }, { name: 'scandinavia', label: 'Scandinavia' },
    { name: 'viveLaFrance', label: 'Vive la France!' }, { name: 'italia', label: 'Italia' },
    { name: 'beyondTheBalticSea', label: 'Beyond the Baltic Sea' }, { name: 'roadToTheBlackSea', label: 'Road to the Black Sea' },
    { name: 'iberia', label: 'Iberia' }, { name: 'westBalkans', label: 'West Balkans' },
    { name: 'greece', label: 'Greece'}
  ];

  public eventService = inject(EventService);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(FormBuilder);

private imageModalService = inject(ImageModalService);

  constructor() {
    this.currentYear = new Date().getFullYear();
    this.upcomingEvents$ = this.eventService.getUpcomingInternalEvents();
    if (this.youtubeVideoId && this.youtubeVideoId !== 'YOUR_YOUTUBE_VIDEO_ID') {
      this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/VIDEO_ID5`);
    } else {
      console.warn("ID Video YouTube non impostato in PublicHomepageComponent.");
    }

    this.vtcRegistrationForm = this.fb.group({
      companyName: ['', Validators.required],
      contactName: ['', Validators.required],
      contactEmail: ['', [Validators.required, Validators.email]],
      participantsCount: [1, [Validators.required, Validators.min(1)]],
      selectedSlotId: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.upcomingEvents$.subscribe({
      next: () => this.isLoadingEvents = false,
      error: (err) => {
        console.error("Errore caricamento eventi per homepage:", err);
        this.isLoadingEvents = false;
      }
    });

    this.vtcRegistrationForm.get('participantsCount')?.valueChanges.subscribe(count => {
        this.updateAvailableSlots(count);
    });
  }

  getEventStateClass(state: string | undefined): string {
    if (!state) return 'event-state-default';
    return `event-state-${state.toLowerCase().replace(' ', '-')}`;
  }

  openEventModal(event: AppEvent): void {
    this.selectedEventForModal = event;
    this.isEventModalOpen = true;
    this.isRegistrationPanelOpen = false;
    this.registrationMessage = null;
    this.vtcRegistrationForm.reset({ participantsCount: 1, selectedSlotId: null });
    this.updateAvailableSlots(1);
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
    if (this.isRegistrationPanelOpen) {
        this.updateAvailableSlots(this.vtcRegistrationForm.get('participantsCount')?.value || 1);
    }
  }

  updateAvailableSlots(participantsNeeded: number | null): void {
    if (!this.selectedEventForModal || !this.selectedEventForModal.slots || participantsNeeded === null || participantsNeeded < 1) {
      this.availableSlotsForBooking = [];
      return;
    }
    this.availableSlotsForBooking = this.selectedEventForModal.slots.filter(slot => {
      const bookedPlaces = slot.bookings?.reduce((sum, b) => sum + b.participantsCount, 0) || 0;
      return (slot.capacity - bookedPlaces) >= participantsNeeded;
    });
    const selectedSlotIdControl = this.vtcRegistrationForm.get('selectedSlotId');
    if (selectedSlotIdControl?.value && !this.availableSlotsForBooking.find(s => s.id === selectedSlotIdControl.value)) {
        selectedSlotIdControl.setValue(null);
    }
  }

  calculateAvailablePlaces(slot: EventSlot): number {
    const booked = slot.bookings?.reduce((sum, b) => sum + b.participantsCount, 0) || 0;
    return slot.capacity - booked;
  }

  async onVtcRegisterSubmit(): Promise<void> {
    if (this.vtcRegistrationForm.invalid || !this.selectedEventForModal?.id) {
      this.registrationMessage = { type: 'error', text: 'Per favore, compila tutti i campi e seleziona uno slot.' };
      Object.values(this.vtcRegistrationForm.controls).forEach(control => control.markAsTouched());
      return;
    }

    this.isLoadingRegistration = true;
    this.registrationMessage = null;

    const formValues = this.vtcRegistrationForm.value;
    const bookingInfo: Omit<SlotParticipantInfo, 'bookingId' | 'bookedAt'> = {
      companyName: formValues.companyName,
      contactName: formValues.contactName,
      contactEmail: formValues.contactEmail,
      participantsCount: formValues.participantsCount
    };

    try {
      await this.eventService.registerVtcToSlot(this.selectedEventForModal.id, formValues.selectedSlotId, bookingInfo);
      this.registrationMessage = { type: 'success', text: 'Registrazione all\'evento completata con successo!' };
      this.vtcRegistrationForm.reset({ participantsCount: 1, selectedSlotId: null });
      if (this.selectedEventForModal && this.selectedEventForModal.id) {
        this.eventService.getEventById(this.selectedEventForModal.id).subscribe(updatedEvent => {
            this.selectedEventForModal = updatedEvent;
            this.updateAvailableSlots(this.vtcRegistrationForm.get('participantsCount')?.value || 1);
        });
      }
    } catch (error: any) {
      this.registrationMessage = { type: 'error', text: `Errore durante la registrazione: ${error.message || 'Riprova.'}` };
      console.error("Errore registrazione VTC:", error);
    } finally {
      this.isLoadingRegistration = false;
    }
  }

  openVideoModal(): void {
    if (this.videoUrl) {
        this.isVideoModalOpen = true;
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Impossibile aprire il modale video: URL non valido o ID non impostato.");
    }
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


   openImageInModal(imageUrl: string | null | undefined): void {
    if (imageUrl) {
      this.imageModalService.openModal(imageUrl);
    }
  }

  objectValues = Object.values;
}
