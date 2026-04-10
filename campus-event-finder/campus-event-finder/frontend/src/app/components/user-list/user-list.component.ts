import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);

  users: User[] = [];
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userService.getUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load users right now.';
        this.loading = false;
      }
    });
  }

  deleteUser(user: User): void {
    const confirmDelete = window.confirm(`Delete ${user.name}?`);
    if (!confirmDelete) return;

    this.userService.deleteUser(user.id).subscribe({
      next: () => this.loadUsers(),
      error: () => {
        this.errorMessage = 'Unable to delete the user.';
      }
    });
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }
}
