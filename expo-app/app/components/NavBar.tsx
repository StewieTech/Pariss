import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles';

export default function NavBar({ current, onNav }: { current: string; onNav: (s: any) => void }) {
  return (
    <View style={styles.navbar}>
  <TouchableOpacity testID="nav-main" onPress={() => onNav('main')}><Text testID="nav-main" style={styles.navText}>Main</Text></TouchableOpacity>
  <TouchableOpacity testID="nav-pve" onPress={() => onNav('pve')}><Text testID="nav-pve" style={[styles.navText, current==='pve' && styles.navTextActive]}>Talk to Lola</Text></TouchableOpacity>
  <TouchableOpacity testID="nav-pvp" onPress={() => onNav('pvp')}><Text testID="nav-pvp" style={[styles.navText, current==='pvp' && styles.navTextActive]}>Talk to Friends</Text></TouchableOpacity>
    </View>
  );
}

// export default function NavBar({ active, onChange }:{active:string, onChange:(s:string)=>void}){
//   return (
//     <View style={styles.container}>
//       {['Home','PvE','PvP'].map(k=> (
//         <TouchableOpacity key={k} onPress={()=>onChange(k)} style={[styles.tab, active===k && styles.active]}>
//           <Text style={[styles.label, active===k && styles.labelActive]}>{k}</Text>
//         </TouchableOpacity>
//       ))}
//     </View>
//   );
// }


