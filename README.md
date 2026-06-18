# Lista Inteligente de Compras

Aplicativo mobile em React Native com TypeScript para conferência de compras por imagem.

O app permite fotografar um produto na gôndola, informar o valor unitário e a quantidade, e acompanhar o total por item e o total geral da compra.

## Funcionalidades

- Login com e-mail e senha.
- Cadastro automático de usuário no primeiro acesso.
- Captura de foto pela câmera.
- Escolha de imagem pela galeria.
- Tratamento da imagem com redimensionamento e compressão.
- Cadastro de produto com nome, valor unitário e quantidade.
- Cálculo automático do total por item e do total geral.
- Edição de quantidade, edição completa do produto e exclusão.
- Lista separada por usuário.
- Integração com Firebase Authentication, Cloud Firestore e Firebase Storage.

## Tecnologias

- Expo
- React Native
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- expo-image-picker
- expo-image-manipulator

## Como rodar

Instale as dependências:

```bash
npm install
```

Inicie o projeto:

```bash
npm start
```

Depois, abra pelo Expo Go no celular ou pelo emulador Android.

## Como configurar Firebase

Abra o arquivo `firebaseConfig.ts` e preencha os dados do seu projeto Firebase:

```ts
export const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
} as const;
```

No Firebase Console, ative:

- Authentication com provedor E-mail/Senha.
- Cloud Firestore.
- Firebase Storage.

Depois publique as regras dos arquivos:

- `firestore.rules` em Firestore Database > Rules.
- `storage.rules` em Storage > Rules.

## Roteiro de apresentação

1. Abrir o app.
2. Fazer login com e-mail e senha.
3. Tocar em `+ Produto`.
4. Tirar foto de um produto pela câmera ou escolher uma imagem da galeria.
5. Informar nome, valor unitário e quantidade.
6. Salvar e mostrar o total do item.
7. Adicionar mais um item e mostrar o total geral.
8. Alterar quantidade usando `+` e `-`.
9. Editar ou excluir um item.

## Observação

O projeto atende ao Projeto 2 do enunciado: App de Conferência de Compras por Imagem, usando React Native, Firebase Authentication, Cloud Firestore, Firebase Storage, câmera e manipulação de imagem.
