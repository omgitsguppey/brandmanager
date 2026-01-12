
'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, Query, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUser, useFirestore, useCollection, useStorage } from '@/firebase';
import { useBrand } from '@/context/brand-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { type Asset } from '@/lib/types';
import { ShieldCheck, UserCheck, Tag as TagIcon, Sparkles, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { runCheckImageSafety, runAutoTagImage, runBrandFaceAudit } from '@/app/actions/ai';
import { useToast } from '@/hooks/use-toast';

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

  // Asset Detail State
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [auditResult, setAuditResult] = useState<any>(undefined);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [autoTags, setAutoTags] = useState<string[]>([]);

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
      
      // Perform Pre-upload Safety Check
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

      await addDoc(collection(firestore, 'users', user.uid, 'assets'), {
        name: selectedFile.name,
        url,
        brandId: selectedBrand.id,
        createdAt: serverTimestamp(),
        contentType: selectedFile.type,
        size: selectedFile.size,
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

  if (userLoading || assetsLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="p-6 space-y-6 bg-black min-h-screen text-[#E6E6FA]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Asset Manager</h1>
          <p className="text-[#E6E6FA]/60">Manage and analyze your brand assets.</p>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#E6E6FA] text-black hover:bg-[#D8BFD8]">
              <Upload className="mr-2 h-4 w-4" /> Add New Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-[#E6E6FA]/10 text-[#E6E6FA]">
            <DialogHeader>
              <DialogTitle>Upload Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="asset-file">Image File</Label>
                <Input id="asset-file" type="file" accept="image/*" onChange={handleFileChange} className="bg-[#0a0a0a] border-[#E6E6FA]/10" />
              </div>
              
              {previewUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-[#E6E6FA]/10 bg-[#0a0a0a]">
                  <img src={previewUrl} className="object-contain w-full h-full" alt="Preview" />
                  <div className="absolute top-2 right-2">
                    {isAnalyzingSafety ? (
                      <Badge variant="secondary" className="animate-pulse bg-black/60 text-[#E6E6FA]">
                        <Sparkles className="mr-1 h-3 w-3" /> Analyzing...
                      </Badge>
                    ) : safetyStatus ? (
                      safetyStatus.isSafe ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/20">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Safe
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/20">
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
                className="w-full bg-[#E6E6FA] text-black hover:bg-[#D8BFD8]"
              >
                {isUploading ? "Uploading..." : "Confirm Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {assets?.map((asset) => (
          <Card 
            key={asset.id} 
            className="group relative cursor-pointer bg-[#0a0a0a] border-[#E6E6FA]/10 overflow-hidden hover:border-[#E6E6FA]/30 transition-all"
            onClick={() => {
              setActiveAsset(asset);
              setAuditResult(undefined);
              setAutoTags([]);
            }}
          >
            <div className="aspect-square overflow-hidden bg-muted">
              <img src={asset.url} alt={asset.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
            </div>
            <div className="p-3">
              <p className="text-xs truncate font-medium text-[#E6E6FA]/80">{asset.name}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Asset Detail Dialog */}
      <Dialog open={!!activeAsset} onOpenChange={() => setActiveAsset(null)}>
        <DialogContent className="max-w-4xl bg-black border-[#E6E6FA]/20 text-[#E6E6FA]">
          {activeAsset && (
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#0a0a0a] border border-[#E6E6FA]/10 relative">
                  <img src={activeAsset.url} className="object-contain w-full h-full" alt={activeAsset.name} />
                  
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    {autoTags.map(tag => (
                      <Badge key={tag} className="bg-black/60 text-[#E6E6FA] border-[#E6E6FA]/20">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8 p-2">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{activeAsset.name}</h2>
                  <p className="text-xs text-[#E6E6FA]/40 uppercase tracking-widest font-bold">AI Intelligence Panel</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-[#E6E6FA]/5 group-hover:bg-[#E6E6FA]/10 transition-colors">
                        <ShieldCheck className="h-5 w-5 text-[#D8BFD8]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Safety Guard</p>
                        <p className="text-[10px] text-[#E6E6FA]/40 uppercase">Pre-Upload Verified</p>
                      </div>
                    </div>
                    <Switch checked={true} disabled className="data-[state=checked]:bg-green-500/40" />
                  </div>

                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-[#E6E6FA]/5 group-hover:bg-[#E6E6FA]/10 transition-colors">
                        <UserCheck className="h-5 w-5 text-[#D8BFD8]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Face Sentiment Audit</p>
                        <p className="text-[10px] text-[#E6E6FA]/40 uppercase">Persona Alignment</p>
                      </div>
                    </div>
                    <Switch 
                      disabled={isAuditing} 
                      checked={!!auditResult} 
                      onCheckedChange={() => handleAudit(activeAsset)} 
                    />
                  </div>

                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-[#E6E6FA]/5 group-hover:bg-[#E6E6FA]/10 transition-colors">
                        <TagIcon className="h-5 w-5 text-[#D8BFD8]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Auto-Tagging</p>
                        <p className="text-[10px] text-[#E6E6FA]/40 uppercase">Keyword Discovery</p>
                      </div>
                    </div>
                    <Switch 
                      disabled={isTagging} 
                      checked={autoTags.length > 0} 
                      onCheckedChange={() => handleTagging(activeAsset)} 
                    />
                  </div>
                </div>

                {auditResult && (
                  <div className="p-4 rounded-2xl bg-[#E6E6FA]/5 border border-[#E6E6FA]/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#D8BFD8]">Audit Result</span>
                      <Badge variant={auditResult.isAligned ? "outline" : "destructive"}>
                        {auditResult.isAligned ? "Aligned" : "Not Aligned"}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-[#E6E6FA]/80">
                      {auditResult.reason}
                    </p>
                    {auditResult.metrics && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="p-2 rounded-lg bg-black/40 border border-[#E6E6FA]/5">
                          <p className="text-[10px] uppercase text-[#E6E6FA]/40">Sentiment</p>
                          <p className="text-xs font-bold">{auditResult.sentiment}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-black/40 border border-[#E6E6FA]/5">
                          <p className="text-[10px] uppercase text-[#E6E6FA]/40">Joy Prob</p>
                          <p className="text-xs font-bold">{auditResult.metrics.joy}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
