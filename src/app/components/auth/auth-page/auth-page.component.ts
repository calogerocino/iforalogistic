import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AppUser } from '../../../services/auth.service'; // AppUser ora ha solo firstName

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss']
})
export class AuthPageComponent implements OnInit {
  isLoginMode: boolean = true;
  loginForm: FormGroup;
  registerForm: FormGroup;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  pageTitle: string = 'Accedi';
  allowRegistration = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      firstName: ['', Validators.required], // Solo firstName
      // lastName: [''], // Rimosso
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(data => {
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
        } else {
          this.allowRegistration = false;
          this.isLoginMode = true;
          this.pageTitle = 'Accesso';
          this.infoMessage = 'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login.';
          this.loginForm.disable();

          setTimeout(() => {
            this.infoMessage = null;
            if (!this.router.url.endsWith('/auth/login')) {
                this.router.navigate(['/auth/login'], { replaceUrl: true });
            }
             setTimeout(() => {
                this.isLoginMode = true;
                this.pageTitle = 'Accedi';
                this.loginForm.enable();
                this.loginForm.reset();
            }, 0);
          }, 4000);
        }
      } else {
        this.allowRegistration = false;
        this.isLoginMode = true;
        this.pageTitle = data['title'] || 'Accedi';
        this.loginForm.enable();
        this.loginForm.reset();
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
      const { email, password } = this.loginForm.value;
      try {
        await this.authService.login(email, password);
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        this.handleAuthError(error, 'login');
      }
    } else if (this.allowRegistration) {
      if (this.registerForm.invalid) {
        this.markFormGroupTouched(this.registerForm);
        return;
      }
      const { firstName, email, password } = this.registerForm.value; // Solo firstName
      try {
        await this.authService.register(email, password, firstName); // Solo firstName
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
    if (!this.allowRegistration) {
      this.infoMessage = 'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login.';
      this.isLoginMode = true;
      this.pageTitle = 'Accesso';
      this.loginForm.disable();

      setTimeout(() => {
        this.infoMessage = null;
        if (!this.router.url.endsWith('/auth/login')) {
            this.router.navigate(['/auth/login'], { replaceUrl: true });
        }
         setTimeout(() => {
            this.isLoginMode = true;
            this.pageTitle = 'Accedi';
            this.loginForm.enable();
            this.loginForm.reset();
        }, 0);
      }, 4000);
    } else {
        // Se allowRegistration è true, significa che siamo già su /auth/registrazione?admin
        // Quindi impostiamo la modalità registrazione
        this.isLoginMode = false;
        this.pageTitle = 'Registrati';
        this.registerForm.enable();
        this.registerForm.reset();
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
}
