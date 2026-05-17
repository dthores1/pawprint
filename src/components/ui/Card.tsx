import React from 'react';
import { cn } from '../../lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';
interface CardProps extends HTMLMotionProps<'div'> {
  hoverLift?: boolean;
}
export function Card({
  className,
  hoverLift = false,
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      className={cn(
        'bg-card rounded-2xl border border-border shadow-soft overflow-hidden',
        className
      )}
      whileHover={
      hoverLift ?
      {
        y: -2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
      } :
      undefined
      }
      transition={{
        duration: 0.2,
        ease: 'easeOut'
      }}
      {...props}>
      
      {children}
    </motion.div>);

}