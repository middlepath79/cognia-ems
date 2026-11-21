export type StaffRecord = {
  id: string;
  user_id: string | null;
  employee_number: string;
  first_name: string;
  middle_name: string | null;
  surname: string;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  staff_category: string;
  department_id: string | null;
  designation: string | null;
  employment_status: string;
  employment_type: string;
  joined_on: string | null;
  reporting_manager_id: string | null;
  account_status: string;
  notes: string | null;
};

export type StaffDepartment = { id: string; name: string };
export type StaffManager = Pick<StaffRecord, "id" | "first_name" | "surname" | "employee_number">;
export type StaffMembership = {
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
};

export type StaffInvitation = {
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type StaffDirectoryStats = {
  total: number | null;
  teaching: number | null;
  nonTeaching: number | null;
  active: number | null;
  pendingInvitations: number | null;
};

export type StaffDirectoryFilters = {
  q?: string;
  status?: string;
  department?: string;
  category?: string;
  account?: string;
  sort?: string;
  direction?: string;
};
