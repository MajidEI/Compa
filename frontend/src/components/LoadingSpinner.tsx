interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

/**
 * Loading Spinner Component
 * 
 * Displays a spinning indicator with an optional message.
 * Used during API calls and data processing.
 */
function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };
  
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-gray-200 border-t-sf-blue-500 
                    rounded-full animate-spin`}
      />
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}

export default LoadingSpinner;
