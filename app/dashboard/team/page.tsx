import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/dashboard/mi-negocio?tab=equipo");
}
