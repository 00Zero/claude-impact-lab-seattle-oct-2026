import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CostEstimatorPage } from "./pages/CostEstimatorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    // Formulary and drug data change rarely; cache aggressively.
    queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CostEstimatorPage />
    </QueryClientProvider>
  );
}
