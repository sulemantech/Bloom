import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Your rights": everything stored about a child, as a JSON download (parent or admin only;
// export_student_data() checks the caller in the database).
export async function GET(_request: NextRequest, { params }: RouteContext<"/parent/children/[id]/export">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_student_data", { p_student: id });
  if (error || !data) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="youth-idealab-data-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
