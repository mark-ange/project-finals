import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { NavigationComponent } from '../shared/navigation/navigation.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, NavigationComponent],
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

  darkMode = false;

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
      this.darkMode = this.authService.getDarkModePreference();
      this.applyTheme();
    }
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.darkMode);
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.authService.setDarkModePreference(this.darkMode);
    this.applyTheme();
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
