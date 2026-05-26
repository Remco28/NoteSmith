"use client";

export function TranscriptUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="max-w-xs">
        <div className="text-3xl mb-3">📝</div>
        <h3 className="text-base font-medium text-gray-700 mb-2">
          No transcript available
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          NoteSmith supports captioned YouTube videos only. The video you&apos;re watching doesn&apos;t have captions enabled, so transcript-assisted note-taking isn&apos;t available.
        </p>
      </div>
    </div>
  );
}
