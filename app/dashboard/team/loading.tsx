import { BusinessPageSkeleton } from "@/components/page-skeletons";

// /dashboard/team redirige a Mi negocio → Equipo; se muestra ese layout
export default function TeamLoading() {
  return <BusinessPageSkeleton tab="equipo" />;
}
