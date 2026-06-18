import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { firebaseIsConfigured } from "./firebaseConfig";
import { getFirebaseClient } from "./firebaseClient";

type ShoppingItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  itemTotal: number;
  imageUri?: string;
  imageUrl?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type AppUser = {
  uid: string;
  email: string | null;
};

type ItemForm = {
  name: string;
  unitPrice: string;
  quantity: string;
  imageUri: string;
  imageUrl: string;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const emptyItem: ItemForm = {
  name: "",
  unitPrice: "",
  quantity: "1",
  imageUri: "",
  imageUrl: ""
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  );

  useEffect(() => {
    let unsubscribe: undefined | (() => void);

    async function initializeAuth() {
      if (!firebaseIsConfigured) {
        setBooting(false);
        return;
      }

      try {
        const { auth } = getFirebaseClient();
        unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
          setUser(
            firebaseUser
              ? { uid: firebaseUser.uid, email: firebaseUser.email }
              : null
          );
          setBooting(false);
        });
      } catch (error) {
        Alert.alert("Erro ao iniciar", getErrorMessage(error));
        setBooting(false);
      }
    }

    initializeAuth();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (user) loadItems(user.uid);
  }, [user]);

  async function loadItems(uid: string) {
    setBusy(true);
    try {
      const { db } = getFirebaseClient();
      const snapshot = await db
        .collection("shoppingItems")
        .where("userId", "==", uid)
        .get();
      const nextItems = snapshot.docs
        .map((doc) => {
          const data = doc.data() as Omit<ShoppingItem, "id">;
          return { id: doc.id, ...data };
        })
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setItems(nextItems);
    } catch (error) {
      Alert.alert("Erro ao carregar", getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Revise o e-mail", "Informe um e-mail valido.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Revise a senha", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const { auth } = getFirebaseClient();

      try {
        await auth.signInWithEmailAndPassword(cleanEmail, password);
      } catch {
        await auth.createUserWithEmailAndPassword(cleanEmail, password);
      }
    } catch (error) {
      Alert.alert("Erro no login", getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { auth } = getFirebaseClient();
    await auth.signOut();
    setUser(null);
    setItems([]);
    setPassword("");
  }

  async function captureImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a camera para fotografar produtos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1
    });

    if (!result.canceled) {
      await processImage(result.assets[0].uri);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1
    });

    if (!result.canceled) {
      await processImage(result.assets[0].uri);
    }
  }

  async function processImage(uri: string) {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
    );

    setForm((current) => ({
      ...current,
      imageUri: resized.uri,
      imageUrl: resized.uri
    }));
  }

  function openNewItem() {
    setForm(emptyItem);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditItem(item: ShoppingItem) {
    setForm({
      name: item.name,
      unitPrice: String(item.unitPrice).replace(".", ","),
      quantity: String(item.quantity),
      imageUri: item.imageUri || item.imageUrl,
      imageUrl: item.imageUrl
    });
    setEditingId(item.id);
    setModalOpen(true);
  }

  async function uploadImageIfNeeded(imageUri: string, itemId: string) {
    if (!imageUri || imageUri.startsWith("https://")) return imageUri;

    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const { storage } = getFirebaseClient();
      const imageRef = storage.ref(`shopping-items/${user.uid}/${itemId}.jpg`);
      await imageRef.put(blob, { contentType: "image/jpeg" });
      return imageRef.getDownloadURL();
    } catch (error) {
      console.warn("Imagem mantida localmente:", getErrorMessage(error));
      return imageUri;
    }
  }

  async function saveItem() {
    const name = form.name.trim();
    const unitPrice = parseNumber(form.unitPrice);
    const quantity = parseInt(form.quantity, 10);

    if (!name || !unitPrice || !quantity || quantity <= 0) {
      Alert.alert("Revise os dados", "Preencha produto, valor unitario e quantidade.");
      return;
    }

    if (!form.imageUri && !form.imageUrl) {
      Alert.alert("Foto obrigatoria", "Tire ou escolha uma foto do produto.");
      return;
    }

    setBusy(true);
    try {
      const id = editingId || String(Date.now());
      const imageUrl = await uploadImageIfNeeded(form.imageUrl || form.imageUri, id);
      const itemTotal = unitPrice * quantity;
      const payload = {
        id,
        name,
        unitPrice,
        quantity,
        itemTotal,
        imageUri: form.imageUri,
        imageUrl,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        createdAt:
          items.find((item) => item.id === editingId)?.createdAt ||
          new Date().toISOString()
      };

      const { db, firebase } = getFirebaseClient();
      await db.collection("shoppingItems").doc(id).set({
        ...payload,
        createdAt: payload.createdAt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await loadItems(user.uid);

      setModalOpen(false);
      setForm(emptyItem);
      setEditingId(null);
    } catch (error) {
      Alert.alert("Erro ao salvar", getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    Alert.alert("Excluir item", "Deseja remover este produto da lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const nextItems = items.filter((item) => item.id !== id);
            setItems(nextItems);
            const { db } = getFirebaseClient();
            await db.collection("shoppingItems").doc(id).delete();
          } catch (error) {
            Alert.alert("Erro ao excluir", getErrorMessage(error));
          }
        }
      }
    ]);
  }

  async function changeQuantity(item: ShoppingItem, direction: number) {
    const quantity = Math.max(1, item.quantity + direction);
    const nextItems = items.map((current) =>
      current.id === item.id
        ? { ...current, quantity, itemTotal: current.unitPrice * quantity }
        : current
    );
    setItems(nextItems);

    try {
      const { db } = getFirebaseClient();
      await db
        .collection("shoppingItems")
        .doc(item.id)
        .update({ quantity, itemTotal: item.unitPrice * quantity });
    } catch (error) {
      Alert.alert("Erro ao atualizar", getErrorMessage(error));
      setItems(items);
    }
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.loading}>Carregando app...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    if (!firebaseIsConfigured) {
      return (
        <SafeAreaView style={styles.authScreen}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.authCard}>
            <Text style={styles.brand}>Lista Inteligente</Text>
            <Text style={styles.authTitle}>Configuração pendente</Text>
            <Text style={styles.authCopy}>
              O aplicativo ainda precisa receber as credenciais do projeto antes
              de ser usado.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.authCard}
        >
          <Text style={styles.brand}>Lista Inteligente</Text>
          <Text style={styles.authTitle}>Conferência de compras</Text>
          <Text style={styles.authCopy}>
            Fotografe produtos na prateleira, registre preço e quantidade, e
            confira o total antes de passar no caixa.
          </Text>

          <Text style={styles.inputLabel}>E-mail</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="E-mail"
            placeholderTextColor="#8B9188"
            style={styles.input}
            value={email}
          />
          <Text style={styles.inputLabel}>Senha</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Senha"
            placeholderTextColor="#8B9188"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable disabled={busy} onPress={signIn} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {busy ? "Entrando..." : "Entrar ou criar conta"}
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Conferencia de compras</Text>
          <Text style={styles.title}>Minha lista</Text>
          <Text style={styles.userText}>{user.email}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Total geral</Text>
          <Text style={styles.summaryValue}>{money.format(total)}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryPillText}>{items.length} itens</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhum produto ainda</Text>
            <Text style={styles.emptyCopy}>
              Fotografe um item da gondola, informe valor e quantidade, e o app
              calcula a compra automaticamente.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Sem foto</Text>
              </View>
            )}

            <View style={styles.itemContent}>
              <Text numberOfLines={1} style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {money.format(item.unitPrice)} x {item.quantity}
              </Text>
              <Text style={styles.itemTotal}>
                {money.format(item.unitPrice * item.quantity)}
              </Text>

              <View style={styles.itemActions}>
                <Pressable
                  onPress={() => changeQuantity(item, -1)}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepButtonText}>-</Text>
                </Pressable>
                <Pressable
                  onPress={() => changeQuantity(item, 1)}
                  style={styles.stepButton}
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </Pressable>
                <Pressable onPress={() => openEditItem(item)} style={styles.linkButton}>
                  <Text style={styles.linkButtonText}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => removeItem(item.id)} style={styles.linkButton}>
                  <Text style={styles.dangerText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <Pressable onPress={openNewItem} style={styles.floatingButton}>
        <Text style={styles.floatingButtonText}>+ Produto</Text>
      </Pressable>

      <Modal animationType="slide" visible={modalOpen}>
        <SafeAreaView style={styles.modalScreen}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingId ? "Editar produto" : "Novo produto"}
            </Text>

            <View style={styles.photoBox}>
              {form.imageUri ? (
                <Image source={{ uri: form.imageUri }} style={styles.previewImage} />
              ) : (
                <Text style={styles.photoHint}>Foto do produto</Text>
              )}
            </View>

            <View style={styles.photoActions}>
              <Pressable onPress={captureImage} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Camera</Text>
              </Pressable>
              <Pressable onPress={pickImage} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Galeria</Text>
              </Pressable>
            </View>

            <TextInput
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Nome do produto"
              placeholderTextColor="#697268"
              style={styles.input}
              value={form.name}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(text) => setForm({ ...form, unitPrice: text })}
              placeholder="Valor unitario"
              placeholderTextColor="#697268"
              style={styles.input}
              value={form.unitPrice}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(text) => setForm({ ...form, quantity: text })}
              placeholder="Quantidade"
              placeholderTextColor="#697268"
              style={styles.input}
              value={form.quantity}
            />

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={saveItem} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>
                  {busy ? "Salvando..." : "Salvar"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function parseNumber(value: string) {
  return Number(String(value).replace(/\./g, "").replace(",", "."));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("auth/invalid-email")) {
    return "O e-mail informado nao e valido.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "Este e-mail ja existe. Confira a senha e tente novamente.";
  }

  if (
    message.includes("auth/wrong-password") ||
    message.includes("auth/invalid-credential")
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (message.includes("auth/weak-password")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  if (message.includes("permission-denied")) {
    return "Acesso negado. Confira se voce esta logado e se as regras do Firebase foram publicadas.";
  }

  return message || "Tente novamente.";
}

const styles = StyleSheet.create({
  authCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE4DD",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 8,
    padding: 20,
    shadowColor: "#111111",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    width: "88%"
  },
  authCopy: {
    color: "#596057",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20
  },
  authScreen: {
    alignItems: "center",
    backgroundColor: "#EEF3EC",
    flex: 1,
    justifyContent: "center"
  },
  authTitle: {
    color: "#111711",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 9
  },
  brand: {
    color: "#1F5E43",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 7,
    textTransform: "uppercase"
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#C9CEC4",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14
  },
  cancelButtonText: {
    color: "#30332D",
    fontSize: 16,
    fontWeight: "800"
  },
  centerScreen: {
    alignItems: "center",
    backgroundColor: "#F7F7F2",
    flex: 1,
    justifyContent: "center"
  },
  dangerText: {
    color: "#B83232",
    fontSize: 14,
    fontWeight: "800"
  },
  emptyCopy: {
    color: "#6B7068",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 24
  },
  emptyTitle: {
    color: "#1C1E1A",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8
  },
  floatingButton: {
    alignItems: "center",
    backgroundColor: "#2E7D5B",
    borderRadius: 8,
    bottom: 20,
    elevation: 4,
    paddingHorizontal: 22,
    paddingVertical: 15,
    position: "absolute",
    right: 18
  },
  floatingButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  ghostButton: {
    borderColor: "#CAD0C7",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ghostButtonText: {
    color: "#2E7D5B",
    fontSize: 14,
    fontWeight: "800"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: "#E6E9E2",
    height: 98,
    justifyContent: "center",
    width: 98
  },
  imagePlaceholderText: {
    color: "#6B7068",
    fontSize: 13,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#F9FBF7",
    borderColor: "#CBD6CA",
    borderRadius: 8,
    borderWidth: 1,
    color: "#1C1E1A",
    fontSize: 16,
    marginBottom: 13,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  inputLabel: {
    color: "#30382F",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7
  },
  itemActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E7DE",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden"
  },
  itemContent: {
    flex: 1,
    padding: 12
  },
  itemImage: {
    backgroundColor: "#E6E9E2",
    height: 118,
    width: 112
  },
  itemMeta: {
    color: "#666B62",
    fontSize: 14,
    marginTop: 4
  },
  itemName: {
    color: "#1C1E1A",
    fontSize: 17,
    fontWeight: "900"
  },
  itemTotal: {
    color: "#2E7D5B",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5
  },
  kicker: {
    color: "#5C665C",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  linkButton: {
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  linkButtonText: {
    color: "#315E97",
    fontSize: 14,
    fontWeight: "800"
  },
  list: {
    padding: 18,
    paddingBottom: 100
  },
  loading: {
    color: "#2E7D5B",
    fontSize: 18,
    fontWeight: "800"
  },
  modalContent: {
    padding: 18,
    paddingBottom: 36
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  modalScreen: {
    backgroundColor: "#F7F7F2",
    flex: 1
  },
  modalTitle: {
    color: "#1C1E1A",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 16
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  photoBox: {
    alignItems: "center",
    backgroundColor: "#E6E9E2",
    borderRadius: 8,
    height: 210,
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden"
  },
  photoHint: {
    color: "#6B7068",
    fontSize: 16,
    fontWeight: "800"
  },
  previewImage: {
    height: "100%",
    width: "100%"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1F5E43",
    borderRadius: 8,
    marginTop: 2,
    paddingVertical: 16
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#2E7D5B",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 14
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  screen: {
    backgroundColor: "#F7F7F2",
    flex: 1
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#243B53",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  stepButton: {
    alignItems: "center",
    backgroundColor: "#ECF1EA",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  stepButtonText: {
    color: "#1C1E1A",
    fontSize: 18,
    fontWeight: "900"
  },
  summary: {
    alignItems: "center",
    backgroundColor: "#1E2A25",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    margin: 18,
    marginBottom: 4,
    padding: 18
  },
  summaryLabel: {
    color: "#BFD3C5",
    fontSize: 14,
    fontWeight: "800"
  },
  summaryPill: {
    backgroundColor: "#E7F5EC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  summaryPillText: {
    color: "#2E7D5B",
    fontSize: 13,
    fontWeight: "900"
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 3
  },
  title: {
    color: "#1C1E1A",
    fontSize: 32,
    fontWeight: "900"
  },
  userText: {
    color: "#6B7068",
    fontSize: 13,
    marginTop: 2
  }
});
