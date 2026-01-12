
'use client';

import React, { useState } from 'react';
import { useBrand } from '@/context/brand-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from './ui/button';
import { ChevronsUpDown, PlusCircle, Check, Settings, Trash2, X } from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Brand } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BrandSelector() {
  const { brands, selectedBrand, setSelectedBrand, addBrand, deleteBrand, loading } = useBrand();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addBrand(newBrandName);
      // Close immediately on success
      setIsAddDialogOpen(false);
      
      toast({
        title: 'Brand Added',
        description: `Successfully added "${newBrandName}".`,
      });
      
      // Reset form state
      setNewBrandName('');
    } catch (error) {
      console.error('Failed to add brand:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to add brand',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!brandToDelete) return;
    try {
      await deleteBrand(brandToDelete.id);
      toast({
        title: 'Brand Deleted',
        description: `Successfully deleted "${brandToDelete.name}".`,
      });
      setBrandToDelete(null);
      // If there's 1 or 0 brands left, exit editing mode
      if (brands.length <= 1) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to delete brand:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete brand',
        description: 'Please try again.',
      });
    }
  };

  const handleSelectBrand = (brand: Brand) => {
    if (isEditing) return;
    // Use setTimeout to allow Dropdown to close and restore focus before heavy state updates
    setTimeout(() => setSelectedBrand(brand), 0);
  }

  return (
    <>
      <DropdownMenu onOpenChange={(isOpen) => { if(!isOpen) setIsEditing(false) }}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between" disabled={loading}>
            <span className="truncate">
              {loading ? 'Loading...' : selectedBrand ? selectedBrand.name : 'Select a brand'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>
            Brands
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {brands.map((brand) => (
            <DropdownMenuItem
              key={brand.id}
              onSelect={() => handleSelectBrand(brand)}
              className={cn("justify-between", isEditing && "cursor-default focus:bg-transparent")}
            >
              <span>{brand.name}</span>
              {isEditing ? (
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        setBrandToDelete(brand);
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                selectedBrand?.id === brand.id && <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
          {!brands.length && !loading && (
             <DropdownMenuLabel className="text-xs text-center text-muted-foreground font-normal">No brands yet.</DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTimeout(() => setIsAddDialogOpen(true), 0)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Add New Brand</span>
          </DropdownMenuItem>
           {brands.length > 0 && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsEditing(!isEditing); }}>
              {isEditing ? <X className="mr-2 h-4 w-4" /> : <Settings className="mr-2 h-4 w-4" />}
              <span>{isEditing ? 'Finish' : 'Manage Brands'}</span>
            </DropdownMenuItem>
           )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Brand</DialogTitle>
            <DialogDescription>
              Enter the name for your new brand.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., BrandVision Pro"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBrand();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddBrand} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Brand'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!brandToDelete} onOpenChange={(isOpen) => !isOpen && setBrandToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{brandToDelete?.name}" brand and all of its associated assets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBrand}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    