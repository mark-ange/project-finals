import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  currentUser: User | null = null;
  savedMessage = '';
  errorMessage = '';

  readonly logoImage = 'assets/liceo-logo.png';
  readonly backgroundImage = 'assets/background log-in.png';

  readonly settingsForm = this.formBuilder.group({
    fullName: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.settingsForm.patchValue({
        fullName: this.currentUser.fullName
      });
    }
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  saveSettings(): void {
    this.savedMessage = '';
    this.errorMessage = '';

    if (!this.currentUser) {
      this.errorMessage = 'No active user session.';
      return;
    }

    if (this.settingsForm.invalid) {
      this.errorMessage = 'Please complete all required fields.';
      return;
    }

    const fullName = this.settingsForm.value.fullName ?? '';
    this.authService.updateProfile({ fullName });
    this.currentUser = this.authService.getCurrentUser();
    this.savedMessage = 'Settings saved.';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
