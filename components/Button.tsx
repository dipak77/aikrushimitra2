import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "rounded-xl font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-green-600 text-white shadow-lg shadow-green-200 hover:bg-green-700",
    secondary: "bg-yellow-500 text-white shadow-lg shadow-yellow-200 hover:bg-yellow-600",
    outline: "border-2 border-green-600 text-green-700 bg-transparent hover:bg-green-50",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  const width = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${width} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};