import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [NgIf],
  templateUrl: './student-profile.component.html',
  styleUrls: ['./student-profile.component.css']
})
export class StudentProfileComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  currentUser: User | null = null;

  readonly logoImage = 'assets/liceo-logo.png';
  readonly defaultProfileImage =
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=500&q=80';
  readonly backgroundImage = 'assets/background log-in.png';

  profileImageUrl = this.defaultProfileImage;
  avatarMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.profileImageUrl = this.currentUser?.profileImage || this.defaultProfileImage;
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  openMessages(): void {
    this.router.navigate(['/messages']);
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }

  openAvatarPicker(input: HTMLInputElement): void {
    this.avatarMessage = '';
    input.click();
  }

  onAvatarSelected(event: Event): void {
    this.avatarMessage = '';

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.avatarMessage = 'Please choose an image file.';
      input.value = '';
      return;
    }

    const maxBytes = 1_000_000;
    if (file.size > maxBytes) {
      this.avatarMessage = 'Please choose an image under 1MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        this.avatarMessage = 'Could not read the selected image.';
        return;
      }

      this.authService.updateProfile({ profileImage: result });
      this.currentUser = this.authService.getCurrentUser();
      this.profileImageUrl = result;
      this.avatarMessage = 'Profile photo updated.';
    };

    reader.onerror = () => {
      this.avatarMessage = 'Could not read the selected image.';
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  onAvatarError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    if (target.dataset['fallbackApplied'] === 'true') return;
    target.dataset['fallbackApplied'] = 'true';
    target.src = this.defaultProfileImage;
  }
}
