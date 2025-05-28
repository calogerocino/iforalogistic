import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, tap } from 'rxjs';
import { AuthService, AppUser } from '../../../../services/auth.service';
import { NotificationService, AppNotification } from '../../../../services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
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
  private cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef

  constructor() {
    this.unreadNotifications$ = this.notificationService.getUnreadNotifications(5);
    // It's important that Firestore updates trigger a new emission of this observable
    // or that the objects within the array are updated in a way Angular detects.
    this.allNotifications$ = this.notificationService.getAllNotifications(20);
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

  async handleNotificationMainAction(notification: AppNotification): Promise<void> {
    if (notification.id && !notification.isRead) {
      // Optimistically update local state for immediate UI feedback
      notification.isRead = true;
      notification.interacted = true; 
      await this.notificationService.markAsRead(notification.id);
      // this.cdr.detectChanges(); // Optional: force change detection if needed
    }
    // If already read but not interacted (edge case, service handles setting interacted on markAsRead)
    else if (notification.id && !notification.interacted) {
        notification.interacted = true;
        await this.notificationService.markAsRead(notification.id); // ensure backend is also updated
        // this.cdr.detectChanges(); // Optional
    }

    if (notification.navigateTo) {
      this.router.navigate([notification.navigateTo], {
        queryParams: {
          scrollToSlot: notification.slotId,
          highlightBookingId: (notification as any).bookingId || notification.companyName
        }
      });
    }
    this.closeNotificationDropdown();
  }

  async setNotificationInteracted(notification: AppNotification, event: MouseEvent): Promise<void> {
    event.stopPropagation(); 
    if (notification.id && !notification.interacted) {
      // Optimistically update local state for immediate UI feedback
      notification.interacted = true;
      // Also mark as read if it wasn't already, as interaction implies it's been seen
      if (!notification.isRead) {
          notification.isRead = true;
      }
      await this.notificationService.markAsRead(notification.id); // This call sets both isRead and interacted in Firestore
      // this.cdr.detectChanges(); // Optional: force change detection if ngFor isn't picking up the change on the object property
    } 
    // If it was already interacted, this click does nothing extra unless you want to toggle or something.
    // The main click action is on the content div for navigation.
  }

  async deleteNotification(notification: AppNotification, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (notification.id) {
      await this.notificationService.deleteNotification(notification.id);
      // Firestore observable should update the list automatically.
      // If not, manual filtering of the local array might be needed, but that's less ideal with observables.
    } 
  }

  async markAllNotificationsAsRead(notifications: AppNotification[] | null): Promise<void> {
    if (notifications && notifications.length > 0) {
        const unreadNotifications = notifications.filter(n => !n.isRead);
        if (unreadNotifications.length > 0) {
            // Optimistically update local state
            unreadNotifications.forEach(n => { 
                n.isRead = true; 
                n.interacted = true; 
            });
            await this.notificationService.markMultipleAsRead(unreadNotifications);
            // this.cdr.detectChanges(); // Optional
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
