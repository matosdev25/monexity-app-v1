export type QuotationCompanyInfo = {
  name: string;
  logoUrl: string | null;
  contactFooter: string | null;
  invoiceRuc: string | null;
  invoiceDv: string | null;
  invoiceAddress: string | null;
  invoiceEmail: string | null;
  invoicePhone: string | null;
};

export type PdfLogo = {
  dataUrl: string;
  format: string;
};

export function getCompanyName(company: QuotationCompanyInfo) {
  return company.name?.trim() || "Empresa";
}

export function getCompanyInitial(company: QuotationCompanyInfo) {
  return getCompanyName(company).charAt(0).toUpperCase() || "E";
}

export function getCompanyDetails(company: QuotationCompanyInfo) {
  const ruc = company.invoiceRuc?.trim()
    ? `RUC: ${company.invoiceRuc.trim()}${company.invoiceDv?.trim() ? ` DV ${company.invoiceDv.trim()}` : ""}`
    : "";

  return [
    ruc,
    company.invoiceAddress,
    company.invoiceEmail,
    company.invoicePhone,
    company.contactFooter,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
}

export function getCompanyMetadataLines(company: QuotationCompanyInfo) {
  const ruc = company.invoiceRuc?.trim()
    ? `RUC: ${company.invoiceRuc.trim()}${company.invoiceDv?.trim() ? ` DV ${company.invoiceDv.trim()}` : ""}`
    : "";

  return [
    [ruc, company.invoiceAddress].map((value) => value?.trim() ?? "").filter(Boolean).join(" · "),
    [company.invoiceEmail, company.invoicePhone].map((value) => value?.trim() ?? "").filter(Boolean).join(" · "),
  ].filter(Boolean);
}

export async function loadPdfLogo(logoUrl: string | null): Promise<PdfLogo | null> {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const mimeMatch = dataUrl.match(/^data:image\/(\w+);/);
    let format = mimeMatch?.[1]?.toUpperCase() || "PNG";
    if (format === "JPG") format = "JPEG";

    return { dataUrl, format };
  } catch {
    return null;
  }
}
