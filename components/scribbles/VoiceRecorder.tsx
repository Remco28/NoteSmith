"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface VoiceRecorderProps {
  videoId: string;
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

// Check for SpeechRecognition support
const speechRecognitionSupported =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function VoiceRecorder({
  videoId,
  onTranscript,
  disabled = false,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported] = useState(() => speechRecognitionSupported);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef<string>("");

  // Initialize SpeechRecognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      // When recognition ends, submit the final transcript
      const final = finalTranscriptRef.current.trim();
      if (final) {
        onTranscript(final);
      }
      finalTranscriptRef.current = "";
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, onTranscript]);

  const startRecording = useCallback(() => {
    if (disabled || !isSupported || !recognitionRef.current) return;

    // Pause the YouTube player
    if (videoId) {
      import("@/components/player/YouTubePlayer").then(({ pauseYouTubePlayer }) => {
        pauseYouTubePlayer(videoId);
      });
    }

    finalTranscriptRef.current = "";
    try {
      recognitionRef.current?.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
    }
  }, [disabled, isSupported, videoId]);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.error("Failed to stop speech recognition:", err);
    }
    // Note: onend handler will fire and submit the transcript
  }, []);

  // Graceful disabled state
  if (!isSupported) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-400 rounded-md cursor-not-allowed"
        title="Voice input is not supported in this browser"
      >
        <MicOffIcon />
        <span>Voice</span>
      </button>
    );
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
        isRecording
          ? "bg-red-500 hover:bg-red-600 text-white"
          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
      } disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
      title={isRecording ? "Stop recording" : "Start voice recording"}
    >
      {isRecording ? <RecordingIcon /> : <MicIcon />}
      <span>{isRecording ? "Stop" : "Voice"}</span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}