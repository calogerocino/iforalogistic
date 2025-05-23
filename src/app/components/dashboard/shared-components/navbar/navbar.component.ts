import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, AppUser } from '../../../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isProfileDropdownOpen = false;
  currentUser: AppUser | null = null;
  private userSubscription: Subscription | undefined;
  showLanguageWarning = false; // Nuova proprietà per l'avviso

  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  handleLanguageButtonClick(): void {
    this.showLanguageWarning = true;
    setTimeout(() => {
      this.showLanguageWarning = false;
    }, 3000); // Nasconde l'avviso dopo 3 secondi
  }

  async logout(): Promise<void> {
    this.closeProfileDropdown();
    try {
      await this.authService.logout();
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  navigateToProfile(): void {
    this.closeProfileDropdown();
    this.router.navigate(['/dashboard/profilo']);
  }

  navigateToSettings(): void {
    this.closeProfileDropdown();
    // this.router.navigate(['/dashboard/impostazioni']);
    console.log('Naviga a impostazioni (da implementare)');
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
