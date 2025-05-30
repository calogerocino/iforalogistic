import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { PublicNavbarComponent } from '../public-navbar/public-navbar.component';
import { RouterModule } from '@angular/router';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Observable, filter, map, of } from 'rxjs';
import {
  EventService,
  AppEvent,
  EventDLCs,
  EventSlot,
  EventSubSlot,
  SubSlotBookingInfo,
} from '../../../services/event.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ImageModalService } from '../../../services/image-modal.service';

interface VTCPartner {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
}

@Component({
  selector: 'app-public-homepage',
  standalone: true,
  imports: [
    PublicNavbarComponent,
    RouterModule,
    CommonModule,
    DatePipe,
    TitleCasePipe,
    ReactiveFormsModule,
  ],
  templateUrl: './public-homepage.component.html',
  styleUrls: ['./public-homepage.component.scss'],
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

  vtcRegistrationForm: FormGroup;
  selectedMainSlotForBooking: EventSlot | null = null;
  availableSubSlotsForBooking: EventSubSlot[] = [];

  isLoadingRegistration = false;
  registrationMessage: { type: 'success' | 'error'; text: string } | null =
    null;

  dlcOptions: { name: keyof EventDLCs; label: string }[] = [
    { name: 'goingEast', label: 'Going East!' },
    { name: 'scandinavia', label: 'Scandinavia' },
    { name: 'viveLaFrance', label: 'Vive la France!' },
    { name: 'italia', label: 'Italia' },
    { name: 'beyondTheBalticSea', label: 'Beyond the Baltic Sea' },
    { name: 'roadToTheBlackSea', label: 'Road to the Black Sea' },
    { name: 'iberia', label: 'Iberia' },
    { name: 'westBalkans', label: 'West Balkans' },
    { name: 'greece', label: 'Greece' },
  ];

  public eventService = inject(EventService);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(FormBuilder);
  private imageModalService = inject(ImageModalService);
  private cdr = inject(ChangeDetectorRef);

  vtcPartners: VTCPartner[] = [
    {
      name: 'Logis 2.0',
      logoUrl: 'assets/img/vtcloghi/logis.png',
      websiteUrl: 'https://trucksbook.eu/company/48021',
    },
    {
      name: 'Team Simulator Italia',
      logoUrl: 'assets/img/vtcloghi/tsi.png',
      websiteUrl: 'https://trucksbook.eu/company/64213',
    },
    {
      name: 'KAL',
      logoUrl: 'assets/img/vtcloghi/kal.png',
      websiteUrl: 'https://trucksbook.eu/company/186726',
    },
    {
      name: 'TFI',
      logoUrl: 'assets/img/vtcloghi/tfi.png',
      websiteUrl: 'https://trucksbook.eu/company/136509',
    },
    {
      name: 'shark',
      logoUrl: 'assets/img/vtcloghi/shark.png',
      websiteUrl: 'https://trucksbook.eu/company/207950',
    },
  ];

  constructor() {
    this.currentYear = new Date().getFullYear();
    this.upcomingEvents$ = this.eventService.getUpcomingInternalEvents();

    this.vtcRegistrationForm = this.fb.group({
      companyName: ['', Validators.required],
      contactName: ['', Validators.required],
      contactEmail: ['', [Validators.required, Validators.email]],
      selectedMainSlotId: [null, Validators.required],
      selectedSubSlotId: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.upcomingEvents$.subscribe({
      next: () => (this.isLoadingEvents = false),
      error: (err) => {
        console.error('Errore caricamento eventi per homepage:', err);
        this.isLoadingEvents = false;
      },
    });

    this.vtcRegistrationForm
      .get('selectedMainSlotId')
      ?.valueChanges.subscribe((mainSlotId) => {
        this.updateAvailableSubSlots(mainSlotId);
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
    this.selectedMainSlotForBooking = null;
    this.availableSubSlotsForBooking = [];
    this.vtcRegistrationForm.reset({
       selectedMainSlotId: null,
       selectedSubSlotId: null
    });
    document.body.style.overflow = 'hidden';
  }

  closeEventModal(): void {
    this.isEventModalOpen = false;
    this.selectedEventForModal = null;
    this.isRegistrationPanelOpen = false;
    this.selectedMainSlotForBooking = null;
    this.availableSubSlotsForBooking = [];
    document.body.style.overflow = 'auto';
  }

  toggleRegistrationPanel(): void {
    this.isRegistrationPanelOpen = !this.isRegistrationPanelOpen;
    if (this.isRegistrationPanelOpen) {
      const currentMainSlotId = this.vtcRegistrationForm.get('selectedMainSlotId')?.value;
      if (currentMainSlotId) {
        this.updateAvailableSubSlots(currentMainSlotId);
      } else {
        this.availableSubSlotsForBooking = [];
      }
    }
  }

  updateAvailableSubSlots(mainSlotId: string | null): void {
    this.vtcRegistrationForm.get('selectedSubSlotId')?.reset(null, { emitEvent: false });
    this.availableSubSlotsForBooking = [];

    if (mainSlotId && this.selectedEventForModal?.slots) {
      this.selectedMainSlotForBooking = this.selectedEventForModal.slots.find(ms => ms.id === mainSlotId) || null;
      if (this.selectedMainSlotForBooking && this.selectedMainSlotForBooking.subSlots) {
        this.availableSubSlotsForBooking = this.selectedMainSlotForBooking.subSlots.filter(
          (subSlot) => !subSlot.isBooked
        );
      }
    } else {
       this.selectedMainSlotForBooking = null;
    }
    this.cdr.detectChanges();
  }

  async onVtcRegisterSubmit(): Promise<void> {
    if (this.vtcRegistrationForm.invalid || !this.selectedEventForModal?.id) {
      this.registrationMessage = {
        type: 'error',
        text: 'Per favore, compila tutti i campi e seleziona una zona e una postazione.',
      };
      Object.values(this.vtcRegistrationForm.controls).forEach((control) =>
        control.markAsTouched()
      );
      return;
    }

    this.isLoadingRegistration = true;
    this.registrationMessage = null;

    const formValues = this.vtcRegistrationForm.value;
    const bookingDetails: Omit<SubSlotBookingInfo, 'bookingId' | 'bookedAt'> = {
      companyName: formValues.companyName,
      contactName: formValues.contactName,
      contactEmail: formValues.contactEmail,
    };

    try {
      await this.eventService.registerVtcToEventSubSlot(
        this.selectedEventForModal.id!,
        formValues.selectedMainSlotId,
        formValues.selectedSubSlotId,
        bookingDetails
      );
      this.registrationMessage = {
        type: 'success',
        text: "Registrazione alla postazione completata con successo!",
      };
      this.vtcRegistrationForm.reset({
        selectedMainSlotId: null,
        selectedSubSlotId: null
      });
      this.selectedMainSlotForBooking = null;
      this.availableSubSlotsForBooking = [];


      if (this.selectedEventForModal && this.selectedEventForModal.id) {
        this.eventService
          .getEventById(this.selectedEventForModal.id)
          .subscribe((updatedEvent) => {
            this.selectedEventForModal = updatedEvent;
            if (formValues.selectedMainSlotId) {
                 this.updateAvailableSubSlots(formValues.selectedMainSlotId);
            }
            this.cdr.detectChanges();
          });
      }
    } catch (error: any) {
      this.registrationMessage = {
        type: 'error',
        text: `Errore durante la registrazione: ${error.message || 'Riprova.'}`,
      };
      console.error('Errore registrazione VTC:', error);
    } finally {
      this.isLoadingRegistration = false;
    }
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
    return Object.values(dlcs).some((isSelected) => isSelected === true);
  }

  openImageInModal(imageUrl: string | null | undefined): void {
    if (imageUrl) {
      this.imageModalService.openModal(imageUrl);
    }
  }

   getUnbookedSubSlotsCount(mainSlot: EventSlot): number {
    if (!mainSlot || !mainSlot.subSlots) return 0;
    return mainSlot.subSlots.filter(ss => !ss.isBooked).length;
  }

  objectValues = Object.values;
}
