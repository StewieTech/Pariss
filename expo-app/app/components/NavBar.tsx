import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function NavBar({ active, onChange }:{active:string, onChange:(s:string)=>void}){
  return (
    <View style={styles.container}>
      {['Home','PvE','PvP'].map(k=> (
        <TouchableOpacity key={k} onPress={()=>onChange(k)} style={[styles.tab, active===k && styles.active]}>
          <Text style={[styles.label, active===k && styles.labelActive]}>{k}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flexDirection:'row', justifyContent:'space-around', padding:8, backgroundColor:'#fff'},
  tab:{ padding:8, borderRadius:6 },
  active:{ backgroundColor:'#fde68a' },
  label:{ fontSize:16, color:'#333' },
  labelActive:{ fontWeight:'700' }
});
