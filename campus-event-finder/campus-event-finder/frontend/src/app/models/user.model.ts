export interface User {
  id: number;
  name: string;
  fullName?: string;
  email: string;
  password?: string;
  role: 'student' | 'admin' | 'main-admin';
  department: string;
  profileImage?: string;
}
