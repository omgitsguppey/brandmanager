
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, Query, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useUser, useFirestore, useCollection, useStorage } from '@/firebase';
import { useBrand } from '@/context/brand-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import { type Asset } from '@/lib/types';
import { ShieldCheck, UserCheck, Tag as TagIcon, Sparkles, Upload, AlertCircle, CheckCircle2, Heart, Info, SlidersHorizontal, Share, Trash2, Cloud, MapPin } from 'lucide-react';
import { runCheckImageSafety, runAutoTagImage, runBrandFaceAudit } from '@/ai/personaFlows';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AssetsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { selectedBrand } = useBrand();
  const { toast } = useToast();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [safetyStatus, setSafetyStatus] = useState<{ isSafe: boolean; reason?: string } | undefined>(undefined);
  const [isAnalyzingSafety, setIsAnalyzingSafety] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);

  const assetsQuery = useMemo(() => {
    if (!user || !firestore || !selectedBrand) return null;
    return query(
      collection(firestore, 'users', user.uid, 'assets'), 
      where('brandId', '==', selectedBrand.id)
    ) as Query<Asset>;
  }, [user, firestore, selectedBrand]);

  const { data: assets, loading: assetsLoading } = useCollection<Asset>(assetsQuery);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSafetyStatus(undefined);
      
      setIsAnalyzingSafety(true);
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const result = await runCheckImageSafety(base64, file.type);
        setSafetyStatus(result);
      } catch (err) {
        console.error('Safety check failed', err);
      } finally {
        setIsAnalyzingSafety(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !firestore || !storage || !selectedBrand) return;
    if (safetyStatus && !safetyStatus.isSafe) {
      toast({
        variant: "destructive",
        title: "Upload Blocked",
        description: "This image does not meet our safety guidelines.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/assets/${Date.now()}_${selectedFile.name}`);
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const url = await getDownloadURL(snapshot.ref);

      const image = new Image();
      image.src = url;
      await image.decode();

      await addDoc(collection(firestore, 'users', user.uid, 'assets'), {
        name: selectedFile.name,
        url,
        brandId: selectedBrand.id,
        createdAt: serverTimestamp(),
        contentType: selectedFile.type,
        size: selectedFile.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
        isFavorite: false,
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast({ title: "Asset uploaded successfully" });
    } catch (err) {
      console.error('Upload failed', err);
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  };
  
  if (userLoading || assetsLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  if (!selectedBrand) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 border rounded-lg shadow-sm bg-background">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Asset Manager</h2>
          <p className="text-muted-foreground mt-2">Please select a brand from the navigation bar to view and manage assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl">Asset Manager: {selectedBrand.name}</CardTitle>
            <CardDescription>Manage and analyze your brand assets.</CardDescription>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" /> Add New Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Asset</DialogTitle>
                <DialogDescription>
                  Upload an image to your asset library. We'll automatically check it for safety.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-file">Image File</Label>
                  <Input id="asset-file" type="file" accept="image/*" onChange={handleFileChange} />
                </div>
                
                {previewUrl && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                    <img src={previewUrl} className="object-contain w-full h-full" alt="Preview" />
                    <div className="absolute top-2 right-2">
                      {isAnalyzingSafety ? (
                        <Badge variant="secondary" className="animate-pulse">
                          <Sparkles className="mr-1 h-3 w-3" /> Analyzing...
                        </Badge>
                      ) : safetyStatus ? (
                        safetyStatus.isSafe ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Safe
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="mr-1 h-3 w-3" /> NSFW Detected
                          </Badge>
                        )
                      ) : null}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading || isAnalyzingSafety || !selectedFile || (safetyStatus && !safetyStatus.isSafe)}
                  className="w-full"
                >
                  {isUploading ? "Uploading..." : "Confirm Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets?.map((asset) => (
              <Card 
                key={asset.id} 
                className="group relative cursor-pointer overflow-hidden hover:shadow-md transition-all"
                onClick={() => setActiveAsset(asset)}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img src={asset.url} alt={asset.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                  {asset.isFavorite && <Heart className="absolute top-2 right-2 h-5 w-5 text-red-500 fill-red-500" />}
                </div>
                <div className="p-3 border-t">
                  <p className="text-xs truncate font-medium">{asset.name}</p>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <AssetDetailDialog
        asset={activeAsset}
        user={user}
        onClose={() => setActiveAsset(null)}
      />
    </div>
  );
}


// ASSET DETAIL DIALOG
type AssetDetailProps = {
  asset: Asset | null;
  user: any;
  onClose: () => void;
}

function AssetDetailDialog({ asset, user, onClose }: AssetDetailProps) {
  const [activePanel, setActivePanel] = useState<'info' | 'ai'>('info');
  const [showSharePlaceholder, setShowSharePlaceholder] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const handleToggleFavorite = async () => {
    if (!asset || !user) return;
    const assetRef = doc(firestore, 'users', user.uid, 'assets', asset.id);
    await updateDoc(assetRef, { isFavorite: !asset.isFavorite });
  };
  
  const handleDelete = async () => {
    if (!asset || !user || !storage) return;

    setIsDeleting(true);
    try {
        const assetRef = doc(firestore, 'users', user.uid, 'assets', asset.id);
        const fileRef = ref(storage, asset.url);

        await deleteObject(fileRef);
        await deleteDoc(assetRef);

        toast({ title: "Asset deleted" });
        onClose();
    } catch (error) {
        console.error("Error deleting asset:", error);
        toast({ variant: "destructive", title: "Failed to delete asset" });
    } finally {
        setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (asset) {
        setActivePanel('info');
    }
  }, [asset]);

  if (!asset) return null;

  return (
    <Dialog open={!!asset} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 !rounded-lg overflow-hidden">
        {/* Hidden accessible title/description */}
        <DialogTitle className="sr-only">Asset Details</DialogTitle>
        <DialogDescription className="sr-only">
          View and manage details for {asset?.name ? String(asset.name) : 'Asset'}
        </DialogDescription>

        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
          <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
        </div>
        <div className="bg-background text-foreground shrink-0">
          <div className="relative overflow-hidden">
            <div 
              className={cn("transition-transform duration-300 ease-in-out", {
                "-translate-x-full": activePanel === 'ai'
              })}
            >
              <div className="flex w-[200%]">
                <div className="w-1/2 shrink-0"><InfoPanel asset={asset} /></div>
                <div className="w-1/2 shrink-0"><AIPanel asset={asset} /></div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-t">
            <Button variant="ghost" size="icon" onClick={() => setShowSharePlaceholder(true)}>
              <Share />
            </Button>
            <div className="flex items-center gap-2 bg-muted p-1 rounded-full">
              <Button variant={activePanel === 'info' ? 'secondary' : 'ghost'} size="icon" className="rounded-full" onClick={() => setActivePanel('info')}>
                <Info />
              </Button>
               <Button variant={activePanel === 'ai' ? 'secondary' : 'ghost'} size="icon" className="rounded-full" onClick={() => setActivePanel('ai')}>
                <SlidersHorizontal />
              </Button>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleToggleFavorite}>
                    <Heart className={cn("transition-colors", asset.isFavorite && "text-red-500 fill-red-500")} />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the asset.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        </div>
      </DialogContent>

       <AlertDialog open={showSharePlaceholder} onOpenChange={setShowSharePlaceholder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sharing is not available yet</AlertDialogTitle>
            <AlertDialogDescription>
              This feature is coming soon!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSharePlaceholder(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function InfoPanel({ asset }: { asset: Asset }) {
  const megapixels = asset.width && asset.height ? ((asset.width * asset.height) / 1000000).toFixed(1) : null;

  return (
    <div className="p-4 space-y-4 max-h-[25vh] overflow-y-auto">
        <div className="text-sm">
            <p className="font-semibold">{asset.createdAt && typeof asset.createdAt.toDate === 'function' ? format(asset.createdAt.toDate(), 'eeee') : 'Date unavailable'}</p>
            <p className="text-muted-foreground">{asset.createdAt && typeof asset.createdAt.toDate === 'function' ? format(asset.createdAt.toDate(), 'MMM d, yyyy • h:mm a') : 'Time unavailable'}</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Cloud className="w-4 h-4" />
            <span>{asset.name}</span>
        </div>
        <div className="bg-muted p-3 rounded-lg text-sm">
            <div className="flex justify-between items-center">
                <span>No camera information</span>
                <span className="text-xs uppercase text-muted-foreground bg-background px-2 py-0.5 rounded">{asset.contentType?.split('/')[1] || 'file'}</span>
            </div>
            <p className="text-xs text-muted-foreground">No lens information</p>
            <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs text-muted-foreground">
                {megapixels && `${megapixels}MP • `}{asset.width && `${asset.width} x ${asset.height} • `}{(asset.size && (asset.size / 1024 / 1024).toFixed(2)) + ' MB'}
            </div>
        </div>
        <Button variant="secondary" className="w-full">
            <MapPin className="mr-2 h-4 w-4" />
            Add a location...
        </Button>
    </div>
  )
}


function AIPanel({ asset }: { asset: Asset }) {
  const [auditResult, setAuditResult] = useState<any>(undefined);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [autoTags, setAutoTags] = useState<string[]>([]);
  const { selectedBrand } = useBrand();
  
  const handleAudit = async (asset: Asset) => {
    if (!selectedBrand) return;
    setIsAuditing(true);
    try {
      const result = await runBrandFaceAudit(asset.url, selectedBrand.id);
      setAuditResult(result);
    } catch (err) {
      console.error('Audit failed', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleTagging = async (asset: Asset) => {
    setIsTagging(true);
    try {
      const result = await runAutoTagImage(asset.url);
      setAutoTags(result.tags);
    } catch (err) {
      console.error('Tagging failed', err);
    } finally {
      setIsTagging(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-h-[25vh] overflow-y-auto">
        <h2 className="text-lg font-bold">AI Intelligence Panel</h2>
        
        <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                <p className="text-sm font-medium">Safety Guard</p>
                <p className="text-[10px] text-muted-foreground uppercase">Verified SFW Content</p>
                </div>
            </div>
            <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-primary" />
                <div>
                <p className="text-sm font-medium">Face Sentiment Audit</p>
                <p className="text-[10px] text-muted-foreground uppercase">Persona Alignment</p>
                </div>
            </div>
            <Switch 
                disabled={isAuditing} 
                checked={!!auditResult} 
                onCheckedChange={() => handleAudit(asset)} 
            />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <TagIcon className="h-5 w-5 text-primary" />
                <div>
                <p className="text-sm font-medium">Auto-Tagging</p>
                <p className="text-[10px] text-muted-foreground uppercase">Keyword Discovery</p>
                </div>
            </div>
            <Switch 
                disabled={isTagging} 
                checked={autoTags.length > 0} 
                onCheckedChange={() => handleTagging(asset)} 
            />
            </div>
        </div>

        {autoTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
                {autoTags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
            </div>
        )}

        {auditResult && (
            <Card className="bg-muted/50 border-primary/20">
            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                <CardTitle className="text-xs uppercase tracking-widest text-primary">Audit Result</CardTitle>
                <Badge variant={auditResult.isAligned ? "default" : "destructive"}>
                    {auditResult.isAligned ? "Aligned" : "Not Aligned"}
                </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                {auditResult.reason}
                </p>
                {auditResult.metrics && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 rounded-md bg-background border">
                    <p className="text-[10px] uppercase text-muted-foreground">Sentiment</p>
                    <p className="text-xs font-bold">{auditResult.sentiment}</p>
                    </div>
                    <div className="p-2 rounded-md bg-background border">
                    <p className="text-[10px] uppercase text-muted-foreground">Joy Prob</p>
                    <p className="text-xs font-bold">{auditResult.metrics.joy}</p>
                    </div>
                </div>
                )}
            </CardContent>
            </Card>
        )}
    </div>
  );
}

    