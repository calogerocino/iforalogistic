import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, tap } from 'rxjs';
import { AuthService, AppUser } from '../../../../services/auth.service';
import {
  NotificationService,
  AppNotification,
} from '../../../../services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  isProfileDropdownOpen = false;
  isNotificationDropdownOpen = false;
  currentUser: AppUser | null = null;
  unreadNotifications$: Observable<AppNotification[]>;
  allNotifications$: Observable<AppNotification[]>;
  unreadCount = 0;

  private userSubscription: Subscription | undefined;
  private unreadNotificationsSubscription: Subscription | undefined;
  showLanguageWarning = false;

  public authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  public isAdmin = false;
  public isEventManager = false;

  constructor() {
    this.unreadNotifications$ =
      this.notificationService.getUnreadNotifications(5);
    this.allNotifications$ = this.notificationService.getAllNotifications(20);
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.isAdmin = user?.role === 'Admin';
      this.isEventManager = user?.role === 'Eventmanager';
    });
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
    this.unreadNotificationsSubscription = this.unreadNotifications$.subscribe(
      (notifications) => {
        this.unreadCount = notifications.length;
      }
    );
  }

  toggleProfileDropdown(): void {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    if (this.isProfileDropdownOpen) {
      this.isNotificationDropdownOpen = false;
    }
  }

  closeProfileDropdown(): void {
    this.isProfileDropdownOpen = false;
  }

  toggleNotificationDropdown(): void {
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
    if (this.isNotificationDropdownOpen) {
      this.isProfileDropdownOpen = false;
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

  async handleNotificationMainAction(
    notification: AppNotification
  ): Promise<void> {
    if (notification.id && !notification.isRead) {
      notification.isRead = true;
      notification.interacted = true;
      await this.notificationService.markAsRead(notification.id);
    } else if (notification.id && !notification.interacted) {
      notification.interacted = true;
      await this.notificationService.markAsRead(notification.id);
    }

    if (notification.navigateTo) {
      this.router.navigate([notification.navigateTo], {
        queryParams: {
          scrollToSlot: notification.subSlotId,
          highlightBookingId:
            (notification as any).bookingId || notification.companyName,
        },
      });
    }
    this.closeNotificationDropdown();
  }

  async setNotificationInteracted(
    notification: AppNotification,
    event: MouseEvent
  ): Promise<void> {
    event.stopPropagation();
    if (notification.id && !notification.interacted) {
      notification.interacted = true;
      if (!notification.isRead) {
        notification.isRead = true;
      }
      await this.notificationService.markAsRead(notification.id);
    }
  }

  async deleteNotification(
    notification: AppNotification,
    event: MouseEvent
  ): Promise<void> {
    event.stopPropagation();
    if (notification.id) {
      await this.notificationService.deleteNotification(notification.id);
    }
  }

  async markAllNotificationsAsRead(
    notifications: AppNotification[] | null
  ): Promise<void> {
    if (notifications && notifications.length > 0) {
      const unreadNotifications = notifications.filter((n) => !n.isRead);
      if (unreadNotifications.length > 0) {
        unreadNotifications.forEach((n) => {
          n.isRead = true;
          n.interacted = true;
        });
        await this.notificationService.markMultipleAsRead(unreadNotifications);
      }
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
