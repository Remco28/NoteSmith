"use client";

import { useState, useCallback } from "react";
import { Header, AutoUpdateStatus } from "@/components/header/Header";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";

export default function Home() {
  const [answerQuestions, setAnswerQuestions] = useState(false);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<AutoUpdateStatus>("manual");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const handleUpdateNow = useCallback(() => {
    setAutoUpdateStatus("updating");
    // Placeholder: actual update logic will be added in Tasks 10-11
    setTimeout(() => {
      setAutoUpdateStatus(autoUpdateStatus === "on" ? "on" : "manual");
      setLastUpdated(Date.now());
    }, 1500);
  }, [autoUpdateStatus]);

  const handleAutoUpdateToggle = useCallback(() => {
    setAutoUpdateStatus((prev) => (prev === "on" ? "manual" : "on"));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        answerQuestions={answerQuestions}
        onAnswerQuestionsChange={setAnswerQuestions}
        autoUpdateStatus={autoUpdateStatus}
        lastUpdated={lastUpdated}
        onUpdateNow={handleUpdateNow}
        onAutoUpdateToggle={handleAutoUpdateToggle}
      />
      <WorkspaceLayout />
    </main>
  );
}