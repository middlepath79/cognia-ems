export type StaffFormValues = {
  id: string;
  userId: string;
  employeeNumber: string;
  firstName: string;
  middleName: string;
  surname: string;
  email: string;
  phone: string;
  profilePhotoUrl: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  staffCategory: string;
  reportingManagerId: string;
  departmentId: string;
  designation: string;
  employmentStatus: string;
  employmentType: string;
  joinedOn: string;
  notes: string;
};

export type StaffCsvRow = {
  employee_number: string;
  first_name: string;
  middle_name: string | null;
  surname: string;
  email: string | null;
  phone: string | null;
  employment_status: string;
  employment_type: string;
  designation: string | null;
  staff_category: string;
  account_status: string;
};

export type StaffContactValues = { phone: string; address: string };

export function getInvitationDisplayStatus(status: string, expiresAt: string, now = Date.now()): string {
  return status === "pending" && Date.parse(expiresAt) <= now ? "expired" : status;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["active", "on_leave", "suspended", "terminated", "retired"]);
const employmentTypes = new Set(["full_time", "part_time", "contract", "temporary", "adjunct"]);
const staffCategories = new Set(["teaching", "non_teaching"]);
const genders = new Set(["", "female", "male", "non_binary", "prefer_not_to_say"]);

export function validateStaffContact(values: StaffContactValues): string | null {
  if (values.phone.length > 40 || values.address.length > 500) {
    return "Phone must be 40 characters or fewer and address must be 500 characters or fewer.";
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(values.phone + values.address)) {
    return "Phone and address cannot contain control characters.";
  }
  return null;
}

export function canAccessTeacherWorkspace(role: string): boolean {
  return role === "teacher";
}

export function validateStaffForm(values: StaffFormValues): string | null {
  if (values.id && !uuid.test(values.id)) return "This staff profile is invalid. Refresh and try again.";
  if (values.userId && !uuid.test(values.userId)) return "Select an active staff membership.";
  if (!values.userId && !values.email) return "Enter an email address to invite this staff member.";
  if (!staffCategories.has(values.staffCategory)) return "Choose a staff category: teaching or non-teaching.";
  if (
    !values.employeeNumber.trim() ||
    values.employeeNumber.length > 32 ||
    /[\u0000-\u001f\u007f]/.test(values.employeeNumber)
  ) {
    return "Enter an employee number up to 32 characters long.";
  }
  if (
    !values.firstName ||
    values.firstName.length > 100 ||
    values.middleName.length > 100 ||
    !values.surname ||
    values.surname.length > 100
  ) {
    return "Enter a first name and surname, each no longer than 100 characters.";
  }
  if (values.email.length > 254 || (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) {
    return "Enter a valid email address.";
  }
  if (values.phone.length > 40 || values.designation.length > 120 || values.notes.length > 2000) {
    return "One or more staff profile fields exceed the allowed length.";
  }
  if (values.profilePhotoUrl.length > 2048 || values.address.length > 500) {
    return "The profile photograph URL or address exceeds the allowed length.";
  }
  if (values.profilePhotoUrl) {
    try {
      const photoUrl = new URL(values.profilePhotoUrl);
      if (!["http:", "https:"].includes(photoUrl.protocol)) throw new Error("Unsupported protocol");
    } catch {
      return "Enter a valid HTTP or HTTPS profile photograph URL.";
    }
  }
  if (!genders.has(values.gender)) return "Choose a valid gender option.";
  if (values.departmentId && !uuid.test(values.departmentId)) {
    return "Choose a department belonging to this institution.";
  }
  if (values.reportingManagerId && !uuid.test(values.reportingManagerId)) {
    return "Choose a reporting manager in this institution.";
  }
  if (!statuses.has(values.employmentStatus) || !employmentTypes.has(values.employmentType)) {
    return "Choose a valid employment status and type.";
  }
  if (values.joinedOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.joinedOn)) return "Enter a valid joining date.";
    const parsedDate = new Date(`${values.joinedOn}T00:00:00.000Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== values.joinedOn) {
      return "Enter a valid joining date.";
    }
  }
  if (values.dateOfBirth) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth)) return "Enter a valid date of birth.";
    const parsedDate = new Date(`${values.dateOfBirth}T00:00:00.000Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== values.dateOfBirth) {
      return "Enter a valid date of birth.";
    }
  }
  return null;
}

function csvCell(value: string | null): string {
  const raw = String(value ?? "");
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll("\"", "\"\"")}"` : safe;
}

export function createStaffCsv(rows: StaffCsvRow[]): string {
  const headers = ["Employee", "Name", "Email", "Phone", "Status", "Type", "Designation", "Category", "Account"];
  const records = rows.map((row) => [
    row.employee_number,
    [row.first_name, row.middle_name, row.surname].filter(Boolean).join(" "),
    row.email,
    row.phone,
    row.employment_status,
    row.employment_type,
    row.designation,
    row.staff_category,
    row.account_status,
  ]);
  return [headers, ...records].map((record) => record.map(csvCell).join(",")).join("\r\n");
}
