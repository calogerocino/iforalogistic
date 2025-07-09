import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { PublicNavbarComponent } from '../public-navbar/public-navbar.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Observable, Subscription, filter, map, of } from 'rxjs';
import { take } from 'rxjs/operators';
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
import { Title, Meta } from '@angular/platform-browser';

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
export class PublicHomepageComponent implements OnInit, OnDestroy {
  private titleService = inject(Title);
  private metaService = inject(Meta);

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
  private route = inject(ActivatedRoute);

  private queryParamsSubscription: Subscription | undefined;
  private eventSubscription: Subscription | undefined;

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
    this.titleService.setTitle(
      'IFL Logistics - La tua VTC per Euro Truck Simulator 2'
    );
    this.metaService.updateTag({
      name: 'description',
      content:
        'Unisciti a IFL Logistics, una Virtual Trucking Company diversa dal solito. Organizziamo eventi, abbiamo una community attiva e una grande passione per la logistica virtuale.', // [cite: 1]
    });

    this.eventSubscription = this.upcomingEvents$.subscribe({
      next: () => (this.isLoadingEvents = false),
      error: (err) => {
        console.error('Errore caricamento eventi per homepage:', err);
        this.isLoadingEvents = false;
      },
    });

    this.queryParamsSubscription = this.route.queryParamMap
      .pipe(take(1))
      .subscribe((params) => {
        const eventId = params.get('eventId');
        if (eventId) {
          const initialLoadingState = this.isLoadingEvents;
          this.isLoadingEvents = true;
          this.cdr.detectChanges();

          this.eventService.getEventById(eventId).subscribe({
            next: (event) => {
              if (event && event.id) {
                if (event.eventType === 'internal') {
                  this.openEventModal(event);
                } else {
                  console.warn(
                    `Event ${eventId} is not an internal event and cannot be opened via direct link this way.`
                  );
                }
              } else {
                console.warn(
                  `Event with ID ${eventId} not found for direct link.`
                );
              }
              this.isLoadingEvents = initialLoadingState;
              if (!eventId) this.isLoadingEvents = false;
              this.cdr.detectChanges();
            },
            error: (err) => {
              console.error(
                `Error fetching event ${eventId} for direct link:`,
                err
              );
              this.isLoadingEvents = initialLoadingState;
              if (!eventId) this.isLoadingEvents = false;
              this.cdr.detectChanges();
            },
          });
        } else {
          if (!this.isLoadingEvents) {
            this.isLoadingEvents = false;
          }
        }
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
      selectedSubSlotId: null,
    });
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();
  }

  closeEventModal(): void {
    this.isEventModalOpen = false;
    this.selectedEventForModal = null;
    this.isRegistrationPanelOpen = false;
    this.selectedMainSlotForBooking = null;
    this.availableSubSlotsForBooking = [];
    document.body.style.overflow = 'auto';
    this.cdr.detectChanges();
  }

  toggleRegistrationPanel(): void {
    this.isRegistrationPanelOpen = !this.isRegistrationPanelOpen;
    if (this.isRegistrationPanelOpen) {
      const currentMainSlotId =
        this.vtcRegistrationForm.get('selectedMainSlotId')?.value;
      if (currentMainSlotId) {
        this.updateAvailableSubSlots(currentMainSlotId);
      } else {
        this.availableSubSlotsForBooking = [];
      }
    }
    this.cdr.detectChanges();
  }

  updateAvailableSubSlots(mainSlotId: string | null): void {
    this.vtcRegistrationForm
      .get('selectedSubSlotId')
      ?.reset(null, { emitEvent: false });
    this.availableSubSlotsForBooking = [];

    if (mainSlotId && this.selectedEventForModal?.slots) {
      this.selectedMainSlotForBooking =
        this.selectedEventForModal.slots.find((ms) => ms.id === mainSlotId) ||
        null;
      if (
        this.selectedMainSlotForBooking &&
        this.selectedMainSlotForBooking.subSlots
      ) {
        this.availableSubSlotsForBooking =
          this.selectedMainSlotForBooking.subSlots.filter(
            (subSlot) => !subSlot.isBooked
          );
      }
    } else {
      this.selectedMainSlotForBooking = null;
    }
    this.cdr.detectChanges();
  }

  getPublicEventLink(): string {
    if (this.selectedEventForModal && this.selectedEventForModal.id) {
      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : '';
      return `${baseUrl}/?eventId=${this.selectedEventForModal.id}`;
    }
    return '';
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
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingRegistration = true;
    this.registrationMessage = null;
    this.cdr.detectChanges();

    const formValues = this.vtcRegistrationForm.value;
    const bookingDetails: Omit<SubSlotBookingInfo, 'bookingId' | 'bookedAt'> = {
      companyName: formValues.companyName,
      contactName: formValues.contactName,
      contactEmail: formValues.contactEmail,
    };

    try {
      // Ottieni il link pubblico dell'evento
      const appLink = this.getPublicEventLink();

      await this.eventService.registerVtcToEventSubSlot(
        this.selectedEventForModal.id!,
        formValues.selectedMainSlotId,
        formValues.selectedSubSlotId,
        bookingDetails,
        appLink // Passa il link pubblico come quinto argomento
      );
      this.registrationMessage = {
        type: 'success',
        text: 'Registrazione alla postazione completata con successo!',
      };
      const previousMainSlotId = formValues.selectedMainSlotId;
      this.vtcRegistrationForm.reset({
        selectedMainSlotId: previousMainSlotId,
        selectedSubSlotId: null,
      });

      if (this.selectedEventForModal && this.selectedEventForModal.id) {
        this.eventService
          .getEventById(this.selectedEventForModal.id)
          .subscribe((updatedEvent) => {
            this.selectedEventForModal = updatedEvent;
            if (previousMainSlotId) {
              this.updateAvailableSubSlots(previousMainSlotId);
            } else {
              this.selectedMainSlotForBooking = null;
              this.availableSubSlotsForBooking = [];
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
      this.cdr.detectChanges();
    }
  }

  openVideoModal(): void {
    this.isVideoModalOpen = true;
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();
  }

  closeVideoModal(): void {
    this.isVideoModalOpen = false;
    document.body.style.overflow = 'auto';
    this.cdr.detectChanges();
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
    return mainSlot.subSlots.filter((ss) => !ss.isBooked).length;
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }

  objectValues = Object.values;
}
