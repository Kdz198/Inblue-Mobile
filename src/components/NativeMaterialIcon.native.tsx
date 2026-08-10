import type React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function NativeMaterialIcon({
  name,
  size,
  color,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size: number;
  color: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
