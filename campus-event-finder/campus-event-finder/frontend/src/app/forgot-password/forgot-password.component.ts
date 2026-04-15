import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

type Phase = 'request' | 'done';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  phase: Phase = 'request';
  message = '';

  readonly requestForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmitRequest(): void {
    this.message = '';
    if (this.requestForm.invalid) return;

    const email = this.requestForm.value.email ?? '';
    const result = this.authService.requestPasswordReset(email);
    this.phase = 'done';
    this.message = result.message;
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
