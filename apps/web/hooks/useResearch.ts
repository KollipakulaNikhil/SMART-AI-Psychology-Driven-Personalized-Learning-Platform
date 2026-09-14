"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createResearch,
  deleteResearch,
  explainResearchSource,
  getResearch,
  listResearch,
} from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";
import type { ResearchProjectView, ResearchStatus } from "@/lib/types";

const ACTIVE: ReadonlySet<ResearchStatus> = new Set(["queued", "searching", "snapshotting", "ideating"]);

export function isResearchActive(status: ResearchStatus | undefined): boolean {
  return Boolean(status && ACTIVE.has(status));
}

export function useResearchProjects() {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ["research"],
    queryFn: listResearch,
    enabled: Boolean(firebaseUser),
    // Keep the list live while any brief is still being prepared.
    refetchInterval: (query) =>
      query.state.data?.some((project) => isResearchActive(project.status)) ? 4_000 : false,
  });
}

/** A single brief — polls every few seconds until the background pipeline settles. */
export function useResearchProject(id: string | null) {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ["research", id],
    queryFn: () => getResearch(id as string),
    enabled: Boolean(firebaseUser && id),
    refetchInterval: (query) => (isResearchActive(query.state.data?.status) ? 3_000 : false),
  });
}

export function useCreateResearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idea, title }: { idea: string; title?: string }) => createResearch(idea, title),
    onSuccess: (project) => {
      // Seed the detail cache so the progress screen renders instantly on navigation.
      queryClient.setQueryData(["research", project.id], project);
      queryClient.invalidateQueries({ queryKey: ["research"], exact: true });
    },
  });
}

export function useDeleteResearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteResearch(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ["research", id] });
      queryClient.invalidateQueries({ queryKey: ["research"], exact: true });
    },
  });
}

/** Explain one paper/patent in depth; the result is merged into the cached brief. */
export function useExplainSource(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, index }: { kind: "paper" | "patent"; index: number }) =>
      explainResearchSource(projectId, kind, index),
    onSuccess: ({ kind, index, deepDive }) => {
      queryClient.setQueryData<ResearchProjectView>(["research", projectId], (current) => {
        if (!current) return current;
        if (kind === "paper") {
          return { ...current, papers: current.papers.map((p) => (p.index === index ? { ...p, deepDive } : p)) };
        }
        return { ...current, patents: current.patents.map((t) => (t.index === index ? { ...t, deepDive } : t)) };
      });
    },
  });
}
