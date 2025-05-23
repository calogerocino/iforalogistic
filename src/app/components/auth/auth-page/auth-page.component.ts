import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

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
  registerForm: FormGroup; // Lo manteniamo per coerenza, anche se non verrà usato per input
  errorMessage: string | null = null;
  infoMessage: string | null = null; // Per il messaggio di registrazioni disabilitate
  pageTitle: string = 'Accedi';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({ // Definiamo comunque il form
      firstName: [''],
      lastName: [''],
      email: [''],
      password: [''],
      confirmPassword: ['']
    });
  }

  ngOnInit(): void {
    this.activatedRoute.data.subscribe(data => {
      const requestedModeIsLogin = data['isLoginMode'] !== undefined ? data['isLoginMode'] : true;

      if (!requestedModeIsLogin) { // Se si tenta di accedere alla registrazione
        this.isLoginMode = true; // Mostra comunque l'interfaccia di login (o nulla se preferisci)
        this.pageTitle = 'Accesso'; // O un titolo generico
        this.infoMessage = 'Le registrazioni sono momentaneamente disabilitate. Sarai reindirizzato alla pagina di login a breve.';
        // Nascondi il form di login mentre mostri il messaggio, poi reindirizza
        this.loginForm.disable();

        setTimeout(() => {
          this.infoMessage = null; // Pulisci il messaggio
          this.router.navigate(['/auth/login'], { replaceUrl: true });
           // Riabilita il form di login se l'utente è stato reindirizzato qui
           // Questo timeout assicura che il form sia riabilitato dopo la navigazione
           setTimeout(() => this.loginForm.enable(), 0);
        }, 4000); // Reindirizza dopo 4 secondi
      } else {
        this.isLoginMode = true;
        this.pageTitle = data['title'] || 'Accedi';
        this.loginForm.enable(); // Assicura che il form di login sia abilitato
      }
      this.errorMessage = null;
      if (this.isLoginMode) {
        this.loginForm.reset();
      } else {
        // Non serve resettare registerForm se non viene mai mostrato/usato
      }
    });
  }

  // Il validatore passwordMatch non è più strettamente necessario se il form di registrazione non viene usato
  // passwordMatchValidator(form: FormGroup) { ... }

  async onSubmit(): Promise<void> {
    // Questa logica ora gestisce solo il login
    if (!this.isLoginMode || this.loginForm.invalid) {
      if(this.loginForm.invalid) this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.errorMessage = null;
    const { email, password } = this.loginForm.value;
    try {
      await this.authService.login(email, password);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.handleAuthError(error, 'login');
    }
  }

  private handleAuthError(error: any, mode: 'login' /*| 'register'*/): void { // Rimosso 'register'
    if (mode === 'login') {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        this.errorMessage = 'Email o password non validi.';
      } else {
        this.errorMessage = 'Errore durante il login. Riprova.';
      }
    // La logica per l'errore di registrazione non è più necessaria qui
    // } else {
    //   if (error.code === 'auth/email-already-in-use') {
    //     this.errorMessage = 'Questa email è già in uso.';
    //   } else {
    //     this.errorMessage = 'Errore durante la registrazione. Riprova.';
    //   }
    }
    console.error(error);
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
