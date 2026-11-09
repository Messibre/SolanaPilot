import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { unlinkIdentity, prismaAccountLinkDb } from "@/lib/accounts";

const unlinkSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  providerAccountId: z.string().min(1, "Provider account ID is required"),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = unlinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { provider, providerAccountId } = parsed.data;

  const result = await unlinkIdentity(prismaAccountLinkDb, {
    userId,
    provider,
    providerAccountId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
