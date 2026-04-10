import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) return router.parseUrl('/login');
  if (authService.isAdmin()) return true;

  alert('Admin access only. Log in with the admin code to continue.');
  return router.parseUrl('/dashboard');
};
