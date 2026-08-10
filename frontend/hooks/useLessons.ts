"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getLesson,
  getLessonLanguages,
  listLessons,
  listRecentTopics,
} from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";

export function useLessons(limit = 20, page = 1) {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["lessons", limit, page],
    queryFn: () => listLessons(limit, page),
    enabled: Boolean(firebaseUser),
  });
}

/** The server's narratable languages. Effectively static, so cache it hard. */
export function useLessonLanguages() {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["lesson-languages"],
    queryFn: getLessonLanguages,
    enabled: Boolean(firebaseUser),
    staleTime: Infinity,
  });
}

export function useRecentTopics() {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["recent-topics"],
    queryFn: listRecentTopics,
    enabled: Boolean(firebaseUser),
  });
}

export function useLesson(id: string | null) {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["lesson", id],
    queryFn: () => getLesson(id as string),
    enabled: Boolean(firebaseUser && id),
  });
}
