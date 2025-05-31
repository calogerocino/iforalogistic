import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AppUser } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './authpage.component.html',
  styleUrls: ['./authpage.component.scss']
})
export class AuthPageComponent implements OnInit, OnDestroy {
  isLoginMode: boolean = true;
  loginForm: FormGroup;
  registerForm: FormGroup;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  pageTitle: string = 'Accedi';
  allowRegistration = false;

  private fb = inject(FormBuilder);
  public authService = inject(AuthService); // Public for template if needed
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  private autoLoginInProgress = false;
  private authSubscription: Subscription | undefined;
  private routeDataSubscription: Subscription | undefined;


  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [this.authService.isRememberMeActive()] // Initialize checkbox state
    });

    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    if (this.authService.isRememberMeActive() && !this.autoLoginInProgress) {
      this.autoLoginInProgress = true;
      this.isLoginMode = true; // For UI consistency during auto-login
      this.pageTitle = 'Accesso Automatico';
      this.infoMessage = 'Verifica sessione in corso...';
      this.loginForm.disable();
      this.registerForm.disable();

      // Give a brief moment for Firebase to potentially resolve auth state
      // from persisted session before checking currentUser$.
      setTimeout(() => {
        this.authSubscription = this.authService.currentUser$.pipe(take(1)).subscribe(appUser => {
          if (this.autoLoginInProgress) { // Check flag again, might have been resolved
            if (appUser) {
              this.router.navigate(['/dashboard']);
            } else {
              // Auto-login failed or no active Firebase session
              this.infoMessage = 'Sessione non attiva o scaduta. Effettua nuovamente il login.';
              this.pageTitle = 'Accedi';
              // AuthService should have cleared the localStorage flag if user became null
              this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
              this.loginForm.enable();
              // Keep registerForm disabled if we are in login mode
              this.registerForm.disable();
              this.autoLoginInProgress = false;
              this.initializeFormBasedOnRouteData(); // Setup for manual login
              setTimeout(() => this.infoMessage = null, 4000);
            }
          }
        });
      }, 200); // Short delay for Firebase auth state initialization

    } else {
      this.initializeFormBasedOnRouteData();
    }
  }

  private initializeFormBasedOnRouteData(): void {
    if (this.autoLoginInProgress) return; // Don't re-initialize if an auto-login attempt is active

    this.routeDataSubscription = this.activatedRoute.data.subscribe(data => {
      const routeIsForLogin = data['isLoginMode'] !== undefined ? data['isLoginMode'] : true;
      const adminQueryParam = this.activatedRoute.snapshot.queryParamMap.get('admin');
      this.infoMessage = null;
      this.errorMessage = null;

      if (!routeIsForLogin) {
        if (adminQueryParam !== null) {
          this.allowRegistration = true;
          this.isLoginMode = false;
          this.pageTitle = data['title'] || 'Registrati';
          this.registerForm.enable();
          this.registerForm.reset();
          this.loginForm.disable();
        } else {
          this.allowRegistration = false;
          this.isLoginMode = true;
          this.pageTitle = 'Accesso';
          this.infoMessage = 'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login.';
          this.loginForm.disable(); // Keep login form disabled initially
          this.registerForm.disable();
          setTimeout(() => {
            this.infoMessage = null;
            if (!this.router.url.endsWith('/auth/login')) {
                this.router.navigate(['/auth/login'], { replaceUrl: true });
            }
             setTimeout(() => { // Nested setTimeout to ensure navigation completes
                this.isLoginMode = true;
                this.pageTitle = 'Accedi';
                this.loginForm.enable();
                this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
            }, 0);
          }, 4000);
        }
      } else {
        this.allowRegistration = false;
        this.isLoginMode = true;
        this.pageTitle = data['title'] || 'Accedi';
        this.loginForm.enable();
        this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
        this.registerForm.disable();
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    return password && confirmPassword && password.value === confirmPassword.value ? null : { mismatch: true };
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = null;
    this.infoMessage = null;

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
        this.infoMessage = 'Registrazione completata con successo! Sarai reindirizzato al login.';
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
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
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
        this.infoMessage = 'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login.';
        this.registerForm.disable();
        this.loginForm.disable();
        setTimeout(() => {
            this.infoMessage = null;
            this.router.navigate(['/auth/login'], { replaceUrl: true }).then(() => {
                this.isLoginMode = true;
                this.pageTitle = 'Accedi';
                this.loginForm.enable();
                this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
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
        this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
        this.infoMessage = null;
        this.errorMessage = null;
    } else if (this.isLoginMode) {
        this.isLoginMode = true;
        this.pageTitle = 'Accedi';
        this.loginForm.enable();
        this.loginForm.reset({ rememberMe: this.authService.isRememberMeActive() });
        this.registerForm.disable();
        this.registerForm.reset();
        this.infoMessage = null;
        this.errorMessage = null;
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
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routeDataSubscription) {
      this.routeDataSubscription.unsubscribe();
    }
  }
}
