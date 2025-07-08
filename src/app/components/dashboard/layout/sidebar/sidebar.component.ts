import {
  Component,
  EventEmitter,
  Output,
  HostBinding,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  @HostBinding('class.collapsed') isCollapsed = false;
  @Output() toggleCollapse = new EventEmitter<boolean>();

  public isAdmin = false;
  public isEventManager = false;
  private authService = inject(AuthService);
  private userSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.isAdmin = user?.role === 'Admin';
      this.isEventManager = user?.role === 'Eventmanager';
    });
  }

  onToggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggleCollapse.emit(this.isCollapsed);
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
