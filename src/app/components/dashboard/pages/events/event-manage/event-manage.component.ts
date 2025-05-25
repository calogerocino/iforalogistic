import { Component, OnInit, inject, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import { EventService, AppEvent, EventState, ServerType, TrailerType, EventDLCs } from '../../../../../services/event.service';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-event-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './event-manage.component.html',
  styleUrls: ['./event-manage.component.scss']
})
export class EventManageComponent implements OnInit, OnDestroy {
  @ViewChild('photoAreaInput') photoAreaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('routeImageInput') routeImageInput!: ElementRef<HTMLInputElement>;

  eventForm: FormGroup;
  pageTitle: string = 'Gestisci Evento';
  mode: 'create' | 'edit' | 'view' = 'view';
  eventId: string | null = null;
  eventType: 'internal' | 'external' | null = 'internal';
  currentEvent: AppEvent | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  private routeSubscription: Subscription | undefined;

  availableEventStates: EventState[] = [];
  private allEventStates: EventState[] = ['nuovo', 'programmato', 'adesso', 'concluso'];

  serverOptions: ServerType[] = ['Simulation 1', 'Simulation 2', 'Promods','SCS Convoy'];
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
  trailerTypeOptions: TrailerType[] = ['Standard', 'Pianale', 'Bestiame'];

  photoAreaPreview: string | null = null;
  routeImagePreview: string | null = null;
  isUploadingPhotoArea = false;
  isUploadingRouteImage = false;
  photoAreaUploadProgress: number | undefined = 0;
  routeImageUploadProgress: number | undefined = 0;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public eventService = inject(EventService);

  constructor() {
    const dlcGroup: { [key: string]: any } = {};
    this.dlcOptions.forEach(dlc => dlcGroup[dlc.name] = this.fb.control(false));

    this.eventForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      meetingTime: ['', Validators.required],
      startTime: [''],
      state: ['nuovo' as EventState, Validators.required],
      server: [null as ServerType | null],
      dlcs: this.fb.group(dlcGroup),
      departure: [''],
      destination: [''],
      photoAreaImageUrl: [null as string | null],
      trailerType: [null as TrailerType | null],
      cargo: [''],
      routeImageUrl: [null as string | null]
    });
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.routeSubscription = this.route.paramMap.pipe(
      tap(params => {
        this.eventId = params.get('id');
        const currentUrl = this.router.url;
        if (currentUrl.includes('/nuovo')) {
          this.mode = 'create';
          this.availableEventStates = ['nuovo', 'programmato'];
        } else if (currentUrl.includes('/modifica')) {
          this.mode = 'edit';
          this.availableEventStates = [...this.allEventStates];
        } else {
          this.mode = 'view';
          this.availableEventStates = [...this.allEventStates];
        }
      }),
      switchMap(() => {
        if (this.mode === 'create') {
          this.photoAreaPreview = this.eventService.defaultEventPhotoAreaUrl;
          this.routeImagePreview = this.eventService.defaultEventRouteUrl;
          this.eventForm.get('state')?.setValue('nuovo');
          return of(null);
        }
        return this.eventId ? this.eventService.getEventById(this.eventId) : of(null);
      })
    ).subscribe({
      next: (eventData) => {
        if (this.mode === 'create') {
          this.route.queryParamMap.subscribe(queryParams => {
            const typeFromQuery = queryParams.get('type');
            if (typeFromQuery === 'internal') {
              this.eventType = typeFromQuery;
            } else {
              this.router.navigate(['/dashboard/eventi']);
              return;
            }
            this.pageTitle = `Crea Evento Interno`;
            this.configureFormForEventType();
            this.eventForm.enable();
          });
        } else if (eventData) {
          this.currentEvent = eventData;
          this.eventType = eventData.eventType || 'internal';
          this.pageTitle = this.mode === 'edit' ? `Modifica: ${eventData.name}` : `Dettaglio: ${eventData.name}`;
          this.updateFormAndPreviews(eventData);
          this.configureFormForEventType();
          if (this.mode === 'view') {
            this.eventForm.disable();
          } else {
            this.eventForm.enable();
          }
        } else if (this.eventId && (this.mode === 'edit' || this.mode === 'view')) {
          this.errorMessage = "Evento non trovato.";
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = "Errore nel caricamento dei dati dell'evento.";
        console.error("Errore in ngOnInit (caricamento evento):", err);
        this.isLoading = false;
      }
    });
  }

  private updateFormAndPreviews(eventData: AppEvent): void {
    this.eventForm.patchValue({
      name: eventData.name,
      description: eventData.description,
      meetingTime: this.formatDateForInput(eventData.startDate),
      startTime: this.formatDateForInput(eventData.endDate),
      state: eventData.state,
      server: eventData.server,
      dlcs: eventData.dlcs || this.dlcOptions.reduce((acc, dlc) => ({...acc, [dlc.name]: false}), {}),
      departure: eventData.departure,
      destination: eventData.destination,
      photoAreaImageUrl: eventData.photoAreaImageUrl,
      trailerType: eventData.trailerType,
      cargo: eventData.cargo,
      routeImageUrl: eventData.routeImageUrl
    });
    this.photoAreaPreview = eventData.photoAreaImageUrl || this.eventService.defaultEventPhotoAreaUrl;
    this.routeImagePreview = eventData.routeImageUrl || this.eventService.defaultEventRouteUrl;
  }

  get dlcsFormGroup(): FormGroup {
    return this.eventForm.get('dlcs') as FormGroup;
  }

  hasSelectedDlcs(dlcs: EventDLCs | undefined | null): boolean {
    if (!dlcs) {
      return false;
    }
    return Object.values(dlcs).some(isSelected => isSelected === true);
  }

  configureFormForEventType(): void {}

  formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';
    if (dateValue && typeof dateValue.seconds === 'number') {
      const date = new Date(dateValue.seconds * 1000);
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      const hours = ('0' + date.getHours()).slice(-2);
      const minutes = ('0' + date.getMinutes()).slice(-2);
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return dateValue;
  }

  convertInputDateToTimestamp(dateString: string): any {
    if (!dateString) return null;
    return new Date(dateString);
  }

  async onSubmit(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    if (this.eventForm.invalid) {
      this.markFormGroupTouched(this.eventForm);
      this.errorMessage = "Per favore, compila tutti i campi obbligatori.";
      this.isLoading = false;
      return;
    }

    const formValues = this.eventForm.getRawValue();
    const eventDataToSave: Partial<AppEvent> = {
      name: formValues.name,
      description: formValues.description,
      startDate: this.convertInputDateToTimestamp(formValues.meetingTime),
      endDate: this.convertInputDateToTimestamp(formValues.startTime),
      state: formValues.state,
      eventType: 'internal',
      server: formValues.server,
      dlcs: formValues.dlcs,
      departure: formValues.departure,
      destination: formValues.destination,
      trailerType: formValues.trailerType,
      cargo: formValues.cargo,
      photoAreaImageUrl: this.eventForm.get('photoAreaImageUrl')?.value,
      routeImageUrl: this.eventForm.get('routeImageUrl')?.value,
    };

    try {
      if (this.mode === 'create') {
        const addedEventRef = await this.eventService.addEvent(eventDataToSave as Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'>);
        this.successMessage = "Evento creato con successo!";
        this.router.navigate(['/dashboard/eventi', addedEventRef.id]);
      } else if (this.mode === 'edit' && this.eventId) {
        await this.eventService.updateEvent(this.eventId, eventDataToSave);
        this.successMessage = "Evento aggiornato con successo!";
        this.mode = 'view';
        this.pageTitle = `Dettaglio: ${eventDataToSave.name || this.currentEvent?.name}`;
        this.eventService.getEventById(this.eventId).subscribe(updatedEvent => {
            if (updatedEvent) {
                this.currentEvent = updatedEvent;
                this.updateFormAndPreviews(updatedEvent);
            }
            this.eventForm.disable();
        });
      }
    } catch (err: any) {
      this.errorMessage = `Errore durante il salvataggio dell'evento: ${err.message || 'Operazione fallita.'}`;
      console.error("Errore in onSubmit:", err);
    } finally {
      this.isLoading = false;
    }
  }

  triggerImageInput(type: 'photoArea' | 'routePath'): void {
    if (type === 'photoArea') {
      this.photoAreaInput.nativeElement.click();
    } else {
      this.routeImageInput.nativeElement.click();
    }
  }

  async onImageSelected(event: Event, imageType: 'photoArea' | 'routePath'): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    const file = input.files[0];
    const currentImageId = this.eventId;
    let oldImageUrl: string | null | undefined = null;

    if (currentImageId) {
        if (imageType === 'photoArea') {
            oldImageUrl = this.eventForm.get('photoAreaImageUrl')?.value;
        } else {
            oldImageUrl = this.eventForm.get('routeImageUrl')?.value;
        }
        const defaultUrl = imageType === 'photoArea' ? this.eventService.defaultEventPhotoAreaUrl : this.eventService.defaultEventRouteUrl;
        if (oldImageUrl === defaultUrl) {
            oldImageUrl = null;
        }
    }

    if (imageType === 'photoArea') {
      this.isUploadingPhotoArea = true;
      this.photoAreaUploadProgress = 0;
    } else {
      this.isUploadingRouteImage = true;
      this.routeImageUploadProgress = 0;
    }
    this.successMessage = null;
    this.errorMessage = null;

    try {
      if (currentImageId && oldImageUrl) {
        await this.eventService.deleteEventImage(currentImageId, oldImageUrl, imageType, false);
      }

      const uploadEventId = this.eventId || `temp_${Date.now()}`;
      const { uploadProgress$, downloadUrlPromise } = this.eventService.uploadEventImage(uploadEventId, file, imageType);

      uploadProgress$.subscribe(
        progress => {
          if (imageType === 'photoArea') this.photoAreaUploadProgress = progress;
          else this.routeImageUploadProgress = progress;
        },
        error => {
          this.errorMessage = `Errore durante il caricamento dell'immagine ${imageType === 'photoArea' ? 'Area Foto' : 'Percorso'}. Dettagli: ${error.message || error}`;
          if (imageType === 'photoArea') this.isUploadingPhotoArea = false; else this.isUploadingRouteImage = false;
          this.photoAreaUploadProgress = undefined;
          this.routeImageUploadProgress = undefined;
        }
      );

      const newImageUrl = await downloadUrlPromise;

      if (imageType === 'photoArea') {
        this.eventForm.get('photoAreaImageUrl')?.setValue(newImageUrl);
        this.photoAreaPreview = newImageUrl;
      } else {
        this.eventForm.get('routeImageUrl')?.setValue(newImageUrl);
        this.routeImagePreview = newImageUrl;
      }
      this.successMessage = `Immagine ${imageType === 'photoArea' ? 'Area Foto' : 'Percorso'} caricata. Salva l'evento per applicare la modifica.`;

    } catch (error: any) {
      this.errorMessage = `Errore durante la gestione dell'immagine ${imageType === 'photoArea' ? 'Area Foto' : 'Percorso'}. Dettagli: ${error.message || error}`;
    } finally {
      if (imageType === 'photoArea') this.isUploadingPhotoArea = false; else this.isUploadingRouteImage = false;
      this.photoAreaUploadProgress = undefined;
      this.routeImageUploadProgress = undefined;
      if (input) input.value = '';
    }
  }

  async deleteEventImage(imageType: 'photoArea' | 'routePath'): Promise<void> {
    if (!this.eventId) {
        this.errorMessage = "Salva prima l'evento per poter eliminare le immagini.";
        if (imageType === 'photoArea') {
            this.eventForm.get('photoAreaImageUrl')?.setValue(this.eventService.defaultEventPhotoAreaUrl);
            this.photoAreaPreview = this.eventService.defaultEventPhotoAreaUrl;
        } else {
            this.eventForm.get('routeImageUrl')?.setValue(this.eventService.defaultEventRouteUrl);
            this.routeImagePreview = this.eventService.defaultEventRouteUrl;
        }
        this.successMessage = "Selezione immagine annullata.";
        return;
    }

    const currentImageUrl = imageType === 'photoArea' ? this.eventForm.get('photoAreaImageUrl')?.value : this.eventForm.get('routeImageUrl')?.value;
    const defaultUrl = imageType === 'photoArea' ? this.eventService.defaultEventPhotoAreaUrl : this.eventService.defaultEventRouteUrl;

    if (currentImageUrl === defaultUrl) {
        this.successMessage = "Nessuna immagine personalizzata da eliminare.";
        return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    try {
      await this.eventService.deleteEventImage(this.eventId, currentImageUrl, imageType, true);
      if (imageType === 'photoArea') {
          this.eventForm.get('photoAreaImageUrl')?.setValue(defaultUrl);
          this.photoAreaPreview = defaultUrl;
      } else {
          this.eventForm.get('routeImageUrl')?.setValue(defaultUrl);
          this.routeImagePreview = defaultUrl;
      }
      this.successMessage = `Immagine ${imageType === 'photoArea' ? 'Area Foto' : 'Percorso'} eliminata. Salva l'evento per confermare (se non già fatto dal servizio).`;
    } catch (error: any) {
        this.errorMessage = `Errore durante l'eliminazione dell'immagine: ${error.message || 'Riprova.'}`;
        console.error("Errore in deleteEventImage:", error);
    } finally {
        this.isLoading = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/eventi']);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
        this.routeSubscription.unsubscribe();
    }
  }
}
