import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, DisplayUser } from '../../../../services/user.service';
import { AuthService, AppUser } from '../../../../services/auth.service';
import { Observable, Subscription } from 'rxjs';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.scss'],
})
export class UsersListComponent implements OnInit {
  public users$!: Observable<DisplayUser[]>;
  public currentUser$: Observable<AppUser | null>;
  public isAdmin: boolean = false;
  private currentUserSubscription: Subscription | undefined;

  private toastService = inject(ToastService);
  public availableRoles: ('Admin' | 'User' | 'Eventmanager' | 'Nuovo')[] = [
    'Admin',
    'Nuovo',
    'Eventmanager',
    'User',
  ];

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
    this.currentUserSubscription = this.authService.currentUser$.subscribe(
      (user) => {
        this.isAdmin = (user as any)?.role === 'Admin';
      }
    );
  }

  trackByUser(index: number, user: DisplayUser): string {
    return user.id;
  }

  onRoleChange(event: Event, user: DisplayUser): void {
    const selectElement = event.target as HTMLSelectElement;
    const newRole = selectElement.value as
      | 'Admin'
      | 'User'
      | 'Nuovo';

    this.userService
      .updateUserRole(user.id, newRole)
      .then(() => {
        this.toastService.show(
          `Ruolo di ${user.name} aggiornato a ${newRole}.`,
          'success'
        );
      })
      .catch((error) => {
        console.error("Errore durante l'aggiornamento del ruolo:", error);
        this.toastService.show(
          `Errore nell'aggiornare il ruolo di ${user.name}.`,
          'error'
        );

        selectElement.value = user.role;
      });
  }

  ngOnDestroy(): void {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
  }
}
