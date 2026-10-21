import Icon from './Icon'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
      <Icon name="alert" size={16} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm shrink-0">
          Try again
        </button>
      )}
    </div>
  )
}
