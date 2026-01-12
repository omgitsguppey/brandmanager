
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  BookText,
  ImageIcon,
  CalendarDays,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useBrand } from '@/context/brand-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Dynamically import AlertDialog components to reduce initial bundle size
const AlertDialog = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialog), { ssr: false });
const AlertDialogAction = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogAction), { ssr: false });
const AlertDialogCancel = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogCancel), { ssr: false });
const AlertDialogContent = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogContent), { ssr: false });
const AlertDialogDescription = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogDescription), { ssr: false });
const AlertDialogFooter = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogFooter), { ssr: false });
const AlertDialogHeader = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogHeader), { ssr: false });
const AlertDialogTitle = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogTitle), { ssr: false });
const AlertDialogTrigger = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogTrigger), { ssr: false });

const modules = [
  {
    href: '/guidelines',
    icon: BookText,
    title: 'Guidelines',
    description: 'Define and view your color palettes, typography, and logo usage rules.',
  },
  {
    href: '/assets',
    icon: ImageIcon,
    title: 'Assets',
    description: 'Upload, manage, and access all your brand’s digital assets in one place.',
  },
  {
    href: '/calendar',
    icon: CalendarDays,
    title: 'Calendar',
    description: 'Plan and schedule your social media posts and content strategy.',
  },
  {
    href: '/brand-voice',
    icon: Sparkles,
    title: 'Brand Voice',
    description: 'Use AI to generate slogans and other content that match your brand’s tone.',
    isAi: true,
    model: '2.5 Flash'
  },
];

export default function DashboardPage() {
  const { selectedBrand, loading, deleteAllBrands } = useBrand();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleReset = async () => {
    setIsDeleting(true);
    try {
      await deleteAllBrands();
      toast({
        title: 'Account Reset',
        description: 'All brands and assets have been successfully deleted.',
      });
    } catch (error: any) {
      console.error("Failed to reset account:", error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: `Could not delete all data. ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
       <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!selectedBrand) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-2xl font-bold mb-2">Welcome to BrandVision</p>
          <p className="text-muted-foreground">
            Please select or create a brand to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {selectedBrand.name}
        </h1>
        <p className="text-muted-foreground">
          Welcome back. Here are your brand management tools.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {modules.map((module) => (
          <Card
            key={module.href}
            className="group hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer"
            onClick={() => router.push(module.href)}
          >
            <div className="flex flex-col aspect-square justify-between p-4">
              <div className="flex justify-between items-start">
                <div className="bg-muted p-2 rounded-lg">
                  <module.icon className="h-5 w-5 text-foreground" />
                </div>
                {module.isAi && (
                    <Badge variant="outline" className="text-xs bg-accent/50 border-accent text-accent-foreground shadow-sm shadow-accent/50 animate-pulse">
                      {module.model}
                    </Badge>
                )}
              </div>
              <div className="space-y-1">
                 <h3 className="font-semibold whitespace-nowrap truncate">{module.title}</h3>
                 <p className="text-xs text-muted-foreground line-clamp-2">{module.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="danger-zone" className="border-red-400 bg-red-500/10 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span className="font-semibold text-red-400">Danger Zone</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <p className="text-sm text-red-400/80 mb-4">
              This is a one-time action to reset your account. It will delete all brands and assets permanently.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? 'Resetting Account...' : 'Reset Account'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete ALL brands and ALL associated assets from your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </div>
  );
}
