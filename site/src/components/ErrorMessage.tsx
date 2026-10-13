interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="p-4 border border-red-200 rounded bg-red-50 text-red-700 flex items-center gap-3">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm underline hover:no-underline shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}
