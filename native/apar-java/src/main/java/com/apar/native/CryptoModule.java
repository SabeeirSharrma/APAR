package com.apar.native;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.HashMap;

/**
 * AES-256-GCM encryption/decryption module for APAR.
 * Called via Transit from TypeScript.
 */
public class CryptoModule {

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final String ALGORITHM = "AES/GCM/NoPadding";

    /**
     * Generate a new AES-256 key (base64-encoded).
     * @param argsJson unused
     * @return JSON with "key" field
     */
    public String generateKey(String argsJson) {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256, new SecureRandom());
            SecretKey key = keyGen.generateKey();
            String keyBase64 = Base64.getEncoder().encodeToString(key.getEncoded());
            
            return String.format("{\"key\":\"%s\"}", keyBase64);
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Encrypt plaintext using AES-256-GCM.
     * @param argsJson JSON with "key" (base64) and "plaintext" fields
     * @return JSON with "ciphertext" and "nonce" fields
     */
    public String encrypt(String argsJson) {
        try {
            Map<String, String> args = parseJson(argsJson);
            String keyBase64 = args.get("key");
            String plaintext = args.get("plaintext");

            if (keyBase64 == null || plaintext == null) {
                return "{\"error\":\"key and plaintext are required\"}";
            }

            byte[] keyBytes = Base64.getDecoder().decode(keyBase64);
            SecretKey key = new SecretKeySpec(keyBytes, "AES");

            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes("UTF-8"));

            String ciphertextBase64 = Base64.getEncoder().encodeToString(ciphertext);
            String nonceBase64 = Base64.getEncoder().encodeToString(iv);

            return String.format("{\"ciphertext\":\"%s\",\"nonce\":\"%s\"}", ciphertextBase64, nonceBase64);
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Decrypt ciphertext using AES-256-GCM.
     * @param argsJson JSON with "key", "nonce", and "ciphertext" fields (all base64)
     * @return JSON with "plaintext" field
     */
    public String decrypt(String argsJson) {
        try {
            Map<String, String> args = parseJson(argsJson);
            String keyBase64 = args.get("key");
            String nonceBase64 = args.get("nonce");
            String ciphertextBase64 = args.get("ciphertext");

            if (keyBase64 == null || nonceBase64 == null || ciphertextBase64 == null) {
                return "{\"error\":\"key, nonce, and ciphertext are required\"}";
            }

            byte[] keyBytes = Base64.getDecoder().decode(keyBase64);
            byte[] iv = Base64.getDecoder().decode(nonceBase64);
            byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);

            SecretKey key = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(ciphertext);

            String plaintextStr = new String(plaintext, "UTF-8");
            // Escape JSON special characters
            plaintextStr = plaintextStr.replace("\\", "\\\\").replace("\"", "\\\"");

            return String.format("{\"plaintext\":\"%s\"}", plaintextStr);
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Simple JSON parser for flat key-value pairs.
     * For production, use a proper JSON library.
     */
    private Map<String, String> parseJson(String json) {
        Map<String, String> map = new HashMap<>();
        json = json.trim();
        if (json.startsWith("{")) json = json.substring(1);
        if (json.endsWith("}")) json = json.substring(0, json.length() - 1);
        
        String[] pairs = json.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
        for (String pair : pairs) {
            String[] kv = pair.split(":(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", 2);
            if (kv.length == 2) {
                String key = kv[0].trim().replace("\"", "");
                String value = kv[1].trim().replace("\"", "");
                map.put(key, value);
            }
        }
        return map;
    }
}
