import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-messages',
  standalone: true,
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent {
  private readonly router = inject(Router);

  readonly logoImage = 'assets/liceo-logo.png';
  readonly backgroundImage = 'assets/background log-in.png';

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  openNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }
}
