import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [NgIf],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  currentUser: User | null = null;
  menuOpen = false;

  readonly logoImage = 'assets/liceo-logo.png';

  constructor() {
    this.currentUser = this.authService.getCurrentUser();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.menuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  isProfilePage(): boolean {
    return this.router.url === '/profile';
  }
}
