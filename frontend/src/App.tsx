import { TooltipProvider } from '@/components/ui/tooltip';
import { Dashboard } from '@/components/dashboard/Dashboard';

function App() {
  return (
    <TooltipProvider>
      <Dashboard />
    </TooltipProvider>
  );
}

export default App;
