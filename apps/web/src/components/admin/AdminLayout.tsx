import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <AdminHeader />
        <main className="flex-1 pt-14 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
