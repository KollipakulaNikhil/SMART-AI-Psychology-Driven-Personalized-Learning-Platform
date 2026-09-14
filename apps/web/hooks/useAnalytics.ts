"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";

export function useAnalytics() {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
    enabled: Boolean(firebaseUser),
  });
}
