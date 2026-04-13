import { Routes } from '@angular/router';
import { LoginComponent } from './log-in/login.component';
import { SignUpComponent } from './sign-up/sign-up.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminEventsComponent } from './admin-events/admin-events.component';
import { StudentProfileComponent } from './student-profile/student-profile.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { SettingsComponent } from './settings/settings.component';
import { UserListComponent } from './components/user-list/user-list.component';
import { UserCreateComponent } from './components/user-create/user-create.component';
import { UserEditComponent } from './components/user-edit/user-edit.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { studentGuard } from './guards/student.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'sign-up', component: SignUpComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'admin-events', component: AdminEventsComponent, canActivate: [adminGuard] },
  { path: 'profile', component: StudentProfileComponent, canActivate: [studentGuard] },
  { path: 'messages', redirectTo: '/notifications', pathMatch: 'full' },
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'users', component: UserListComponent },
  { path: 'users/new', component: UserCreateComponent },
  { path: 'users/:id/edit', component: UserEditComponent }
];
