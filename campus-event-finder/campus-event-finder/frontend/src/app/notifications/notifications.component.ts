import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  private readonly router = inject(Router);

  readonly logoImage = 'assets/liceo-logo.png';
  readonly backgroundImage = 'assets/background log-in.png';

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  openMessages(): void {
    this.router.navigate(['/messages']);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }
}
