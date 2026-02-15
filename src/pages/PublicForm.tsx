import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield } from "lucide-react";
import DataEntryForm from "@/components/DataEntryForm";

export default function PublicForm() {
  const { token } = useParams<{ token: string }>();
  const [linkData, setLinkData] = useState<{ group_id: string; user_id: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!token) { setInvalid(true); return; }
      const { data } = await supabase
        .from("shared_links")
        .select("group_id, user_id, is_active")
        .eq("token", token)
        .single();

      if (!data || !data.is_active) {
        setInvalid(true);
      } else {
        setLinkData({ group_id: data.group_id, user_id: data.user_id });
      }
    };
    validate();
  }, [token]);

  if (invalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <p className="text-destructive font-medium">Link tidak valid atau sudah dinonaktifkan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
            <p className="text-lg font-medium">Terima kasih!</p>
            <p className="text-muted-foreground">Data Anda telah berhasil dikirim.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <Shield className="mx-auto mb-2 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">Input Data Halal</h1>
          <p className="text-sm text-muted-foreground">Silakan isi form di bawah ini</p>
        </div>
        <DataEntryForm
          groupId={linkData.group_id}
          isPublic
          sharedLinkUserId={linkData.user_id}
          onCancel={() => {}}
          onSaved={() => setSubmitted(true)}
        />
      </div>
    </div>
  );
}
