import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 8, marginVertical: 6, maxWidth: '80%' },
  userBubble: { backgroundColor: '#dcf8c6', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#f1f0f0', alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginRight: 8 }
  ,
  // shared app styles
  container: { flex:1, padding: 12, backgroundColor: '#fff' },
  navbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: '#5b21b6' },
  navText: { color: '#eee', fontWeight: '600' },
  navTextActive: { color: '#fff', textDecorationLine: 'underline' },
  mainMenu: { padding: 16, alignItems: 'center' },
  subtitle: { marginTop: 8, color: '#6b21a8' },
  menuBtn: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 12, marginVertical: 8, width: 280, alignItems: 'center' },
  menuText: { color: '#fff', fontWeight: '700' },
  tabBtn: { padding: 8, marginRight: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  tabActive: { backgroundColor: '#eee' },
  header: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  modeRow: { flexDirection: 'row', marginTop: 8 },
  modeBtn: { padding: 8, marginRight: 6, borderRadius: 6, borderWidth:1, borderColor:'#ccc' },
  modeBtnActive: { backgroundColor: '#eee' },
  modeText: {},
  translatePanel: { padding: 10, backgroundColor: '#fff8e6', borderRadius: 8, marginTop: 10 },
  translateOption: { padding: 10, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', marginBottom: 8 }
});

export default styles;
