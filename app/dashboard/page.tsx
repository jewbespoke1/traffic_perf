import { DashboardShell } from '@/components/Dashboard';
import { DataProvider } from '@/components/providers/DataProvider';
import {
  generateInitialSnapshot,
  getEmphasisWeights,
  initTrafficModel,
  setCircadianProfile,
  setSubdomainWeights,
  setTrafficRate,
} from '@/lib/dataGenerator';

export default async function DashboardPage() {
  initTrafficModel(1);
  setTrafficRate(12_000);
  setCircadianProfile(true);
  setSubdomainWeights(getEmphasisWeights());
  const initialData = generateInitialSnapshot(10);

  return (
    <DataProvider initialData={initialData}>
      <DashboardShell />
    </DataProvider>
  );
}
