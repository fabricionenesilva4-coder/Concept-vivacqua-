# App Zelador — Concept Vivacqua

Projeto inicial Android em React Native + Expo + Firebase.

## O que já está incluído
- Login por e-mail e senha (Firebase Authentication).
- Checklist das sete áreas do condomínio.
- Registro de conclusão/pendência no Firestore.
- Abertura de ocorrências.
- Anexar foto da galeria ou câmera e enviar ao Firebase Storage.
- Painel de acompanhamento para perfil `sindico` ou `admin`.

## Importante
Este é o código inicial do aplicativo. Para funcionar com contas reais, é necessário configurar o Firebase, criar os usuários e aplicar as regras de segurança. Não use em produção antes de revisar permissões, regras, política de privacidade e testes.

## 1. Configurar Firebase
1. Entre em https://console.firebase.google.com e crie um projeto.
2. Adicione um app Web ao projeto Firebase e copie o objeto de configuração.
3. Copie `firebaseConfig.example.js` para `firebaseConfig.js` e preencha os dados.
4. No Firebase Authentication, habilite o provedor **E-mail/senha**.
5. Crie um banco **Cloud Firestore** e habilite o **Storage**.
6. Em Authentication > Users, crie os usuários do zelador e do síndico.
7. Em Firestore, crie para cada usuário um documento na coleção `users`, usando como ID o UID exibido no Authentication. Campos: `role` = `zelador` ou `sindico`, e `name` = nome da pessoa.

## 2. Regras iniciais do Firestore
Cole estas regras em Firestore > Rules. Elas restringem o acesso a usuários autenticados do app. Antes de produção, revise com um profissional e amplie as validações por função.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isMember() {
      return signedIn() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
    }
    match /tasks/{id} {
      allow read: if isMember();
      allow create: if isMember() && request.resource.data.userId == request.auth.uid;
      allow update: if isMember();
      allow delete: if false;
    }
    match /occurrences/{id} {
      allow read: if isMember();
      allow create: if isMember() && request.resource.data.userId == request.auth.uid;
      allow update: if isMember();
      allow delete: if false;
    }
  }
}
```

## 3. Regras iniciais do Storage
Cole em Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /ocorrencias/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## 4. Executar e gerar APK
É mais fácil fazer a primeira compilação usando um computador. Também é possível usar serviços de desenvolvimento na nuvem, mas o fluxo precisa ser configurado.

1. Instale Node.js LTS no computador.
2. Extraia o ZIP.
3. Abra o terminal dentro da pasta do projeto e execute:
   `npm install`
4. Teste com:
   `npx expo start`
5. Para gerar APK com EAS Build:
   `npx eas-cli@latest build:configure`
6. Crie/ajuste `eas.json` para perfil APK:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

7. Execute:
   `npx eas-cli@latest build --platform android --profile preview`

O EAS solicitará autenticação e poderá pedir configuração adicional. O APK será disponibilizado pelo serviço de build quando a compilação terminar.

## Estrutura
- `App.js`: telas e fluxo principal.
- `src/firebase.js`: conexão Firebase.
- `firebaseConfig.example.js`: modelo de configuração.
- `app.json`: identidade Android e permissões de câmera/galeria.
