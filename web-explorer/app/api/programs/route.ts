import { NextResponse } from "next/server";
import { fetchRegistryEntries } from "@/lib/solana";
import {
  parseProgramsQuery,
  filterPrograms,
  serverRegistryCache,
  type ProgramRecord,
} from "@/lib/registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawParams: Record<string, string | undefined> = {
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    authority: url.searchParams.get("authority") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  };

  const parseResult = parseProgramsQuery(rawParams);
  if (!parseResult.ok) {
    return NextResponse.json(
      { error: parseResult.error },
      { status: 400 }
    );
  }

  const { pageSize, offset, authority, search } = parseResult.data;

  try {
    let allPrograms = serverRegistryCache.get("all_programs");

    if (!allPrograms) {
      const fetched = await fetchRegistryEntries();
      allPrograms = fetched.map(
        (p): ProgramRecord => ({
          programId: p.programId,
          authority: p.creator,
          name: p.programName,
          description: p.description,
          version: p.version,
          createdAt: new Date(p.registeredAt).getTime() || 0,
          updatedAt: new Date(p.lastDeployed).getTime() || 0,
        })
      );

      serverRegistryCache.set("all_programs", allPrograms);
    }

    const filtered = filterPrograms(allPrograms, { authority, search });
    const paginated = filtered.slice(offset, offset + pageSize);

    return NextResponse.json(
      {
        programs: paginated,
        total: filtered.length,
        offset,
        pageSize,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch programs from registry." },
      { status: 500 }
    );
  }
}
