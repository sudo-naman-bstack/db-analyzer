import { getCustomerAccordionData } from "@/lib/db/queries";
import { ExpandOnHash } from "@/components/expand-on-hash";
import { CustomerAccordion } from "@/components/customer-accordion";
import { SectionHeader } from "@/components/section-header";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { grouped, byCustomer } = await getCustomerAccordionData();

  return (
    <div className="space-y-6">
      <ExpandOnHash />
      <SectionHeader
        icon={<Users className="h-4 w-4" />}
        title="By customer"
        description={`${grouped.length} customers with dealblocking tickets`}
      />
      <CustomerAccordion grouped={grouped} byCustomer={byCustomer} />
    </div>
  );
}
