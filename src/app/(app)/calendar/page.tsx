
'use client';

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBrand } from "@/context/brand-context";

export default function CalendarPage() {
  const { selectedBrand } = useBrand();

  if (!selectedBrand) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Please select a brand to view its content calendar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={new Date()}
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Upcoming Posts for {selectedBrand.name}</h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No upcoming posts.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
