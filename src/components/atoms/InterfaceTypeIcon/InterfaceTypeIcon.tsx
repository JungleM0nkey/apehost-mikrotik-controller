import React from 'react';
import {
  Cable,
  Wifi,
  GitBranch,
  Network,
  Link2,
  Globe,
  Minus
} from 'lucide-react';

export interface InterfaceTypeIconProps {
  type: string;
  size?: number;
  className?: string;
}

export const InterfaceTypeIcon: React.FC<InterfaceTypeIconProps> = ({
  type,
  size = 16,
  className
}) => {
  // Normalize type to lowercase for matching
  const normalizedType = type.toLowerCase();

  // Icon mapping based on interface type
  const getIcon = () => {
    if (normalizedType.includes('ether')) {
      return <Cable size={size} className={className} />;
    }
    if (normalizedType.includes('wlan') || normalizedType.includes('wireless')) {
      return <Wifi size={size} className={className} />;
    }
    if (normalizedType.includes('bridge')) {
      return <GitBranch size={size} className={className} />;
    }
    if (normalizedType.includes('vlan')) {
      return <Network size={size} className={className} />;
    }
    if (normalizedType.includes('bond')) {
      return <Link2 size={size} className={className} />;
    }
    if (normalizedType.includes('pppoe')) {
      return <Globe size={size} className={className} />;
    }
    // Default icon for unknown types
    return <Minus size={size} className={className} />;
  };

  return getIcon();
};
