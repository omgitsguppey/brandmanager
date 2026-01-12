
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, type Query, orderBy, doc, deleteDoc, writeBatch, getDocs, where, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useStorage } from '@/firebase';
import type { Brand, Memory } from '@/lib/types';

interface BrandContextType {
  brands: Brand[];
  selectedBrand: Brand | null;
  setSelectedBrand: (brand: Brand | null) => void;
  addBrand: (name: string) => Promise<void>;
  deleteBrand: (brandId: string) => Promise<void>;
  deleteAllBrands: () => Promise<void>;
  loading: boolean;
  memories: Memory[];
  addMemory: (content: string, type: Memory['type'], source?: string) => Promise<void>;
  deleteMemory: (memoryId: string) => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const [selectedBrand, setSelectedBrandState] = useState<Brand | null>(null);

  const brandsQuery = useMemo(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'brands'), orderBy('createdAt', 'desc')) as Query<Brand>;
    }
    return null;
  }, [firestore, user]);
  
  const { data: brands, loading } = useCollection<Brand>(brandsQuery);

  const memoriesQuery = useMemo(() => {
    if (user && firestore && selectedBrand) {
      return query(
        collection(firestore, 'users', user.uid, 'brands', selectedBrand.id, 'memories'), 
        orderBy('createdAt', 'desc')
      ) as Query<Memory>;
    }
    return null;
  }, [firestore, user, selectedBrand]);

  const { data: memories } = useCollection<Memory>(memoriesQuery);

  useEffect(() => {
    if (loading || !brands) return;

    const currentSelectedId = selectedBrand?.id;
    const isSelectedBrandValid = currentSelectedId && brands.some(b => b.id === currentSelectedId);

    if (isSelectedBrandValid) {
      const freshBrand = brands.find(b => b.id === currentSelectedId);
       // only update state if the object has actually changed.
      if (freshBrand && JSON.stringify(freshBrand) !== JSON.stringify(selectedBrand)) {
        setSelectedBrandState(freshBrand);
      }
      return;
    }
    
    const lastBrandId = typeof window !== 'undefined' ? localStorage.getItem('selectedBrandId') : null;
    
    const brandToSelect = 
      (lastBrandId && brands.find(b => b.id === lastBrandId)) || 
      brands[0] || 
      null;

    setSelectedBrand(brandToSelect);

  }, [brands, loading, selectedBrand]);


  const setSelectedBrand = (brand: Brand | null) => {
    setSelectedBrandState(brand);
    if (typeof window !== 'undefined') {
      if (brand) {
        localStorage.setItem('selectedBrandId', brand.id);
      } else {
        localStorage.removeItem('selectedBrandId');
      }
    }
  };
  
  const addBrand = async (name: string) => {
    if (!user || !firestore) throw new Error("User not authenticated");
    await addDoc(collection(firestore, 'users', user.uid, 'brands'), {
        name,
        createdAt: serverTimestamp(),
        userId: user.uid,
    });
  };

  const deleteBrand = async (brandId: string) => {
    if (!user || !firestore || !storage) throw new Error("Services not available");

    const batch = writeBatch(firestore);
    const brandRef = doc(firestore, 'users', user.uid, 'brands', brandId);
    
    const assetsQuery = query(collection(firestore, 'users', user.uid, 'assets'), where('brandId', '==', brandId));
    const assetsSnapshot = await getDocs(assetsQuery);
    
    const assetDeletionPromises = assetsSnapshot.docs.map(assetDoc => {
      const assetData = assetDoc.data();
      if (assetData.name) {
        const fileRef = ref(storage, `users/${user.uid}/assets/${assetData.name}`);
        return deleteObject(fileRef).catch(error => {
          if (error.code === 'storage/object-not-found') {
            return;
          }
          console.error(`Failed to delete asset from storage: ${assetData.name}`, error);
          throw error;
        });
      }
      return Promise.resolve();
    });

    await Promise.all(assetDeletionPromises);
    
    assetsSnapshot.forEach(assetDoc => {
      batch.delete(assetDoc.ref);
    });

    batch.delete(brandRef);

    await batch.commit();
  }

  const deleteAllBrands = async () => {
    if (!user || !firestore || !brands) throw new Error("User not authenticated or no brands to delete.");
    // This creates a stable copy of the brands array to iterate over.
    const allBrands = [...brands];
    for (const brand of allBrands) {
      await deleteBrand(brand.id);
    }
  };
  
  const addMemory = async (content: string, type: Memory['type'], source?: string) => {
    if (!user || !firestore || !selectedBrand) throw new Error("Cannot add memory: user or brand not available.");

    const memoriesRef = collection(firestore, `users/${user.uid}/brands/${selectedBrand.id}/memories`);
    const q = query(memoriesRef, where('content', '==', content));

    const existingMemorySnapshot = await getDocs(q);

    if (!existingMemorySnapshot.empty) {
      const existingMemoryDoc = existingMemorySnapshot.docs[0];
      await updateDoc(doc(firestore, memoriesRef.path, existingMemoryDoc.id), {
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(memoriesRef, {
        content,
        type,
        source: source || 'manual',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const deleteMemory = async (memoryId: string) => {
    if (!user || !firestore || !selectedBrand) throw new Error("Cannot delete memory: user or brand not available.");
    await deleteDoc(doc(firestore, `users/${user.uid}/brands/${selectedBrand.id}/memories`, memoryId));
  };


  const value = {
    brands: brands || [],
    selectedBrand,
    setSelectedBrand,
    addBrand,
    deleteBrand,
    deleteAllBrands,
    loading,
    memories: memories || [],
    addMemory,
    deleteMemory,
  };

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
