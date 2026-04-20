import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.css']
})
export class UserCreateComponent {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  saving = false;
  errorMessage = '';

  save(): void {
    if (!this.name.trim() || !this.email.trim()) {
      this.errorMessage = 'Name and email are required.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.userService.createUser({
      name: this.name.trim(),
      email: this.email.trim(),
      department: 'Main Administration', // Default for administrative creation
      role: 'admin'
    }).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/users']);
      },
      error: () => {
        this.errorMessage = 'Unable to create the user.';
        this.saving = false;
      }
    });
  }
}
