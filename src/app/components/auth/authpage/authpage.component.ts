import {
  Component,
  OnInit,
  inject,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './authpage.component.html',
  styleUrls: ['./authpage.component.scss'],
})
export class AuthPageComponent implements OnInit, OnDestroy {
  isLoginMode: boolean = true;
  loginForm: FormGroup;
  registerForm: FormGroup;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  accountBanned: string | null = null;
  pageTitle: string = 'Accedi';
  allowRegistration = true;

  private fb = inject(FormBuilder);
  public authService = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  private cdr = inject(ChangeDetectorRef);
  private autoLoginInProgress = false;
  private authSubscription: Subscription | undefined;
  private routeDataSubscription: Subscription | undefined;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [this.authService.isRememberMeActive()],
    });

    this.registerForm = this.fb.group(
      {
        firstName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    const routeParamsSub = this.activatedRoute.queryParamMap.subscribe(
      (params) => {
        const reason = params.get('reason');
        if (reason === 'unauthorized') {
          this.infoMessage =
            'Il tuo account è in attesa di approvazione da parte di un amministratore.';
          this.cdr.detectChanges();
        }
        if (reason === 'banned') {
          this.accountBanned = 'Il tuo account è stato bannato.';
          this.cdr.detectChanges();
        }
      }
    );
    if (this.authService.isRememberMeActive() && !this.autoLoginInProgress) {
      this.autoLoginInProgress = true;
      this.isLoginMode = true;
      this.pageTitle = 'Accesso Automatico';
      this.infoMessage = 'Verifica sessione in corso...';
      this.loginForm.disable();
      this.registerForm.disable();

      setTimeout(() => {
        this.authSubscription = this.authService.currentUser$
          .pipe(take(1))
          .subscribe((appUser) => {
            if (this.autoLoginInProgress) {
              if (appUser) {
                this.router.navigate(['/dashboard']);
              } else {
                this.infoMessage =
                  'Sessione non attiva o scaduta. Effettua nuovamente il login.';
                this.pageTitle = 'Accedi';
                this.loginForm.reset({
                  rememberMe: this.authService.isRememberMeActive(),
                });
                this.loginForm.enable();
                this.registerForm.disable();
                this.autoLoginInProgress = false;
                this.initializeFormBasedOnRouteData();
                setTimeout(() => (this.infoMessage = null), 4000);
              }
            }
          });
      }, 200);
    } else {
      this.initializeFormBasedOnRouteData();
    }
  }

  private initializeFormBasedOnRouteData(): void {
    if (this.autoLoginInProgress) return;

    this.routeDataSubscription = this.activatedRoute.data.subscribe((data) => {
      this.isLoginMode =
        data['isLoginMode'] !== undefined ? data['isLoginMode'] : true;
      this.pageTitle = this.isLoginMode ? 'Accedi' : 'Registrati';
      this.errorMessage = null;
      this.infoMessage = null;
      this.accountBanned = null;

      if (this.isLoginMode) {
        this.loginForm.enable();
        this.registerForm.disable();
      } else {
        this.registerForm.enable();
        this.loginForm.disable();
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    return password &&
      confirmPassword &&
      password.value === confirmPassword.value
      ? null
      : { mismatch: true };
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = null;
    this.infoMessage = null;
    this.accountBanned = null;


    if (this.isLoginMode) {
      if (this.loginForm.invalid) {
        this.markFormGroupTouched(this.loginForm);
        return;
      }
      const { email, password, rememberMe } = this.loginForm.value;
      try {
        await this.authService.login(email, password, rememberMe);
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        this.handleAuthError(error, 'login');
      }
    } else if (this.allowRegistration) {
      if (this.registerForm.invalid) {
        this.markFormGroupTouched(this.registerForm);
        return;
      }
      const { firstName, email, password } = this.registerForm.value;
      try {
        await this.authService.register(email, password, firstName);
        this.infoMessage =
          'Registrazione completata con successo! Sarai reindirizzato al login.';
        setTimeout(() => {
          this.infoMessage = null;
          this.router.navigate(['/auth/login']);
        }, 3000);
      } catch (error: any) {
        this.handleAuthError(error, 'register');
      }
    }
  }

  private handleAuthError(error: any, mode: 'login' | 'register'): void {
    if (mode === 'login') {
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        this.errorMessage = 'Email o password non validi.';
      } else {
        this.errorMessage = 'Errore durante il login. Riprova.';
      }
    } else {
      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'Questa email è già in uso.';
      } else {
        this.errorMessage = 'Errore durante la registrazione. Riprova.';
      }
    }
    console.error(error);
  }

  showRegistrationDisabledMessage(): void {
    if (this.autoLoginInProgress) return;

    if (!this.allowRegistration && !this.isLoginMode) {
      this.isLoginMode = false;
      this.pageTitle = 'Registrati';
      this.infoMessage =
        'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login.';
      this.registerForm.disable();
      this.loginForm.disable();
      setTimeout(() => {
        this.infoMessage = null;
        this.router.navigate(['/auth/login'], { replaceUrl: true }).then(() => {
          this.isLoginMode = true;
          this.pageTitle = 'Accedi';
          this.loginForm.enable();
          this.loginForm.reset({
            rememberMe: this.authService.isRememberMeActive(),
          });
          this.registerForm.reset();
          this.registerForm.disable();
        });
      }, 4000);
    } else if (this.allowRegistration && !this.isLoginMode) {
      this.isLoginMode = false;
      this.pageTitle = 'Registrati';
      this.registerForm.enable();
      this.registerForm.reset();
      this.loginForm.disable();
      this.loginForm.reset({
        rememberMe: this.authService.isRememberMeActive(),
      });
      this.infoMessage = null;
      this.errorMessage = null;
      this.accountBanned = null;
    } else if (this.isLoginMode) {
      this.isLoginMode = true;
      this.pageTitle = 'Accedi';
      this.loginForm.enable();
      this.loginForm.reset({
        rememberMe: this.authService.isRememberMeActive(),
      });
      this.registerForm.disable();
      this.registerForm.reset();
      this.infoMessage = null;
      this.errorMessage = null;
      this.accountBanned = null;
    }
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
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routeDataSubscription) {
      this.routeDataSubscription.unsubscribe();
    }
  }
}
