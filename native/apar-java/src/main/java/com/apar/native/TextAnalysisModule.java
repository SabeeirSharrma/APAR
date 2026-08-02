package com.apar.native;

import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/**
 * Text analysis module for APAR.
 * Called via Transit from TypeScript for CPU-intensive text processing.
 */
public class TextAnalysisModule {

    /**
     * Extract key phrases and statistics from text.
     * @param argsJson JSON with "text" field
     * @return JSON with analysis results
     */
    public String analyzeText(String argsJson) {
        try {
            Map<String, String> args = parseJson(argsJson);
            String text = args.get("text");

            if (text == null || text.isEmpty()) {
                return "{\"error\":\"text is required\"}";
            }

            // Word count
            String[] words = text.split("\\s+");
            int wordCount = words.length;

            // Sentence count
            String[] sentences = text.split("[.!?]+");
            int sentenceCount = sentences.length;

            // Paragraph count
            String[] paragraphs = text.split("\\n\\n+");
            int paragraphCount = paragraphs.length;

            // Average word length
            double avgWordLength = Arrays.stream(words)
                .mapToInt(String::length)
                .average()
                .orElse(0);

            // Character count (excluding spaces)
            long charCount = text.chars()
                .filter(c -> !Character.isWhitespace(c))
                .count();

            // Unique word ratio
            Set<String> uniqueWords = Arrays.stream(words)
                .map(w -> w.toLowerCase().replaceAll("[^a-z]", ""))
                .filter(w -> !w.isEmpty())
                .collect(Collectors.toSet());
            double uniqueWordRatio = wordCount > 0 ? (double) uniqueWords.size() / wordCount : 0;

            return String.format(
                "{\"wordCount\":%d,\"sentenceCount\":%d,\"paragraphCount\":%d," +
                "\"avgWordLength\":%.1f,\"charCount\":%d,\"uniqueWordRatio\":%.2f}",
                wordCount, sentenceCount, paragraphCount,
                avgWordLength, charCount, uniqueWordRatio
            );
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Tokenize text into words with metadata.
     * @param argsJson JSON with "text" field
     * @return JSON with token array
     */
    public String tokenize(String argsJson) {
        try {
            Map<String, String> args = parseJson(argsJson);
            String text = args.get("text");

            if (text == null || text.isEmpty()) {
                return "{\"error\":\"text is required\"}";
            }

            // Simple word tokenization
            String[] words = text.split("\\s+");
            StringBuilder result = new StringBuilder("[");
            for (int i = 0; i < words.length; i++) {
                if (i > 0) result.append(",");
                String word = words[i].replaceAll("[^a-zA-Z0-9]", "");
                int length = word.length();
                boolean isUpperCase = word.equals(word.toUpperCase()) && word.length() > 1;
                result.append(String.format("{\"word\":\"%s\",\"length\":%d,\"isUpperCase\":%b}", 
                    word, length, isUpperCase));
            }
            result.append("]");

            return String.format("{\"tokens\":%s,\"count\":%d}", result, words.length);
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Find and extract patterns from text.
     * @param argsJson JSON with "text" and "pattern" fields
     * @return JSON with matches
     */
    public String findPatterns(String argsJson) {
        try {
            Map<String, String> args = parseJson(argsJson);
            String text = args.get("text");
            String pattern = args.get("pattern");

            if (text == null || pattern == null) {
                return "{\"error\":\"text and pattern are required\"}";
            }

            Pattern p = Pattern.compile(pattern, Pattern.CASE_INSENSITIVE);
            Matcher matcher = p.matcher(text);

            List<String> matches = new ArrayList<>();
            while (matcher.find()) {
                matches.add(matcher.group());
            }

            StringBuilder result = new StringBuilder("[");
            for (int i = 0; i < matches.size(); i++) {
                if (i > 0) result.append(",");
                result.append(String.format("\"%s\"", matches.get(i).replace("\"", "\\\"")));
            }
            result.append("]");

            return String.format("{\"matches\":%s,\"count\":%d}", result, matches.size());
        } catch (Exception e) {
            return String.format("{\"error\":\"%s\"}", e.getMessage());
        }
    }

    /**
     * Simple JSON parser for flat key-value pairs.
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
