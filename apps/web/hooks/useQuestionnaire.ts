"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getQuestions, submitQuestionnaire } from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";
import type { QuestionnaireAnswer } from "@/lib/types";

export function useQuestions() {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["questions"],
    queryFn: getQuestions,
    enabled: Boolean(firebaseUser),
    staleTime: Infinity,
  });
}

export function useSubmitQuestionnaire() {
  const queryClient = useQueryClient();
  const { markProfileComplete } = useAuth();

  return useMutation({
    mutationFn: (answers: QuestionnaireAnswer[]) => submitQuestionnaire(answers),
    onSuccess: (profile) => {
      queryClient.setQueryData(["profile"], profile);
      markProfileComplete();
    },
  });
}
