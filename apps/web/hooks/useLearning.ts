"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCourse,
  createCourseFromPdf,
  getCourse,
  getDueReviews,
  listCourses,
  submitQuizAttempt,
} from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";
import type { LessonLanguage } from "@/lib/types";

export function useCourses() {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: Boolean(firebaseUser),
  });
}

export function useCourse(id: string | null) {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => getCourse(id as string),
    enabled: Boolean(firebaseUser && id),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goal, language }: { goal: string; language: LessonLanguage }) =>
      createCourse(goal, language),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });
}

export function useCreateCourseFromPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, language }: { file: File; language: LessonLanguage }) =>
      createCourseFromPdf(file, language),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });
}

export function useDueReviews() {
  const { firebaseUser } = useAuth();
  return useQuery({
    queryKey: ["due-reviews"],
    queryFn: getDueReviews,
    enabled: Boolean(firebaseUser),
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presentationId, answers }: { presentationId: string; answers: number[] }) =>
      submitQuizAttempt(presentationId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["due-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}
