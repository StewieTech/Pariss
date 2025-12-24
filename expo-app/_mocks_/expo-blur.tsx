import React from 'react';
import { View } from 'react-native';

export const BlurView: React.FC<any> = ({ children, style }) => {
  return <View style={style}>{children}</View>;
};

export default { BlurView };
