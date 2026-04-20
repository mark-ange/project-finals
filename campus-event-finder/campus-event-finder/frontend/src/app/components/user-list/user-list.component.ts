import { Component, OnInit, inject } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { NavigationComponent } from '../../shared/navigation/navigation.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, RouterLink, NavigationComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  public readonly authService = inject(AuthService);

  users: User[] = [];
  loading = false;
  errorMessage = '';
  resetMessage = '';
  resetMessageType: 'success' | 'error' | 'info' | null = null;
  pendingDeleteUserId: number | null = null;
  currentFilter: 'all' | 'student' | 'admin' = 'all';
  allUsers: User[] = [];
  visiblePasswordIds: Set<number> = new Set();

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userService.getUsers().subscribe({
      next: users => {
        // Exclude main-admin from the list since they are the ones managing it
        this.allUsers = users.filter((u: any) => u.role !== 'main-admin');
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load users right now.';
        this.loading = false;
      }
    });
  }

  setFilter(filter: 'all' | 'student' | 'admin'): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.currentFilter === 'all') {
      this.users = [...this.allUsers];
    } else {
      this.users = this.allUsers.filter(u => u.role === this.currentFilter);
    }
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

  togglePassword(userId: number): void {
    if (this.visiblePasswordIds.has(userId)) {
      this.visiblePasswordIds.delete(userId);
    } else {
      this.visiblePasswordIds.add(userId);
    }
  }

  isPasswordVisible(userId: number): boolean {
    return this.visiblePasswordIds.has(userId);
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }
}
