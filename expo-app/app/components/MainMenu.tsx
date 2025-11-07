import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../styles';

export default function MainMenu({ onChoose }: { onChoose: (s: any) => void }) {
  return (
    <View style={styles.mainMenu}>
      <Text style={styles.title}>LolaInParis</Text>
      <Text style={styles.subtitle}>Pick a mode</Text>
      <View style={{ marginTop: 16 }}>
        <TouchableOpacity
          testID="menu-pve"
          style={styles.menuBtn}
          onPress={() => {
            try { console.log('MainMenu: choose pve'); } catch(e){}
            onChoose('pve');
          }}
        >
          <Text testID="menu-pve" style={styles.menuText}>Talk to Lola</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="menu-pvp"
          style={styles.menuBtn}
          onPress={() => {
            try { console.log('MainMenu: choose pvp'); } catch(e){}
            onChoose('pvp');
          }}
        >
          <Text testID="menu-pvp" style={styles.menuText}>Talk to Friends</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
