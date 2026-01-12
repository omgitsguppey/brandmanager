
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ThumbsUp, ThumbsDown, Trash2, BrainCircuit } from 'lucide-react';
import { useBrand } from '@/context/brand-context';
import { trainPersonaFlow, generateCaptionFlow, recordFeedbackFlow } from '@/ai/personaFlows';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore as db } from '@/firebase/client';

const platforms = ['Instagram', 'TikTok', 'X (Twitter)', 'LinkedIn', 'Facebook'];

export default function PersonaManagerPage() {
  const { selectedBrand } = useBrand();
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    if (!selectedBrand) return;
    const unsub = onSnapshot(doc(db, 'brands', selectedBrand.id), (doc) => {
      const data = doc.data();
      setConfidence(data?.personaConfidence || 0);
    });
    return () => unsub();
  }, [selectedBrand]);

  if (!selectedBrand) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 border rounded-lg shadow-sm">
          <BrainCircuit className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Brand Persona Manager</h2>
          <p className="text-muted-foreground mt-2">Please select a brand from the navigation bar to begin training.</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <BrainCircuit className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-2xl">Persona Manager: {selectedBrand.name}</CardTitle>
            <CardDescription>Train the AI on your brand's unique voice and generate captions.</CardDescription>
          </div>
        </div>
        <div className="pt-4">
          <label className="text-sm font-medium text-muted-foreground">Training Confidence</label>
          <Progress value={confidence} className="w-full mt-1" />
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <TrainingZone brandId={selectedBrand.id} />
        <GeneratorZone brandId={selectedBrand.id} />
      </CardContent>
    </Card>
  );
}

function TrainingZone({ brandId }: { brandId: string }) {
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleTrain = async () => {
    if (!caption || selectedPlatforms.length === 0) return;
    setLoading(true);
    await trainPersonaFlow({ brandId, captionText: caption, platforms: selectedPlatforms });
    setCaption('');
    setLoading(false);
  };

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">1. Train The AI</h3>
      <p className="text-sm text-muted-foreground mb-4">Add high-quality captions to teach the AI your brand's voice.</p>
      <Textarea
        placeholder="e.g., Unboxing our new collection... ✨"
        value={caption}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCaption(e.target.value)}
        className="mb-4"
      />
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Select Platforms:</p>
        <div className="flex flex-wrap gap-2">
          {platforms.map(p => (
            <Button key={p} variant={selectedPlatforms.includes(p) ? 'default' : 'outline'} size="sm" onClick={() => {
              setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]);
            }}>{p}</Button>
          ))}
        </div>
      </div>
      <Button onClick={handleTrain} disabled={loading || !caption || selectedPlatforms.length === 0} className="w-full">
        {loading ? 'Training...' : 'Train AI'}
      </Button>
    </div>
  );
}

function GeneratorZone({ brandId }: { brandId: string }) {
  return (
    <div className="p-6 border rounded-lg">
       <h3 className="text-lg font-semibold">2. Generate Captions</h3>
      <p className="text-sm text-muted-foreground mb-4">Generate new captions based on the AI's training.</p>
      <GeneratorModal brandId={brandId} />
    </div>
  );
}

function GeneratorModal({ brandId }: { brandId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!prompt || selectedPlatforms.length === 0) return;
    setLoading(true);
    const { captions } = await generateCaptionFlow({ brandId, userPrompt: prompt, platforms: selectedPlatforms });
    setResults(captions.concat(results).slice(0, 5));
    setLoading(false);
  };

  const handleFeedback = async (caption: string, feedback: 'positive' | 'negative') => {
    await recordFeedbackFlow({ brandId, captionText: caption, platforms: selectedPlatforms, feedback });
  };

  const handleRemove = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">Open Caption Generator</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Caption Generator</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Topic for the caption, e.g., 'new summer sale'" value={prompt} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrompt(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {platforms.map(p => (
              <Button key={p} variant={selectedPlatforms.includes(p) ? 'default' : 'outline'} size="sm" onClick={() => {
                setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]);
              }}>{p}</Button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={loading || !prompt || selectedPlatforms.length === 0} className="w-full">
            {loading ? 'Generating...' : 'Generate Captions'}
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold">History</h4>
          {results.map((res, i) => (
            <div key={i} className="p-3 bg-muted rounded-lg flex justify-between items-center">
              <p className="flex-grow">{res}</p>
              <div className="flex gap-1 ml-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleFeedback(res, 'positive')}><ThumbsUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleFeedback(res, 'negative')}><ThumbsDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemove(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
