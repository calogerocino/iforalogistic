import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, Observable, finalize } from 'rxjs';
import { AuthService, AppUser } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  profileForm: FormGroup;
  passwordForm: FormGroup;
  currentUser: AppUser | null = null;
  private userSubscription: Subscription | undefined;

  profileUpdateSuccess: string | null = null;
  profileUpdateError: string | null = null;
  passwordUpdateSuccess: string | null = null;
  passwordUpdateError: string | null = null;
  photoUpdateMessage: string | null = null;


  isLoadingProfile = false;
  isLoadingPassword = false;
  isUploadingPhoto = false;
  uploadProgress: number | undefined = 0;

  isPhotoDropdownOpen = false;
  readonly defaultPhotoURL: string;

  private fb = inject(FormBuilder);
  public authService = inject(AuthService); // Public per usarlo nel template (defaultPhotoURL)

  constructor() {
    this.defaultPhotoURL = this.authService.defaultPhotoURL;
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
    });

    this.passwordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.profileForm.patchValue({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
        });
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    return newPassword && confirmPassword && newPassword.value === confirmPassword.value ? null : { mismatch: true };
  }

  async onProfileSubmit(): Promise<void> {
    this.profileUpdateSuccess = null;
    this.profileUpdateError = null;
    this.isLoadingProfile = true;

    if (this.profileForm.invalid || !this.currentUser?.uid) {
      this.markFormGroupTouched(this.profileForm);
      this.profileUpdateError = "Per favore, correggi gli errori nel modulo.";
      this.isLoadingProfile = false;
      return;
    }

    const { firstName, lastName } = this.profileForm.value;
    const profileData: Partial<AppUser> = { firstName, lastName };

    try {
      await this.authService.updateUserProfileData(this.currentUser.uid, profileData);
      this.profileUpdateSuccess = 'Profilo aggiornato con successo!';
    } catch (error: any) {
      this.profileUpdateError = `Errore durante l'aggiornamento del profilo: ${error.message || 'Riprova.'}`;
      console.error(error);
    } finally {
      this.isLoadingProfile = false;
    }
  }

  async onPasswordSubmit(): Promise<void> {
    this.passwordUpdateSuccess = null;
    this.passwordUpdateError = null;
    this.isLoadingPassword = true;

    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      this.passwordUpdateError = "Per favore, correggi gli errori nel modulo.";
      this.isLoadingPassword = false;
      return;
    }

    const { oldPassword, newPassword } = this.passwordForm.value;

    try {
      await this.authService.updateUserPassword(oldPassword, newPassword);
      this.passwordUpdateSuccess = 'Password aggiornata con successo!';
      this.passwordForm.reset();
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        this.passwordUpdateError = "La vecchia password inserita non è corretta.";
      } else if (error.code === 'auth/requires-recent-login') {
        this.passwordUpdateError = "Questa operazione richiede un accesso recente. Effettua nuovamente il logout e login, poi riprova.";
      } else {
        this.passwordUpdateError = `Errore durante l'aggiornamento della password: ${error.message || 'Riprova.'}`;
      }
      console.error(error);
    } finally {
      this.isLoadingPassword = false;
    }
  }

  togglePhotoDropdown(): void {
    this.isPhotoDropdownOpen = !this.isPhotoDropdownOpen;
  }

  closePhotoDropdown(): void {
    this.isPhotoDropdownOpen = false;
  }

  triggerFileInput(): void {
    this.closePhotoDropdown();
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.currentUser?.uid) {
      return;
    }
    const file = input.files[0];
    this.isUploadingPhoto = true;
    this.photoUpdateMessage = null;
    this.uploadProgress = 0;

    const { uploadProgress$, downloadUrl$ } = this.authService.uploadProfileImage(this.currentUser.uid, file);

    uploadProgress$.subscribe(
      progress => this.uploadProgress = progress,
      error => {
        this.isUploadingPhoto = false;
        this.photoUpdateMessage = "Errore durante il caricamento dell'immagine.";
        console.error(error);
        this.uploadProgress = undefined;
      }
    );

    try {
      const photoURL = await downloadUrl$;
      await this.authService.updateUserProfileData(this.currentUser.uid, { photoURL });
      this.photoUpdateMessage = 'Immagine profilo aggiornata!';
      // L'observable currentUser$ si aggiornerà automaticamente mostrando la nuova immagine
    } catch (error) {
      this.photoUpdateMessage = "Errore durante l'aggiornamento dell'URL dell'immagine.";
      console.error(error);
    } finally {
      this.isUploadingPhoto = false;
      this.uploadProgress = undefined;
      if (input) {
        input.value = ''; // Resetta l'input file per permettere di ricaricare lo stesso file
      }
    }
  }

  async deleteProfilePicture(): Promise<void> {
    this.closePhotoDropdown();
    if (!this.currentUser || !this.currentUser.uid ) return;
    if (this.currentUser.photoURL === this.defaultPhotoURL) {
        this.photoUpdateMessage = "Nessuna immagine personalizzata da eliminare.";
        return;
    }

    this.isUploadingPhoto = true; // Usa lo stesso loader per coerenza
    this.photoUpdateMessage = null;
    try {
      await this.authService.deleteProfileImage(this.currentUser.uid, this.currentUser.photoURL);
      this.photoUpdateMessage = 'Immagine profilo eliminata.';
    } catch (error: any) {
      this.photoUpdateMessage = `Errore durante l'eliminazione dell'immagine: ${error.message}`;
      console.error(error);
    } finally {
      this.isUploadingPhoto = false;
    }
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
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
