
'use client';
import { useState } from 'react';
import { ai } from '@/firebase';
import { getGenerativeModel } from 'firebase/ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function TestAIPage() {
  const [prompt, setPrompt] = useState('Write a story about a magic backpack.');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      setResponse(result.response.text());
    } catch (error: any) {
      console.error(error);
      setResponse('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Test Firebase AI (Client SDK)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt"
            className="min-h-[100px]"
          />
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? 'Generating...' : 'Generate'}
          </Button>
          {response && (
            <div className="mt-4 p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">
              {response}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
