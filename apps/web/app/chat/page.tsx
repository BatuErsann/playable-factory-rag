import { DestinationPlaceholder } from "@/components/auth/destination-placeholder";
import { ProductShell } from "@/components/product-shell";

export default function ChatPlaceholderPage() {
  return (
    <ProductShell eyebrow="User workspace">
      <DestinationPlaceholder title="Chat workspace" />
    </ProductShell>
  );
}
