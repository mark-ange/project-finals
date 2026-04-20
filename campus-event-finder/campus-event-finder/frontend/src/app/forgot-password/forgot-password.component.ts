import { Component, inject, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  phase: 'request' | 'reset' | 'done' | 'error' = 'request';
  message = '';
  resetLink = '';
  token = '';
  userEmail = '';
  showPassword = false;

  readonly requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((params: Params) => {
      if (params['token']) {
        this.token = params['token'];
        this.verifyToken();
      }
    });
  }

  private verifyToken(): void {
    this.authService.validateResetToken(this.token).subscribe({
      next: (res) => {
        if (res.valid) {
          this.userEmail = res.email;
          this.phase = 'reset';
        } else {
          this.phase = 'error';
          this.message = 'This link has expired or is invalid.';
        }
      },
      error: () => {
        this.phase = 'error';
        this.message = 'Verification failed. Please request a new link.';
      }
    });
  }

  onSubmitRequest(): void {
    const email = this.requestForm.value.email ?? '';
    this.message = '';

    this.authService.requestPasswordReset(email).subscribe({
      next: (res) => {
        this.phase = 'done';
        this.resetLink = res.link || '';
        this.message = 'Account verified! Your reset link is ready below.';
      },
      error: (err) => {
        // Use backend message if available, otherwise fallback to defaults
        const backendMessage = err.error?.message;
        
        if (err.status === 404) {
          this.message = backendMessage || 'Access Denied: No account associated with this email.';
        } else {
          this.message = backendMessage || 'Server error. Please try again later.';
        }
      }
    });
  }

  onSubmitReset(): void {
    const password = this.resetForm.value.password ?? '';
    if (password !== this.resetForm.value.confirmPassword) {
      this.message = 'Passwords do not match.';
      return;
    }

    this.authService.setPassword(this.token, password).subscribe({
      next: (res) => {
        if (res.success) {
          this.phase = 'done';
          this.resetLink = ''; // Show final success screen
          this.message = 'Your password has been successfully updated.';
        } else {
          this.message = res.message || 'Failed to reset password. Link might be used.';
        }
      },
      error: () => {
        this.message = 'Failed to reset password. Link might be used or network error occurred.';
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  backToLogin() {
    this.router.navigate(['/login']);
  }
}