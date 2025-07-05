import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, DisplayUser } from '../../../../services/user.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.scss']
})
export class UsersListComponent implements OnInit {
  public users$!: Observable<DisplayUser[]>;

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.users$ = this.userService.getUsers();
  }

  trackByUser(index: number, user: DisplayUser): string {
    return user.id;
  }
}
