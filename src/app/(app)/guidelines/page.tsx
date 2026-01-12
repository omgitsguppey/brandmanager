
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { CheckCircle, XCircle } from 'lucide-react';
import { useBrand } from "@/context/brand-context";

const logoGoodUrl = "https://picsum.photos/seed/logos-good/300/200";
const logoBadUrl = "https://picsum.photos/seed/logos-bad/300/200";

export default function GuidelinesPage() {
  const { selectedBrand } = useBrand();

  if (!selectedBrand) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Please select a brand to view its guidelines.</p>
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="colors" className="space-y-4">
      <TabsList>
        <TabsTrigger value="colors">Color Palette</TabsTrigger>
        <TabsTrigger value="typography">Typography</TabsTrigger>
        <TabsTrigger value="logos">Logos</TabsTrigger>
        <TabsTrigger value="voice">Tone of Voice</TabsTrigger>
      </TabsList>

      <TabsContent value="colors" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Primary Colors</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <p className="text-muted-foreground">No color palette defined for {selectedBrand.name}.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="typography" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Fonts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-accent-foreground">Inter</h3>
              <p className="text-muted-foreground">Used for all headlines and body text.</p>
            </div>
            <div className="space-y-4">
                <h1 className="font-headline text-5xl font-bold">Headline 1</h1>
                <h2 className="font-headline text-4xl font-semibold">Headline 2</h2>
                <h3 className="font-headline text-3xl font-medium">Headline 3</h3>
                <p className="font-body text-base">This is the standard body text. The quick brown fox jumps over the lazy dog. Used for paragraphs and longer-form content to ensure readability and a clean, modern aesthetic across the application.</p>
                <p className="font-body text-sm text-muted-foreground">This is smaller text, often used for captions or less important information. The quick brown fox jumps over the lazy dog.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="logos" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Logo Usage</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-green-400"><CheckCircle size={20} /> Do</h3>
              <div className="p-4 rounded-lg bg-card-foreground/5 flex justify-center items-center">
                <Image src={logoGoodUrl} alt="Correct logo usage" width={300} height={200} className="object-contain" data-ai-hint="logo correct" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Use the primary logo on light or dark backgrounds that provide sufficient contrast.</li>
                <li>Maintain clear space around the logo.</li>
                <li>Use the provided asset files.</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-400"><XCircle size={20} /> Don't</h3>
              <div className="p-4 rounded-lg bg-card-foreground/5 flex justify-center items-center">
                 <Image src={logoBadUrl} alt="Incorrect logo usage" width={300} height={200} className="object-contain contrast-50 hue-rotate-90" data-ai-hint="logo incorrect" />
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Do not stretch, distort, or change the logo's color.</li>
                <li>Do not place on a cluttered or low-contrast background.</li>
                <li>Do not add other elements or text to the logo.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="voice">
        <Card>
          <CardHeader>
            <CardTitle>Tone of Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Our brand voice for {selectedBrand.name} is clear, confident, and professional, yet approachable and human. We aim to inspire trust and innovation.</p>
            <div className="grid md:grid-cols-3 gap-4">
                <div><h4 className="font-semibold text-foreground">Professional</h4><p>We are experts in our field and communicate with authority and precision.</p></div>
                <div><h4 className="font-semibold text-foreground">Innovative</h4><p>We look to the future, using forward-thinking language that excites and inspires.</p></div>
                <div><h4 className="font-semibold text-foreground">Approachable</h4><p>We are friendly and open, avoiding jargon to make our message accessible to everyone.</p></div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
