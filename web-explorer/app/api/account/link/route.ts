import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { linkIdentity, prismaAccountLinkDb } from "@/lib/accounts";
import { verifySiwsMessage, defaultNonceStore } from "@/lib/siws";

const linkSolanaSchema = z.object({
  provider: z.literal("solana"),
  message: z.string().min(1, "SIWS message is required"),
  signature: z.string().min(1, "Signature is required"),
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

  const parsed = linkSolanaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { message, signature } = parsed.data;

  // Re-prove ownership: verify SIWS signature and domain
  const host = request.headers.get("host") ?? "localhost:3000";
  const origin = request.headers.get("origin") ?? `http://${host}`;

  const verifyResult = await verifySiwsMessage({
    message,
    signature,
    expectedDomain: host,
    expectedUri: origin,
    nonceStore: defaultNonceStore,
  });

  if (!verifyResult.ok) {
    return NextResponse.json(
      { error: `Proof of ownership failed: ${verifyResult.error}` },
      { status: 400 }
    );
  }

  const result = await linkIdentity(prismaAccountLinkDb, {
    userId,
    provider: "solana",
    providerAccountId: verifyResult.data.address,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, address: verifyResult.data.address });
}
