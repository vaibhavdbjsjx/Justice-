import { getViewer } from "@/lib/auth/session";
import { buildDocx, buildPdf, exportFilename } from "@/lib/documents/export";

/**
 * Export a generated document as PDF or DOCX (Part 4.1). Takes the content in
 * the request (works identically for persisted and preview drafts); every
 * export carries the draft notice + lawyer review/signature block.
 */

const MAX_BODY_CHARS = 120_000;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) return jsonError("Please sign in to export documents.", 401);

  let body: { title?: unknown; body_markdown?: unknown; format?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("That request couldn't be read. Please try again.", 400);
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Document";
  const markdown =
    typeof body.body_markdown === "string" ? body.body_markdown : "";
  const format = body.format === "docx" ? "docx" : body.format === "pdf" ? "pdf" : null;

  if (!markdown.trim() || markdown.length > MAX_BODY_CHARS || !format) {
    return jsonError("That document couldn't be exported. Please try again.", 400);
  }

  try {
    const bytes =
      format === "pdf"
        ? await buildPdf(title, markdown)
        : await buildDocx(title, markdown);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${exportFilename(title, format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export] failed:", err);
    return jsonError("That document couldn't be exported. Please try again.", 500);
  }
}
