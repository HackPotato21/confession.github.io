import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const SheetsSync = () => {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!spreadsheetId.trim()) {
      toast.error("Please enter a Spreadsheet ID");
      return;
    }

    setIsSyncing(true);
    console.log("Starting sync to Google Sheets:", spreadsheetId);

    try {
      const { data, error } = await supabase.functions.invoke('sync-to-sheets', {
        body: { spreadsheetId }
      });

      if (error) throw error;

      toast.success("Data synced successfully!", {
        description: `Synced ${data.stats.confessions} confessions, ${data.stats.users} users, ${data.stats.confessionLikes} confession likes, ${data.stats.comments} comments, and ${data.stats.commentLikes} comment likes.`
      });

      console.log("Sync completed:", data);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync data", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Sync to Google Sheets</CardTitle>
        <CardDescription>
          Enter your Google Spreadsheet ID to sync all database data. 
          Make sure the spreadsheet has these sheets: Confessions, Users, Confession Likes, Comments, Comment Likes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="spreadsheet-id" className="text-sm font-medium">
            Spreadsheet ID
          </label>
          <Input
            id="spreadsheet-id"
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            disabled={isSyncing}
          />
          <p className="text-xs text-muted-foreground">
            Find this in your Google Sheets URL after /d/
          </p>
        </div>
        <Button 
          onClick={handleSync} 
          disabled={isSyncing}
          className="w-full"
        >
          {isSyncing ? "Syncing..." : "Sync to Sheets"}
        </Button>
      </CardContent>
    </Card>
  );
};
