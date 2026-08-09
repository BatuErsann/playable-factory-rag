import { DestinationPlaceholder } from "@/components/auth/destination-placeholder";
import { ProductShell } from "@/components/product-shell";

export default function AdminPlaceholderPage() {
  return (
    <ProductShell eyebrow="Admin workspace">
      <DestinationPlaceholder requiredRole="ADMIN" title="Admin dashboard" />
    </ProductShell>
  );
}
