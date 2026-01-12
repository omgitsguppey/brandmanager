'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutGrid, BookText, ImageIcon, CalendarDays, LucideIcon, Sparkles } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    icon: LayoutGrid,
  },
  {
    href: '/guidelines',
    title: 'Guidelines',
    icon: BookText,
  },
  {
    href: '/assets',
    title: 'Asset Library',
    icon: ImageIcon,
  },
  {
    href: '/calendar',
    title: 'Content Calendar',
    icon: CalendarDays,
  },
  {
    href: '/brand-voice',
    title: 'Brand Voice',
    icon: Sparkles,
  },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="p-4">
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton 
                isActive={pathname === item.href}
                className="w-full justify-start text-base"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
