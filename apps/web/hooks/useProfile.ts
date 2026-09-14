"use client";

import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/services/lessons.service";
import { useAuth } from "@/context/AuthContext";

export function useProfile() {
  const { firebaseUser } = useAuth();

  return useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: Boolean(firebaseUser),
  });
}
