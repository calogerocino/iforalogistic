import {
  Component,
  OnInit,
  inject,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  AbstractControl,
} from '@angular/forms';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import {
  EventService,
  AppEvent,
  EventState,
  ServerType,
  TrailerType,
  EventDLCs,
  EventSlot,
  EventSubSlot,
  SubSlotBookingInfo,
} from '../../../../../services/event.service';
import { AuthService } from '../../../../../services/auth.service';
import { v4 as uuidv4 } from 'uuid';
import { ImageModalService } from '../../../../../services/image-modal.service';

@Component({
  selector: 'app-event-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './event-manage.component.html',
  styleUrls: ['./event-manage.component.scss'],
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
  private allEventStates: EventState[] = [
    'nuovo',
    'programmato',
    'adesso',
    'concluso',
  ];

  serverOptions: ServerType[] = [
    'Simulation 1',
    'Simulation 2',
    'SCS Convoy',
    'Promods',
  ];
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
  trailerTypeOptions: TrailerType[] = ['Standard', 'Pianale', 'Bestiame', 'Refrigerato'];

  photoAreaPreview: string | null = null;
  routeImagePreview: string | null = null;
  isUploadingPhotoArea = false;
  isUploadingRouteImage = false;
  photoAreaUploadProgress: number | undefined = 0;
  routeImageUploadProgress: number | undefined = 0;
  slotImageUploadProgress: { [slotId: string]: number | undefined } = {};
  isUploadingSlotImage: { [slotId: string]: boolean } = {};
  visibleBookingsForSlotId: string | null = null;
  visibleSubSlotsForMainSlotId: string | null = null;


  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public eventService = inject(EventService);
  public imageModalService = inject(ImageModalService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    const dlcGroup: { [key: string]: any } = {};
    this.dlcOptions.forEach(
      (dlc) => (dlcGroup[dlc.name] = this.fb.control(false))
    );

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
      routeImageUrl: [null as string | null],
      slots: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.routeSubscription = this.route.paramMap
      .pipe(
        tap((params) => {
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
            this.slotsFormArray.clear();
            return of(null);
          }
          return this.eventId
            ? this.eventService.getEventById(this.eventId)
            : of(null);
        })
      )
      .subscribe({
        next: (eventData) => {
          if (this.mode === 'create') {
            this.route.queryParamMap.subscribe((queryParams) => {
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
            this.pageTitle =
              this.mode === 'edit'
                ? `Modifica: ${eventData.name}`
                : `Dettaglio: ${eventData.name}`;
            this.updateFormAndPreviews(eventData);
            this.configureFormForEventType();
            if (this.mode === 'view') {
              this.eventForm.disable();
            } else {
              this.eventForm.enable();
            }
          } else if (
            this.eventId &&
            (this.mode === 'edit' || this.mode === 'view')
          ) {
            this.errorMessage = 'Evento non trovato.';
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = "Errore nel caricamento dei dati dell'evento.";
          console.error('Errore in ngOnInit (caricamento evento):', err);
          this.isLoading = false;
        },
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
      dlcs:
        eventData.dlcs ||
        this.dlcOptions.reduce(
          (acc, dlc) => ({ ...acc, [dlc.name]: false }),
          {}
        ),
      departure: eventData.departure,
      destination: eventData.destination,
      photoAreaImageUrl: eventData.photoAreaImageUrl,
      trailerType: eventData.trailerType,
      cargo: eventData.cargo,
      routeImageUrl: eventData.routeImageUrl,
    });
    this.photoAreaPreview =
      eventData.photoAreaImageUrl || this.eventService.defaultEventPhotoAreaUrl;
    this.routeImagePreview =
      eventData.routeImageUrl || this.eventService.defaultEventRouteUrl;
    this.populateSlotsFormArray(eventData.slots || []);
  }

  get dlcsFormGroup(): FormGroup {
    return this.eventForm.get('dlcs') as FormGroup;
  }

  get slotsFormArray(): FormArray {
    return this.eventForm.get('slots') as FormArray;
  }

  private createMainSlotFormGroup(slot?: EventSlot): FormGroup {
    return this.fb.group({
      id: [slot?.id || uuidv4()],
      name: [slot?.name || '', Validators.required],
      imageUrl: [slot?.imageUrl || this.eventService.defaultSlotImageUrl],
      numberOfSubSlots: [slot?.numberOfSubSlots || 1, [Validators.required, Validators.min(1)]],
    });
  }

  addSlot(): void {
    if (this.mode === 'view') return;
    this.slotsFormArray.push(this.createMainSlotFormGroup());
  }

  removeSlot(index: number): void {
    if (this.mode === 'view') return;
    this.slotsFormArray.removeAt(index);
  }

  private populateSlotsFormArray(mainSlots: EventSlot[]): void {
    this.slotsFormArray.clear();
    mainSlots.forEach((slot) => {
      this.slotsFormArray.push(this.createMainSlotFormGroup(slot));
    });
  }

  getSubSlotsForMainSlot(mainSlotId: string): EventSubSlot[] {
    return this.currentEvent?.slots?.find(s => s.id === mainSlotId)?.subSlots || [];
  }

  getTotalBookedInMainSlot(mainSlot: EventSlot | undefined): number {
    if (!mainSlot || !mainSlot.subSlots) return 0;
    return mainSlot.subSlots.filter(ss => ss.isBooked).length;
  }

  getTotalAvailableInMainSlot(mainSlot: EventSlot | undefined): number {
     if (!mainSlot || !mainSlot.subSlots) return 0;
     return mainSlot.numberOfSubSlots - this.getTotalBookedInMainSlot(mainSlot);
  }

  toggleSubSlotsVisibility(mainSlotId: string): void {
    if (this.visibleSubSlotsForMainSlotId === mainSlotId) {
      this.visibleSubSlotsForMainSlotId = null;
    } else {
      this.visibleSubSlotsForMainSlotId = mainSlotId;
    }
  }


  hasSelectedDlcs(dlcs: EventDLCs | undefined | null): boolean {
    if (!dlcs) return false;
    return Object.values(dlcs).some((isSelected) => isSelected === true);
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
      this.errorMessage = 'Per favore, compila tutti i campi obbligatori.';
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
      slots: formValues.slots.map((slotFromForm: any) => {
        const existingMainSlotData = this.currentEvent?.slots?.find(
          (s) => s.id === slotFromForm.id
        );
        return {
          id: slotFromForm.id,
          name: slotFromForm.name,
          imageUrl: slotFromForm.imageUrl,
          numberOfSubSlots: slotFromForm.numberOfSubSlots,
          subSlots: existingMainSlotData?.subSlots || this.eventService['generateSubSlots'](slotFromForm.numberOfSubSlots)
        };
      }),
    };

    try {
      if (this.mode === 'create') {
        const addedEventRef = await this.eventService.addEvent(
          eventDataToSave as Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'>
        );
        this.successMessage = 'Evento creato con successo!';
        this.router.navigate(['/dashboard/eventi', addedEventRef.id]);
      } else if (this.mode === 'edit' && this.eventId) {
        await this.eventService.updateEvent(this.eventId, eventDataToSave);
        this.successMessage = 'Evento aggiornato con successo!';
        this.mode = 'view';
        this.pageTitle = `Dettaglio: ${
          eventDataToSave.name || this.currentEvent?.name
        }`;
        this.eventService
          .getEventById(this.eventId)
          .subscribe((updatedEvent) => {
            if (updatedEvent) {
              this.currentEvent = updatedEvent;
              this.updateFormAndPreviews(updatedEvent);
            }
            this.eventForm.disable();
            this.cdr.detectChanges();
          });
      }
    } catch (err: any) {
      this.errorMessage = `Errore durante il salvataggio dell'evento: ${
        err.message || 'Operazione fallita.'
      }`;
      console.error('Errore in onSubmit:', err);
    } finally {
      this.isLoading = false;
    }
  }

  triggerImageInput(
    type: 'photoArea' | 'routePath' | 'slotImage',
    slotIndex?: number
  ): void {
    if (!this.eventId && this.mode === 'create') {
      this.errorMessage = "Salva prima l'evento per aggiungere immagini.";
      setTimeout(() => (this.errorMessage = null), 3000);
      return;
    }
    if (type === 'photoArea') {
      this.photoAreaInput.nativeElement.click();
    } else if (type === 'routePath') {
      this.routeImageInput.nativeElement.click();
    } else if (type === 'slotImage' && slotIndex !== undefined) {
      const slotImageInput = document.getElementById(
        `slotImageInput-${slotIndex}`
      ) as HTMLInputElement;
      if (slotImageInput) slotImageInput.click();
    }
  }

  async onImageSelected(
    event: Event,
    imageType: 'photoArea' | 'routePath' | 'slotImage',
    slotIndexOrId?: number | string
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (!this.eventId) {
      console.error(
        "Impossibile caricare l'immagine: eventId non è definito. Salva prima l'evento."
      );
      this.errorMessage =
        "Devi prima salvare l'evento per poter caricare immagini.";
      if (input) input.value = '';
      return;
    }

    let oldImageUrl: string | null | undefined = null;
    const isSlotImg = imageType === 'slotImage';
    let mainSlotIdForPath: string | undefined;


    if (isSlotImg && slotIndexOrId !== undefined && typeof slotIndexOrId === 'number') {
      const mainSlotControl = this.slotsFormArray.at(slotIndexOrId);
      mainSlotIdForPath = mainSlotControl.get('id')?.value;
      oldImageUrl = mainSlotControl.get('imageUrl')?.value;

    } else {
      oldImageUrl =
        imageType === 'photoArea'
          ? this.eventForm.get('photoAreaImageUrl')?.value
          : this.eventForm.get('routeImageUrl')?.value;
    }
    const defaultUrl = isSlotImg
      ? this.eventService.defaultSlotImageUrl
      : imageType === 'photoArea'
      ? this.eventService.defaultEventPhotoAreaUrl
      : this.eventService.defaultEventRouteUrl;

    if (oldImageUrl === defaultUrl) oldImageUrl = null;

    if (imageType === 'photoArea') {
      this.isUploadingPhotoArea = true;
      this.photoAreaUploadProgress = 0;
    } else if (imageType === 'routePath') {
      this.isUploadingRouteImage = true;
      this.routeImageUploadProgress = 0;
    } else if (isSlotImg && mainSlotIdForPath) {
      this.isUploadingSlotImage[mainSlotIdForPath] = true;
      this.slotImageUploadProgress[mainSlotIdForPath] = 0;
    }
    this.successMessage = null;
    this.errorMessage = null;

    try {
      if (oldImageUrl) {
        await this.eventService.deleteEventImage(oldImageUrl);
      }

      const { uploadProgress$, downloadUrlPromise } =
        this.eventService.uploadEventImage(
          this.eventId,
          file,
          imageType,
          mainSlotIdForPath
        );

      uploadProgress$.subscribe(
        (progress) => {
          if (imageType === 'photoArea')
            this.photoAreaUploadProgress = progress;
          else if (imageType === 'routePath')
            this.routeImageUploadProgress = progress;
          else if (isSlotImg && mainSlotIdForPath)
            this.slotImageUploadProgress[mainSlotIdForPath] = progress;
          this.cdr.detectChanges();
        },
        (error) => {
          this.errorMessage = `Errore upload. Dettagli: ${
            error.message || error
          }`;
           this.cdr.detectChanges();
        }
      );

      const newImageUrl = await downloadUrlPromise;

      if (imageType === 'photoArea') {
        this.eventForm.get('photoAreaImageUrl')?.setValue(newImageUrl);
        this.photoAreaPreview = newImageUrl;
      } else if (imageType === 'routePath') {
        this.eventForm.get('routeImageUrl')?.setValue(newImageUrl);
        this.routeImagePreview = newImageUrl;
      } else if (isSlotImg && typeof slotIndexOrId === 'number') {
        this.slotsFormArray
          .at(slotIndexOrId)
          .get('imageUrl')
          ?.setValue(newImageUrl);
      }
      this.successMessage = `Immagine caricata. Salva l'evento per applicare.`;
    } catch (error: any) {
      this.errorMessage = `Errore gestione immagine. Dettagli: ${
        error.message || error
      }`;
    } finally {
      if (imageType === 'photoArea') this.isUploadingPhotoArea = false;
      else if (imageType === 'routePath') this.isUploadingRouteImage = false;
      else if (isSlotImg && mainSlotIdForPath)
        this.isUploadingSlotImage[mainSlotIdForPath] = false;

      if (imageType === 'photoArea') this.photoAreaUploadProgress = undefined;
      else if (imageType === 'routePath')
        this.routeImageUploadProgress = undefined;
      else if (isSlotImg && mainSlotIdForPath)
        this.slotImageUploadProgress[mainSlotIdForPath] = undefined;

      if (input) input.value = '';
      this.cdr.detectChanges();
    }
  }

  async deleteEventImage(
    imageType: 'photoArea' | 'routePath' | 'slotImage',
    slotIndex?: number
  ): Promise<void> {
    const isSlotImg = imageType === 'slotImage';
    let currentImageUrl: string | null | undefined;
    let defaultUrl: string;
    let mainSlotId: string | undefined;

    if (isSlotImg && slotIndex !== undefined) {
      const mainSlotControl = this.slotsFormArray.at(slotIndex);
      currentImageUrl = mainSlotControl.get('imageUrl')?.value;
      mainSlotId = mainSlotControl.get('id')?.value;
      defaultUrl = this.eventService.defaultSlotImageUrl;
    } else if (imageType === 'photoArea') {
      currentImageUrl = this.eventForm.get('photoAreaImageUrl')?.value;
      defaultUrl = this.eventService.defaultEventPhotoAreaUrl;
    } else {
      currentImageUrl = this.eventForm.get('routeImageUrl')?.value;
      defaultUrl = this.eventService.defaultEventRouteUrl;
    }

    if (!this.eventId && !isSlotImg) {
      this.errorMessage =
        "Salva prima l'evento per poter eliminare le immagini principali.";
      if (imageType === 'photoArea') {
        this.eventForm.get('photoAreaImageUrl')?.setValue(defaultUrl);
        this.photoAreaPreview = defaultUrl;
      } else if (imageType === 'routePath') {
        this.eventForm.get('routeImageUrl')?.setValue(defaultUrl);
        this.routeImagePreview = defaultUrl;
      }
      this.successMessage = 'Selezione immagine annullata.';
      this.cdr.detectChanges();
      return;
    }
    if (
      isSlotImg &&
      slotIndex !== undefined && mainSlotId &&
      mainSlotId.startsWith('temp_')
    ) {
      this.slotsFormArray.at(slotIndex!).get('imageUrl')?.setValue(defaultUrl);
      this.successMessage = 'Selezione immagine slot annullata.';
      this.cdr.detectChanges();
      return;
    }

    if (currentImageUrl === defaultUrl || !currentImageUrl) {
      this.successMessage = 'Nessuna immagine personalizzata da eliminare.';
       this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();
    try {
      await this.eventService.deleteEventImage(currentImageUrl);

      if (isSlotImg && slotIndex !== undefined) {
        this.slotsFormArray.at(slotIndex).get('imageUrl')?.setValue(defaultUrl);
      } else if (imageType === 'photoArea') {
        this.eventForm.get('photoAreaImageUrl')?.setValue(defaultUrl);
        this.photoAreaPreview = defaultUrl;
      } else {
        this.eventForm.get('routeImageUrl')?.setValue(defaultUrl);
        this.routeImagePreview = defaultUrl;
      }
      this.successMessage = `Immagine eliminata. Salva l'evento per confermare la modifica.`;
    } catch (error: any) {
      this.errorMessage = `Errore eliminazione immagine: ${
        error.message || 'Riprova.'
      }`;
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }


  goBack(): void {
    this.router.navigate(['/dashboard/eventi']);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
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

  openImageInModal(imageUrl: string | null | undefined): void {
    if (imageUrl) {
      this.imageModalService.openModal(imageUrl);
    }
  }

  objectValues = Object.values;
}
