import React from 'react'

export const Skeleton = ({ className = '', ...props }) => (
  <div className={`animate-pulse bg-muted rounded-md ${className}`} {...props} />
)

export const SkeletonRow = ({ className = '', ...props }) => (
  <Skeleton className={`h-4 w-full ${className}`} {...props} />
)

export const SkeletonCard = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-card border border-border rounded-2xl p-6 ${className}`}
    {...props}
  >
    <Skeleton className="h-5 w-2/3 mb-4" />
    <SkeletonRow className="mb-2" />
    <SkeletonRow className="w-4/5" />
  </div>
)
