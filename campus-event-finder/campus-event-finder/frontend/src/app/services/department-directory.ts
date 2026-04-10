export const DEPARTMENT_OPTIONS = [
  'Computer Science Department',
  'Engineering Department',
  'Healthcare Department',
  'Information Technology Department',
  'Business Department',
  'Sports Department',
  'Fine Arts Department',
  'Student Affairs Department'
] as const;

export const MAIN_ADMIN_DEPARTMENT = 'Main Administration' as const;

export type UserRole = 'student' | 'admin' | 'main-admin';

const DEPARTMENT_ALIASES: Record<string, DepartmentName> = {
  'computer science': 'Computer Science Department',
  'computer science dept': 'Computer Science Department',
  'computer studies': 'Computer Science Department',
  'cs': 'Computer Science Department',
  'engineering': 'Engineering Department',
  'engineering dept': 'Engineering Department',
  'healthcare': 'Healthcare Department',
  'health care': 'Healthcare Department',
  'healthcare dept': 'Healthcare Department',
  'nursing': 'Healthcare Department',
  'pre-med': 'Healthcare Department',
  'medical': 'Healthcare Department',
  'information technology': 'Information Technology Department',
  'it': 'Information Technology Department',
  'it department': 'Information Technology Department',
  'i.t department': 'Information Technology Department',
  'i.t. department': 'Information Technology Department',
  'information technology dept': 'Information Technology Department',
  'business': 'Business Department',
  'business dept': 'Business Department',
  'accountancy': 'Business Department',
  'sports': 'Sports Department',
  'sports dept': 'Sports Department',
  'fine arts': 'Fine Arts Department',
  'arts': 'Fine Arts Department',
  'arts dept': 'Fine Arts Department',
  'student affairs': 'Student Affairs Department',
  'student affairs office': 'Student Affairs Department',
  'school': 'Student Affairs Department'
};

export type DepartmentName = (typeof DEPARTMENT_OPTIONS)[number];

export interface DemoDepartmentAccount {
  fullName: string;
  email: string;
  password: string;
  department: DepartmentName | typeof MAIN_ADMIN_DEPARTMENT;
  role: UserRole;
}

export const DEMO_DEPARTMENT_ACCOUNTS: DemoDepartmentAccount[] = [
  {
    fullName: 'CS Admin',
    email: 'cs.admin@liceo.edu.ph',
    password: 'CSAdmin123',
    department: 'Computer Science Department',
    role: 'admin'
  },
  {
    fullName: 'CS Student',
    email: 'cs.student@liceo.edu.ph',
    password: 'CSStudent123',
    department: 'Computer Science Department',
    role: 'student'
  },
  {
    fullName: 'Engineering Admin',
    email: 'eng.admin@liceo.edu.ph',
    password: 'EngAdmin123',
    department: 'Engineering Department',
    role: 'admin'
  },
  {
    fullName: 'Engineering Student',
    email: 'eng.student@liceo.edu.ph',
    password: 'EngStudent123',
    department: 'Engineering Department',
    role: 'student'
  },
  {
    fullName: 'Healthcare Admin',
    email: 'health.admin@liceo.edu.ph',
    password: 'HealthAdmin123',
    department: 'Healthcare Department',
    role: 'admin'
  },
  {
    fullName: 'Healthcare Student',
    email: 'health.student@liceo.edu.ph',
    password: 'HealthStudent123',
    department: 'Healthcare Department',
    role: 'student'
  },
  {
    fullName: 'IT Admin',
    email: 'it.admin@liceo.edu.ph',
    password: 'ITAdmin123',
    department: 'Information Technology Department',
    role: 'admin'
  },
  {
    fullName: 'IT Student',
    email: 'it.student@liceo.edu.ph',
    password: 'ITStudent123',
    department: 'Information Technology Department',
    role: 'student'
  },
  {
    fullName: 'Business Admin',
    email: 'business.admin@liceo.edu.ph',
    password: 'BusinessAdmin123',
    department: 'Business Department',
    role: 'admin'
  },
  {
    fullName: 'Business Student',
    email: 'business.student@liceo.edu.ph',
    password: 'BusinessStudent123',
    department: 'Business Department',
    role: 'student'
  },
  {
    fullName: 'Sports Admin',
    email: 'sports.admin@liceo.edu.ph',
    password: 'SportsAdmin123',
    department: 'Sports Department',
    role: 'admin'
  },
  {
    fullName: 'Sports Student',
    email: 'sports.student@liceo.edu.ph',
    password: 'SportsStudent123',
    department: 'Sports Department',
    role: 'student'
  },
  {
    fullName: 'Fine Arts Admin',
    email: 'arts.admin@liceo.edu.ph',
    password: 'ArtsAdmin123',
    department: 'Fine Arts Department',
    role: 'admin'
  },
  {
    fullName: 'Fine Arts Student',
    email: 'arts.student@liceo.edu.ph',
    password: 'ArtsStudent123',
    department: 'Fine Arts Department',
    role: 'student'
  },
  {
    fullName: 'Student Affairs Admin',
    email: 'affairs.admin@liceo.edu.ph',
    password: 'AffairsAdmin123',
    department: 'Student Affairs Department',
    role: 'admin'
  },
  {
    fullName: 'Student Affairs Student',
    email: 'affairs.student@liceo.edu.ph',
    password: 'AffairsStudent123',
    department: 'Student Affairs Department',
    role: 'student'
  },
  {
    fullName: 'Main Admin',
    email: 'main.admin@liceo.edu.ph',
    password: 'MainAdmin123',
    department: MAIN_ADMIN_DEPARTMENT,
    role: 'main-admin'
  }
];

export function normalizeDepartment(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  const alias = DEPARTMENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const match = DEPARTMENT_OPTIONS.find(option => option.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

export function isKnownDepartment(value: string | null | undefined): value is DepartmentName {
  return DEPARTMENT_OPTIONS.includes(normalizeDepartment(value) as DepartmentName);
}

export function sameDepartment(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normalizedLeft = normalizeDepartment(left);
  const normalizedRight = normalizeDepartment(right);
  return normalizedLeft !== '' && normalizedLeft === normalizedRight;
}
