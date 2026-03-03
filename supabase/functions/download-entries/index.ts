import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user via getUser
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = user.id;
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (!callerRole || !["super_admin", "admin", "admin_input"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { entry_ids } = await req.json();
    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return new Response(JSON.stringify({ error: "entry_ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("data_entries")
      .select("*")
      .in("id", entry_ids);

    if (entriesError || !entries) {
      return new Response(JSON.stringify({ error: entriesError?.message || "Entries not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zip = new JSZip();

    for (const entry of entries) {
      const folderName = (entry.nama || `entry-${entry.id.slice(0, 8)}`).replace(/[/\\?%*:|"<>]/g, "_");
      const folder = zip.folder(folderName)!;

      const info = [
        `Nama: ${entry.nama || "-"}`,
        `Alamat: ${entry.alamat || "-"}`,
        `Nomor HP: ${entry.nomor_hp || "-"}`,
        `Tanggal dibuat: ${entry.created_at}`,
      ].join("\n");
      folder.file("info.txt", info);

      const addFile = async (url: string | null, filename: string) => {
        if (!url) return;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const urlPath = new URL(url).pathname;
            const ext = urlPath.split(".").pop() || "bin";
            folder.file(`${filename}.${ext}`, buffer);
          }
        } catch (e) {
          console.error(`Failed to download ${url}:`, e);
        }
      };

      // Fetch entry_photos for this entry
      const { data: entryPhotos } = await supabaseAdmin
        .from("entry_photos")
        .select("*")
        .eq("entry_id", entry.id);

      const produkPhotos = (entryPhotos ?? []).filter((p: any) => p.photo_type === "produk");
      const verifikasiPhotos = (entryPhotos ?? []).filter((p: any) => p.photo_type === "verifikasi");

      const downloadPromises = [
        addFile(entry.ktp_url, "ktp"),
        addFile(entry.nib_url, "nib"),
        addFile(entry.sertifikat_url, "sertifikat"),
      ];

      produkPhotos.forEach((p: any, i: number) => {
        downloadPromises.push(addFile(p.url, `foto_produk_${i + 1}`));
      });
      verifikasiPhotos.forEach((p: any, i: number) => {
        downloadPromises.push(addFile(p.url, `foto_verifikasi_${i + 1}`));
      });

      // Fallback: if no entry_photos but legacy URL exists
      if (produkPhotos.length === 0 && entry.foto_produk_url) {
        downloadPromises.push(addFile(entry.foto_produk_url, "foto_produk_1"));
      }
      if (verifikasiPhotos.length === 0 && entry.foto_verifikasi_url) {
        downloadPromises.push(addFile(entry.foto_verifikasi_url, "foto_verifikasi_1"));
      }

      await Promise.all(downloadPromises);
    }

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    const filename = entries.length === 1
      ? `${(entries[0].nama || "data").replace(/[/\\?%*:|"<>]/g, "_")}.zip`
      : `data-halal-${entries.length}-entries.zip`;

    return new Response(zipBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
