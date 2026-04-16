import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterData } from '../services/auth.service';
import { DEPARTMENT_OPTIONS } from '../services/department-directory';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  registerForm: FormGroup = this.formBuilder.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
    department: ['', Validators.required],
    adminCode: ['']
  });

  errorMessage = '';
  successMessage = '';
  readonly departments = DEPARTMENT_OPTIONS;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.authService.logout();
      this.setStatusAfterLogout();
    }
  }

  private setStatusAfterLogout(): void {
    this.successMessage = 'You were logged out so you can create a new account. Please complete the signup form.';
    this.errorMessage = '';
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      const password = this.registerForm.value.password;
      const confirmPassword = this.registerForm.value.confirmPassword;
      
      if (password !== confirmPassword) {
        this.errorMessage = 'Passwords do not match';
        return;
      }

      const registerData: RegisterData = {
        fullName: this.registerForm.value.fullName,
        email: this.registerForm.value.email,
        password: password,
        department: this.registerForm.value.department,
        adminCode: this.registerForm.value.adminCode || undefined
      };

      this.authService.register(registerData).subscribe(result => {
        if (result.success) {
          this.successMessage = result.message;
          this.errorMessage = '';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.errorMessage = result.message;
          this.successMessage = '';
        }
      });
    }
  }

  onBackToLogin(): void {
    this.router.navigate(['/login']);
  }
}
