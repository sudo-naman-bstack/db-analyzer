import { getCustomerAccordionData } from "@/lib/db/queries";
import { CustomersTable } from "@/components/customers-table";
import { SectionHeader } from "@/components/section-header";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { grouped } = await getCustomerAccordionData();

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Users className="h-4 w-4" />}
        title="By customer"
        description={`${grouped.length} customers · click a customer to view their tickets`}
      />
      <CustomersTable rows={grouped} />
    </div>
  );
}
