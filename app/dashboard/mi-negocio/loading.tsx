"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BusinessPageSkeleton } from "@/components/page-skeletons";

// loading.tsx no recibe searchParams: se leen en cliente para mostrar el skeleton del tab activo
function TabAwareSkeleton() {
  const searchParams = useSearchParams();
  return <BusinessPageSkeleton tab={searchParams.get("tab") === "equipo" ? "equipo" : "general"} />;
}

export default function MiNegocioLoading() {
  // useSearchParams requiere un límite de Suspense para no romper el prerender
  return (
    <Suspense fallback={<BusinessPageSkeleton />}>
      <TabAwareSkeleton />
    </Suspense>
  );
}
