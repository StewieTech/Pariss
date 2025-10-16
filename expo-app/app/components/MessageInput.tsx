import React from 'react';
import { View, TextInput, Button } from 'react-native';
import styles from '../styles';

export default function MessageInput({ value, onChange, onSend, placeholder }:{value:string,onChange:(s:string)=>void,onSend:()=>void,placeholder?:string}){
  return (
    <View style={styles.inputRow}>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder||'Type...'} />
      <Button title="Send" onPress={onSend} />
    </View>
  );
}
