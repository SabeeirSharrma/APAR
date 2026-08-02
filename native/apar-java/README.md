# apar-java — Transit Java Modules

Java modules for APAR called via Transit from TypeScript.

## Modules

### CryptoModule

AES-256-GCM encryption/decryption.

```java
// Functions discovered by Transit:
CryptoModule.generateKey(argsJson) → {"key": "<base64>"}
CryptoModule.encrypt(argsJson) → {"ciphertext": "<base64>", "nonce": "<base64>"}
CryptoModule.decrypt(argsJson) → {"plaintext": "<text>"}
```

### TextAnalysisModule

CPU-intensive text processing.

```java
// Functions discovered by Transit:
TextAnalysisModule.analyzeText(argsJson) → {"wordCount": N, ...}
TextAnalysisModule.tokenize(argsJson) → {"tokens": [...], "count": N}
TextAnalysisModule.findPatterns(argsJson) → {"matches": [...], "count": N}
```

## Usage from TypeScript (via Transit)

```typescript
import { transit } from "transit";
import { resolve } from "node:path";

const jv = transit.java(resolve(__dirname, "./native/apar-java/src/main/java"));

// Encrypt
const result = await jv.encrypt(JSON.stringify({
  key: "<base64-key>",
  plaintext: "Hello, APAR!"
}));

// Analyze text
const analysis = await jv.analyzeText(JSON.stringify({
  text: "This is a sample document..."
}));
```

## Requirements

- Java JDK 21+
- Transit CLI installed (`bun install -g transit-cli`)
