import { Dashboard } from "@/app/components/Dashboard";
import { getDashboardData } from "@/app/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  return <Dashboard initialData={data} />;
}
