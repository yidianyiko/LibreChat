#!/usr/bin/env node

/**
 * Seed Token Pricing Script
 *
 * This script imports all hardcoded token pricing from api/models/tx.js
 * into the TokenPricing MongoDB collection. It can be run multiple times
 * safely - duplicate patterns will be skipped.
 *
 * Usage:
 *   node config/seed-token-pricing.js [--dry-run] [--force]
 *
 * Options:
 *   --dry-run    Show what would be imported without making changes
 *   --force      Update existing records with new rates
 *   --clear      Clear all existing records before seeding
 */

const path = require('path');
require('module-alias/register');
const moduleAlias = require('module-alias');

const basePath = path.resolve(__dirname, '..', 'api');
moduleAlias.addAlias('~', basePath);

const mongoose = require('mongoose');

// Import token pricing data from tx.js
const bedrockValues = {
  // Basic llama2 patterns (base defaults to smallest variant)
  llama2: { prompt: 0.75, completion: 1.0 },
  'llama-2': { prompt: 0.75, completion: 1.0 },
  'llama2-13b': { prompt: 0.75, completion: 1.0 },
  'llama2:70b': { prompt: 1.95, completion: 2.56 },
  'llama2-70b': { prompt: 1.95, completion: 2.56 },

  // Basic llama3 patterns (base defaults to smallest variant)
  llama3: { prompt: 0.3, completion: 0.6 },
  'llama-3': { prompt: 0.3, completion: 0.6 },
  'llama3-8b': { prompt: 0.3, completion: 0.6 },
  'llama3:8b': { prompt: 0.3, completion: 0.6 },
  'llama3-70b': { prompt: 2.65, completion: 3.5 },
  'llama3:70b': { prompt: 2.65, completion: 3.5 },

  // llama3-x-Nb pattern (base defaults to smallest variant)
  'llama3-1': { prompt: 0.22, completion: 0.22 },
  'llama3-1-8b': { prompt: 0.22, completion: 0.22 },
  'llama3-1-70b': { prompt: 0.72, completion: 0.72 },
  'llama3-1-405b': { prompt: 2.4, completion: 2.4 },
  'llama3-2': { prompt: 0.1, completion: 0.1 },
  'llama3-2-1b': { prompt: 0.1, completion: 0.1 },
  'llama3-2-3b': { prompt: 0.15, completion: 0.15 },
  'llama3-2-11b': { prompt: 0.16, completion: 0.16 },
  'llama3-2-90b': { prompt: 0.72, completion: 0.72 },
  'llama3-3': { prompt: 2.65, completion: 3.5 },
  'llama3-3-70b': { prompt: 2.65, completion: 3.5 },

  // llama3.x:Nb pattern (base defaults to smallest variant)
  'llama3.1': { prompt: 0.22, completion: 0.22 },
  'llama3.1:8b': { prompt: 0.22, completion: 0.22 },
  'llama3.1:70b': { prompt: 0.72, completion: 0.72 },
  'llama3.1:405b': { prompt: 2.4, completion: 2.4 },
  'llama3.2': { prompt: 0.1, completion: 0.1 },
  'llama3.2:1b': { prompt: 0.1, completion: 0.1 },
  'llama3.2:3b': { prompt: 0.15, completion: 0.15 },
  'llama3.2:11b': { prompt: 0.16, completion: 0.16 },
  'llama3.2:90b': { prompt: 0.72, completion: 0.72 },
  'llama3.3': { prompt: 2.65, completion: 3.5 },
  'llama3.3:70b': { prompt: 2.65, completion: 3.5 },

  // llama-3.x-Nb pattern (base defaults to smallest variant)
  'llama-3.1': { prompt: 0.22, completion: 0.22 },
  'llama-3.1-8b': { prompt: 0.22, completion: 0.22 },
  'llama-3.1-70b': { prompt: 0.72, completion: 0.72 },
  'llama-3.1-405b': { prompt: 2.4, completion: 2.4 },
  'llama-3.2': { prompt: 0.1, completion: 0.1 },
  'llama-3.2-1b': { prompt: 0.1, completion: 0.1 },
  'llama-3.2-3b': { prompt: 0.15, completion: 0.15 },
  'llama-3.2-11b': { prompt: 0.16, completion: 0.16 },
  'llama-3.2-90b': { prompt: 0.72, completion: 0.72 },
  'llama-3.3': { prompt: 2.65, completion: 3.5 },
  'llama-3.3-70b': { prompt: 2.65, completion: 3.5 },
  'mistral-7b': { prompt: 0.15, completion: 0.2 },
  'mistral-small': { prompt: 0.15, completion: 0.2 },
  'mixtral-8x7b': { prompt: 0.45, completion: 0.7 },
  'mistral-large-2402': { prompt: 4.0, completion: 12.0 },
  'mistral-large-2407': { prompt: 3.0, completion: 9.0 },
  'command-text': { prompt: 1.5, completion: 2.0 },
  'command-light': { prompt: 0.3, completion: 0.6 },
  // AI21 models
  'j2-mid': { prompt: 12.5, completion: 12.5 },
  'j2-ultra': { prompt: 18.8, completion: 18.8 },
  'jamba-instruct': { prompt: 0.5, completion: 0.7 },
  // Amazon Titan models
  'titan-text-lite': { prompt: 0.15, completion: 0.2 },
  'titan-text-express': { prompt: 0.2, completion: 0.6 },
  'titan-text-premier': { prompt: 0.5, completion: 1.5 },
  // Amazon Nova models
  'nova-micro': { prompt: 0.035, completion: 0.14 },
  'nova-lite': { prompt: 0.06, completion: 0.24 },
  'nova-pro': { prompt: 0.8, completion: 3.2 },
  'nova-premier': { prompt: 2.5, completion: 12.5 },
  'deepseek.r1': { prompt: 1.35, completion: 5.4 },
  // Moonshot/Kimi models on Bedrock
  'moonshot.kimi': { prompt: 0.6, completion: 2.5 },
  'moonshot.kimi-k2': { prompt: 0.6, completion: 2.5 },
  'moonshot.kimi-k2.5': { prompt: 0.6, completion: 3.0 },
  'moonshot.kimi-k2-thinking': { prompt: 0.6, completion: 2.5 },
};

const tokenValues = Object.assign(
  {
    // Generic fallback patterns (check LAST) - skip these generic patterns
    // 'claude-': { prompt: 0.8, completion: 2.4 },
    // deepseek: { prompt: 0.28, completion: 0.42 },
    // command: { prompt: 0.38, completion: 0.38 },
    // gemma: { prompt: 0.02, completion: 0.04 },
    // gemini: { prompt: 0.5, completion: 1.5 },
    // 'gpt-oss': { prompt: 0.05, completion: 0.2 },

    // Specific model variants
    'gpt-3.5-turbo-1106': { prompt: 1, completion: 2 },
    'gpt-3.5-turbo-0125': { prompt: 0.5, completion: 1.5 },
    'gpt-4-1106': { prompt: 10, completion: 30 },
    'gpt-4.1': { prompt: 2, completion: 8 },
    'gpt-4.1-nano': { prompt: 0.1, completion: 0.4 },
    'gpt-4.1-mini': { prompt: 0.4, completion: 1.6 },
    'gpt-4.5': { prompt: 75, completion: 150 },
    'gpt-4o': { prompt: 2.5, completion: 10 },
    'gpt-4o-2024-05-13': { prompt: 5, completion: 15 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
    'gpt-5': { prompt: 1.25, completion: 10 },
    'gpt-5.1': { prompt: 1.25, completion: 10 },
    'gpt-5.2': { prompt: 1.75, completion: 14 },
    'gpt-5-nano': { prompt: 0.05, completion: 0.4 },
    'gpt-5-mini': { prompt: 0.25, completion: 2 },
    'gpt-5-pro': { prompt: 15, completion: 120 },
    o1: { prompt: 15, completion: 60 },
    'o1-mini': { prompt: 1.1, completion: 4.4 },
    'o1-preview': { prompt: 15, completion: 60 },
    o3: { prompt: 2, completion: 8 },
    'o3-mini': { prompt: 1.1, completion: 4.4 },
    'o4-mini': { prompt: 1.1, completion: 4.4 },
    'claude-instant': { prompt: 0.8, completion: 2.4 },
    'claude-2': { prompt: 8, completion: 24 },
    'claude-2.1': { prompt: 8, completion: 24 },
    'claude-3-haiku': { prompt: 0.25, completion: 1.25 },
    'claude-3-sonnet': { prompt: 3, completion: 15 },
    'claude-3-opus': { prompt: 15, completion: 75 },
    'claude-3-5-haiku': { prompt: 0.8, completion: 4 },
    'claude-3.5-haiku': { prompt: 0.8, completion: 4 },
    'claude-3-5-sonnet': { prompt: 3, completion: 15 },
    'claude-3.5-sonnet': { prompt: 3, completion: 15 },
    'claude-3-7-sonnet': { prompt: 3, completion: 15 },
    'claude-3.7-sonnet': { prompt: 3, completion: 15 },
    'claude-haiku-4-5': { prompt: 1, completion: 5 },
    'claude-opus-4': { prompt: 15, completion: 75 },
    'claude-opus-4-5': { prompt: 5, completion: 25 },
    'claude-opus-4-6': { prompt: 5, completion: 25 },
    'claude-sonnet-4': { prompt: 3, completion: 15 },
    'command-r': { prompt: 0.5, completion: 1.5 },
    'command-r-plus': { prompt: 3, completion: 15 },
    'deepseek-chat': { prompt: 0.28, completion: 0.42 },
    'deepseek-reasoner': { prompt: 0.28, completion: 0.42 },
    'deepseek-r1': { prompt: 0.4, completion: 2.0 },
    'deepseek-v3': { prompt: 0.2, completion: 0.8 },
    'gemma-2': { prompt: 0.01, completion: 0.03 },
    'gemma-3': { prompt: 0.02, completion: 0.04 },
    'gemma-3-27b': { prompt: 0.09, completion: 0.16 },
    'gemini-1.5': { prompt: 2.5, completion: 10 },
    'gemini-1.5-flash': { prompt: 0.15, completion: 0.6 },
    'gemini-1.5-flash-8b': { prompt: 0.075, completion: 0.3 },
    'gemini-2.0': { prompt: 0.1, completion: 0.4 },
    'gemini-2.0-flash': { prompt: 0.1, completion: 0.4 },
    'gemini-2.0-flash-lite': { prompt: 0.075, completion: 0.3 },
    'gemini-2.5': { prompt: 0.3, completion: 2.5 },
    'gemini-2.5-flash': { prompt: 0.3, completion: 2.5 },
    'gemini-2.5-flash-lite': { prompt: 0.1, completion: 0.4 },
    'gemini-2.5-pro': { prompt: 1.25, completion: 10 },
    'gemini-2.5-flash-image': { prompt: 0.15, completion: 30 },
    'gemini-3': { prompt: 2, completion: 12 },
    'gemini-3-pro-image': { prompt: 2, completion: 120 },
    'gemini-pro-vision': { prompt: 0.5, completion: 1.5 },
    grok: { prompt: 2.0, completion: 10.0 },
    'grok-beta': { prompt: 5.0, completion: 15.0 },
    'grok-vision-beta': { prompt: 5.0, completion: 15.0 },
    'grok-2': { prompt: 2.0, completion: 10.0 },
    'grok-2-1212': { prompt: 2.0, completion: 10.0 },
    'grok-2-latest': { prompt: 2.0, completion: 10.0 },
    'grok-2-vision': { prompt: 2.0, completion: 10.0 },
    'grok-2-vision-1212': { prompt: 2.0, completion: 10.0 },
    'grok-2-vision-latest': { prompt: 2.0, completion: 10.0 },
    'grok-3': { prompt: 3.0, completion: 15.0 },
    'grok-3-fast': { prompt: 5.0, completion: 25.0 },
    'grok-3-mini': { prompt: 0.3, completion: 0.5 },
    'grok-3-mini-fast': { prompt: 0.6, completion: 4 },
    'grok-4': { prompt: 3.0, completion: 15.0 },
    'grok-4-fast': { prompt: 0.2, completion: 0.5 },
    'grok-4-1-fast': { prompt: 0.2, completion: 0.5 },
    'grok-code-fast': { prompt: 0.2, completion: 1.5 },
    codestral: { prompt: 0.3, completion: 0.9 },
    'ministral-3b': { prompt: 0.04, completion: 0.04 },
    'ministral-8b': { prompt: 0.1, completion: 0.1 },
    'mistral-nemo': { prompt: 0.15, completion: 0.15 },
    'mistral-saba': { prompt: 0.2, completion: 0.6 },
    'pixtral-large': { prompt: 2.0, completion: 6.0 },
    'mistral-large': { prompt: 2.0, completion: 6.0 },
    'mixtral-8x22b': { prompt: 0.65, completion: 0.65 },
    // Moonshot/Kimi models
    kimi: { prompt: 0.6, completion: 2.5 },
    moonshot: { prompt: 2.0, completion: 5.0 },
    'kimi-latest': { prompt: 0.2, completion: 2.0 },
    'kimi-k2': { prompt: 0.6, completion: 2.5 },
    'kimi-k2.5': { prompt: 0.6, completion: 3.0 },
    'kimi-k2-turbo': { prompt: 1.15, completion: 8.0 },
    'kimi-k2-turbo-preview': { prompt: 1.15, completion: 8.0 },
    'kimi-k2-0905': { prompt: 0.6, completion: 2.5 },
    'kimi-k2-0905-preview': { prompt: 0.6, completion: 2.5 },
    'kimi-k2-0711': { prompt: 0.6, completion: 2.5 },
    'kimi-k2-0711-preview': { prompt: 0.6, completion: 2.5 },
    'kimi-k2-thinking': { prompt: 0.6, completion: 2.5 },
    'kimi-k2-thinking-turbo': { prompt: 1.15, completion: 8.0 },
    'moonshot-v1': { prompt: 2.0, completion: 5.0 },
    'moonshot-v1-auto': { prompt: 2.0, completion: 5.0 },
    'moonshot-v1-8k': { prompt: 0.2, completion: 2.0 },
    'moonshot-v1-8k-vision': { prompt: 0.2, completion: 2.0 },
    'moonshot-v1-8k-vision-preview': { prompt: 0.2, completion: 2.0 },
    'moonshot-v1-32k': { prompt: 1.0, completion: 3.0 },
    'moonshot-v1-32k-vision': { prompt: 1.0, completion: 3.0 },
    'moonshot-v1-32k-vision-preview': { prompt: 1.0, completion: 3.0 },
    'moonshot-v1-128k': { prompt: 2.0, completion: 5.0 },
    'moonshot-v1-128k-vision': { prompt: 2.0, completion: 5.0 },
    'moonshot-v1-128k-vision-preview': { prompt: 2.0, completion: 5.0 },
    // GPT-OSS models
    'gpt-oss:20b': { prompt: 0.05, completion: 0.2 },
    'gpt-oss-20b': { prompt: 0.05, completion: 0.2 },
    'gpt-oss:120b': { prompt: 0.15, completion: 0.6 },
    'gpt-oss-120b': { prompt: 0.15, completion: 0.6 },
    // GLM models (Zhipu AI)
    glm4: { prompt: 0.1, completion: 0.1 },
    'glm-4': { prompt: 0.1, completion: 0.1 },
    'glm-4-32b': { prompt: 0.1, completion: 0.1 },
    'glm-4.5': { prompt: 0.35, completion: 1.55 },
    'glm-4.5-air': { prompt: 0.14, completion: 0.86 },
    'glm-4.5v': { prompt: 0.6, completion: 1.8 },
    'glm-4.6': { prompt: 0.5, completion: 1.75 },
    // Qwen models
    qwen: { prompt: 0.08, completion: 0.33 },
    'qwen2.5': { prompt: 0.08, completion: 0.33 },
    'qwen-turbo': { prompt: 0.05, completion: 0.2 },
    'qwen-plus': { prompt: 0.4, completion: 1.2 },
    'qwen-max': { prompt: 1.6, completion: 6.4 },
    'qwq-32b': { prompt: 0.15, completion: 0.4 },
    // Qwen3 models
    qwen3: { prompt: 0.035, completion: 0.138 },
    'qwen3-8b': { prompt: 0.035, completion: 0.138 },
    'qwen3-14b': { prompt: 0.05, completion: 0.22 },
    'qwen3-30b-a3b': { prompt: 0.06, completion: 0.22 },
    'qwen3-32b': { prompt: 0.05, completion: 0.2 },
    'qwen3-235b-a22b': { prompt: 0.08, completion: 0.55 },
    'qwen3-vl-8b-thinking': { prompt: 0.18, completion: 2.1 },
    'qwen3-vl-8b-instruct': { prompt: 0.18, completion: 0.69 },
    'qwen3-vl-30b-a3b': { prompt: 0.29, completion: 1.0 },
    'qwen3-vl-235b-a22b': { prompt: 0.3, completion: 1.2 },
    'qwen3-max': { prompt: 1.2, completion: 6 },
    'qwen3-coder': { prompt: 0.22, completion: 0.95 },
    'qwen3-coder-30b-a3b': { prompt: 0.06, completion: 0.25 },
    'qwen3-coder-plus': { prompt: 1, completion: 5 },
    'qwen3-coder-flash': { prompt: 0.3, completion: 1.5 },
    'qwen3-next-80b-a3b': { prompt: 0.1, completion: 0.8 },
  },
  bedrockValues,
);

// Premium (long context) pricing
const premiumTokenValues = {
  'claude-opus-4-6': { threshold: 200000, prompt: 10, completion: 37.5 },
};

// Provider mapping based on model name patterns
const providerMapping = {
  'gpt-': 'openai',
  'o1': 'openai',
  'o3': 'openai',
  'o4': 'openai',
  'claude-': 'anthropic',
  'gemini-': 'google',
  'gemma-': 'google',
  'grok': 'xai',
  'mistral': 'mistral',
  'mixtral': 'mistral',
  'codestral': 'mistral',
  'ministral': 'mistral',
  'pixtral': 'mistral',
  'deepseek': 'deepseek',
  'kimi': 'moonshot',
  'moonshot': 'moonshot',
  'command': 'cohere',
  'qwen': 'alibaba',
  'qwq': 'alibaba',
  'glm': 'zhipu',
  'llama': 'meta',
  'nova-': 'aws',
  'titan-': 'aws',
  'j2-': 'ai21',
  'jamba': 'ai21',
  'gpt-oss': 'openai-compatible',
};

function inferProvider(modelPattern) {
  for (const [pattern, provider] of Object.entries(providerMapping)) {
    if (modelPattern.includes(pattern)) {
      return provider;
    }
  }
  return 'other';
}

async function seedTokenPricing() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');
  const isClear = args.includes('--clear');

  console.log('='.repeat(80));
  console.log('Token Pricing Seeding Script');
  console.log('='.repeat(80));
  if (isDryRun) {
    console.log('[DRY RUN MODE] No changes will be made to the database\n');
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
    console.log(`Connecting to MongoDB: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');

    // Load models
    const { TokenPricing } = require('~/db/models');
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');

    // Clear existing records if requested
    if (isClear && !isDryRun) {
      const deleteResult = await TokenPricing.deleteMany({});
      console.log(`✓ Cleared ${deleteResult.deletedCount} existing records\n`);
    }

    // Prepare records to insert
    const records = [];

    for (const [modelPattern, rates] of Object.entries(tokenValues)) {
      // Skip generic patterns and legacy token size mappings
      if (['8k', '32k', '4k', '16k'].includes(modelPattern)) {
        continue;
      }

      const provider = inferProvider(modelPattern);
      const premium = premiumTokenValues[modelPattern];

      const record = {
        modelPattern,
        provider,
        inputRate: rates.prompt,
        outputRate: rates.completion,
        isActive: true,
      };

      // Add long context pricing if available
      if (premium) {
        record.longContextThreshold = premium.threshold;
        record.longContextInputRate = premium.prompt;
        record.longContextOutputRate = premium.completion;
      }

      records.push(record);
    }

    // Sort records by provider then model name for organized output
    records.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.modelPattern.localeCompare(b.modelPattern);
    });

    console.log(`Prepared ${records.length} pricing records\n`);

    // Statistics
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('Processing records...\n');

    for (const record of records) {
      try {
        const existing = await TokenPricing.findOne({ modelPattern: record.modelPattern });

        if (existing) {
          if (isForce && !isDryRun) {
            await TokenPricing.findByIdAndUpdate(existing._id, record);
            updated++;
            console.log(`  ↻ Updated: ${record.modelPattern} (${record.provider})`);
          } else {
            skipped++;
            if (isDryRun) {
              console.log(`  - Skip: ${record.modelPattern} (${record.provider}) - already exists`);
            }
          }
        } else {
          if (!isDryRun) {
            await TokenPricing.create(record);
          }
          inserted++;
          const longCtx = record.longContextThreshold ? ' [Long Context]' : '';
          console.log(`  ✓ ${isDryRun ? 'Would insert' : 'Inserted'}: ${record.modelPattern} (${record.provider})${longCtx}`);
        }
      } catch (error) {
        errors++;
        console.error(`  ✗ Error: ${record.modelPattern} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log('='.repeat(80));
    console.log(`Total records:    ${records.length}`);
    console.log(`Inserted:         ${inserted}`);
    console.log(`Updated:          ${updated}`);
    console.log(`Skipped:          ${skipped}`);
    console.log(`Errors:           ${errors}`);
    console.log('='.repeat(80));

    if (!isDryRun && (inserted > 0 || updated > 0)) {
      console.log('\nInvalidating and reloading cache...');
      tokenPricingCache.invalidate();
      await tokenPricingCache.load();
      console.log('✓ Cache reloaded\n');
    }

    if (isDryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
    } else if (skipped > 0 && !isForce) {
      console.log('\n💡 To update existing records, run with --force flag.');
    }

  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  seedTokenPricing()
    .then(() => {
      console.log('\n✓ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedTokenPricing;
