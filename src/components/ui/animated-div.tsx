'use client';

import React from 'react';
import { motion, Variants, Transition } from 'framer-motion';

interface AnimatedDivProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const AnimatedDiv: React.FC<AnimatedDivProps> = ({
  children,
  className = '',
  delay = 0,
  duration = 0.3,
  direction = 'up'
}) => {
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: 20 };
      case 'down': return { y: -20 };
      case 'left': return { x: 20 };
      case 'right': return { x: -20 };
      default: return { y: 20 };
    }
  };

  const transition: Transition = {
    delay,
    duration,
    type: "spring",
    stiffness: 220,
    damping: 26,
  };

  const exitTransition: Transition = {
    duration,
  };

  const variants: Variants = {
    hidden: { opacity: 0, scale: 0.98, ...getInitialPosition() },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition,
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: exitTransition,
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export { AnimatedDiv };