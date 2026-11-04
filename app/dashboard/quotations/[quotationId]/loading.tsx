import { PageLoader } from "@/components/page-loader";

// Evita heredar el skeleton del listado de cotizaciones (layout distinto)
export default function QuotationDetailLoading() {
  return <PageLoader />;
}
