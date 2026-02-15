import { useState, forwardRef, useEffect } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  priority?: boolean;
  placeholder?: string;
}

/**
 * Performance-optimized image component with lazy loading, fade-in effect, and async decoding
 * @param src - Image source URL
 * @param alt - Alt text for accessibility
 * @param priority - If true, loads image immediately (for above-fold images)
 * @param placeholder - Optional placeholder color while loading
 */
export const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ src, alt, priority = false, placeholder = '#f3f4f6', className, style, ...props }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setIsLoaded(false);
      setHasError(false);
    }, [src]);

    if (hasError) {
      return (
        <div
          className={`flex items-center justify-center bg-gray-200 ${className || ''}`}
          style={style}
          role="img"
          aria-label={alt}
        >
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={className}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          backgroundColor: !isLoaded ? placeholder : undefined,
          ...style,
        }}
        {...props}
      />
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';
