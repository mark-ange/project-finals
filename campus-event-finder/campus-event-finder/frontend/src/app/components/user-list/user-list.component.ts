import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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
  readonly authService = inject(AuthService);

  users: User[] = [];
  loading = false;
  errorMessage = '';
  resetMessage = '';
  resetMessageType: 'success' | 'error' | 'info' | null = null;
  pendingDeleteUserId: number | null = null;

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

  requestDeleteUser(user: User): void {
    this.pendingDeleteUserId = user.id;
    this.errorMessage = '';
  }

  confirmDeleteUser(user: User): void {
    if (this.pendingDeleteUserId !== user.id) return;

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.pendingDeleteUserId = null;
        this.loadUsers();
      },
      error: () => {
        this.errorMessage = 'Unable to delete the user.';
      }
    });
  }

  cancelDelete(): void {
    this.pendingDeleteUserId = null;
  }

  sendResetLink(user: User): void {
    this.resetMessage = '';
    this.resetMessageType = null;

    this.authService.requestPasswordReset(user.email).subscribe(result => {
      this.resetMessage = result.message;
      this.resetMessageType = result.success ? 'success' : 'error';
    });
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }
}
