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
  loading = false;
  saving = false;
  errorMessage = '';

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

    this.userService.updateUser(this.userId, {
      name: this.name.trim(),
      email: this.email.trim()
    }).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/users']);
      },
      error: () => {
        this.errorMessage = 'Unable to update the user.';
        this.saving = false;
      }
    });
  }
}
