import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, Observable } from 'rxjs';
import { AuthService, AppUser } from '../../../../services/auth.service';
import { NotificationService, AppNotification } from '../../../../services/notification.service'; // Importa NotificationService

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isProfileDropdownOpen = false;
  isNotificationDropdownOpen = false; // Per il dropdown delle notifiche
  currentUser: AppUser | null = null;
  unreadNotifications$: Observable<AppNotification[]>;
  allNotifications$: Observable<AppNotification[]>; // Per visualizzare più notifiche
  unreadCount = 0;

  private userSubscription: Subscription | undefined;
  private unreadNotificationsSubscription: Subscription | undefined;
  showLanguageWarning = false;

  public authService = inject(AuthService); // Reso pubblico se usato nel template, altrimenti private
  private router = inject(Router);
  private notificationService = inject(NotificationService); // Inietta NotificationService

  constructor() {
    this.unreadNotifications$ = this.notificationService.getUnreadNotifications(5);
    this.allNotifications$ = this.notificationService.getAllNotifications(10);
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.unreadNotificationsSubscription = this.unreadNotifications$.subscribe(notifications => {
      this.unreadCount = notifications.length;
    });
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    if (this.isProfileDropdownOpen) {
      this.isNotificationDropdownOpen = false; // Chiudi l'altro dropdown
    }
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  toggleNotificationDropdown(): void {
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
    if (this.isNotificationDropdownOpen) {
      this.isProfileDropdownOpen = false; // Chiudi l'altro dropdown
    }
  }

  closeNotificationDropdown(): void {
    this.isNotificationDropdownOpen = false;
  }

  handleLanguageButtonClick(): void {
    this.showLanguageWarning = true;
    setTimeout(() => {
      this.showLanguageWarning = false;
    }, 3000);
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
    console.log('Naviga a impostazioni (da implementare)');
  }

  async onNotificationClick(notification: AppNotification): Promise<void> {
    if (notification.id && !notification.isRead) {
      await this.notificationService.markAsRead(notification.id);
    }
    if (notification.navigateTo) {
      // Assicurati che i queryParams siano corretti per la tua logica di highlighting
      this.router.navigate([notification.navigateTo], {
        queryParams: {
          scrollToSlot: notification.slotId,
          highlightBookingId: (notification as any).bookingId || notification.companyName // Adatta se bookingId è disponibile
        }
      });
    }
    this.closeNotificationDropdown();
  }

  async markAllNotificationsAsRead(notifications: AppNotification[] | null): Promise<void> {
    if (notifications && notifications.length > 0) {
        await this.notificationService.markMultipleAsRead(notifications.filter(n => !n.isRead));
    }
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.unreadNotificationsSubscription) {
      this.unreadNotificationsSubscription.unsubscribe();
    }
  }
}
