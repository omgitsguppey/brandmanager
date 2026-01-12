'use client';

import React, { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { Sparkles } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { BrandProvider } from '@/context/brand-context';
import { BrandSelector } from '@/components/brand-selector';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrandProvider>
      <SidebarProvider>
        <div className="min-h-screen">
          <Sidebar>
            <div className="flex flex-col h-full">
              <div className="p-4 flex items-center gap-2">
                <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">BrandVision</h1>
              </div>
              <div className="flex-1">
                <MainNav />
              </div>
            </div>
          </Sidebar>
          <SidebarInset>
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
              <div className="container mx-auto grid grid-cols-3 h-16 items-center px-4 md:px-8">
                <div>
                  <SidebarTrigger />
                </div>
                <div className="flex justify-center">
                  <BrandSelector />
                </div>
                <div className="flex justify-end">
                  <UserNav />
                </div>
              </div>
            </header>
            <main className="flex-1 p-4 md:p-8">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </BrandProvider>
  );
}
