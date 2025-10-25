import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles';

export default function ChatBubble({ author, text }:{author:string,text:string}){
  const isUser = author === 'user' || author === 'me';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text>{text}</Text>
    </View>
  );
}
