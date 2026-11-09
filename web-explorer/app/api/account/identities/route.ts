import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserIdentities, prismaAccountLinkDb } from "@/lib/accounts";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const identities = await getUserIdentities(prismaAccountLinkDb, userId);
    return NextResponse.json({
      identities: identities.map((i) => ({
        id: i.id,
        provider: i.provider,
        providerAccountId: i.providerAccountId,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve account identities." },
      { status: 500 }
    );
  }
}
