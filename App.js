import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  updateDoc, where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './src/firebase';

const AREAS = [
  { name: 'Jardins', tasks: ['Verificar limpeza e conservação dos jardins', 'Retirar folhas e resíduos', 'Verificar irrigação e plantas', 'Identificar plantas danificadas'] },
  { name: 'Garagem', tasks: ['Verificar limpeza do piso', 'Inspecionar iluminação', 'Verificar portões e acessos', 'Identificar vazamentos ou infiltrações', 'Verificar organização das vagas'] },
  { name: 'Elevadores', tasks: ['Verificar funcionamento', 'Observar ruídos ou irregularidades', 'Verificar limpeza das cabines', 'Comunicar falhas à administração'] },
  { name: 'Portaria', tasks: ['Verificar organização e limpeza', 'Inspecionar iluminação', 'Verificar conservação dos acessos', 'Comunicar irregularidades'] },
  { name: 'Churrasqueira', tasks: ['Verificar limpeza do espaço', 'Inspecionar grelhas e equipamentos', 'Conferir mesas e cadeiras', 'Verificar torneiras e pontos de água'] },
  { name: 'Salão de festas', tasks: ['Verificar limpeza geral', 'Inspecionar mesas e cadeiras', 'Conferir iluminação e tomadas', 'Verificar portas e janelas', 'Registrar danos encontrados'] },
  { name: 'Academia', tasks: ['Verificar limpeza do ambiente', 'Inspecionar equipamentos visualmente', 'Verificar conservação dos aparelhos', 'Conferir iluminação e ventilação', 'Comunicar equipamentos danificados'] }
];

const COLORS = { green: '#174C3C', light: '#EAF2EE', ink: '#18231F', muted: '#66756D', white: '#FFFFFF', line: '#DCE5DF', orange: '#B56A16' };

function Btn({ title, onPress, secondary = false, disabled = false }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.btn, secondary && styles.btnSecondary, disabled && { opacity: .5 }]}>
    <Text style={[styles.btnText, secondary && { color: COLORS.green }]}>{title}</Text>
  </TouchableOpacity>;
}
function Field(props) { return <TextInput placeholderTextColor="#89958E" style={styles.input} {...props} />; }

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('home');
  const [expanded, setExpanded] = useState('Jardins');
  const [records, setRecords] = useState({});
  const [occurrences, setOccurrences] = useState([]);
  const [report, setReport] = useState([]);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current);
    if (current) {
      try {
        const snap = await getDoc(doc(db, 'users', current.uid));
        setRole(snap.exists() ? snap.data().role : 'zelador');
      } catch { setRole('zelador'); }
    } else setRole('');
    setLoading(false);
  }), []);

  const total = useMemo(() => AREAS.reduce((n, a) => n + a.tasks.length, 0), []);
  const completed = Object.values(records).filter(r => r.status === 'Concluída').length;

  async function login() {
    if (!email.trim() || !password) return Alert.alert('Atenção', 'Informe e-mail e senha.');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (e) { Alert.alert('Não foi possível entrar', traduzErro(e.code)); }
  }
  async function logout() { await signOut(auth); setScreen('home'); }

 async function markTask(area, task, status) {
  if (!user) {
    Alert.alert('Atenção', 'Faça login novamente.');
    return;
  }

  try {
    const key = `${area}__${task}`;
    const existing = records[key];

    if (existing?.id) {
      await updateDoc(doc(db, 'tasks', existing.id), {
        status,
        updatedAt: serverTimestamp()
      });
    } else {
      const refDoc = await addDoc(collection(db, 'tasks'), {
        area,
        task,
        status,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photoUrl: null
      });

      setRecords(old => ({
        ...old,
        [key]: { id: refDoc.id, status }
      }));
    }

    if (existing?.id) {
      setRecords(old => ({
        ...old,
        [key]: { ...old[key], status }
      }));
    }

    Alert.alert('Sucesso', 'Tarefa atualizada!');
  } catch (e) {
    Alert.alert(
      'Erro ao salvar',
      `Código: ${e.code || 'desconhecido'}\n${e.message || 'Erro desconhecido'}`
    );
  }
} 

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permissão necessária', 'Autorize o uso da câmera.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function saveOccurrence() {
    if (!problem.trim()) return Alert.alert('Atenção', 'Descreva a ocorrência.');
    try {
      let photoUrl = null;
      if (photo) {
        const response = await fetch(photo);
        const blob = await response.blob();
        const storageRef = ref(storage, `ocorrencias/${user.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        photoUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, 'occurrences'), {
        description: problem.trim(), photoUrl, status: 'Aberta',
        userId: user.uid, userEmail: user.email, createdAt: serverTimestamp()
      });
      setProblem(''); setPhoto(null);
      Alert.alert('Registrado', 'Ocorrência enviada ao síndico.');
      setScreen('home');
    } catch { Alert.alert('Erro', 'Não foi possível enviar. Confira sua conexão e configuração do Firebase.'); }
  }

  async function loadData() {
    try {
      const tq = query(collection(db, 'tasks'), orderBy('updatedAt', 'desc'));
      const ts = await getDocs(tq);
      const next = {};
      ts.forEach(d => { const x = d.data(); next[`${x.area}__${x.task}`] = { id: d.id, status: x.status }; });
      setRecords(next);
      const os = await getDocs(query(collection(db, 'occurrences'), orderBy('createdAt', 'desc')));
      setOccurrences(os.docs.map(d => ({ id: d.id, ...d.data() })));
      const rs = await getDocs(query(collection(db, 'tasks'), orderBy('updatedAt', 'desc')));
      setReport(rs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* conexão/regras serão informadas na tela */ }
  }

  useEffect(() => { if (user) loadData(); }, [user]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={COLORS.green} /></SafeAreaView>;

  if (!user) return <SafeAreaView style={styles.loginPage}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.green} />
    <View style={styles.loginHeader}>
      <Text style={styles.brandSmall}>CONDOMÍNIO RESIDENCIAL</Text>
      <Text style={styles.brand}>CONCEPT VIVACQUA</Text>
      <Text style={styles.loginSubtitle}>Aplicativo de zeladoria</Text>
    </View>
    <View style={styles.loginCard}>
      <Text style={styles.heading}>Acessar aplicativo</Text>
      <Text style={styles.label}>E-mail</Text>
      <Field value={email} onChangeText={setEmail} placeholder="seuemail@exemplo.com" autoCapitalize="none" keyboardType="email-address" />
      <Text style={styles.label}>Senha</Text>
      <Field value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry />
      <Btn title="Entrar" onPress={login} />
      <Text style={styles.help}>O acesso é criado previamente pela administração. Não existe cadastro público.</Text>
    </View>
  </SafeAreaView>;

  return <SafeAreaView style={styles.page}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.green} />
    <View style={styles.topbar}>
      <View><Text style={styles.topBrand}>CONCEPT VIVACQUA</Text><Text style={styles.topSub}>GESTÃO DE ZELADORIA</Text></View>
      <TouchableOpacity onPress={logout}><Text style={styles.logout}>Sair</Text></TouchableOpacity>
    </View>
    <View style={styles.nav}>
      {['home', 'checklist', 'occurrence', ...(role === 'sindico' || role === 'admin' ? ['reports'] : [])].map((s, i) => (
        <TouchableOpacity key={s} onPress={() => setScreen(s)} style={[styles.navItem, screen === s && styles.navActive]}>
          <Text style={[styles.navText, screen === s && styles.navTextActive]}>{({home:'Início',checklist:'Checklist',occurrence:'Ocorrência',reports:'Síndico'})[s]}</Text>
        </TouchableOpacity>
      ))}
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {screen === 'home' && <>
        <Text style={styles.heading}>Olá, {role === 'sindico' ? 'Síndico' : 'Zelador'}!</Text>
        <Text style={styles.muted}>Acompanhe as atividades do condomínio.</Text>
        <View style={styles.progressCard}>
          <Text style={styles.cardTitle}>Checklist geral</Text>
          <Text style={styles.progressNumber}>{completed} <Text style={styles.progressTotal}>/ {total}</Text></Text>
          <Text style={styles.muted}>tarefas concluídas</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, completed / total * 100)}%` }]} /></View>
          <Btn title="Abrir checklist" onPress={() => setScreen('checklist')} />
        </View>
        <View style={styles.twoCards}>
          <View style={styles.miniCard}><Text style={styles.miniNumber}>{occurrences.length}</Text><Text style={styles.muted}>Ocorrências carregadas</Text></View>
          <View style={styles.miniCard}><Text style={styles.miniNumber}>{Object.values(records).filter(x => x.status !== 'Concluída').length}</Text><Text style={styles.muted}>Tarefas em aberto</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Áreas monitoradas</Text>
        {AREAS.map(a => <TouchableOpacity key={a.name} style={styles.areaRow} onPress={() => { setExpanded(a.name); setScreen('checklist'); }}>
          <Text style={styles.areaName}>{a.name}</Text><Text style={styles.muted}>{a.tasks.length} tarefas  ›</Text>
        </TouchableOpacity>)}
      </>}
      {screen === 'checklist' && <>
        <Text style={styles.heading}>Checklist diário</Text>
        <Text style={styles.muted}>Marque o andamento de cada atividade.</Text>
        {AREAS.map(a => <View key={a.name} style={styles.areaCard}>
          <TouchableOpacity style={styles.areaHeader} onPress={() => setExpanded(expanded === a.name ? '' : a.name)}>
            <Text style={styles.areaName}>{a.name}</Text><Text style={styles.muted}>{expanded === a.name ? '−' : '+'}</Text>
          </TouchableOpacity>
          {expanded === a.name && a.tasks.map(task => {
            const status = records[`${a.name}__${task}`]?.status || 'Pendente';
            return <View key={task} style={styles.taskRow}>
              <View style={{ flex: 1 }}><Text style={styles.taskText}>{task}</Text><Text style={[styles.status, status === 'Concluída' && { color: '#16834D' }]}>{status}</Text></View>
              <TouchableOpacity style={styles.smallButton} onPress={() => markTask(a.name, task, status === 'Concluída' ? 'Pendente' : 'Concluída')}>
                <Text style={styles.smallButtonText}>{status === 'Concluída' ? 'Desfazer' : 'Concluir'}</Text>
              </TouchableOpacity>
            </View>;
          })}
        </View>)}
      </>}
      {screen === 'occurrence' && <>
        <Text style={styles.heading}>Nova ocorrência</Text>
        <Text style={styles.muted}>Descreva o problema e anexe uma foto, se necessário.</Text>
        <Text style={styles.label}>Descrição</Text>
        <Field value={problem} onChangeText={setProblem} placeholder="Ex.: lâmpada queimada na garagem..." multiline style={[styles.input, styles.multiline]} />
        <View style={styles.photoButtons}><View style={{ flex: 1 }}><Btn title="Tirar foto" onPress={takePhoto} secondary /></View><View style={{ flex: 1 }}><Btn title="Escolher foto" onPress={choosePhoto} secondary /></View></View>
        {photo && <Image source={{ uri: photo }} style={styles.preview} />}
        <Btn title="Enviar ocorrência" onPress={saveOccurrence} />
      </>}
      {screen === 'reports' && <>
        <Text style={styles.heading}>Painel do síndico</Text>
        <Text style={styles.muted}>Atividades e ocorrências registradas.</Text>
        <View style={styles.twoCards}><View style={styles.miniCard}><Text style={styles.miniNumber}>{report.length}</Text><Text style={styles.muted}>Registros de tarefas</Text></View><View style={styles.miniCard}><Text style={styles.miniNumber}>{occurrences.length}</Text><Text style={styles.muted}>Ocorrências</Text></View></View>
        <Text style={styles.sectionTitle}>Últimas tarefas</Text>
        {report.slice(0, 30).map(r => <View key={r.id} style={styles.reportRow}><Text style={styles.taskText}>{r.area} · {r.task}</Text><Text style={styles.status}>{r.status} · {r.userEmail}</Text></View>)}
        <Text style={styles.sectionTitle}>Ocorrências</Text>
        {occurrences.map(o => <View key={o.id} style={styles.reportRow}><Text style={styles.taskText}>{o.description}</Text><Text style={styles.status}>{o.status} · {o.userEmail}</Text>{o.photoUrl && <Image source={{ uri: o.photoUrl }} style={styles.preview} />}</View>)}
        <Btn title="Atualizar dados" onPress={loadData} secondary />
      </>}
      <Text style={styles.footer}>Concept Vivacqua · Uso interno do condomínio</Text>
    </ScrollView>
  </SafeAreaView>;
}

function traduzErro(code) {
  const errors = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
    'auth/network-request-failed': 'Verifique sua conexão com a internet.'
  };
  return errors[code] || 'Confira os dados e tente novamente.';
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F8F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loginPage: { flex: 1, backgroundColor: COLORS.green, justifyContent: 'center', padding: 22 },
  loginHeader: { marginBottom: 28 },
  brandSmall: { color: '#C6D9CF', fontSize: 11, letterSpacing: 2 },
  brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 7 },
  loginSubtitle: { color: '#D7E5DE', marginTop: 8 },
  loginCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22 },
  topbar: { backgroundColor: COLORS.green, paddingHorizontal: 18, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBrand: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1 },
  topSub: { color: '#C6D9CF', fontSize: 9, marginTop: 3, letterSpacing: 1.5 },
  logout: { color: '#FFFFFF', fontWeight: '700' },
  nav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 7, borderBottomWidth: 1, borderColor: COLORS.line },
  navItem: { paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  navActive: { borderBottomColor: COLORS.green },
  navText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  navTextActive: { color: COLORS.green },
  content: { padding: 18, paddingBottom: 40 },
  heading: { fontSize: 23, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  label: { color: COLORS.ink, fontWeight: '700', marginTop: 16, marginBottom: 7, fontSize: 13 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 13, color: COLORS.ink, fontSize: 14 },
  multiline: { minHeight: 115, textAlignVertical: 'top' },
  btn: { backgroundColor: COLORS.green, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  btnSecondary: { backgroundColor: COLORS.light, borderWidth: 1, borderColor: '#C9D9D0' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  help: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 15, textAlign: 'center' },
  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: COLORS.line },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  progressNumber: { fontSize: 38, fontWeight: '800', color: COLORS.green, marginTop: 12 },
  progressTotal: { fontSize: 19, color: COLORS.muted },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: '#E6EDE8', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#26945E', borderRadius: 8 },
  twoCards: { flexDirection: 'row', gap: 10, marginTop: 12 },
  miniCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 15, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line },
  miniNumber: { fontSize: 25, color: COLORS.green, fontWeight: '800', marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginTop: 23, marginBottom: 10 },
  areaRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#FFFFFF', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.line },
  areaName: { color: COLORS.ink, fontWeight: '800', fontSize: 14 },
  areaCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, marginTop: 12, overflow: 'hidden' },
  areaHeader: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EDF4EF' },
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 13, borderTopWidth: 1, borderTopColor: '#EDF1EE', gap: 8 },
  taskText: { color: COLORS.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  status: { color: COLORS.orange, fontSize: 11, marginTop: 4 },
  smallButton: { backgroundColor: COLORS.light, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8 },
  smallButtonText: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  photoButtons: { flexDirection: 'row', gap: 9, marginTop: 8 },
  preview: { width: '100%', height: 190, borderRadius: 12, marginTop: 13, resizeMode: 'cover' },
  reportRow: { padding: 13, backgroundColor: '#FFFFFF', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.line },
  footer: { color: '#8A968F', fontSize: 10, textAlign: 'center', marginTop: 28 }
});
