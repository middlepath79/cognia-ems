import Link from "next/link";
import PageHeading from "@/components/page-heading";
import StudentForm from "../student-form";

export default function NewStudentPage() {
  return <><PageHeading title="Register a student" description="Create a student record. Academic placement can be added after registration."/><p className="mb-4 text-sm"><Link href="/admin/students" className="font-semibold text-indigo-700">← Back to directory</Link></p><StudentForm/></>;
}
