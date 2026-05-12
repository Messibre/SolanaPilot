"use client";

import {
  useState,
  useDeferredValue,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { StatsBar } from "./stats-bar";
import { SearchControls, type SortOption } from "./search-controls";
import { ProgramCard } from "./program-card";
import { SkeletonGrid, SkeletonStats } from "./skeleton-cards";
import { EmptyNoPrograms, EmptyNoResults } from "./empty-states";
import { MOCK_PROGRAMS, getRegistryStats, type Program } from "@/lib/mock-data";
import { fetchRegistryEntries } from "@/lib/solana";

type DataSource = "mock" | "live" | "loading";

export function RegistryExplorer() {
  const [programs, setPrograms] = useState<Program[]>(MOCK_PROGRAMS);
  const [dataSource, setDataSource] = useState<DataSource>("mock");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("recent");

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadPrograms = useCallback(async () => {
    setDataSource("loading");

    try {
      const entries = await fetchRegistryEntries();

      if (entries.length > 0) {
        setPrograms(entries);
        setDataSource("live");
        return;
      }

      setPrograms(MOCK_PROGRAMS);
      setDataSource("mock");
    } catch (err) {
      setPrograms(MOCK_PROGRAMS);
      setDataSource("mock");
    }
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  const filteredPrograms = useMemo(() => {
    let result = [...programs];

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase().trim();
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.filter(
        (p) =>
          p.programName.toLowerCase().includes(safeQuery) ||
          p.description.toLowerCase().includes(safeQuery) ||
          p.programId.toLowerCase().includes(safeQuery) ||
          p.creator.toLowerCase().includes(safeQuery),
      );
    }

    switch (sortOption) {
      case "recent":
        result.sort(
          (a, b) =>
            new Date(b.registeredAt).getTime() -
            new Date(a.registeredAt).getTime(),
        );
        break;
      case "deployments":
        result.sort((a, b) => b.deploymentCount - a.deploymentCount);
        break;
      case "name":
        result.sort((a, b) => a.programName.localeCompare(b.programName));
        break;
    }

    return result;
  }, [programs, deferredSearchQuery, sortOption]);

  const stats = useMemo(() => getRegistryStats(programs), [programs]);

  const isSearchPending = searchQuery !== deferredSearchQuery;

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const isLoading = dataSource === "loading";
  const isLive = dataSource === "live";
  const hasPrograms = programs.length > 0;

  const sourcePillClasses = isLive
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  const sourceDotClasses = isLive ? "bg-emerald-400" : "bg-amber-300";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground text-balance">
            Registry explorer
          </h1>
          {!isLoading && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:text-xs font-medium ${sourcePillClasses}`}
              aria-label={isLive ? "Devnet live data" : "Mock demo data"}
            >
              <span
                className={`size-1.5 rounded-full ${sourceDotClasses}`}
                aria-hidden="true"
              />
              {isLive ? "Devnet Live" : "Demo Data"}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Browse programs registered from the VS Code extension on Solana
          devnet.
        </p>
      </div>

      {/* Stats Bar */}
      {isLoading ? (
        <SkeletonStats />
      ) : (
        <StatsBar
          totalPrograms={stats.totalPrograms}
          totalDeployments={stats.totalDeployments}
          totalInstructions={stats.totalInstructions}
        />
      )}

      {/* Empty State (no programs at all) */}
      {!isLoading && !hasPrograms && <EmptyNoPrograms />}

      {/* Data state - Show search and programs */}
      {!isLoading && hasPrograms && (
        <>
          {/* Search Controls */}
          <SearchControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOption={sortOption}
            onSortChange={setSortOption}
            resultCount={filteredPrograms.length}
          />

          {/* Programs Grid */}
          {filteredPrograms.length > 0 ? (
            <div
              className={`grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 transition-opacity duration-200 ${isSearchPending ? "opacity-60" : "opacity-100"}`}
              role="feed"
              aria-label="Program list"
              aria-busy={isSearchPending}
            >
              {filteredPrograms.map((program) => (
                <ProgramCard key={program.programId} program={program} />
              ))}
            </div>
          ) : (
            <EmptyNoResults onClearSearch={handleClearSearch} />
          )}
        </>
      )}

      {/* Loading State */}
      {isLoading && (
        <>
          <div className="space-y-2">
            <div className="h-9 sm:h-11 w-full rounded-md animate-shimmer" />
            <div className="h-4 w-16 rounded animate-shimmer" />
          </div>
          <SkeletonGrid />
        </>
      )}
    </div>
  );
}
