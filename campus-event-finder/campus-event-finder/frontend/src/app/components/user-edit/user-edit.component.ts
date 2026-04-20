import { Component, OnInit, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.css']
})
export class UserEditComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  userId = 0;
  name = '';
  email = '';
  password = '';
  loading = false;
  saving = false;
  department = '';
  role: 'student' | 'admin' | 'main-admin' = 'student';
  showPassword = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const parsedId = Number(idParam);
    if (!parsedId) {
      this.errorMessage = 'Invalid user id.';
      return;
    }

    this.userId = parsedId;
    this.loadUser();
  }

  loadUser(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userService.getUser(this.userId).subscribe({
      next: user => {
        this.name = user.name;
        this.email = user.email;
        this.department = user.department;
        this.role = user.role;
        this.password = user.password || '';
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load the user.';
        this.loading = false;
      }
    });
  }

  save(): void {
    if (!this.name.trim() || !this.email.trim()) {
      this.errorMessage = 'Name and email are required.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Update basic info
    this.userService.updateUser(this.userId, {
      name: this.name.trim(),
      email: this.email.trim(),
      department: this.department,
      role: this.role
    }).subscribe({
      next: () => {
        // If password was also provided, update it too
        if (this.password.trim()) {
          this.userService.updatePassword(this.userId, this.password.trim()).subscribe({
            next: () => {
              this.saving = false;
              this.successMessage = 'User and security credentials updated.';
              setTimeout(() => this.router.navigate(['/users']), 1500);
            },
            error: () => {
              this.errorMessage = 'Profile updated, but password change failed.';
              this.saving = false;
            }
          });
        } else {
          this.saving = false;
          this.successMessage = 'User profile updated successfully.';
          setTimeout(() => this.router.navigate(['/users']), 1500);
        }
      },
      error: () => {
        this.errorMessage = 'Unable to update the user profile.';
        this.saving = false;
      }
    });
  }
}
