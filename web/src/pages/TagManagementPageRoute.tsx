import Header from "@/components/Header";
import { TagManagementPage } from "@/features/tag/components/TagManagementPage";

export default function TagManagementPageRoute() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <TagManagementPage />
      </div>
    </main>
  );
}
